/**
 * Fire Traffic Area volume.
 *
 *  - 12 NM ICOM ring (the FTA communications boundary) rendered as a thin
 *    line at ground.
 *  - Operational zones (drop zone, convective column, dip site) rendered as
 *    translucent vertical cylinders, color-coded by kind. The convective
 *    column is the no-fly core and reads brightest.
 *
 * Modeled on src/map/tfr.ts: a MapLibre CustomLayer running its own three.js
 * scene with the canonical scene-local-meters / y-up / origin-at-scenario-
 * center convention used everywhere else in this codebase.
 */

import * as THREE from 'three';
import maplibregl, {
	type CustomLayerInterface,
	type CustomRenderMethodInput,
	type Map as MapLibreMap,
} from 'maplibre-gl';
import { SCENARIO_CENTER } from '../config';
import { SCENARIO_FTA, type OperationalZone } from '../fta';

const SCENE_ORIGIN_LON = SCENARIO_CENTER[0];
const SCENE_ORIGIN_LAT = SCENARIO_CENTER[1];

function metersPerDegLat(): number {
	return 111_320;
}

function metersPerDegLon(lat: number): number {
	return 111_320 * Math.cos((lat * Math.PI) / 180);
}

function sceneXY(lon: number, lat: number): { x: number; y: number } {
	return {
		x: (lon - SCENE_ORIGIN_LON) * metersPerDegLon(SCENE_ORIGIN_LAT),
		y: (lat - SCENE_ORIGIN_LAT) * metersPerDegLat(),
	};
}

const ICOM_COLOR = 0x6fb8ff;
const ICOM_OPACITY = 0.55;
const ICOM_SEGMENTS = 128;

const ZONE_STYLES: Record<OperationalZone['kind'], { color: number; opacity: number }> = {
	'drop-zone':         { color: 0xffb938, opacity: 0.18 },
	'convective-column': { color: 0xff3b3b, opacity: 0.22 },
	'dip-site':          { color: 0x6fb8ff, opacity: 0.18 },
};

/** Renders the 12 NM ICOM ring as a thin ground-level circle. */
function buildIcomRing(): THREE.Line {
	const { centerLat, centerLon, icomRingRadiusMeters } = SCENARIO_FTA;
	const center = sceneXY(centerLon, centerLat);
	const points: THREE.Vector3[] = [];
	for (let i = 0; i <= ICOM_SEGMENTS; i++) {
		const a = (i / ICOM_SEGMENTS) * Math.PI * 2;
		const x = center.x + Math.cos(a) * icomRingRadiusMeters;
		const y = center.y + Math.sin(a) * icomRingRadiusMeters;
		// y in scene = north, so position the ring on the ground (alt=0).
		points.push(new THREE.Vector3(x, 0, y));
	}
	const geom = new THREE.BufferGeometry().setFromPoints(points);
	const mat = new THREE.LineBasicMaterial({
		color: ICOM_COLOR,
		transparent: true,
		opacity: ICOM_OPACITY,
		depthWrite: false,
	});
	return new THREE.Line(geom, mat);
}

/**
 * One operational zone -> a translucent vertical cylinder.
 *
 * For unbounded ceilings (the convective column) we render a tall finite
 * cylinder — taller than any plausible aircraft AGL — so the operator reads
 * it as "no-fly all the way up" without dealing with infinite geometry.
 */
function buildZoneCylinder(zone: OperationalZone): THREE.Mesh {
	const center = sceneXY(zone.centerLon, zone.centerLat);
	const ceilAgl = zone.ceilAglMeters ?? 3000; // unbounded -> tall but finite
	const heightMeters = ceilAgl - zone.floorAglMeters;
	const radialSegments = 48;
	const geom = new THREE.CylinderGeometry(
		zone.radiusMeters,
		zone.radiusMeters,
		heightMeters,
		radialSegments,
		1,
		true,         // openEnded — no top/bottom caps; reads as a volume not a can
	);
	// CylinderGeometry centers on origin with axis along +Y. Move so the base
	// sits at floorAgl and the cylinder rises to ceilAgl.
	geom.translate(0, zone.floorAglMeters + heightMeters / 2, 0);

	const style = ZONE_STYLES[zone.kind];
	const mat = new THREE.MeshBasicMaterial({
		color: style.color,
		transparent: true,
		opacity: style.opacity,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geom, mat);
	mesh.position.set(center.x, 0, center.y);
	return mesh;
}

interface FtaLayerState {
	scene: THREE.Scene;
	camera: THREE.Camera;
	renderer: THREE.WebGLRenderer;
	disposables: { geometry: THREE.BufferGeometry; material: THREE.Material }[];
	originMercator: maplibregl.MercatorCoordinate;
	metersToMerc: number;
	map: MapLibreMap;
}

export function createFtaLayer(): CustomLayerInterface {
	let state: FtaLayerState | null = null;

	return {
		id: 'fta-volume',
		type: 'custom',
		renderingMode: '3d',

		onAdd(map, gl) {
			const scene = new THREE.Scene();
			scene.rotateX(Math.PI / 2);
			scene.scale.multiply(new THREE.Vector3(1, 1, -1));

			const camera = new THREE.Camera();
			const disposables: FtaLayerState['disposables'] = [];

			const icom = buildIcomRing();
			scene.add(icom);
			disposables.push({
				geometry: icom.geometry,
				material: icom.material as THREE.Material,
			});

			for (const zone of SCENARIO_FTA.zones) {
				const mesh = buildZoneCylinder(zone);
				scene.add(mesh);
				disposables.push({
					geometry: mesh.geometry,
					material: mesh.material as THREE.Material,
				});
			}

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
				disposables,
				originMercator,
				metersToMerc,
				map,
			};
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
				for (const d of state.disposables) {
					d.geometry.dispose();
					d.material.dispose();
				}
				state.renderer.dispose();
				state = null;
			}
		},
	};
}
