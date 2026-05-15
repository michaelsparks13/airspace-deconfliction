/**
 * Single source of truth for the current aircraft fleet. Switches between
 * replay (default, offline) and live (OpenSky) modes via setMode().
 *
 * Module-level singleton — created on first import — so the AircraftLayer
 * (outside the Vue tree) can read the same ref the panel + time bar do.
 */

import { computed, ref, watch, type Ref, type ShallowRef } from 'vue';
import type { Aircraft } from '../data/types';
import { useReplay, type ReplayState } from './useReplay';
import { useLive, type LiveState } from './useLive';

export type DataMode = 'replay' | 'live';

interface Store {
	mode: Ref<DataMode>;
	replay: ReplayState;
	live: LiveState;
	aircraft: ShallowRef<Aircraft[]>;
	setMode: (m: DataMode) => void;
}

let singleton: Store | null = null;

function build(): Store {
	const mode = ref<DataMode>('replay');
	const replay = useReplay();
	const live = useLive();

	const aircraft = computed<Aircraft[]>(() =>
		mode.value === 'replay' ? replay.aircraft.value : live.aircraft.value,
	) as unknown as ShallowRef<Aircraft[]>;

	watch(
		mode,
		(m) => {
			if (m === 'live') {
				live.start();
			} else {
				live.stop();
			}
		},
		{ immediate: true },
	);

	return {
		mode,
		replay,
		live,
		aircraft,
		setMode: (m: DataMode) => { mode.value = m; },
	};
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
