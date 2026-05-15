/**
 * OpenSky Network `/states/all` adapter.
 *
 * Fetches a bbox-filtered snapshot of every aircraft transmitting ADS-B in
 * the demo area and maps each state vector into our Aircraft shape so the
 * renderer + deconfliction never branch on data source.
 *
 * State vector indices verified against
 *   https://openskynetwork.github.io/opensky-api/rest.html
 * (slice 5 plan grounding step, still current at the time of writing).
 *
 * Notes for the README:
 *  - The San Juans bbox is wilderness; live mode typically returns 0
 *    aircraft. The integration is what's being demonstrated. Expanding the
 *    bbox over a major airport (KDEN, KCOS) immediately produces traffic.
 *  - Anonymous OpenSky rate limits tightened in 2024; 10 s polling for a
 *    single demo client fits anonymous quotas but is on the edge.
 */

import type { Aircraft, AircraftCategory, CrewType } from './types';
import { DEMO_BBOX, LIVE } from '../config';

// Documented field order of each /states/all state vector array.
const IDX = {
	icao24: 0,
	callsign: 1,
	longitude: 4,
	latitude: 5,
	baroAltitude: 6,
	onGround: 7,
	velocity: 8,
	trueTrack: 9,
	verticalRate: 10,
	geoAltitude: 12,
} as const;

interface OpenSkyStatesResponse {
	time: number;
	states: unknown[][] | null;
}

function pickNumber(state: unknown[], idx: number): number | null {
	const v = state[idx];
	return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function pickString(state: unknown[], idx: number): string | null {
	const v = state[idx];
	return typeof v === 'string' ? v : null;
}

function pickBool(state: unknown[], idx: number): boolean {
	return state[idx] === true;
}

/**
 * Best-effort category inference from OpenSky's limited fields. OpenSky doesn't
 * tell us "this is a helicopter" without the `extended=1` `category` field
 * (which itself only gives a small number of ICAO categories). For demo
 * legibility we infer rotorcraft from low speed + low altitude, and otherwise
 * call it a generic fixed-wing.
 */
function inferCategory(altMsl: number, groundspeedMps: number): {
	category: AircraftCategory;
	crew: CrewType;
} {
	if (groundspeedMps < 40 && altMsl < 4000) {
		return { category: 'helo-type1', crew: 'manned' };
	}
	return { category: 'recon-fw', crew: 'manned' };
}

export async function fetchOpenSkyStates(signal?: AbortSignal): Promise<Aircraft[]> {
	const params = new URLSearchParams({
		lamin: String(DEMO_BBOX.latMin),
		lomin: String(DEMO_BBOX.lonMin),
		lamax: String(DEMO_BBOX.latMax),
		lomax: String(DEMO_BBOX.lonMax),
	});
	const url = `${LIVE.endpoint}?${params}`;
	const res = await fetch(url, { signal });
	if (!res.ok) {
		throw new Error(`OpenSky HTTP ${res.status}`);
	}
	const data = (await res.json()) as OpenSkyStatesResponse;
	if (!data.states) return [];

	const out: Aircraft[] = [];
	for (const s of data.states) {
		if (pickBool(s, IDX.onGround)) continue;
		const lat = pickNumber(s, IDX.latitude);
		const lon = pickNumber(s, IDX.longitude);
		if (lat === null || lon === null) continue;

		const baro = pickNumber(s, IDX.baroAltitude);
		const geo = pickNumber(s, IDX.geoAltitude);
		const altMsl = baro ?? geo;
		if (altMsl === null) continue;

		const icao = pickString(s, IDX.icao24)?.trim() ?? `unknown-${out.length}`;
		const callsignRaw = pickString(s, IDX.callsign)?.trim();
		const callsign = callsignRaw && callsignRaw.length > 0 ? callsignRaw : icao.toUpperCase();
		const groundspeed = pickNumber(s, IDX.velocity) ?? 0;
		const heading = pickNumber(s, IDX.trueTrack) ?? 0;
		const vrate = pickNumber(s, IDX.verticalRate) ?? 0;
		const { category, crew } = inferCategory(altMsl, groundspeed);

		out.push({
			id: icao,
			callsign,
			category,
			crew,
			lat,
			lon,
			altitudeMslMeters: altMsl,
			groundspeedMps: groundspeed,
			trueTrackDeg: heading,
			verticalRateMps: vrate,
		});
	}
	return out;
}
