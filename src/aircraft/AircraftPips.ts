/**
 * Screen-space aircraft "pip" markers — small DOM dots overlaid by MapLibre's
 * Marker system so each aircraft has a constant-pixel anchor that never
 * disappears at any zoom level. Complements the three.js halo + outline + mesh
 * in AircraftLayer.ts (which are real-world scale and can vanish at high
 * zoom-out or close-in views).
 */

import maplibregl, { type Map as MapLibreMap, type Marker } from 'maplibre-gl';
import type { Aircraft } from '../data/types';
import type { ConflictPair } from '../deconfliction';
import { AGL_COLORS, aglBandFor } from './visuals';

const PIP_CONFLICT_COLOR = '#ff3b3b';

function makePipElement(): HTMLDivElement {
	const el = document.createElement('div');
	el.className = 'aircraft-pip';
	return el;
}

function applyPipStyle(el: HTMLDivElement, color: string, conflict: boolean): void {
	el.style.background = color;
	el.classList.toggle('aircraft-pip--conflict', conflict);
}

export function mountAircraftPips(
	map: MapLibreMap,
	getAircraft: () => readonly Aircraft[],
	getConflicts: () => readonly ConflictPair[] = () => [],
): () => void {
	const markers = new Map<string, { marker: Marker; el: HTMLDivElement; lastAgl: number | null }>();
	let rafId = 0;
	let cancelled = false;

	function tick() {
		if (cancelled) return;
		const aircraft = getAircraft();
		const conflicts = getConflicts();
		const conflictIds = new Set<string>();
		for (const c of conflicts) {
			conflictIds.add(c.aId);
			conflictIds.add(c.bId);
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
			const groundMsl = map.queryTerrainElevation([a.lon, a.lat]);
			const agl = groundMsl === null || groundMsl === undefined
				? entry.lastAgl
				: a.altitudeMslMeters - groundMsl;
			entry.lastAgl = agl;

			const color = inConflict
				? PIP_CONFLICT_COLOR
				: `#${AGL_COLORS[aglBandFor(agl)].toString(16).padStart(6, '0')}`;
			applyPipStyle(entry.el, color, inConflict);
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
