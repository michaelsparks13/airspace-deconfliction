/**
 * Draws the offline tile-pack edge as a labeled "scenario operations area"
 * rectangle so the abrupt terrain drop-off reads as an intentional boundary
 * rather than a render bug. Without this, the cliff at the edge of DEMO_BBOX
 * looks like the map is broken.
 */

import type { Map as MapLibreMap } from 'maplibre-gl';
import { DEMO_BBOX } from '../config';

const BOUNDARY_COLOR = '#7dd3fc';

function bboxRing(): GeoJSON.Feature<GeoJSON.LineString> {
	const { lonMin, latMin, lonMax, latMax } = DEMO_BBOX;
	return {
		type: 'Feature',
		properties: {},
		geometry: {
			type: 'LineString',
			coordinates: [
				[lonMin, latMin],
				[lonMax, latMin],
				[lonMax, latMax],
				[lonMin, latMax],
				[lonMin, latMin],
			],
		},
	};
}

function labelPoints(): GeoJSON.FeatureCollection<GeoJSON.Point> {
	const { lonMin, latMin, lonMax, latMax } = DEMO_BBOX;
	const midLon = (lonMin + lonMax) / 2;
	const midLat = (latMin + latMax) / 2;
	const text = 'SCENARIO OPERATIONS AREA';
	return {
		type: 'FeatureCollection',
		features: [
			{ type: 'Feature', properties: { text }, geometry: { type: 'Point', coordinates: [midLon, latMax] } },
			{ type: 'Feature', properties: { text }, geometry: { type: 'Point', coordinates: [midLon, latMin] } },
			{ type: 'Feature', properties: { text }, geometry: { type: 'Point', coordinates: [lonMin, midLat] } },
			{ type: 'Feature', properties: { text }, geometry: { type: 'Point', coordinates: [lonMax, midLat] } },
		],
	};
}

export function addScenarioBoundaryLayer(map: MapLibreMap): void {
	if (!map.getSource('scenario-bbox')) {
		map.addSource('scenario-bbox', {
			type: 'geojson',
			data: bboxRing(),
		});
	}

	if (!map.getSource('scenario-bbox-labels')) {
		map.addSource('scenario-bbox-labels', {
			type: 'geojson',
			data: labelPoints(),
		});
	}

	if (!map.getLayer('scenario-bbox-line')) {
		map.addLayer({
			id: 'scenario-bbox-line',
			type: 'line',
			source: 'scenario-bbox',
			paint: {
				'line-color': BOUNDARY_COLOR,
				'line-width': 1.5,
				'line-opacity': 0.8,
				'line-dasharray': [4, 3],
			},
		});
	}

	if (!map.getLayer('scenario-bbox-label')) {
		map.addLayer({
			id: 'scenario-bbox-label',
			type: 'symbol',
			source: 'scenario-bbox-labels',
			layout: {
				'text-field': ['get', 'text'],
				'text-size': 10,
				'text-letter-spacing': 0.18,
				'text-anchor': 'center',
				'text-allow-overlap': false,
				'text-ignore-placement': false,
			},
			paint: {
				'text-color': BOUNDARY_COLOR,
				'text-halo-color': '#0a0d12',
				'text-halo-width': 1.5,
				'text-opacity': 0.85,
			},
		});
	}
}
