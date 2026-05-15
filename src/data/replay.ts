/**
 * Replay adapter: reads the bundled scenario JSON and exposes a function that,
 * given a current time in seconds, returns the interpolated Aircraft[] at that
 * moment.
 *
 * Linear interpolation between snapshots. Heading uses the short-way-around
 * lerp so 350° → 10° doesn't sweep through 180°.
 */

import type { Aircraft, AircraftCategory, CrewType } from './types';
import scenario from './mock-san-juans-fire.json';

interface Sample {
	t: number;
	lat: number;
	lon: number;
	altitudeMslMeters: number;
	trueTrackDeg: number;
	groundspeedMps: number;
	verticalRateMps: number;
}

interface Track {
	id: string;
	callsign: string;
	category: AircraftCategory;
	crew: CrewType;
	samples: Sample[];
}

interface ScenarioFile {
	durationSeconds: number;
	hz: number;
	notes: string;
	tracks: Track[];
}

const FILE = scenario as ScenarioFile;

export const SCENARIO_DURATION = FILE.durationSeconds;

function lerp(a: number, b: number, k: number): number {
	return a + (b - a) * k;
}

function lerpHeading(a: number, b: number, k: number): number {
	let d = b - a;
	if (d > 180) d -= 360;
	if (d < -180) d += 360;
	let h = a + d * k;
	if (h < 0) h += 360;
	if (h >= 360) h -= 360;
	return h;
}

/**
 * Find the two samples bracketing time t and the interpolation factor.
 * Samples are sorted by t. Linear scan from a per-track cursor for cheapness
 * during forward playback; falls back to a clamped lookup on seek.
 */
function bracket(samples: readonly Sample[], t: number, cursor: number): {
	a: Sample;
	b: Sample;
	k: number;
	nextCursor: number;
} {
	const last = samples.length - 1;
	if (t <= samples[0].t) {
		return { a: samples[0], b: samples[0], k: 0, nextCursor: 0 };
	}
	if (t >= samples[last].t) {
		return { a: samples[last], b: samples[last], k: 0, nextCursor: last };
	}
	let i = Math.max(0, Math.min(cursor, last - 1));
	// Walk forward if we've moved past the current bracket.
	while (i < last - 1 && t > samples[i + 1].t) i++;
	// Walk backward if we've seeked backward.
	while (i > 0 && t < samples[i].t) i--;
	const a = samples[i];
	const b = samples[i + 1];
	const k = (t - a.t) / (b.t - a.t);
	return { a, b, k, nextCursor: i };
}

export interface ReplayAdapter {
	durationSeconds: number;
	at(t: number): Aircraft[];
}

export function createReplayAdapter(): ReplayAdapter {
	const cursors = new Map<string, number>();
	for (const tr of FILE.tracks) cursors.set(tr.id, 0);

	return {
		durationSeconds: FILE.durationSeconds,
		at(t: number): Aircraft[] {
			const out: Aircraft[] = [];
			for (const tr of FILE.tracks) {
				const cursor = cursors.get(tr.id) ?? 0;
				const { a, b, k, nextCursor } = bracket(tr.samples, t, cursor);
				cursors.set(tr.id, nextCursor);
				out.push({
					id: tr.id,
					callsign: tr.callsign,
					category: tr.category,
					crew: tr.crew,
					lat: lerp(a.lat, b.lat, k),
					lon: lerp(a.lon, b.lon, k),
					altitudeMslMeters: lerp(a.altitudeMslMeters, b.altitudeMslMeters, k),
					trueTrackDeg: lerpHeading(a.trueTrackDeg, b.trueTrackDeg, k),
					groundspeedMps: lerp(a.groundspeedMps, b.groundspeedMps, k),
					verticalRateMps: lerp(a.verticalRateMps, b.verticalRateMps, k),
				});
			}
			return out;
		},
	};
}
