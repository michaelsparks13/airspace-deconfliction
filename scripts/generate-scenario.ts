/**
 * Generates src/data/mock-san-juans-fire.json — the 90s replay scenario.
 *
 * Five aircraft, each track defined here as a function of time t in seconds.
 * The script samples each track at 1 Hz and writes a per-track JSON file
 * (compact form: shared metadata once, then a samples array).
 *
 * Engineered conflict window: T+42s..T+50s, when the air tanker pulls up
 * from a retardant run and the Type 1 helo descends toward its dip site
 * over the same drainage. By T+45s they're well under the 1 nm / 500 ft
 * separation minima — the deconfliction UI (slice 6) should fire visibly
 * during the demo without anyone needing to scrub for it.
 *
 *   npm run generate-scenario
 */

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AircraftCategory, CrewType } from '../src/data/types.ts';

const ROOT = resolve(import.meta.dirname, '..');
const OUTPUT = resolve(ROOT, 'src', 'data', 'mock-san-juans-fire.json');

const DURATION_SECONDS = 90;
const HZ = 1;

// -----------------------------------------------------------------------------
//  Track-builder helpers — all positions are linear interpolations between
//  named "keyframes" (t, lat, lon, alt, heading, groundspeed, vrate).
// -----------------------------------------------------------------------------

interface Keyframe {
	t: number;             // seconds
	lat: number;
	lon: number;
	altMsl: number;        // meters
	headingDeg: number;
	gsMps: number;
	vrateMps: number;
}

function lerp(a: number, b: number, k: number): number {
	return a + (b - a) * k;
}

/** Heading lerp that takes the short way around the circle. */
function lerpHeading(a: number, b: number, k: number): number {
	let d = b - a;
	if (d > 180) d -= 360;
	if (d < -180) d += 360;
	let h = a + d * k;
	if (h < 0) h += 360;
	if (h >= 360) h -= 360;
	return h;
}

function sampleTrack(keys: Keyframe[], t: number): Omit<Keyframe, 't'> {
	if (t <= keys[0].t) return keys[0];
	if (t >= keys[keys.length - 1].t) return keys[keys.length - 1];
	for (let i = 0; i < keys.length - 1; i++) {
		const a = keys[i];
		const b = keys[i + 1];
		if (t >= a.t && t <= b.t) {
			const k = (t - a.t) / (b.t - a.t);
			return {
				lat: lerp(a.lat, b.lat, k),
				lon: lerp(a.lon, b.lon, k),
				altMsl: lerp(a.altMsl, b.altMsl, k),
				headingDeg: lerpHeading(a.headingDeg, b.headingDeg, k),
				gsMps: lerp(a.gsMps, b.gsMps, k),
				vrateMps: lerp(a.vrateMps, b.vrateMps, k),
			};
		}
	}
	throw new Error(`unreachable: t=${t}`);
}

