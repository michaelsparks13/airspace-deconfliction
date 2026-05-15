/**
 * Shared aircraft-state interface. Replay mode (mock JSON) and live mode
 * (OpenSky) both produce this shape, so rendering and deconfliction code is
 * agnostic to where the data came from.
 *
 * All values are SI-internal: meters / m/s / radians (where applicable).
 * Display-layer conversion to feet / knots / degrees lives in src/geo/units.ts.
 */

export type AircraftCategory =
	| 'helo-type1'      // Type 1 helicopter (heavy water bucket / drop)
	| 'air-tanker'      // Fixed-wing retardant tanker
	| 'recon-fw'        // Fixed-wing reconnaissance / observation orbit
	| 'atgs-fw'         // Fixed-wing Air Tactical Group Supervisor ("Air Attack")
	| 'uas-sheriff';    // Sheriff's small unmanned aircraft system

export type CrewType = 'manned' | 'uas';

export interface Aircraft {
	/** Stable identifier — used for tracking across snapshots and as the three.js group key. */
	id: string;
	callsign: string;
	category: AircraftCategory;
	crew: CrewType;

	/** Position. lat/lon WGS84 decimal degrees, altitude in meters MSL. */
	lat: number;
	lon: number;
	altitudeMslMeters: number;

	/** Velocity. groundspeed in m/s, true_track in degrees from north (0..360). */
	groundspeedMps: number;
	trueTrackDeg: number;

	/** Vertical rate in m/s (positive = climbing). Optional — UAS often null. */
	verticalRateMps?: number;
}

/**
 * Convenience helper: which categories are manned vs uas. Single source of
 * truth so UI badges, mesh selection, and stem dashing all stay consistent.
 */
export function crewFor(category: AircraftCategory): CrewType {
	return category === 'uas-sheriff' ? 'uas' : 'manned';
}
