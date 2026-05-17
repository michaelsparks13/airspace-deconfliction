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

// MapLibre style: muted raster basemap, terrarium DEM for 3D terrain, and a
// hillshade derived from the same DEM. Tile URLs go through config.ts so we
// can swap remote vs bundled-local without touching this file.
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
			// MapLibre warns if one raster-dem source is reused for both terrain
			// and hillshade; declare it twice so each layer has its own handle.
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
		// Fog dissolves the edge of the loaded tile pack into the background;
		// without it you get a visible black "cliff" where terrain ends.
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

// fetch-tiles pre-loads DEMO_BBOX + a 0.5° buffer in every direction.
// Clamping the camera center to a slightly tighter inner bbox keeps the
// pitched view inside the loaded area, the buffer absorbs the extra reach
// of the pitched horizon.
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

	map.on('load', () => {
		addFirePerimeterLayers(map);
		// Boundary line first so place labels render on top of it.
		addScenarioBoundaryLayer(map);
		addPlaceLabels(map);
		// Order matters: structural airspace volumes, then aircraft on top.
		map.addLayer(createTfrLayer());
		map.addLayer(createFtaLayer());
		map.addLayer(createAircraftLayer(getCurrentAircraft, getCurrentConflicts));
		mountAircraftPips(map, getCurrentAircraft, getCurrentConflicts);
	});

	return map;
}
