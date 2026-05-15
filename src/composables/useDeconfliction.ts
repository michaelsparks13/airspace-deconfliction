/**
 * Reactive wrapper around detectConflicts(). Recomputes on every fleet
 * snapshot change.
 */

import { computed } from 'vue';
import { detectConflicts, conflictIdsFromPairs, type ConflictPair } from '../deconfliction';
import { useAircraftStore } from './useAircraftStore';

let cached: ReturnType<typeof build> | null = null;

function build() {
	const store = useAircraftStore();
	const conflicts = computed<ConflictPair[]>(() => detectConflicts(store.aircraft.value));
	const conflictIds = computed<Set<string>>(() => conflictIdsFromPairs(conflicts.value));
	return { conflicts, conflictIds };
}

export function useDeconfliction() {
	if (!cached) cached = build();
	return cached;
}

/** Non-Vue accessor for the three.js custom layer. */
export function getCurrentConflicts(): readonly ConflictPair[] {
	if (!cached) cached = build();
	return cached.conflicts.value;
}
