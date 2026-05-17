import maplibregl, { Map as MapLibreMap, type LngLatBoundsLike, type StyleSpecification } from 'maplibre-gl';
import { CAMERA, DEMO_BBOX, SCENARIO_CENTER, basemapTileUrl, terrainTileUrl } from '../config';
import { addPlaceLabels } from './places';
import { addFirePerimeterLayers } from './firePerimeterLayer';
import { addScenarioBoundaryLayer } from './scenarioBoundaryLayer';
import { createTfrLayer } from './tfr';
import { createAircraftLayer } from '../aircraft/AircraftLayer';
import { mountAircraftPips } from '../aircraft/AircraftPips';
import { getCurrentAircraft } from '../composables/useAircraftStore';
import { getCurrentConflicts } from '../composables/useDeconfliction';
import { createFtaLayer } from './ftaLayer';

/**
 * Build the MapLibre style: a single muted raster basemap, a terrarium-encoded
 * DEM source for 3D terrain, and a hillshade derived from the same DEM.
 *
 * Both raster sources are referenced through config.ts so Slice 2 can swap to
 * locally-bundled tiles without touching this file.
 */
function buildStyle(): StyleSpecification {
	return {
		version: 8,
		// Render anything not behind a tile (e.g. terrain "walls" at edges) as our bg.
		sources: {
			basemap: {
				type: 'raster',
				tiles: [basemapTileUrl()],
				tileSize: 256,
				maxzoom: 19,
				attribution:
					'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
			},
			terrainDem: {
				type: 'raster-dem',
				tiles: [terrainTileUrl()],
				tileSize: 256,
				maxzoom: 14,
				encoding: 'terrarium',
				attribution:
					'Terrain: <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">Tilezen Joerd</a> (AWS Public Datasets)',
			},
			// MapLibre warns when one raster-dem is used for both terrain and hillshade.
			// Use a second source pointing at the same tiles to silence the warning and
			// follow the canonical MapLibre 3D-terrain example.
			hillshadeDem: {
				type: 'raster-dem',
				tiles: [terrainTileUrl()],
				tileSize: 256,
				maxzoom: 14,
				encoding: 'terrarium',
			},
		},
		layers: [
			{
				id: 'background',
				type: 'background',
				paint: { 'background-color': '#0a0d12' },
			},
			{
				id: 'basemap',
				type: 'raster',
				source: 'basemap',
				paint: { 'raster-opacity': 0.9 },
			},
			{
				id: 'hillshade',
				type: 'hillshade',
				source: 'hillshadeDem',
				paint: {
					'hillshade-shadow-color': '#000814',
					'hillshade-highlight-color': '#7088a8',
					'hillshade-accent-color': '#1a2030',
					'hillshade-exaggeration': 0.55,
				},
			},
		],
		terrain: {
			source: 'terrainDem',
			exaggeration: 1.0,
		},
		// Fog parameters are tuned to dissolve the edge of the loaded tile pack
		// into the background — without this you get a visible black "cliff"
		// where the terrain ends abruptly at the bbox edge.
		sky: {
			'sky-color': '#0a0d12',
			'sky-horizon-blend': 0.6,
			'horizon-color': '#0a0d12',
			'horizon-fog-blend': 1.0,
			'fog-color': '#0a0d12',
			'fog-ground-blend': 0.92,
		},
	};
}

/**
 * The tile fetcher pre-loads DEMO_BBOX + a 0.5° buffer in every direction.
 * Clamping the camera CENTER to a slightly tighter inner bbox keeps the
 * full pitched view inside the loaded area at zoom 9 — the buffer absorbs
 * the extra reach of the pitched-camera horizon.
 */
const PAN_BUFFER_DEG = 0.25;
const maxBounds: LngLatBoundsLike = [
	[DEMO_BBOX.lonMin - PAN_BUFFER_DEG, DEMO_BBOX.latMin - PAN_BUFFER_DEG],
	[DEMO_BBOX.lonMax + PAN_BUFFER_DEG, DEMO_BBOX.latMax + PAN_BUFFER_DEG],
];

export function createMap(container: HTMLElement): MapLibreMap {
	const map = new maplibregl.Map({
		container,
		style: buildStyle(),
		center: SCENARIO_CENTER,
		zoom: CAMERA.zoom,
		pitch: CAMERA.pitch,
		bearing: CAMERA.bearing,
		maxPitch: CAMERA.maxPitch,
		minZoom: 8,
		maxBounds,
		canvasContextAttributes: { antialias: true },
		attributionControl: { compact: true },
	});

	map.addControl(
		new maplibregl.NavigationControl({
			visualizePitch: true,
			showZoom: true,
			showCompass: true,
		}),
		'top-left',
	);

	map.on('load', () => {
		addFirePerimeterLayers(map);
		// Boundary line BEFORE place labels so labels render on top of the line.
		addScenarioBoundaryLayer(map);
		addPlaceLabels(map);
		// Order matters: structural airspace (TFR, FTA) first, aircraft layer
		// last so aircraft draw on top of the translucent volumes.
		map.addLayer(createTfrLayer());
		map.addLayer(createFtaLayer());
		map.addLayer(createAircraftLayer(getCurrentAircraft, getCurrentConflicts));
		mountAircraftPips(map, getCurrentAircraft, getCurrentConflicts);
	});

	return map;
}
