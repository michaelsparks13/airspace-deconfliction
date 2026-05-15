/**
 * Pairwise separation check.
 *
 * Pure: input is a fleet snapshot, output is a list of pairs in conflict.
 * No dependencies on Vue, MapLibre, or three.js. Thresholds come from
 * config.ts so the bands stay tunable in one place.
 *
 * A pair is in conflict iff lateral separation < SEPARATION.lateralMeters
 * AND vertical separation < SEPARATION.verticalMeters at the same instant.
 * Lateral uses haversine over (lat, lon); vertical is abs(MSL diff).
 *
 * Complexity is O(n^2) — fine for the demo's fleet of 5 and entirely
 * acceptable up to a few hundred aircraft. Spatial bucketing would be the
 * obvious next step at production scale.
 */

import { SEPARATION } from './config';
import type { Aircraft } from './data/types';
import { haversineMeters } from './geo/haversine';

export interface ConflictPair {
	aId: string;
	bId: string;
	aCallsign: string;
	bCallsign: string;
	lateralMeters: number;
	verticalMeters: number;
}

export function detectConflicts(aircraft: readonly Aircraft[]): ConflictPair[] {
	const out: ConflictPair[] = [];
	for (let i = 0; i < aircraft.length; i++) {
		const a = aircraft[i];
		for (let j = i + 1; j < aircraft.length; j++) {
			const b = aircraft[j];
			const vert = Math.abs(a.altitudeMslMeters - b.altitudeMslMeters);
			if (vert >= SEPARATION.verticalMeters) continue;
			const lat = haversineMeters(a.lat, a.lon, b.lat, b.lon);
			if (lat >= SEPARATION.lateralMeters) continue;
			out.push({
				aId: a.id,
				bId: b.id,
				aCallsign: a.callsign,
				bCallsign: b.callsign,
				lateralMeters: lat,
				verticalMeters: vert,
			});
		}
	}
	return out;
}

/** O(1) lookup helper — does an aircraft id participate in any active conflict? */
export function conflictIdsFromPairs(pairs: readonly ConflictPair[]): Set<string> {
	const s = new Set<string>();
	for (const p of pairs) {
		s.add(p.aId);
		s.add(p.bId);
	}
	return s;
}
