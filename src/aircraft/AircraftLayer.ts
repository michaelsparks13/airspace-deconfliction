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
import { SCENARIO_CENTER } from '../config';
import type { Aircraft } from '../data/types';
import { buildAircraftMesh } from './models';
import {
	AGL_COLORS,
	aglBandFor,
	buildGroundStem,
	buildHaloRing,
	setHaloColor,
	type GroundStem,
} from './visuals';

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
}

function makeSlot(aircraft: Aircraft, scene: THREE.Scene): AircraftSlot {
	const root = new THREE.Group();
	const mesh = buildAircraftMesh(aircraft.category);
	const halo = buildHaloRing();
	const stem = buildGroundStem(aircraft.crew);
	root.add(mesh, halo, stem.object);
	scene.add(root);
	return { root, mesh, halo, stem, lastAgl: null };
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
			};
		},

		render(_gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput) {
			if (!state) return;
			const aircraft = getAircraft();
			const seen = new Set<string>();

			// --- Add / update each aircraft -----------------------------------
			for (const a of aircraft) {
				seen.add(a.id);
				let slot = state.slots.get(a.id);
				if (!slot) {
					slot = makeSlot(a, state.scene);
					state.slots.set(a.id, slot);
				}

				const [east, north] = eastNorthMetersFromOrigin(a.lon, a.lat);

				// Aircraft root sits at (east, altitude_msl, north). The mesh
				// inside is modeled nose along +X; rotate around Y to true_track.
				slot.root.position.set(east, a.altitudeMslMeters, north);
				slot.mesh.rotation.y = -degToRad(a.trueTrackDeg - 90);

				// Halo lives at the aircraft's altitude, centered on it. Mesh
				// position is the same as the root, so the halo is local-origin
				// at the group — already in place.

				// AGL via queryTerrainElevation. May be null before terrain
				// tiles arrive — keep last known to avoid color flicker.
				const groundMsl = state.map.queryTerrainElevation([a.lon, a.lat]);
				const agl =
					groundMsl === null || groundMsl === undefined
						? slot.lastAgl
						: a.altitudeMslMeters - groundMsl;
				slot.lastAgl = agl;

				const band = aglBandFor(agl);
				const hex = AGL_COLORS[band];
				setHaloColor(slot.halo, band);
				slot.stem.setColor(hex);

				// Stem: from the GROUND (at terrain elevation) up to the
				// aircraft. The stem's geometry is anchored at the root's
				// position, so its base needs to be at -altitudeMsl + groundMsl
				// = -AGL. We model the line as (0, 0) -> (0, AGL) and then
				// shift the line down by AGL so the top lands at the root.
				if (agl !== null && agl !== undefined) {
					slot.stem.object.position.y = -agl;
					slot.stem.setHeight(agl);
				} else {
					// No terrain yet — hide the stem rather than draw a wrong-length one.
					slot.stem.object.visible = false;
					continue;
				}
				slot.stem.object.visible = true;
			}

			// --- Remove slots that no longer have a corresponding aircraft ----
			for (const [id, slot] of state.slots) {
				if (!seen.has(id)) {
					disposeSlot(slot, state.scene);
					state.slots.delete(id);
				}
			}

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
