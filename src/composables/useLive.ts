/**
 * Live-mode adapter: polls OpenSky every LIVE.pollMs and exposes the latest
 * Aircraft[] snapshot in the same shape replay produces.
 *
 * Polling is started/stopped on demand by useAircraftStore() so we don't
 * burn OpenSky quota while the user is in replay mode.
 */

import { onScopeDispose, ref, shallowRef } from 'vue';
import type { Aircraft } from '../data/types';
import { fetchOpenSkyStates } from '../data/opensky';
import { LIVE } from '../config';

export type LiveStatus = 'idle' | 'fetching' | 'ok' | 'error';

export function useLive() {
	const aircraft = shallowRef<Aircraft[]>([]);
	const status = ref<LiveStatus>('idle');
	const lastErrorMessage = ref<string | null>(null);
	const lastFetchedMs = ref<number | null>(null);

	let timer: ReturnType<typeof setInterval> | null = null;
	let controller: AbortController | null = null;
	let running = false;

	async function fetchOnce(): Promise<void> {
		controller?.abort();
		controller = new AbortController();
		status.value = 'fetching';
		try {
			const fresh = await fetchOpenSkyStates(controller.signal);
			aircraft.value = fresh;
			lastFetchedMs.value = Date.now();
			lastErrorMessage.value = null;
			status.value = 'ok';
		} catch (err) {
			if ((err as { name?: string }).name === 'AbortError') return;
			lastErrorMessage.value = (err as Error).message;
			status.value = 'error';
		}
	}

	function start(): void {
		if (running) return;
		running = true;
		void fetchOnce();
		timer = setInterval(fetchOnce, LIVE.pollMs);
	}

	function stop(): void {
		running = false;
		if (timer) {
			clearInterval(timer);
			timer = null;
		}
		controller?.abort();
	}

	onScopeDispose(() => stop());

	return {
		aircraft,
		status,
		lastErrorMessage,
		lastFetchedMs,
		start,
		stop,
		fetchOnce,
	};
}

export type LiveState = ReturnType<typeof useLive>;
