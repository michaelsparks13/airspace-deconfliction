// Shared aircraft-state and airspace-structure types.
//
// SI-internal: meters / m/s / degrees. Display conversion lives in
// src/geo/units.ts.
//
// Each Aircraft carries the structural fields the fireground deconfliction
// model needs (assignedBlock, operationId, participant) alongside raw state.

export type AircraftCategory =
	| 'helo-type1'      // Type 1 helicopter (heavy water bucket / drop)
	| 'air-tanker'      // Fixed-wing retardant tanker
	| 'recon-fw'        // Fixed-wing reconnaissance / observation orbit
	| 'atgs-fw'         // Fixed-wing Air Tactical Group Supervisor ("Air Attack")
	| 'uas-sheriff'     // Sheriff's small unmanned aircraft system
	| 'ga-fixed-wing';  // General aviation single (Cessna / Cirrus class) — non-FTA

export type CrewType = 'manned' | 'uas';

/** Slot in the FTA vertical stack, AGL. Assigned by the ATGS. */
export interface AltitudeBlock {
	/** Short label, e.g. 'ROTOR', 'TANKER', 'RECON', 'ATGS'. */
	label: string;
	floorAglMeters: number;
	ceilAglMeters: number;
}

export interface Aircraft {
	/** Stable identifier, also the three.js group key. */
	id: string;
	callsign: string;
	category: AircraftCategory;
	crew: CrewType;

	lat: number;
	lon: number;
	altitudeMslMeters: number;

	/**
	 * Height above ground, meters. Baked by the scenario generator against
	 * the same DEM that produced altitudeMslMeters, so AGL and MSL are
	 * consistent and the deconfliction layer needs no terrain sampler.
	 */
	aglMeters: number;

	groundspeedMps: number;
	/** True track in degrees from north, [0, 360). */
	trueTrackDeg: number;
	/** Positive = climbing. */
	verticalRateMps: number;

	/** ATGS-assigned slot in the stack. */
	assignedBlock: AltitudeBlock;

	/**
	 * When two aircraft share an operationId (e.g. lead + tanker on one
	 * retardant run) they're expected to be close, and pairwise proximity
	 * between them is suppressed. Undefined = not coordinated.
	 */
	operationId?: string;

	/** False = not checked in to the FTA. Inside the TFR, that's an intrusion. */
	participant: boolean;
}

export function crewFor(category: AircraftCategory): CrewType {
	return category === 'uas-sheriff' ? 'uas' : 'manned';
}
