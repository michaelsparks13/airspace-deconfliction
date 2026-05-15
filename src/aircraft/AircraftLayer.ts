/**
 * three.js CustomLayer that renders the active aircraft fleet above 3D
 * terrain at real MSL altitudes.
 *
 * Matrix math (canonical MapLibre 3D-model-on-terrain pattern):
 *
 *  - SCENE ORIGIN is the scenario center at altitude 0. Its MercatorCoordinate
 *    + meterInMercatorCoordinateUnits() give us the translate + scale that
 *    composes with MapLibre's projection matrix to map a scene-local frame
 *    in real meters (east, up, north) into clip space.
 *  - Per aircraft we maintain a THREE.Group at a position computed in
 *    east/north meters from the scene origin, with altitude as Y (up).
 *  - Heading rotates the group around its local Y axis.
 *
 *  AGL = altitudeMSL - queryTerrainElevation(lng, lat).
 *  queryTerrainElevation returns null until terrain tiles load — when null
 *  we keep the previous AGL (per-aircraft cache) so the halo color doesn't
 *  flicker grey during pan/zoom.
 */

import * as THREE from 'three';
import maplibregl, {
	type CustomLayerInterface,
	type CustomRenderMethodInput,
	type Map as MapLibreMap,
} from 'maplibre-gl';
import {
	AIRCRAFT_REFERENCE_MESH_SCALE,
	AIRCRAFT_REFERENCE_ZOOM,
	SCENARIO_CENTER,
} from '../config';
import type { Aircraft } from '../data/types';
import type { ConflictPair } from '../deconfliction';
import { buildAircraftMesh } from './models';
import {
	AGL_COLORS,
	aglBandFor,
	buildGroundStem,
	buildHaloRing,
	buildOutlineRing,
	setHaloColor,
	type GroundStem,
} from './visuals';

/** Conflict halo override. Distinct from the AGL red so the two read differently. */
const CONFLICT_COLOR_HEX = 0xff3b3b;
const CONFLICT_LINE_COLOR_HEX = 0xff3b3b;
/** Halo opacity range while pulsing. */
const CONFLICT_PULSE_MIN = 0.35;
const CONFLICT_PULSE_MAX = 0.95;
/** Pulse frequency in Hz. */
const CONFLICT_PULSE_HZ = 1.4;

const SCENE_ORIGIN_LON = SCENARIO_CENTER[0];
const SCENE_ORIGIN_LAT = SCENARIO_CENTER[1];

function degToRad(d: number): number {
	return (d * Math.PI) / 180;
}

function metersPerDegLat(): number {
	return 111_320;
}

function metersPerDegLon(lat: number): number {
	return 111_320 * Math.cos(degToRad(lat));
}

function eastNorthMetersFromOrigin(lng: number, lat: number): [number, number] {
	const east = (lng - SCENE_ORIGIN_LON) * metersPerDegLon(SCENE_ORIGIN_LAT);
	const north = (lat - SCENE_ORIGIN_LAT) * metersPerDegLat();
	return [east, north];
}

interface AircraftSlot {
	root: THREE.Group;
	mesh: THREE.Group;
	halo: THREE.Mesh;
	outline: THREE.LineLoop;
	stem: GroundStem;
	lastAgl: number | null;
}

interface LayerState {
	scene: THREE.Scene;
	camera: THREE.Camera;
	renderer: THREE.WebGLRenderer;
	slots: Map<string, AircraftSlot>;
	originMercator: maplibregl.MercatorCoordinate;
	metersToMerc: number;
	map: MapLibreMap;
	/** One segments object rebuilt each frame from current conflict pairs. */
	conflictLines: THREE.LineSegments;
	/** Pre-allocated position buffer; size chosen to comfortably exceed real-world pair counts. */
	conflictLinePositions: Float32Array;
}

const MAX_CONFLICT_PAIRS = 32;

function makeSlot(aircraft: Aircraft, scene: THREE.Scene): AircraftSlot {
	const root = new THREE.Group();
	const mesh = buildAircraftMesh(aircraft.category);
	const halo = buildHaloRing();
	const outline = buildOutlineRing();
	const stem = buildGroundStem(aircraft.crew);
	root.add(mesh, halo, outline, stem.object);
	scene.add(root);
	return { root, mesh, halo, outline, stem, lastAgl: null };
}

