/**
 * Adds the fire perimeter as MapLibre layers on the map surface:
 *  - a semi-transparent orange fill over the burned footprint
 *  - a brighter stroke along the perimeter
 *
 * The same polygon is the footprint of the TFR cylinder rendered in 3D
 * by tfr.ts, with the simplifying assumption that the TFR boundary matches
 * the perimeter exactly (real-world TFRs are typically a circle around the
 * fire and may include buffer mileage — called out in the README).
 */

import type { Map as MapLibreMap } from 'maplibre-gl';
import firePerimeter from '../data/fire-perimeter.json';

export const FIRE_PERIMETER = firePerimeter as GeoJSON.Feature<GeoJSON.Polygon>;

export function addFirePerimeterLayers(map: MapLibreMap): void {
	if (!map.getSource('fire-perimeter')) {
		map.addSource('fire-perimeter', {
			type: 'geojson',
			data: FIRE_PERIMETER,
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
}
