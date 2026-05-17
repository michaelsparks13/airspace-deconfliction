// Fire Traffic Area for the scenario: 12 NM ICOM ring, vertical stack
// (defined in config.ts), and the operational zones (drop zone, convective
// column, dip site). Pure data + pure functions.

import { FTA, SCENARIO_CENTER, TFR } from './config';
import { haversineMeters } from './geo/haversine';

export type ZoneKind = 'drop-zone' | 'convective-column' | 'dip-site';

/** Vertical cylinder of airspace. ceilAglMeters === null = unbounded. */
export interface OperationalZone {
	id: string;
	kind: ZoneKind;
	label: string;
	centerLat: number;
	centerLon: number;
	radiusMeters: number;
	floorAglMeters: number;
	ceilAglMeters: number | null;
}

export interface FireTrafficArea {
	centerLat: number;
	centerLon: number;
	icomRingRadiusMeters: number;
	tfr: {
		centerLat: number;
		centerLon: number;
		radiusMeters: number;
		ceilingMslMeters: number;
	};
	zones: readonly OperationalZone[];
}

const [CENTER_LON, CENTER_LAT] = SCENARIO_CENTER;

// Drop zone sits on the fire's NE edge where Tanker 21 runs retardant;
// the convective column rises over the hot core; the dip site is the
// drainage 5H descends to. Positions are tunables.
export const SCENARIO_ZONES: readonly OperationalZone[] = [
	{
		id: 'dz-1',
		kind: 'drop-zone',
		label: 'Active drop zone',
		centerLat: 37.8595,
		centerLon: -107.7850,
		radiusMeters: 450,
		floorAglMeters: 0,
		ceilAglMeters: 245,        // ~800 ft, run + pull-up envelope
	},
	{
		id: 'col-1',
		kind: 'convective-column',
		label: 'Convective column',
		centerLat: 37.8560,
		centerLon: -107.7950,
		radiusMeters: 700,
		floorAglMeters: 0,
		ceilAglMeters: null,       // unbounded no-fly core
	},
	{
		id: 'dip-1',
		kind: 'dip-site',
		label: 'Helo dip site',
		centerLat: 37.8500,
		centerLon: -107.7620,
		radiusMeters: 300,
		floorAglMeters: 0,
		ceilAglMeters: 120,
	},
] as const;

export const SCENARIO_FTA: FireTrafficArea = {
	centerLat: CENTER_LAT,
	centerLon: CENTER_LON,
	icomRingRadiusMeters: FTA.icomRingRadiusMeters,
	tfr: {
		centerLat: TFR.centerLat,
		centerLon: TFR.centerLon,
		radiusMeters: TFR.radiusMeters,
		ceilingMslMeters: TFR.ceilingMeters,
	},
	zones: SCENARIO_ZONES,
};

export function horizontalMeters(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number,
): number {
	return haversineMeters(lat1, lon1, lat2, lon2);
}

export function isInsideZone(
	lat: number,
	lon: number,
	aglMeters: number,
	zone: OperationalZone,
): boolean {
	const horiz = horizontalMeters(lat, lon, zone.centerLat, zone.centerLon);
	if (horiz > zone.radiusMeters) return false;
	if (aglMeters < zone.floorAglMeters) return false;
	if (zone.ceilAglMeters !== null && aglMeters > zone.ceilAglMeters) return false;
	return true;
}

export function isInsideTfrCylinder(
	lat: number,
	lon: number,
	altitudeMslMeters: number,
	fta: FireTrafficArea,
): boolean {
	const horiz = horizontalMeters(lat, lon, fta.tfr.centerLat, fta.tfr.centerLon);
	return horiz <= fta.tfr.radiusMeters && altitudeMslMeters <= fta.tfr.ceilingMslMeters;
}
