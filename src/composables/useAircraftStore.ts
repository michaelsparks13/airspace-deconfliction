// Module-level singleton for the current fleet so the three.js AircraftLayer
// (outside the Vue tree) reads the same shallowRef as the side panel and
// time bar. Replay-only: the OpenSky live integration is pulled, see git
// history for the prior union-mode plumbing.

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
