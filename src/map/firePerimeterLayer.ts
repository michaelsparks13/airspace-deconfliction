// Fire perimeter on the map surface: translucent orange fill + brighter
// stroke. The same polygon is the footprint of the TFR cylinder in tfr.ts;
// see README for the simplifying assumption.

import type { Map as MapLibreMap } from 'maplibre-gl';
import firePerimeter from '../data/fire-perimeter.json';

export const FIRE_PERIMETER = firePerimeter as GeoJSON.Feature<GeoJSON.Polygon>;

// Push the label just outside the polygon's north edge so it never sits
// on the fire fill (the orange wash chews up text halos). 0.005° is
// roughly 550 m at this latitude.
const LABEL_LAT_OFFSET_DEG = 0.006;

function perimeterTopCenter(): [number, number] {
	const ring = FIRE_PERIMETER.geometry.coordinates[0];
	let minLon = Infinity;
	let maxLon = -Infinity;
	let maxLat = -Infinity;
	for (const [lon, lat] of ring) {
		if (lon < minLon) minLon = lon;
		if (lon > maxLon) maxLon = lon;
		if (lat > maxLat) maxLat = lat;
	}
	return [(minLon + maxLon) / 2, maxLat + LABEL_LAT_OFFSET_DEG];
}

function labelFeature(): GeoJSON.Feature<GeoJSON.Point> {
	const [lon, lat] = perimeterTopCenter();
	const acres = FIRE_PERIMETER.properties?.acresApprox;
	const name = FIRE_PERIMETER.properties?.name ?? 'Fire perimeter';
	const subtitle = acres ? `${acres.toLocaleString()} ac · TFR active` : 'TFR active';
	return {
		type: 'Feature',
		properties: { name, subtitle },
		geometry: { type: 'Point', coordinates: [lon, lat] },
	};
}

export function addFirePerimeterLayers(map: MapLibreMap): void {
	if (!map.getSource('fire-perimeter')) {
		map.addSource('fire-perimeter', {
			type: 'geojson',
			data: FIRE_PERIMETER,
		});
	}

	if (!map.getSource('fire-perimeter-label')) {
		map.addSource('fire-perimeter-label', {
			type: 'geojson',
			data: labelFeature(),
		});
	}

	if (!map.getLayer('fire-perimeter-fill')) {
		map.addLayer({
			id: 'fire-perimeter-fill',
			type: 'fill',
			source: 'fire-perimeter',
			paint: {
				'fill-color': '#ff7a3b',
				'fill-opacity': 0.18,
			},
		});
	}

	if (!map.getLayer('fire-perimeter-outline')) {
		map.addLayer({
			id: 'fire-perimeter-outline',
			type: 'line',
			source: 'fire-perimeter',
			paint: {
				'line-color': '#ff7a3b',
				'line-width': 2,
				'line-opacity': 0.85,
			},
		});
	}

	if (!map.getLayer('fire-perimeter-label')) {
		map.addLayer({
			id: 'fire-perimeter-label',
			type: 'symbol',
			source: 'fire-perimeter-label',
			layout: {
				'text-field': [
					'format',
					['get', 'name'], { 'font-scale': 1.0 },
					'\n',
					['get', 'subtitle'], { 'font-scale': 0.75 },
				],
				'text-size': 13,
				'text-letter-spacing': 0.08,
				'text-anchor': 'bottom',
				'text-allow-overlap': true,
				'text-ignore-placement': true,
			},
			paint: {
				'text-color': '#ffb38a',
				'text-halo-color': '#0a0d12',
				'text-halo-width': 2,
				'text-halo-blur': 0.5,
			},
		});
	}
}
