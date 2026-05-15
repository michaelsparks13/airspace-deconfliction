/**
 * Great-circle (haversine) distance between two lat/lon points, in METERS.
 *
 * Pure function — no allocations, no dependencies. Re-used by the
 * deconfliction layer's pairwise loop and by the conflict-banner UI.
 *
 * Mean Earth radius (WGS84-ish): 6,371,008.8 m.
 */

const EARTH_RADIUS_M = 6_371_008.8;

function toRad(deg: number): number {
	return (deg * Math.PI) / 180;
}

export function haversineMeters(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number,
): number {
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return EARTH_RADIUS_M * c;
}
