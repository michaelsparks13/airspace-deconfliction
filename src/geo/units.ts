// Display-only conversions. Internal math is meters / m/s; feet, knots,
// and nautical miles belong inside UI strings, not in module state.

export const METERS_PER_FOOT = 0.3048;
export const METERS_PER_NMI = 1852;
export const MPS_PER_KNOT = 0.514444;

export function metersToFeet(m: number): number {
	return m / METERS_PER_FOOT;
}

export function metersToNmi(m: number): number {
	return m / METERS_PER_NMI;
}

export function mpsToKnots(mps: number): number {
	return mps / MPS_PER_KNOT;
}

/** "1,250 ft", comma-grouped, no decimals by default. */
export function fmtFeet(m: number | null | undefined, fractionDigits = 0): string {
	if (m === null || m === undefined || Number.isNaN(m)) return '—';
	return `${metersToFeet(m).toLocaleString(undefined, { maximumFractionDigits: fractionDigits })} ft`;
}

/** "0.6 nm". */
export function fmtNmi(m: number, fractionDigits = 2): string {
	return `${metersToNmi(m).toFixed(fractionDigits)} nm`;
}

/** "118 kt". */
export function fmtKnots(mps: number, fractionDigits = 0): string {
	return `${mpsToKnots(mps).toFixed(fractionDigits)} kt`;
}
