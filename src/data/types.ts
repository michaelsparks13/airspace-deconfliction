/**
 * Shared aircraft-state and airspace-structure interfaces.
 *
 * All values are SI-internal: meters / m/s / degrees. Display-layer
 * conversion to feet / knots / nm lives in src/geo/units.ts.
 *
 * Deconfliction over a fire is not en-route CD&R: the primitives are the
 * ATGS-assigned altitude block (the "stack"), the Fire Traffic Area, and the
 * operational zones. Aircraft therefore carry the structural fields the
 * detector needs — assignedBlock, operationId, participant — alongside raw
 * state.
 */

export type AircraftCategory =
	| 'helo-type1'      // Type 1 helicopter (heavy water bucket / drop)
	| 'air-tanker'      // Fixed-wing retardant tanker
	| 'recon-fw'        // Fixed-wing reconnaissance / observation orbit
	| 'atgs-fw'         // Fixed-wing Air Tactical Group Supervisor ("Air Attack")
	| 'uas-sheriff';    // Sheriff's small unmanned aircraft system

export type CrewType = 'manned' | 'uas';

/**
 * A slot in the FTA vertical stack, expressed AGL. The ATGS assigns one to
 * each participating aircraft; conformance to it is the primary deconfliction
 * check.
 */
export interface AltitudeBlock {
	/** Short label, e.g. 'ROTOR', 'TANKER', 'RECON', 'ATGS'. */
	label: string;
	floorAglMeters: number;
	ceilAglMeters: number;
}

export interface Aircraft {
	/** Stable identifier — tracked across snapshots, used as three.js group key. */
	id: string;
	callsign: string;
	category: AircraftCategory;
	crew: CrewType;

	/** Position. lat/lon WGS84 decimal degrees, altitude meters MSL. */
	lat: number;
	lon: number;
	altitudeMslMeters: number;

	/**
	 * Height above ground, meters. Baked by the scenario generator against the
	 * same DEM that produced altitudeMslMeters, so AGL and MSL are mutually
	 * consistent and the deconfliction layer needs no terrain sampler of its
	 * own.
	 */
	aglMeters: number;

	/** Velocity. groundspeed m/s, true_track degrees from north [0,360). */
	groundspeedMps: number;
	trueTrackDeg: number;
	/** Vertical rate m/s, positive = climbing. */
	verticalRateMps: number;

	/** ATGS-assigned slot in the stack. */
	assignedBlock: AltitudeBlock;

	/**
	 * Aircraft sequenced into the same operation (e.g. a lead + tanker pair on
	 * one retardant run) are expected to be close — proximity between them is
	 * sanctioned and suppressed. Undefined = not in a coordinated operation.
	 */
	operationId?: string;

	/**
	 * False = not checked in to the FTA / not under ATGS control. A
	 * non-participant inside the TFR is an intrusion.
	 */
	participant: boolean;
}

/**
 * Convenience helper: which categories are manned vs uas. Single source of
 * truth so UI badges, mesh selection, and stem dashing stay consistent.
 */
export function crewFor(category: AircraftCategory): CrewType {
	return category === 'uas-sheriff' ? 'uas' : 'manned';
}
