/**
 * Single source of truth for the current aircraft fleet. Replay mode (slice 5)
 * is the only feeder right now; slice 8 will add a live-mode branch that
 * fulfils the same shape, so renderers and deconfliction code never care
 * which mode is active.
 *
 * Implemented as a module-level singleton — created once on first import — so
 * the AircraftLayer (which lives outside the Vue component tree) can read the
 * same shallowRef the panel and time bar do.
 */

import type { Aircraft } from '../data/types';
import type { ShallowRef } from 'vue';
import { useReplay, type ReplayState } from './useReplay';

let singleton: { replay: ReplayState } | null = null;

function ensure() {
	if (!singleton) singleton = { replay: useReplay() };
	return singleton;
}

export function useAircraftStore() {
	return ensure().replay;
}

/** For non-Vue consumers (the three.js layer): a stable getter. */
export function getCurrentAircraft(): readonly Aircraft[] {
	return ensure().replay.aircraft.value;
}

export function getAircraftRef(): ShallowRef<Aircraft[]> {
	return ensure().replay.aircraft;
}
