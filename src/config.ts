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

/** Default camera. Zoom 13 frames the fire perimeter snugly while still
 * showing the surrounding ridges; the matching maxBounds in setupMap.ts
 * stops the user from panning past the bundled tile pack and revealing
 * unloaded-terrain "cliffs." */
export const CAMERA = {
	zoom: 13,
	pitch: 62,
	bearing: -28,
	maxPitch: 80,
} as const;

/** Aircraft mesh size multiplier. Real-world scale (16 m helo, 28 m tanker)
 * is invisible at zoom 13 over 3D terrain — a few pixels. 6x scales the
 * silhouettes to "obviously an aircraft" without making them look toy-sized
 * next to the terrain. Halos remain 1 nm true. */
export const AIRCRAFT_MESH_SCALE = 6;

/** Deconfliction thresholds (FAA-ish "see and avoid" minima for portfolio purposes). */
export const SEPARATION = {
	lateralMeters: 1852,        // 1 nm
	verticalMeters: 152.4,      // 500 ft
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
	useLocal: true,
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
