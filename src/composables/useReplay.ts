// Replay playback. Advances currentTime via rAF, exposes the reactive
// aircraft array from the replay adapter, and the play/pause/seek/speed
// controls that TimeBar binds to.

import { computed, onScopeDispose, ref, shallowRef } from 'vue';
import type { Aircraft } from '../data/types';
import { createReplayAdapter, SCENARIO_DURATION } from '../data/replay';
import { REPLAY } from '../config';

export function useReplay() {
	const adapter = createReplayAdapter();
	const currentTime = ref(0);
	const isPlaying = ref(true);
	const speed = ref<number>(REPLAY.defaultSpeed);
	const aircraft = shallowRef<Aircraft[]>(adapter.at(0));

	let rafHandle = 0;
	let lastWallMs = 0;

	function tick(nowMs: number): void {
		if (!isPlaying.value) {
			lastWallMs = nowMs;
			aircraft.value = adapter.at(currentTime.value);
			rafHandle = requestAnimationFrame(tick);
			return;
		}
		const dt = lastWallMs === 0 ? 0 : (nowMs - lastWallMs) / 1000;
		lastWallMs = nowMs;
		let next = currentTime.value + dt * speed.value;
		if (next >= SCENARIO_DURATION) {
			// Wrap so the demo loops unattended.
			next = next % SCENARIO_DURATION;
		}
		currentTime.value = next;
		aircraft.value = adapter.at(next);
		rafHandle = requestAnimationFrame(tick);
	}

	rafHandle = requestAnimationFrame(tick);

	onScopeDispose(() => {
		if (rafHandle) cancelAnimationFrame(rafHandle);
	});

	function play(): void { isPlaying.value = true; }
	function pause(): void { isPlaying.value = false; }
	function toggle(): void { isPlaying.value = !isPlaying.value; }
	function seek(t: number): void {
		currentTime.value = Math.max(0, Math.min(SCENARIO_DURATION, t));
		aircraft.value = adapter.at(currentTime.value);
	}
	function setSpeed(s: number): void { speed.value = s; }

	const progress = computed(() => currentTime.value / SCENARIO_DURATION);

	return {
		// state
		currentTime,
		isPlaying,
		speed,
		aircraft,
		progress,
		duration: SCENARIO_DURATION,
		// actions
		play,
		pause,
		toggle,
		seek,
		setSpeed,
	};
}

export type ReplayState = ReturnType<typeof useReplay>;
