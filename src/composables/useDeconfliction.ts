/**
 * Reactive wrapper around detectConflicts(). Recomputes on every fleet
 * snapshot change, against the scenario's Fire Traffic Area.
 */

import { computed } from 'vue';
import {
	aircraftIdsInConflicts,
	conflictLinePairs,
	detectConflicts,
	type Conflict,
} from '../deconfliction';
import { SCENARIO_FTA } from '../fta';
import { useAircraftStore } from './useAircraftStore';

let cached: ReturnType<typeof build> | null = null;

function build() {
	const store = useAircraftStore();
	const conflicts = computed<Conflict[]>(() =>
		detectConflicts(store.aircraft.value, SCENARIO_FTA),
	);
	/** ids in a critical conflict — render as a pulsing red cue. */
	const criticalIds = computed(() =>
		aircraftIdsInConflicts(conflicts.value, 'critical'),
	);
	/** ids in a caution/advisory conflict but NOT critical — steady amber. */
	const cautionIds = computed(() => {
		const crit = criticalIds.value;
		const out = new Set<string>();
		for (const id of aircraftIdsInConflicts(conflicts.value, 'advisory')) {
			if (!crit.has(id)) out.add(id);
		}
		return out;
	});
	/** id pairs for the 3D conflict lines (stack-proximity only). */
	const linePairs = computed(() => conflictLinePairs(conflicts.value));
	return { conflicts, criticalIds, cautionIds, linePairs };
}

export function useDeconfliction() {
	if (!cached) cached = build();
	return cached;
}

/** Non-Vue accessor for the three.js AircraftLayer. */
export function getCurrentConflicts(): readonly Conflict[] {
	if (!cached) cached = build();
	return cached.conflicts.value;
}
