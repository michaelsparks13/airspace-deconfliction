/**
 * Single source of truth for thresholds, the demo bbox, and color palettes.
 * Every other module should import from here rather than hardcoding numbers.
 *
 * Internal math is meters and m/s. The display layer (geo/units.ts) handles
 * feet/knots conversion.
 */

/** Fictional fire near Telluride/Silverton, San Juan Mountains. */
export const SCENARIO_CENTER: [number, number] = [-107.80, 37.85];

/** Bbox the offline tile pack covers. */
export const DEMO_BBOX = {
	lonMin: -108.10,
	latMin: 37.60,
	lonMax: -107.50,
	latMax: 38.10,
} as const;

/** Default camera. Zoom 9 keeps the basemap legible and frames the fire
 * inside a recognizable patch of San Juan terrain. Aircraft are scaled
 * zoom-relative (see AIRCRAFT_REFERENCE_MESH_SCALE) so the silhouettes
 * stay visible as the user zooms in/out. */
export const CAMERA = {
	zoom: 12,
	pitch: 62,
	bearing: -28,
	maxPitch: 80,
} as const;

/** Aircraft mesh scale at REFERENCE_ZOOM. AircraftLayer scales meshes
 * by 2^(REFERENCE_ZOOM - currentZoom), so the on-screen size is roughly
 * constant from zoom 8 to zoom 14. At zoom 13 (close-in) this gives a
 * comfortable silhouette; at zoom 9 (default) the meshes auto-scale ~16x
 * larger so the fleet stays visible. Halos remain 1 nm true-scale. */
export const AIRCRAFT_REFERENCE_MESH_SCALE = 9;
export const AIRCRAFT_REFERENCE_ZOOM = 13;

/** Deconfliction thresholds (FAA-ish "see and avoid" minima for portfolio purposes). */
export const SEPARATION = {
	lateralMeters: 1852,        // 1 nm
	verticalMeters: 152.4,      // 500 ft
} as const;

/**
 * Proximity warning thresholds — 2x the conflict bubble. A pair inside the
 * warning radius but outside the conflict radius gets a steady amber cue so
 * the operator has a few seconds of "watch this" before the pulsing red.
 */
export const PROXIMITY = {
	lateralMeters: 3704,        // 2 nm
	verticalMeters: 304.8,      // 1000 ft
} as const;

/** AGL color bands. Each upper bound is exclusive. */
export const AGL_BANDS = {
	redMaxMeters: 152.4,        // <  500 ft -> red
	amberMaxMeters: 457.2,      // <1500 ft -> amber, otherwise green
} as const;

/** TFR cylinder, MSL ceiling (matches real wildfire TFR convention). */
export const TFR = {
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

/**
 * Tile sources. Set useLocal=true once the offline tile pack is fetched (Slice 2).
 *
 * Labels are NOT a raster layer — population-scaled cartographic labels make
 * Montrose dominant over an operationally-relevant Silverton. Instead we render
 * a curated list of POIs as MapLibre Markers (see src/map/places.ts).
 */
export const TILES = {
	// Always stream from CDN — AWS terrarium + CARTO are fast enough that the
	// offline tile pack isn't worth the deploy weight or DX overhead.
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
