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
 * Altitudes are specified as AGL (above ground level). Terrain MSL is sampled
 * from the local terrarium tile pack so flight tracks track real San Juan
 * topography — no more aircraft 2,000 ft underground.
 *
 *   npm run generate-scenario
 */

import { writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import type { AircraftCategory, CrewType } from '../src/data/types.ts';

const ROOT = resolve(import.meta.dirname, '..');
const OUTPUT = resolve(ROOT, 'src', 'data', 'mock-san-juans-fire.json');
const TILES_DIR = resolve(ROOT, 'public', 'tiles', 'terrarium');

const DURATION_SECONDS = 90;
const HZ = 1;
// Sample terrain at the same LOD MapLibre uses at the default camera zoom (~9.85).
// Higher-zoom terrarium tiles encode more detail than the rendered terrain mesh
// uses, so picking those produces "true" elevations that are LOWER than the
// runtime's smoothed value over ridges — leaving aircraft visibly underground at
// transient moments. Matching the runtime's LOD keeps panel AGL > 0 always.
const DEM_ZOOM = 10;

// -----------------------------------------------------------------------------
//  Terrarium DEM sampler — reads cached zoom-13 tiles and decodes elevation.
// -----------------------------------------------------------------------------

interface DecodedTile {
	width: number;
	height: number;
	data: Buffer;
}

const tileCache = new Map<string, DecodedTile | null>();

function lon2tile(lon: number, z: number): number {
	return ((lon + 180) / 360) * Math.pow(2, z);
}

function lat2tile(lat: number, z: number): number {
	const rad = (lat * Math.PI) / 180;
	return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z);
}

function loadTile(z: number, x: number, y: number): DecodedTile | null {
	const key = `${z}/${x}/${y}`;
	if (tileCache.has(key)) return tileCache.get(key)!;
	const path = resolve(TILES_DIR, `${z}`, `${x}`, `${y}.png`);
	if (!existsSync(path)) {
		tileCache.set(key, null);
		return null;
	}
	const png = PNG.sync.read(readFileSync(path));
	const tile: DecodedTile = { width: png.width, height: png.height, data: png.data };
	tileCache.set(key, tile);
	return tile;
}

function terrariumElevation(tile: DecodedTile, px: number, py: number): number {
	const ix = Math.max(0, Math.min(tile.width - 1, Math.round(px)));
	const iy = Math.max(0, Math.min(tile.height - 1, Math.round(py)));
	const o = (iy * tile.width + ix) * 4;
	const r = tile.data[o];
	const g = tile.data[o + 1];
	const b = tile.data[o + 2];
	return r * 256 + g + b / 256 - 32768;
}

/** Bilinear-interpolated terrain MSL elevation in meters at (lat, lon). */
function sampleTerrainMsl(lat: number, lon: number): number {
	const tx = lon2tile(lon, DEM_ZOOM);
	const ty = lat2tile(lat, DEM_ZOOM);
	const tileX = Math.floor(tx);
	const tileY = Math.floor(ty);
	const tile = loadTile(DEM_ZOOM, tileX, tileY);
	if (!tile) {
		throw new Error(
			`Missing terrarium tile ${DEM_ZOOM}/${tileX}/${tileY} for lat=${lat} lon=${lon}. ` +
				`Run \`npm run fetch-tiles\` first.`,
		);
	}
	const fx = (tx - tileX) * tile.width;
	const fy = (ty - tileY) * tile.height;
	const x0 = Math.floor(fx);
	const y0 = Math.floor(fy);
	const x1 = Math.min(tile.width - 1, x0 + 1);
	const y1 = Math.min(tile.height - 1, y0 + 1);
	const dx = fx - x0;
	const dy = fy - y0;
	const e00 = terrariumElevation(tile, x0, y0);
	const e10 = terrariumElevation(tile, x1, y0);
	const e01 = terrariumElevation(tile, x0, y1);
	const e11 = terrariumElevation(tile, x1, y1);
	return (
		e00 * (1 - dx) * (1 - dy) +
		e10 * dx * (1 - dy) +
		e01 * (1 - dx) * dy +
		e11 * dx * dy
	);
}

// -----------------------------------------------------------------------------
//  Track-builder helpers — keyframes specify lat/lon + AGL.
// -----------------------------------------------------------------------------

