/**
 * Reactive wrapper around detectConflicts(). Recomputes on every fleet
 * snapshot change.
 */

import { computed } from 'vue';
import {
	conflictIdsFromPairs,
	detectConflicts,
	detectWarnings,
	type ConflictPair,
	type WarningPair,
} from '../deconfliction';
import { useAircraftStore } from './useAircraftStore';

let cached: ReturnType<typeof build> | null = null;

function build() {
	const store = useAircraftStore();
	const conflicts = computed<ConflictPair[]>(() => detectConflicts(store.aircraft.value));
	const warnings = computed<WarningPair[]>(() => detectWarnings(store.aircraft.value));
	const conflictIds = computed<Set<string>>(() => conflictIdsFromPairs(conflicts.value));
	const warningIds = computed<Set<string>>(() => conflictIdsFromPairs(warnings.value));
	return { conflicts, warnings, conflictIds, warningIds };
}

export function useDeconfliction() {
	if (!cached) cached = build();
	return cached;
}

/** Non-Vue accessors for the three.js custom layer. */
export function getCurrentConflicts(): readonly ConflictPair[] {
	if (!cached) cached = build();
	return cached.conflicts.value;
}

export function getCurrentWarnings(): readonly WarningPair[] {
	if (!cached) cached = build();
	return cached.warnings.value;
}
