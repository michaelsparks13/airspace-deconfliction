/**
 * Single source of truth for the current aircraft fleet. Replay-only:
 * the OpenSky live integration that used to live here was a portfolio
 * stretch that didn't add demo value over a wilderness bbox, so it was
 * removed. If a live source is needed later, drop it back in behind a
 * mode ref and re-introduce the union here.
 *
 * Module-level singleton so the three.js AircraftLayer (outside the Vue
 * tree) can read the same shallowRef the panel and time bar consume.
 */

import type { Aircraft } from '../data/types';
import type { ShallowRef } from 'vue';
import { useReplay, type ReplayState } from './useReplay';

interface Store {
	replay: ReplayState;
	aircraft: ShallowRef<Aircraft[]>;
}

let singleton: Store | null = null;

function build(): Store {
	const replay = useReplay();
	return { replay, aircraft: replay.aircraft };
}

function ensure(): Store {
	if (!singleton) singleton = build();
	return singleton;
}

export function useAircraftStore(): Store {
	return ensure();
}

/** Non-Vue accessor for the three.js layer. */
export function getCurrentAircraft(): readonly Aircraft[] {
	return ensure().aircraft.value;
}

export function getAircraftRef(): ShallowRef<Aircraft[]> {
	return ensure().aircraft;
}
