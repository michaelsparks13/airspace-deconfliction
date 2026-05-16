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

import { PROXIMITY, SEPARATION } from './config';
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

/** Same shape as ConflictPair — emitted for pairs inside the warning bubble
 * but outside the conflict bubble. Helps the operator see a pair coming
 * together before it crosses the minima. */
export type WarningPair = ConflictPair;

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

/**
 * Pairs inside the proximity radius but outside the conflict radius. A pair
 * already counted as a conflict is intentionally excluded so the two states
 * don't double-render the same aircraft.
 */
export function detectWarnings(aircraft: readonly Aircraft[]): WarningPair[] {
	const out: WarningPair[] = [];
	for (let i = 0; i < aircraft.length; i++) {
		const a = aircraft[i];
		for (let j = i + 1; j < aircraft.length; j++) {
			const b = aircraft[j];
			const vert = Math.abs(a.altitudeMslMeters - b.altitudeMslMeters);
			if (vert >= PROXIMITY.verticalMeters) continue;
			const lat = haversineMeters(a.lat, a.lon, b.lat, b.lon);
			if (lat >= PROXIMITY.lateralMeters) continue;
			// Skip pairs already in conflict.
			if (lat < SEPARATION.lateralMeters && vert < SEPARATION.verticalMeters) continue;
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