interface Keyframe {
	t: number;             // seconds
	lat: number;
	lon: number;
	aglMeters: number;     // height above ground level
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
	if (t <= keys[0].t) {
		const { t: _t, ...rest } = keys[0];
		return rest;
	}
	if (t >= keys[keys.length - 1].t) {
		const { t: _t, ...rest } = keys[keys.length - 1];
		return rest;
	}
	for (let i = 0; i < keys.length - 1; i++) {
		const a = keys[i];
		const b = keys[i + 1];
		if (t >= a.t && t <= b.t) {
			const k = (t - a.t) / (b.t - a.t);
			return {
				lat: lerp(a.lat, b.lat, k),
				lon: lerp(a.lon, b.lon, k),
				aglMeters: lerp(a.aglMeters, b.aglMeters, k),
				headingDeg: lerpHeading(a.headingDeg, b.headingDeg, k),
				gsMps: lerp(a.gsMps, b.gsMps, k),
				vrateMps: lerp(a.vrateMps, b.vrateMps, k),
			};
		}
	}
	throw new Error(`unreachable: t=${t}`);
}

/** Orbit pattern keyframes at constant AGL around a center. */
function orbitKeyframes(opts: {
	centerLat: number;
	centerLon: number;
	radiusMeters: number;
	aglMeters: number;
	gsMps: number;
	periodSeconds: number;
	startPhase?: number;
	stepSeconds?: number;
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
		const tangentRad = phase + (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
		let heading = (tangentRad * 180) / Math.PI;
		while (heading < 0) heading += 360;
		while (heading >= 360) heading -= 360;
		out.push({
			t,
			lat,
			lon,
			aglMeters: opts.aglMeters,
			headingDeg: heading,
			gsMps: opts.gsMps,
			vrateMps: 0,
		});
	}
	return out;
}

// -----------------------------------------------------------------------------
//  Track definitions — AGL profiles by aircraft type
// -----------------------------------------------------------------------------

/**
 * Type 1 helicopter — bucket drop cycle. Sits at operationally realistic AGL:
 *   T+0..T+30   : returning from dip site, ~60 m (200 ft) AGL transit.
 *   T+30..T+50  : descending toward dip site (the conflict window). Drops to
 *                 30 m AGL by T+45 — overlaps Tanker 21's climb-out altitude.
 *   T+50..T+90  : at dip site over a ~3,000 m drainage, ~5 m AGL hover.
 */
const HELO_KEYS: Keyframe[] = [
	{ t: 0,  lat: 37.8410, lon: -107.8260, aglMeters: 60, headingDeg: 50,  gsMps: 36, vrateMps: 0 },
	{ t: 20, lat: 37.8520, lon: -107.8040, aglMeters: 70, headingDeg: 55,  gsMps: 36, vrateMps: 0.5 },
	{ t: 30, lat: 37.8580, lon: -107.7910, aglMeters: 75, headingDeg: 60,  gsMps: 32, vrateMps: 0 },
	{ t: 42, lat: 37.8600, lon: -107.7850, aglMeters: 80, headingDeg: 60,  gsMps: 30, vrateMps: -1 },
	{ t: 45, lat: 37.8580, lon: -107.7790, aglMeters: 50, headingDeg: 80,  gsMps: 28, vrateMps: -10 },
	{ t: 50, lat: 37.8550, lon: -107.7720, aglMeters: 20, headingDeg: 100, gsMps: 22, vrateMps: -6 },
	{ t: 60, lat: 37.8520, lon: -107.7650, aglMeters: 8,  headingDeg: 120, gsMps: 10, vrateMps: -1 },
	{ t: 90, lat: 37.8500, lon: -107.7620, aglMeters: 5,  headingDeg: 180, gsMps: 0,  vrateMps: 0 },
];

/**
 * Air tanker — retardant run + climb-out. The conflict at T+42..T+50 happens
 * because the tanker is climbing through 50-150 m AGL just as 5H descends
 * through the same band over the same drainage.
 */
// Tanker AGL minimums are padded ~30 m above the operational floor: MapLibre's
// runtime terrain query uses lower-LOD tiles than this script's zoom-13 sample,
// and the difference can push the rendered AGL slightly below the literal value.
// The padding keeps the panel display unambiguously positive at all replay times.
const TANKER_KEYS: Keyframe[] = [
	{ t: 0,  lat: 37.7900, lon: -107.8100, aglMeters: 250, headingDeg: 5,   gsMps: 75, vrateMps: 0 },
	{ t: 20, lat: 37.8350, lon: -107.8050, aglMeters: 110, headingDeg: 0,   gsMps: 78, vrateMps: -1 },
	{ t: 40, lat: 37.8590, lon: -107.7920, aglMeters: 80,  headingDeg: 40,  gsMps: 80, vrateMps: 0 },
	{ t: 45, lat: 37.8600, lon: -107.7820, aglMeters: 110, headingDeg: 55,  gsMps: 80, vrateMps: 8 },
	{ t: 50, lat: 37.8610, lon: -107.7700, aglMeters: 220, headingDeg: 75,  gsMps: 80, vrateMps: 12 },
	{ t: 55, lat: 37.8620, lon: -107.7560, aglMeters: 360, headingDeg: 85,  gsMps: 80, vrateMps: 10 },
	{ t: 90, lat: 37.8670, lon: -107.6900, aglMeters: 740, headingDeg: 90,  gsMps: 82, vrateMps: 4 },
];

/** Recon fixed-wing — left orbit NE of fire at ~2,500 ft AGL. */
const RECON_KEYS = orbitKeyframes({
	centerLat: 37.8950,
	centerLon: -107.7400,
	radiusMeters: 1200,
	aglMeters: 760,
	gsMps: 62,
	periodSeconds: 80,
	startPhase: 0,
});

/** ATGS air-attack — higher, wider orbit south of fire, ~3,500 ft AGL. */
const ATGS_KEYS = orbitKeyframes({
	centerLat: 37.8150,
	centerLon: -107.8250,
	radiusMeters: 2000,
	aglMeters: 1070,
	gsMps: 67,
	periodSeconds: 140,
	startPhase: Math.PI / 2,
});

/** Sheriff UAS — holding 400 ft AGL over structure protection corner. */
const UAS_KEYS: Keyframe[] = [
	{ t: 0,  lat: 37.8420, lon: -107.8150, aglMeters: 120, headingDeg: 180, gsMps: 6, vrateMps: 0 },
	{ t: 90, lat: 37.8380, lon: -107.8150, aglMeters: 120, headingDeg: 180, gsMps: 6, vrateMps: 0 },
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

interface SampleResult {
	samples: Sample[];
	minAgl: number;
	maxAgl: number;
}

function sampleAll(track: TrackManifest): SampleResult {
	const out: Sample[] = [];
	let minAgl = Infinity;
	let maxAgl = -Infinity;
	const step = 1 / HZ;
	for (let t = 0; t <= DURATION_SECONDS; t += step) {
		const s = sampleTrack(track.keys, t);
		const terrainMsl = sampleTerrainMsl(s.lat, s.lon);
		const altMsl = terrainMsl + s.aglMeters;
		minAgl = Math.min(minAgl, s.aglMeters);
		maxAgl = Math.max(maxAgl, s.aglMeters);
		out.push({
			t,
			lat: round(s.lat, 6),
			lon: round(s.lon, 6),
			altitudeMslMeters: round(altMsl, 1),
			trueTrackDeg: round(s.headingDeg, 1),
			groundspeedMps: round(s.gsMps, 2),
			verticalRateMps: round(s.vrateMps, 2),
		});
	}
	return { samples: out, minAgl, maxAgl };
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

const sampled = TRACKS.map((tr) => ({ tr, sr: sampleAll(tr) }));

const file: ReplayFile = {
	durationSeconds: DURATION_SECONDS,
	hz: HZ,
	notes:
		'Generated by scripts/generate-scenario.ts. Altitudes are terrain-aware ' +
		'(AGL profiles sampled against zoom-13 terrarium DEM). ' +
		'Engineered conflict between Tanker 21 (climbing post-drop) and 5H (descending to dip site) at T+42..T+50.',
	tracks: sampled.map(({ tr, sr }) => ({
		id: tr.id,
		callsign: tr.callsign,
		category: tr.category,
		crew: tr.crew,
		samples: sr.samples,
	})),
};

await writeFile(OUTPUT, JSON.stringify(file, null, '\t'), 'utf8');
console.log(`wrote ${OUTPUT}`);

const totalSamples = file.tracks.reduce((n, t) => n + t.samples.length, 0);
const overallMinAgl = Math.min(...sampled.map((s) => s.sr.minAgl));
const overallMaxAgl = Math.max(...sampled.map((s) => s.sr.maxAgl));
console.log(
	`${file.tracks.length} tracks × ${file.tracks[0].samples.length} samples = ${totalSamples} records ` +
		`— min AGL = ${overallMinAgl.toFixed(1)} m, max AGL = ${overallMaxAgl.toFixed(1)} m`,
);

if (overallMinAgl < -10) {
	console.error(`ERROR: minimum AGL ${overallMinAgl.toFixed(1)} m is below ground tolerance.`);
	process.exit(1);
}
