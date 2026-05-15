/**
 * three.js CustomLayer that renders aircraft above 3D terrain at their real
 * MSL altitudes.
 *
 * The math (canonical MapLibre 3D-model-on-terrain pattern):
 *
 *  - Pick a SCENE ORIGIN in lng/lat at altitude 0 (we use the scenario center).
 *  - Convert that origin to a MercatorCoordinate. Its (x, y, z) are the scene's
 *    place in Mercator space; its meterInMercatorCoordinateUnits() gives the
 *    scale that maps real-world meters to Mercator units AT that latitude.
 *  - The camera's projection matrix is the MapLibre projection matrix
 *    composed with a translate(scene-origin) · scale(metersToMerc) · mirror(Z)
 *    so the scene's local frame ends up as (east, up, north) in real meters.
 *  - Each aircraft is then placed in scene-local meters: east/north offsets
 *    from the origin, and Y = MSL altitude. Heading rotates around the
 *    vertical axis.
 *
 * Slice 3 hardcodes one helo. Slice 4 swaps in a fleet via the dataProvider.
 */

import * as THREE from 'three';
import maplibregl, {
	type CustomLayerInterface,
	type CustomRenderMethodInput,
	type Map as MapLibreMap,
} from 'maplibre-gl';
import { SCENARIO_CENTER } from '../config';

const SCENE_ORIGIN_LON = SCENARIO_CENTER[0];
const SCENE_ORIGIN_LAT = SCENARIO_CENTER[1];

// Hardcoded aircraft for Slice 3. Sits just east of Telluride, 2,750 m MSL
// (~9,022 ft) — should be visibly above the ridges, below the high peaks.
const STATIC_HELO = {
	lng: -107.81,
	lat: 37.84,
	altitudeMeters: 2750,
	headingDeg: 110,
};

function degToRad(d: number): number {
	return (d * Math.PI) / 180;
}

/**
 * Approx meters-per-degree at a given latitude. Good enough at the scale
 * of a single fire (<100 km across); we're not navigating, just placing
 * meshes in a local tangent plane.
 */
function metersPerDegLat(): number {
	return 111_320; // mean value; varies by 1% across latitudes, irrelevant here.
}

function metersPerDegLon(lat: number): number {
	return 111_320 * Math.cos(degToRad(lat));
}

function eastNorthMetersFromOrigin(lng: number, lat: number): [number, number] {
	const east = (lng - SCENE_ORIGIN_LON) * metersPerDegLon(SCENE_ORIGIN_LAT);
	const north = (lat - SCENE_ORIGIN_LAT) * metersPerDegLat();
	return [east, north];
}

/** Build a low-poly procedural helicopter ~16 m long. */
function buildHelo(): THREE.Group {
	const group = new THREE.Group();

	const bodyMat = new THREE.MeshStandardMaterial({
		color: 0xcfd4dc,
		metalness: 0.4,
		roughness: 0.55,
	});
	const accentMat = new THREE.MeshStandardMaterial({
		color: 0x8a93a3,
		metalness: 0.5,
		roughness: 0.45,
	});
	const discMat = new THREE.MeshStandardMaterial({
		color: 0x9aa3b2,
		transparent: true,
		opacity: 0.25,
		side: THREE.DoubleSide,
	});

	// Fuselage: stretched along east-west by default (heading 90°). We'll rotate
	// the whole group at render time to point along true_track.
	const fuselage = new THREE.Mesh(new THREE.BoxGeometry(9, 3, 3.5), bodyMat);
	fuselage.position.y = 1.75;
	group.add(fuselage);

	// Tail boom
	const tailBoom = new THREE.Mesh(new THREE.BoxGeometry(7, 1.0, 1.0), accentMat);
	tailBoom.position.set(-6.5, 2.0, 0);
	group.add(tailBoom);

	// Vertical tail fin
	const tailFin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 0.3), accentMat);
	tailFin.position.set(-9.5, 2.6, 0);
	group.add(tailFin);

	// Main rotor disc
	const rotor = new THREE.Mesh(new THREE.CircleGeometry(7, 32), discMat);
	rotor.rotation.x = -Math.PI / 2;
	rotor.position.y = 4.2;
	group.add(rotor);

	// Tail rotor disc
	const tailRotor = new THREE.Mesh(new THREE.CircleGeometry(1.4, 16), discMat);
	tailRotor.rotation.y = Math.PI / 2;
	tailRotor.position.set(-10.0, 2.6, 0.4);
	group.add(tailRotor);

	// Skid landing gear (a single thin box, both sides)
	const skidGeom = new THREE.BoxGeometry(7, 0.15, 0.3);
	const skidL = new THREE.Mesh(skidGeom, accentMat);
	skidL.position.set(0, 0, -1.6);
	const skidR = new THREE.Mesh(skidGeom, accentMat);
	skidR.position.set(0, 0, 1.6);
	group.add(skidL, skidR);

	return group;
}

interface LayerState {
	scene: THREE.Scene;
	camera: THREE.Camera;
	renderer: THREE.WebGLRenderer;
	helo: THREE.Group;
	originMercator: maplibregl.MercatorCoordinate;
	metersToMerc: number;
	map: MapLibreMap;
}

export function createAircraftLayer(): CustomLayerInterface {
	let state: LayerState | null = null;

	return {
		id: 'aircraft',
		type: 'custom',
		renderingMode: '3d',

		onAdd(map, gl) {
			const scene = new THREE.Scene();
			const camera = new THREE.Camera();

			const sun = new THREE.DirectionalLight(0xffffff, 1.4);
			sun.position.set(0.4, 1, 0.6).normalize();
			scene.add(sun);
			scene.add(new THREE.AmbientLight(0xffffff, 0.35));

			const helo = buildHelo();
			scene.add(helo);

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
				helo,
				originMercator,
				metersToMerc,
				map,
			};
		},

		render(_gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput) {
			if (!state) return;

			// --- Place the aircraft in scene-local meters ---------------------
			const [east, north] = eastNorthMetersFromOrigin(STATIC_HELO.lng, STATIC_HELO.lat);
			state.helo.position.set(east, STATIC_HELO.altitudeMeters, north);
			// Aircraft "nose" was modeled along +X (east, heading 90°). Rotating
			// around the up axis: heading 0 = north, so we subtract 90° to align.
			state.helo.rotation.y = -degToRad(STATIC_HELO.headingDeg - 90);

			// --- Compose the projection matrix --------------------------------
			//  M = mapProj · translate(originMerc) · scale(metersToMerc, -metersToMerc, metersToMerc)
			//
			// The Y-negation flips three.js's Y-up world into MapLibre's
			// Z-up Mercator frame: after this, scene-local +Y points "up" in
			// MapLibre, +X points east, +Z points south. Setting position with
			// the third arg as +north then comes out correctly because we feed
			// (east, up, north) and the matrix maps that to (east, -up, north)
			// in MapLibre's coordinate frame... wait — see notes file.
			//
			// In practice the canonical example uses scale(s, -s, s) and ends
			// up with the conventional (east, up, north) interpretation, so we
			// match that exactly.
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
				state.renderer.dispose();
				state = null;
			}
		},
	};
}
