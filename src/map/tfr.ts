/**
 * Temporary Flight Restriction (TFR) volume.
 *
 *  - In 3D: a translucent vertical prism extruded from sea level up to
 *    TFR.ceilingFt MSL, sharing the AircraftLayer's matrix conventions
 *    (scene-local meters, y=up, scene origin at scenario center).
 *    Implemented as a MapLibre CustomLayer that renders its own three.js
 *    scene; could be merged into AircraftLayer's scene for one fewer GL
 *    state switch, but keeping it separate makes the code easier to reason
 *    about and keeps the TFR independently toggleable later.
 *
 *  - In 2D logic: isInsideTfr(lng, lat) — ray-cast point-in-polygon over
 *    the same coordinates the 3D mesh is built from. Used by the side
 *    panel (slice 9) to label each aircraft IN/OUT.
 *
 * Simplifying assumption (called out in README): TFR footprint == fire
 * perimeter polygon. Real wildfire TFRs are typically circular around a
 * point with buffer mileage; substitute that here without changing the
 * rendering path if we want.
 */

import * as THREE from 'three';
import maplibregl, {
	type CustomLayerInterface,
	type CustomRenderMethodInput,
	type Map as MapLibreMap,
} from 'maplibre-gl';
import { SCENARIO_CENTER, TFR } from '../config';
import { FIRE_PERIMETER } from './firePerimeterLayer';

const SCENE_ORIGIN_LON = SCENARIO_CENTER[0];
const SCENE_ORIGIN_LAT = SCENARIO_CENTER[1];

function metersPerDegLat(): number {
	return 111_320;
}

function metersPerDegLon(lat: number): number {
	return 111_320 * Math.cos((lat * Math.PI) / 180);
}

/** Outer ring of the TFR footprint, lng/lat. */
function tfrRingLngLat(): readonly [number, number][] {
	const ring = FIRE_PERIMETER.geometry.coordinates[0] as [number, number][];
	// Polygon rings are closed (first == last); drop the duplicate for our
	// extrude shape since THREE.Shape closes implicitly.
	const last = ring.length - 1;
	const closed =
		ring[0][0] === ring[last][0] && ring[0][1] === ring[last][1];
	return closed ? ring.slice(0, last) : ring;
}

/** Ring projected to scene-local (east, north) meters. */
function ringInSceneMeters(): { x: number; y: number }[] {
	const mPerDegLat = metersPerDegLat();
	const mPerDegLon = metersPerDegLon(SCENE_ORIGIN_LAT);
	return tfrRingLngLat().map(([lon, lat]) => ({
		x: (lon - SCENE_ORIGIN_LON) * mPerDegLon,
		y: (lat - SCENE_ORIGIN_LAT) * mPerDegLat,
	}));
}

/**
 * Point-in-polygon via ray casting on the lng/lat ring. Cheap and good
 * enough at the scale of one fire's polygon.
 */
export function isInsideTfr(lng: number, lat: number): boolean {
	const ring = tfrRingLngLat();
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [xi, yi] = ring[i];
		const [xj, yj] = ring[j];
		const intersects =
			yi > lat !== yj > lat &&
			lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
		if (intersects) inside = !inside;
	}
	return inside;
}

function buildTfrMesh(): THREE.Mesh {
	const ringMeters = ringInSceneMeters();

	const shape = new THREE.Shape();
	shape.moveTo(ringMeters[0].x, ringMeters[0].y);
	for (let i = 1; i < ringMeters.length; i++) {
		shape.lineTo(ringMeters[i].x, ringMeters[i].y);
	}
	shape.lineTo(ringMeters[0].x, ringMeters[0].y);

	const ceilingMeters = TFR.ceilingMeters;
	const geometry = new THREE.ExtrudeGeometry(shape, {
		depth: ceilingMeters,
		bevelEnabled: false,
		curveSegments: 1,
	});
	// ExtrudeGeometry extrudes along +Z by default. We want the extrusion to
	// go UP in scene-local +Y. The Shape lives in (x, y) of its local frame
	// where y == north in our convention; after extrude, +Z is "up" of the
	// shape's plane. Rotate so that the shape's Z becomes the scene's Y.
	geometry.rotateX(-Math.PI / 2);

	const material = new THREE.MeshBasicMaterial({
		color: 0xff7a3b,
		transparent: true,
		opacity: 0.08,
		side: THREE.DoubleSide,
		depthWrite: false,
	});

	const mesh = new THREE.Mesh(geometry, material);

	// Add a brighter outline as a separate object so the boundary at the
	// ceiling is legible — extrude geometry alone is too washed-out at
	// low opacity to read against terrain.
	const topRingPoints = ringMeters.map(
		(p) => new THREE.Vector3(p.x, ceilingMeters, p.y),
	);
	topRingPoints.push(topRingPoints[0]);
	const topRingGeom = new THREE.BufferGeometry().setFromPoints(topRingPoints);
	const topRingMat = new THREE.LineBasicMaterial({
		color: 0xff7a3b,
		transparent: true,
		opacity: 0.55,
		depthWrite: false,
	});
	const topRing = new THREE.Line(topRingGeom, topRingMat);
	mesh.add(topRing);

	return mesh;
}

interface TfrLayerState {
	scene: THREE.Scene;
	camera: THREE.Camera;
	renderer: THREE.WebGLRenderer;
	mesh: THREE.Mesh;
	originMercator: maplibregl.MercatorCoordinate;
	metersToMerc: number;
	map: MapLibreMap;
}

export function createTfrLayer(): CustomLayerInterface {
	let state: TfrLayerState | null = null;

	return {
		id: 'tfr-volume',
		type: 'custom',
		renderingMode: '3d',

		onAdd(map, gl) {
			const scene = new THREE.Scene();
			scene.rotateX(Math.PI / 2);
			scene.scale.multiply(new THREE.Vector3(1, 1, -1));

			const camera = new THREE.Camera();
			const mesh = buildTfrMesh();
			scene.add(mesh);

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

			state = { scene, camera, renderer, mesh, originMercator, metersToMerc, map };
		},

		render(_gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput) {
			if (!state) return;
			const mc = state.originMercator;
			const s = state.metersToMerc;
			const projection = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix);
			const sceneTransform = new THREE.Matrix4()
				.makeTranslation(mc.x, mc.y, mc.z)
				.scale(new THREE.Vector3(s, -s, s));

			state.camera.projectionMatrix = projection.multiply(sceneTransform);

			state.renderer.resetState();
			state.renderer.render(state.scene, state.camera);
		},

		onRemove() {
			if (state) {
				state.mesh.geometry.dispose();
				const mat = state.mesh.material;
				if (Array.isArray(mat)) {
					for (const m of mat) m.dispose();
				} else {
					mat.dispose();
				}
				state.renderer.dispose();
				state = null;
			}
		},
	};
}
