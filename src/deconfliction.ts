// Fireground deconfliction. NOT en-route CD&R: aircraft over a fire converge
// on drops by design, so the model is structural (block-bust, column, intruder)
// and predictive (closest approach), not a fixed separation bubble.
//
// Block / zone checks use AGL (the stack is defined above ground); pairwise
// stack-proximity uses true MSL slant range. The scenario bakes both off the
// same DEM so they stay consistent.
//
// Pure: fleet snapshot + FTA in, ranked conflicts out. No Vue / MapLibre / three.

import { DECONFLICTION } from './config';
import type { Aircraft } from './data/types';
import { metersToFeet } from './geo/units';
import {
	isInsideTfrCylinder,
	isInsideZone,
	type FireTrafficArea,
} from './fta';

export type Severity = 'advisory' | 'caution' | 'critical';

export interface BlockBustConflict {
	kind: 'block-bust';
	severity: Severity;
	id: string;
	callsign: string;
	edge: 'floor' | 'ceiling';
	/** Signed AGL exceedance, meters: negative = below floor, positive = above ceiling. */
	exceedanceMeters: number;
}

export interface StackProximityConflict {
	kind: 'stack-proximity';
	severity: Severity;
	aId: string;
	bId: string;
	aCallsign: string;
	bCallsign: string;
	/** Slant range right now, meters. */
	slantMetersNow: number;
	/** Predicted minimum slant range over the lookahead horizon, meters. */
	cpaSlantMeters: number;
	/** Seconds until that closest approach (0 = closing now / already past). */
	secondsToCpa: number;
}

export interface ColumnIncursionConflict {
	kind: 'column-incursion';
	severity: Severity;
	id: string;
	callsign: string;
	zoneId: string;
}

export interface IntruderConflict {
	kind: 'intruder';
	severity: Severity;
	id: string;
	callsign: string;
}

export type Conflict =
	| BlockBustConflict
	| StackProximityConflict
	| ColumnIncursionConflict
	| IntruderConflict;

const SEVERITY_RANK: Record<Severity, number> = {
	critical: 0,
	caution: 1,
	advisory: 2,
};

interface Kinematic {
	x: number;   // east, meters from FTA center
	y: number;   // north, meters from FTA center
	z: number;   // MSL altitude, meters
	vx: number;  // east velocity, m/s
	vy: number;  // north velocity, m/s
	vz: number;  // vertical velocity, m/s
}

const M_PER_DEG_LAT = 111_320;

function mPerDegLon(lat: number): number {
	return 111_320 * Math.cos((lat * Math.PI) / 180);
}

function kinematicOf(a: Aircraft, refLat: number, refLon: number): Kinematic {
	const trackRad = (a.trueTrackDeg * Math.PI) / 180;
	return {
		x: (a.lon - refLon) * mPerDegLon(refLat),
		y: (a.lat - refLat) * M_PER_DEG_LAT,
		z: a.altitudeMslMeters,
		vx: a.groundspeedMps * Math.sin(trackRad),
		vy: a.groundspeedMps * Math.cos(trackRad),
		vz: a.verticalRateMps,
	};
}

// Predicted closest approach over [0, horizon] under constant velocity.
function closestApproach(
	a: Kinematic,
	b: Kinematic,
	horizonSeconds: number,
): { cpaSlantMeters: number; secondsToCpa: number; slantNow: number } {
	const drx = b.x - a.x;
	const dry = b.y - a.y;
	const drz = b.z - a.z;
	const dvx = b.vx - a.vx;
	const dvy = b.vy - a.vy;
	const dvz = b.vz - a.vz;
	const slantNow = Math.hypot(drx, dry, drz);
	const dvSq = dvx * dvx + dvy * dvy + dvz * dvz;
	let t = 0;
	if (dvSq > 1e-6) {
		t = -(drx * dvx + dry * dvy + drz * dvz) / dvSq;
		t = Math.max(0, Math.min(horizonSeconds, t));
	}
	const cx = drx + dvx * t;
	const cy = dry + dvy * t;
	const cz = drz + dvz * t;
	return { cpaSlantMeters: Math.hypot(cx, cy, cz), secondsToCpa: t, slantNow };
}

