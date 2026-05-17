/**
 * Single source of truth for thresholds, the demo bbox, and palettes.
 * Every other module imports from here rather than hardcoding numbers.
 *
 * Internal math is meters and m/s. The display layer (geo/units.ts) handles
 * feet/knots conversion.
 */

import type { AircraftCategory, AltitudeBlock } from './data/types';

/** Fictional fire near Telluride/Silverton, San Juan Mountains. */
export const SCENARIO_CENTER: [number, number] = [-107.80, 37.85];

/** Bbox the offline tile pack covers. */
export const DEMO_BBOX = {
	lonMin: -108.10,
	latMin: 37.60,
	lonMax: -107.50,
	latMax: 38.10,
} as const;

/** Default camera. Pulled out to zoom 11 so the 12 NM ICOM ring is framed. */
export const CAMERA = {
	zoom: 11,
	pitch: 62,
	bearing: -28,
	maxPitch: 80,
} as const;

/** Aircraft mesh scale at REFERENCE_ZOOM (see AircraftLayer). */
export const AIRCRAFT_REFERENCE_MESH_SCALE = 9;
export const AIRCRAFT_REFERENCE_ZOOM = 13;

/**
 * Deconfliction parameters.
 *
 * IMPORTANT: these are NOT regulatory separation minima. Over a fire,
 * aircraft deliberately operate inside en-route minima — the deconfliction
 * model is structural (assigned altitude blocks) and predictive (closest
 * approach), not a fixed separation bubble. See src/deconfliction.ts.
 */
export const DECONFLICTION = {
	/** Predicted closest-approach lookahead horizon, seconds. */
	cpaHorizonSeconds: 60,
	/** Predicted slant range at CPA below this -> critical stack-proximity. */
	criticalSlantMeters: 600,
	/** Predicted slant range at CPA below this (>= critical) -> caution. */
	cautionSlantMeters: 1500,
	/** AGL must exceed a block edge by this much before block-bust counts
	 *  (hysteresis — avoids flicker at the boundary). */
	blockBustToleranceMeters: 15,
} as const;

/**
 * The FTA vertical stack — canonical altitude blocks by role, AGL meters.
 * The scenario generator assigns each aircraft the block for its category;
 * blocks are also rendered as labeled bands.
 *
 * Bands intentionally overlap slightly (rotor ceiling / tanker floor) — that
 * overlap is exactly the region the ATGS deconflicts by hand, and the region
 * this tool surfaces. Reference: NWCG PMS 505, Standards for Aerial Supervision.
 */
export const STACK: Record<AircraftCategory, AltitudeBlock> = {
	'helo-type1':  { label: 'ROTOR',  floorAglMeters: 0,    ceilAglMeters: 152 },   // sfc–500 ft
	'air-tanker':  { label: 'TANKER', floorAglMeters: 122,  ceilAglMeters: 762 },   // 400–2500 ft
	'recon-fw':    { label: 'RECON',  floorAglMeters: 671,  ceilAglMeters: 914 },   // 2200–3000 ft
	'atgs-fw':     { label: 'ATGS',   floorAglMeters: 975,  ceilAglMeters: 1463 },  // 3200–4800 ft
	'uas-sheriff': { label: 'UAS',    floorAglMeters: 0,    ceilAglMeters: 122 },   // sfc–400 ft
} as const;

/** Fire Traffic Area geometry. The ICOM ring is the 12 NM communications
 *  boundary all incident aircraft announce within (NWCG FTA protocol). */
export const FTA = {
	icomRingRadiusMeters: 12 * 1852,   // 12 NM
} as const;

/** AGL color bands for the side-panel dot. Each upper bound is exclusive. */
export const AGL_BANDS = {
	redMaxMeters: 152.4,        // <  500 ft -> red
	amberMaxMeters: 457.2,      // < 1500 ft -> amber, otherwise green
} as const;

/**
 * TFR — modeled as a circular cylinder (14 CFR 91.137 wildfire TFRs are
 * circular around a point with an MSL ceiling), not the fire-perimeter
 * polygon. centerLat/Lon default to the scenario center.
 */
export const TFR = {
	centerLat: SCENARIO_CENTER[1],
	centerLon: SCENARIO_CENTER[0],
	radiusMeters: 5 * 1852,     // 5 NM radius — typical wildfire TFR footprint
	ceilingFt: 12000,
	get ceilingMeters(): number {
		return this.ceilingFt * 0.3048;
	},
} as const;

/** Replay scenario. */
export const REPLAY = {
	durationSeconds: 90,
	hz: 1,
	defaultSpeed: 1,
	availableSpeeds: [1, 2, 4] as const,
} as const;

/** Tile sources. */
export const TILES = {
	useLocal: false,
	remote: {
		terrarium: 'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png',
		basemap: 'https://basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
	},
	local: {
		terrarium: '/tiles/terrarium/{z}/{x}/{y}.png',
		basemap: '/tiles/basemap/{z}/{x}/{y}.png',
	},
} as const;

export function terrainTileUrl(): string {
	return TILES.useLocal ? TILES.local.terrarium : TILES.remote.terrarium;
}

export function basemapTileUrl(): string {
	return TILES.useLocal ? TILES.local.basemap : TILES.remote.basemap;
}
