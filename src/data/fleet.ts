/**
 * Hardcoded fleet snapshot for Slice 4 — a believable T=0 arrangement around
 * the fictional fire. Slice 5 will replace this with a replay adapter that
 * yields the same Aircraft[] shape per timestamp.
 *
 * Positions are chosen so each aircraft sits at its operationally typical AGL
 * band and the fleet is visually spread across the bbox rather than stacked.
 *
 * Terrain reference near the scenario center (lat 37.85, lon -107.80):
 *   - Valley floors: ~2,500 m (8,200 ft) MSL
 *   - Ridge tops:    ~3,400 m (11,150 ft) MSL
 *   - High peaks:    ~4,200 m (13,780 ft) MSL — Wilson, Sneffels
 */

import type { Aircraft } from './types';
import { crewFor } from './types';

const make = (a: Omit<Aircraft, 'crew'> & { crew?: Aircraft['crew'] }): Aircraft => ({
	...a,
	crew: a.crew ?? crewFor(a.category),
});

export const SLICE4_FLEET: readonly Aircraft[] = [
	make({
		id: 'helo-5H',
		callsign: '5H',
		category: 'helo-type1',
		// On a water-drop run just east of the fire footprint.
		lat: 37.8500,
		lon: -107.7820,
		altitudeMslMeters: 2900,   // ~ridge-skimming; ~300 ft AGL over the immediate terrain
		groundspeedMps: 36,         // ~70 kt
		trueTrackDeg: 250,
		verticalRateMps: -0.8,
	}),
	make({
		id: 'tanker-21',
		callsign: 'Tanker 21',
		category: 'air-tanker',
		// On a retardant run, just north of the fire, low and fast.
		lat: 37.8650,
		lon: -107.8000,
		altitudeMslMeters: 3050,    // ~150 ft AGL on the run
		groundspeedMps: 78,          // ~150 kt
		trueTrackDeg: 195,
		verticalRateMps: 0,
	}),
	make({
		id: 'recon-N142',
		callsign: 'Recon 142',
		category: 'recon-fw',
		// Orbiting NE of the fire at recon altitude.
		lat: 37.8950,
		lon: -107.7400,
		altitudeMslMeters: 3650,    // ~2,500 ft AGL over high terrain
		groundspeedMps: 62,          // ~120 kt
		trueTrackDeg: 280,
		verticalRateMps: 0.2,
	}),
	make({
		id: 'atgs-air-attack',
		callsign: 'Air Attack 12',
		category: 'atgs-fw',
		// Higher orbit S of the fire, coordinating air ops.
		lat: 37.8150,
		lon: -107.8250,
		altitudeMslMeters: 4050,    // ~3,500 ft AGL — air boss altitude
		groundspeedMps: 67,          // ~130 kt
		trueTrackDeg: 90,
		verticalRateMps: 0,
	}),
	make({
		id: 'uas-sheriff-1',
		callsign: 'Eagle 1',
		category: 'uas-sheriff',
		// Holding over a structure-protection corner, low.
		lat: 37.8420,
		lon: -107.8150,
		altitudeMslMeters: 2780,    // ~400 ft AGL
		groundspeedMps: 6,           // ~12 kt — quadcopter loiter
		trueTrackDeg: 0,
		verticalRateMps: 0,
	}),
];