export function detectConflicts(
	aircraft: readonly Aircraft[],
	fta: FireTrafficArea,
): Conflict[] {
	const out: Conflict[] = [];
	const tol = DECONFLICTION.blockBustToleranceMeters;

	for (const a of aircraft) {
		// Block-bust is about a participant deviating from its ATGS-assigned
		// slot. Non-participants by definition have no slot, so the check is
		// meaningless for them (their "block" in the data is a placeholder).
		if (a.participant) {
			const block = a.assignedBlock;
			if (a.aglMeters < block.floorAglMeters - tol) {
				out.push({
					kind: 'block-bust',
					severity: 'caution',
					id: a.id,
					callsign: a.callsign,
					edge: 'floor',
					exceedanceMeters: a.aglMeters - block.floorAglMeters,
				});
			} else if (a.aglMeters > block.ceilAglMeters + tol) {
				out.push({
					kind: 'block-bust',
					severity: 'caution',
					id: a.id,
					callsign: a.callsign,
					edge: 'ceiling',
					exceedanceMeters: a.aglMeters - block.ceilAglMeters,
				});
			}
		}

		for (const zone of fta.zones) {
			if (zone.kind !== 'convective-column') continue;
			if (isInsideZone(a.lat, a.lon, a.aglMeters, zone)) {
				out.push({
					kind: 'column-incursion',
					severity: 'critical',
					id: a.id,
					callsign: a.callsign,
					zoneId: zone.id,
				});
			}
		}

		if (!a.participant && isInsideTfrCylinder(a.lat, a.lon, a.altitudeMslMeters, fta)) {
			out.push({
				kind: 'intruder',
				severity: 'caution',
				id: a.id,
				callsign: a.callsign,
			});
		}
	}

	const horizon = DECONFLICTION.cpaHorizonSeconds;
	for (let i = 0; i < aircraft.length; i++) {
		const a = aircraft[i];
		const ka = kinematicOf(a, fta.centerLat, fta.centerLon);
		for (let j = i + 1; j < aircraft.length; j++) {
			const b = aircraft[j];
			// Aircraft sequenced into the same operation are expected to be
			// close: the lead deconflicts them. Don't flag.
			if (a.operationId && a.operationId === b.operationId) continue;
			const kb = kinematicOf(b, fta.centerLat, fta.centerLon);
			const cpa = closestApproach(ka, kb, horizon);
			// React to whichever is worse: now, or the predicted CPA.
			const reach = Math.min(cpa.cpaSlantMeters, cpa.slantNow);
			if (reach >= DECONFLICTION.cautionSlantMeters) continue;
			const severity: Severity =
				reach < DECONFLICTION.criticalSlantMeters ? 'critical' : 'caution';
			out.push({
				kind: 'stack-proximity',
				severity,
				aId: a.id,
				bId: b.id,
				aCallsign: a.callsign,
				bCallsign: b.callsign,
				slantMetersNow: cpa.slantNow,
				cpaSlantMeters: cpa.cpaSlantMeters,
				secondsToCpa: cpa.secondsToCpa,
			});
		}
	}

	// Sort: most severe first, then soonest CPA.
	out.sort((x, y) => {
		const s = SEVERITY_RANK[x.severity] - SEVERITY_RANK[y.severity];
		if (s !== 0) return s;
		const xt = x.kind === 'stack-proximity' ? x.secondsToCpa : 0;
		const yt = y.kind === 'stack-proximity' ? y.secondsToCpa : 0;
		return xt - yt;
	});

	return out;
}

/** Aircraft ids in any conflict at or above a severity. */
export function aircraftIdsInConflicts(
	conflicts: readonly Conflict[],
	minSeverity: Severity = 'advisory',
): Set<string> {
	const maxRank = SEVERITY_RANK[minSeverity];
	const s = new Set<string>();
	for (const c of conflicts) {
		if (SEVERITY_RANK[c.severity] > maxRank) continue;
		if (c.kind === 'stack-proximity') {
			s.add(c.aId);
			s.add(c.bId);
		} else {
			s.add(c.id);
		}
	}
	return s;
}

/** Endpoint id pairs for the 3D conflict lines. Only stack-proximity
 *  conflicts connect two aircraft. */
export function conflictLinePairs(
	conflicts: readonly Conflict[],
): { aId: string; bId: string; severity: Severity }[] {
	const out: { aId: string; bId: string; severity: Severity }[] = [];
	for (const c of conflicts) {
		if (c.kind === 'stack-proximity') {
			out.push({ aId: c.aId, bId: c.bId, severity: c.severity });
		}
	}
	return out;
}

/** One-line human summary for the banner / panel. */
export function describeConflict(c: Conflict): string {
	switch (c.kind) {
		case 'block-bust': {
			const dir = c.edge === 'floor' ? 'below' : 'above';
			const ft = Math.round(metersToFeet(Math.abs(c.exceedanceMeters)));
			return `${c.callsign}: ${ft} ft ${dir} assigned block`;
		}
		case 'stack-proximity': {
			const t = Math.round(c.secondsToCpa);
			const when = t <= 1 ? 'now' : `in ${t}s`;
			return `${c.aCallsign} ↔ ${c.bCallsign}: closest approach ${when}`;
		}
		case 'column-incursion':
			return `${c.callsign}: inside convective column`;
		case 'intruder':
			return `${c.callsign}: non-participant in TFR`;
	}
}
