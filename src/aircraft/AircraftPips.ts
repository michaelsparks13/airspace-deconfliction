// Screen-space pip markers: constant-pixel DOM dots via maplibregl.Marker.
// Complements the three.js halo / outline / mesh in AircraftLayer (which are
// in real meters and can vanish at extreme zooms).

import maplibregl, { type Map as MapLibreMap, type Marker } from 'maplibre-gl';
import type { Aircraft } from '../data/types';
import { aircraftIdsInConflicts, type Conflict } from '../deconfliction';
import { AGL_COLORS, aglBandFor } from './visuals';

const PIP_CONFLICT_COLOR = '#ff3b3b';
const PIP_WARNING_COLOR = '#ffb938';

function makePipElement(): HTMLDivElement {
	const el = document.createElement('div');
	el.className = 'aircraft-pip';
	return el;
}

type PipState = 'normal' | 'warning' | 'conflict';

function applyPipStyle(el: HTMLDivElement, color: string, state: PipState): void {
	el.style.background = color;
	el.classList.toggle('aircraft-pip--conflict', state === 'conflict');
	el.classList.toggle('aircraft-pip--warning', state === 'warning');
}

export function mountAircraftPips(
	map: MapLibreMap,
	getAircraft: () => readonly Aircraft[],
	getConflicts: () => readonly Conflict[] = () => [],
): () => void {
	const markers = new Map<string, { marker: Marker; el: HTMLDivElement; lastAgl: number | null }>();
	let rafId = 0;
	let cancelled = false;

	function tick() {
		if (cancelled) return;
		const aircraft = getAircraft();
		const conflicts = getConflicts();
		const conflictIds = aircraftIdsInConflicts(conflicts, 'critical');
		const warningIds = new Set<string>();
		for (const id of aircraftIdsInConflicts(conflicts, 'advisory')) {
			if (!conflictIds.has(id)) warningIds.add(id);
		}

		const seen = new Set<string>();

		for (const a of aircraft) {
			seen.add(a.id);
			let entry = markers.get(a.id);
			if (!entry) {
				const el = makePipElement();
				const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
					.setLngLat([a.lon, a.lat])
					.addTo(map);
				entry = { marker, el, lastAgl: null };
				markers.set(a.id, entry);
			} else {
				entry.marker.setLngLat([a.lon, a.lat]);
			}

			const inConflict = conflictIds.has(a.id);
			const inWarning = !inConflict && warningIds.has(a.id);
			const groundMsl = map.queryTerrainElevation([a.lon, a.lat]);
			const agl = groundMsl === null || groundMsl === undefined
				? entry.lastAgl
				: a.altitudeMslMeters - groundMsl;
			entry.lastAgl = agl;

			let color: string;
			let state: PipState;
			if (inConflict) {
				color = PIP_CONFLICT_COLOR;
				state = 'conflict';
			} else if (inWarning) {
				color = PIP_WARNING_COLOR;
				state = 'warning';
			} else {
				color = `#${AGL_COLORS[aglBandFor(agl)].toString(16).padStart(6, '0')}`;
				state = 'normal';
			}
			applyPipStyle(entry.el, color, state);
		}

		for (const [id, entry] of markers) {
			if (!seen.has(id)) {
				entry.marker.remove();
				markers.delete(id);
			}
		}

		rafId = requestAnimationFrame(tick);
	}

	rafId = requestAnimationFrame(tick);

	return () => {
		cancelled = true;
		cancelAnimationFrame(rafId);
		for (const { marker } of markers.values()) marker.remove();
		markers.clear();
	};
}
