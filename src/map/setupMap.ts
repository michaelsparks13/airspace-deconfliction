import maplibregl, { Map as MapLibreMap, type StyleSpecification } from 'maplibre-gl';
import { CAMERA, SCENARIO_CENTER, basemapTileUrl, terrainTileUrl } from '../config';
import { addPlaceLabels } from './places';
import { addFirePerimeterLayers } from './firePerimeterLayer';
import { createTfrLayer } from './tfr';
import { createAircraftLayer } from '../aircraft/AircraftLayer';
import { getCurrentAircraft } from '../composables/useAircraftStore';
import { getCurrentConflicts } from '../composables/useDeconfliction';

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
		sky: {
			'sky-color': '#0a0d12',
			'sky-horizon-blend': 0.4,
			'horizon-color': '#1a2030',
			'horizon-fog-blend': 0.5,
			'fog-color': '#0a0d12',
			'fog-ground-blend': 0.3,
		},
	};
}

export function createMap(container: HTMLElement): MapLibreMap {
	const map = new maplibregl.Map({
		container,
		style: buildStyle(),
		center: SCENARIO_CENTER,
		zoom: CAMERA.zoom,
		pitch: CAMERA.pitch,
		bearing: CAMERA.bearing,
		maxPitch: CAMERA.maxPitch,
		// Antialias the GL context so future custom layers (three.js) look clean.
		canvasContextAttributes: { antialias: true },
		// We render terrain ourselves; no need for the built-in attribution overlap.
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
		addPlaceLabels(map);
		// Order matters: TFR volume first, aircraft layer last so aircraft draw
		// on top of (and read against) the translucent TFR walls.
		map.addLayer(createTfrLayer());
		map.addLayer(createAircraftLayer(getCurrentAircraft, getCurrentConflicts));
	});

	return map;
}