/** Produce an orbit pattern as a series of keyframes around a center. */
function orbitKeyframes(opts: {
	centerLat: number;
	centerLon: number;
	radiusMeters: number;
	altMsl: number;
	gsMps: number;
	periodSeconds: number;
	startPhase?: number;       // radians at t=0
	stepSeconds?: number;      // keyframe spacing
	clockwise?: boolean;
}): Keyframe[] {
	const step = opts.stepSeconds ?? 5;
	const dir = opts.clockwise ? -1 : 1;
	const out: Keyframe[] = [];
	const radDeg = opts.radiusMeters / 111_320;
	const cosLat = Math.cos((opts.centerLat * Math.PI) / 180);

	for (let t = 0; t <= DURATION_SECONDS; t += step) {
		const phase = (opts.startPhase ?? 0) + dir * 2 * Math.PI * (t / opts.periodSeconds);
		const lat = opts.centerLat + radDeg * Math.cos(phase);
		const lon = opts.centerLon + (radDeg / cosLat) * Math.sin(phase);
		// Tangent heading: 90° offset from the radial.
		const tangentRad = phase + (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
		let heading = (tangentRad * 180) / Math.PI;
		while (heading < 0) heading += 360;
		while (heading >= 360) heading -= 360;
		out.push({
			t,
			lat,
			lon,
			altMsl: opts.altMsl,
			headingDeg: heading,
			gsMps: opts.gsMps,
			vrateMps: 0,
		});
	}
	return out;
}

// -----------------------------------------------------------------------------
//  Track definitions
// -----------------------------------------------------------------------------

/**
 * Type 1 helicopter — bucket drop cycle.
 *   T+0..T+30   : returning from dip site, southwest of fire, ~2900 m.
 *   T+30..T+50  : descending toward dip site northeast (the conflict window).
 *                 Closest to Tanker 21 around T+45.
 *   T+50..T+90  : at dip site, hovering low.
 */
const HELO_KEYS: Keyframe[] = [
	{ t: 0,  lat: 37.8410, lon: -107.8260, altMsl: 2880, headingDeg: 50,  gsMps: 36, vrateMps: 0 },
	{ t: 20, lat: 37.8520, lon: -107.8040, altMsl: 2950, headingDeg: 55,  gsMps: 36, vrateMps: 1 },
	{ t: 30, lat: 37.8580, lon: -107.7910, altMsl: 3050, headingDeg: 60,  gsMps: 32, vrateMps: 0 },
	{ t: 42, lat: 37.8600, lon: -107.7850, altMsl: 3200, headingDeg: 60,  gsMps: 30, vrateMps: -2 },
	{ t: 45, lat: 37.8580, lon: -107.7790, altMsl: 3060, headingDeg: 80,  gsMps: 28, vrateMps: -8 },
	{ t: 50, lat: 37.8550, lon: -107.7720, altMsl: 2820, headingDeg: 100, gsMps: 22, vrateMps: -7 },
	{ t: 60, lat: 37.8520, lon: -107.7650, altMsl: 2700, headingDeg: 120, gsMps: 10, vrateMps: -1 },
	{ t: 90, lat: 37.8500, lon: -107.7620, altMsl: 2690, headingDeg: 180, gsMps: 0,  vrateMps: 0 },
];

/**
 * Air tanker — retardant run + climb-out.
 *   T+0..T+20  : approach from the south, low.
 *   T+20..T+40 : retardant run, ~150 ft AGL, heading north.
 *   T+40..T+55 : climb-out NE — pulls up through 3050→3400 m (THE CONFLICT).
 *   T+55..T+90 : departing east, continuing climb.
 */
const TANKER_KEYS: Keyframe[] = [
	{ t: 0,  lat: 37.7900, lon: -107.8100, altMsl: 3100, headingDeg: 5,   gsMps: 75, vrateMps: 0 },
	{ t: 20, lat: 37.8350, lon: -107.8050, altMsl: 3050, headingDeg: 0,   gsMps: 78, vrateMps: 0 },
	{ t: 40, lat: 37.8590, lon: -107.7920, altMsl: 3050, headingDeg: 40,  gsMps: 80, vrateMps: 0 },
	{ t: 45, lat: 37.8600, lon: -107.7820, altMsl: 3120, headingDeg: 55,  gsMps: 80, vrateMps: 12 },
	{ t: 50, lat: 37.8610, lon: -107.7700, altMsl: 3260, headingDeg: 75,  gsMps: 80, vrateMps: 12 },
	{ t: 55, lat: 37.8620, lon: -107.7560, altMsl: 3400, headingDeg: 85,  gsMps: 80, vrateMps: 10 },
	{ t: 90, lat: 37.8670, lon: -107.6900, altMsl: 3900, headingDeg: 90,  gsMps: 82, vrateMps: 4 },
];

/** Recon fixed-wing — left orbit NE of fire at ~2,500 ft AGL. */
const RECON_KEYS = orbitKeyframes({
	centerLat: 37.8950,
	centerLon: -107.7400,
	radiusMeters: 1200,
	altMsl: 3650,
	gsMps: 62,
	periodSeconds: 80,
	startPhase: 0,
});

/** ATGS air-attack — higher, wider orbit south of fire. */
const ATGS_KEYS = orbitKeyframes({
	centerLat: 37.8150,
	centerLon: -107.8250,
	radiusMeters: 2000,
	altMsl: 4050,
	gsMps: 67,
	periodSeconds: 140,
	startPhase: Math.PI / 2,
});

/** Sheriff UAS — holding low over a structure-protection corner, slow drift south. */
const UAS_KEYS: Keyframe[] = [
	{ t: 0,  lat: 37.8420, lon: -107.8150, altMsl: 2780, headingDeg: 180, gsMps: 6, vrateMps: 0 },
	{ t: 90, lat: 37.8380, lon: -107.8150, altMsl: 2780, headingDeg: 180, gsMps: 6, vrateMps: 0 },
];

// -----------------------------------------------------------------------------
//  Track manifest
// -----------------------------------------------------------------------------

interface TrackManifest {
	id: string;
	callsign: string;
	category: AircraftCategory;
	crew: CrewType;
	keys: Keyframe[];
}

const TRACKS: TrackManifest[] = [
	{ id: 'helo-5H',         callsign: '5H',             category: 'helo-type1',  crew: 'manned', keys: HELO_KEYS },
	{ id: 'tanker-21',       callsign: 'Tanker 21',      category: 'air-tanker',  crew: 'manned', keys: TANKER_KEYS },
	{ id: 'recon-N142',      callsign: 'Recon 142',      category: 'recon-fw',    crew: 'manned', keys: RECON_KEYS },
	{ id: 'atgs-air-attack', callsign: 'Air Attack 12',  category: 'atgs-fw',     crew: 'manned', keys: ATGS_KEYS },
	{ id: 'uas-sheriff-1',   callsign: 'Eagle 1',        category: 'uas-sheriff', crew: 'uas',    keys: UAS_KEYS },
];

// -----------------------------------------------------------------------------
//  Sample + emit
// -----------------------------------------------------------------------------

interface Sample {
	t: number;
	lat: number;
	lon: number;
	altitudeMslMeters: number;
	trueTrackDeg: number;
	groundspeedMps: number;
	verticalRateMps: number;
}

function round(n: number, dp: number): number {
	const f = 10 ** dp;
	return Math.round(n * f) / f;
}

function sampleAll(track: TrackManifest): Sample[] {
	const out: Sample[] = [];
	const step = 1 / HZ;
	for (let t = 0; t <= DURATION_SECONDS; t += step) {
		const s = sampleTrack(track.keys, t);
		out.push({
			t,
			lat: round(s.lat, 6),
			lon: round(s.lon, 6),
			altitudeMslMeters: round(s.altMsl, 1),
			trueTrackDeg: round(s.headingDeg, 1),
			groundspeedMps: round(s.gsMps, 2),
			verticalRateMps: round(s.vrateMps, 2),
		});
	}
	return out;
}

interface ReplayFile {
	durationSeconds: number;
	hz: number;
	notes: string;
	tracks: Array<{
		id: string;
		callsign: string;
		category: AircraftCategory;
		crew: CrewType;
		samples: Sample[];
	}>;
}

const file: ReplayFile = {
	durationSeconds: DURATION_SECONDS,
	hz: HZ,
	notes:
		'Generated by scripts/generate-scenario.ts. ' +
		'Engineered conflict between Tanker 21 (climbing post-drop) and 5H (descending to dip site) at T+42..T+50.',
	tracks: TRACKS.map((tr) => ({
		id: tr.id,
		callsign: tr.callsign,
		category: tr.category,
		crew: tr.crew,
		samples: sampleAll(tr),
	})),
};

await writeFile(OUTPUT, JSON.stringify(file, null, '\t'), 'utf8');
console.log(`wrote ${OUTPUT}`);
console.log(
	`${file.tracks.length} tracks × ${file.tracks[0].samples.length} samples = ${file.tracks.length * file.tracks[0].samples.length} records`,
);
