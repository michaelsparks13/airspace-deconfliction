// Hand-curated POI labels.
//
// Stock raster basemaps scale labels by population: for a fire near
// Silverton, Montrose (the largest nearby town) wins all the typographic
// real estate even though Silverton is the relevant landmark. Curated lists
// are how tactical and operational maps usually solve this.
//
// Towns: candidates for helibase / ICP / dispatch reference.
// Peaks: landmarks an interviewer can orient on.

import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl';

export type PlaceKind = 'town' | 'peak';

export interface Place {
	name: string;
	lonLat: [number, number];
	kind: PlaceKind;
}

export const PLACES: readonly Place[] = [
	{ name: 'Telluride',    lonLat: [-107.8123, 37.9375], kind: 'town' },
	{ name: 'Silverton',    lonLat: [-107.6644, 37.8119], kind: 'town' },
	{ name: 'Ouray',        lonLat: [-107.6712, 38.0228], kind: 'town' },
	{ name: 'Ophir',        lonLat: [-107.8333, 37.8556], kind: 'town' },
	{ name: 'Rico',         lonLat: [-108.0306, 37.6919], kind: 'town' },
	{ name: 'Mt. Sneffels', lonLat: [-107.7919, 38.0036], kind: 'peak' },
	{ name: 'Wilson Peak',  lonLat: [-107.9892, 37.8528], kind: 'peak' },
	{ name: 'Mt. Wilson',   lonLat: [-107.9925, 37.8389], kind: 'peak' },
];

function buildPlaceElement(place: Place): HTMLDivElement {
	const root = document.createElement('div');
	root.className = `place-label place-label--${place.kind}`;
	const dot = document.createElement('span');
	dot.className = 'place-label__dot';
	const text = document.createElement('span');
	text.className = 'place-label__text';
	text.textContent = place.name;
	root.append(dot, text);
	return root;
}

export function addPlaceLabels(map: MapLibreMap): void {
	for (const place of PLACES) {
		new maplibregl.Marker({
			element: buildPlaceElement(place),
			anchor: 'left',
		})
			.setLngLat(place.lonLat)
			.addTo(map);
	}
}