/**
 * Mesh scale that keeps the on-screen silhouette roughly constant as the
 * user zooms in and out. 2^(refZoom - currentZoom) doubles the mesh size
 * for every zoom level out — so a value of 9 at zoom 13 becomes ~144 at
 * zoom 9 — matching how MapLibre's projection makes the same real-world
 * distance shrink on screen.
 */
function meshScaleForZoom(zoom: number): number {
	return AIRCRAFT_REFERENCE_MESH_SCALE * Math.pow(2, AIRCRAFT_REFERENCE_ZOOM - zoom);
}

function disposeSlot(slot: AircraftSlot, scene: THREE.Scene): void {
	scene.remove(slot.root);
	slot.root.traverse((obj) => {
		if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
			obj.geometry?.dispose();
			const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
			for (const m of mats) m?.dispose();
		}
	});
}

export function createAircraftLayer(
	getAircraft: () => readonly Aircraft[],
	getConflicts: () => readonly ConflictPair[] = () => [],
): CustomLayerInterface {
	let state: LayerState | null = null;

	return {
		id: 'aircraft',
		type: 'custom',
		renderingMode: '3d',

		onAdd(map, gl) {
			const scene = new THREE.Scene();
			// Align scene-local axes with MapLibre's Mercator frame:
			//   scene +X = east, scene +Y = up, scene +Z = north.
			// This is the canonical MapLibre `add-a-3d-model-on-terrain` pattern.
			// Setting positions as (east, up, north) in scene-local and rotating
			// meshes around their local Y then corresponds to true heading rotation.
			scene.rotateX(Math.PI / 2);
			scene.scale.multiply(new THREE.Vector3(1, 1, -1));

			const camera = new THREE.Camera();

			const sun = new THREE.DirectionalLight(0xffffff, 1.4);
			sun.position.set(0.4, 1, 0.6).normalize();
			scene.add(sun);
			scene.add(new THREE.AmbientLight(0xffffff, 0.35));

			const renderer = new THREE.WebGLRenderer({
				canvas: map.getCanvas(),
				context: gl,
				antialias: true,
			});
			renderer.autoClear = false;

			// One LineSegments object whose vertex buffer is rewritten each frame
			// from active conflict pairs. setDrawRange controls how many of the
			// pre-allocated vertices are actually drawn.
			const conflictLinePositions = new Float32Array(MAX_CONFLICT_PAIRS * 2 * 3);
			const conflictGeom = new THREE.BufferGeometry();
			conflictGeom.setAttribute(
				'position',
				new THREE.BufferAttribute(conflictLinePositions, 3),
			);
			const conflictMat = new THREE.LineDashedMaterial({
				color: CONFLICT_LINE_COLOR_HEX,
				dashSize: 60,
				gapSize: 35,
				transparent: true,
				opacity: 0.9,
				depthWrite: false,
				linewidth: 2,
			});
			const conflictLines = new THREE.LineSegments(conflictGeom, conflictMat);
			conflictLines.frustumCulled = false;
			scene.add(conflictLines);

			const originMercator = maplibregl.MercatorCoordinate.fromLngLat(
				[SCENE_ORIGIN_LON, SCENE_ORIGIN_LAT],
				0,
			);
			const metersToMerc = originMercator.meterInMercatorCoordinateUnits();

			state = {
				scene,
				camera,
				renderer,
				slots: new Map(),
				originMercator,
				metersToMerc,
				map,
				conflictLines,
				conflictLinePositions,
			};
		},

		render(_gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput) {
			if (!state) return;
			const aircraft = getAircraft();
			const conflicts = getConflicts();
			const conflictIds = new Set<string>();
			for (const c of conflicts) {
				conflictIds.add(c.aId);
				conflictIds.add(c.bId);
			}

			// Pulse phase from wall clock so independent layers can stay in sync.
			const tSec = performance.now() / 1000;
			const pulse =
				CONFLICT_PULSE_MIN +
				(CONFLICT_PULSE_MAX - CONFLICT_PULSE_MIN) *
					(0.5 + 0.5 * Math.sin(2 * Math.PI * CONFLICT_PULSE_HZ * tSec));

			const seen = new Set<string>();
			// Cache east/north per id this frame to avoid recomputing for the
			// conflict-line geometry pass below.
			const positions = new Map<string, { east: number; north: number; alt: number }>();

			// Zoom-relative mesh scale: keep silhouettes roughly constant size on
			// screen as the user zooms in and out.
			const meshScale = meshScaleForZoom(state.map.getZoom());

			// --- Add / update each aircraft -----------------------------------
			for (const a of aircraft) {
				seen.add(a.id);
				let slot = state.slots.get(a.id);
				if (!slot) {
					slot = makeSlot(a, state.scene);
					state.slots.set(a.id, slot);
				}

				const [east, north] = eastNorthMetersFromOrigin(a.lon, a.lat);
				positions.set(a.id, { east, north, alt: a.altitudeMslMeters });

				// Aircraft root sits at (east, altitude_msl, north). The mesh
				// inside is modeled nose along +X; rotate around Y to true_track.
				slot.root.position.set(east, a.altitudeMslMeters, north);
				slot.mesh.rotation.y = -degToRad(a.trueTrackDeg - 90);
				slot.mesh.scale.setScalar(meshScale);

				// AGL via queryTerrainElevation. May be null before terrain
				// tiles arrive — keep last known to avoid color flicker.
				const groundMsl = state.map.queryTerrainElevation([a.lon, a.lat]);
				const agl =
					groundMsl === null || groundMsl === undefined
						? slot.lastAgl
						: a.altitudeMslMeters - groundMsl;
				slot.lastAgl = agl;

				const inConflict = conflictIds.has(a.id);
				const haloMat = slot.halo.material as THREE.MeshBasicMaterial;

				if (inConflict) {
					// Conflict override: pulse a distinct red, ignoring AGL band.
					haloMat.color.setHex(CONFLICT_COLOR_HEX);
					haloMat.opacity = pulse;
					slot.stem.setColor(CONFLICT_COLOR_HEX);
					(slot.outline.material as THREE.LineBasicMaterial).color.setHex(CONFLICT_COLOR_HEX);
					(slot.outline.material as THREE.LineBasicMaterial).opacity = 0.95;
				} else {
					const band = aglBandFor(agl);
					setHaloColor(slot.halo, band);
					haloMat.opacity = 0.4;
					slot.stem.setColor(AGL_COLORS[band]);
					(slot.outline.material as THREE.LineBasicMaterial).color.setHex(0xffffff);
					(slot.outline.material as THREE.LineBasicMaterial).opacity = 0.9;
				}

				// Stem: from the GROUND (at terrain elevation) up to the
				// aircraft. Anchored at the root's position; base is at -AGL.
				if (agl !== null && agl !== undefined) {
					slot.stem.object.position.y = -agl;
					slot.stem.setHeight(agl);
					slot.stem.object.visible = true;
				} else {
					slot.stem.object.visible = false;
				}
			}

			// --- Remove slots that no longer have a corresponding aircraft ----
			for (const [id, slot] of state.slots) {
				if (!seen.has(id)) {
					disposeSlot(slot, state.scene);
					state.slots.delete(id);
				}
			}

			// --- Conflict lines: connect each pair in 3D space ----------------
			const buf = state.conflictLinePositions;
			let pairCount = 0;
			for (const c of conflicts) {
				if (pairCount >= MAX_CONFLICT_PAIRS) break;
				const pa = positions.get(c.aId);
				const pb = positions.get(c.bId);
				if (!pa || !pb) continue;
				const o = pairCount * 6;
				buf[o + 0] = pa.east;
				buf[o + 1] = pa.alt;
				buf[o + 2] = pa.north;
				buf[o + 3] = pb.east;
				buf[o + 4] = pb.alt;
				buf[o + 5] = pb.north;
				pairCount++;
			}
			const posAttr = state.conflictLines.geometry.getAttribute(
				'position',
			) as THREE.BufferAttribute;
			posAttr.needsUpdate = true;
			state.conflictLines.geometry.setDrawRange(0, pairCount * 2);
			state.conflictLines.computeLineDistances();
			state.conflictLines.visible = pairCount > 0;

			// --- Compose the projection matrix --------------------------------
			const mc = state.originMercator;
			const s = state.metersToMerc;
			const projection = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix);
			const sceneTransform = new THREE.Matrix4()
				.makeTranslation(mc.x, mc.y, mc.z)
				.scale(new THREE.Vector3(s, -s, s));

			state.camera.projectionMatrix = projection.multiply(sceneTransform);

			state.renderer.resetState();
			state.renderer.render(state.scene, state.camera);
			state.map.triggerRepaint();
		},

		onRemove() {
			if (state) {
				for (const slot of state.slots.values()) disposeSlot(slot, state.scene);
				state.slots.clear();
				state.renderer.dispose();
				state = null;
			}
		},
	};
}
