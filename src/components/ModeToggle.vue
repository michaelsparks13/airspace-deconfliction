<script setup lang="ts">
import { computed } from 'vue';
import { useAircraftStore, type DataMode } from '../composables/useAircraftStore';

const store = useAircraftStore();

const mode = computed<DataMode>({
	get: () => store.mode.value,
	set: (m) => store.setMode(m),
});

const liveStatus = computed(() => store.live.status.value);
const liveCount = computed(() => store.live.aircraft.value.length);
const lastError = computed(() => store.live.lastErrorMessage.value);
</script>

<template>
	<div class="mode-toggle" role="group" aria-label="Data source">
		<button
			:class="['seg', { active: mode === 'replay' }]"
			:aria-pressed="mode === 'replay'"
			@click="mode = 'replay'"
		>
			Replay
		</button>
		<button
			:class="['seg', { active: mode === 'live' }]"
			:aria-pressed="mode === 'live'"
			@click="mode = 'live'"
		>
			Live
			<span v-if="mode === 'live'" :class="['dot', liveStatus]" aria-hidden="true" />
		</button>
		<div v-if="mode === 'live'" class="live-meta">
			<span v-if="liveStatus === 'fetching'">polling…</span>
			<span v-else-if="liveStatus === 'error'" class="err" :title="lastError ?? ''">
				request failed
			</span>
			<span v-else-if="liveCount === 0">no aircraft in bbox</span>
			<span v-else>{{ liveCount }} aircraft</span>
		</div>
	</div>
</template>

<style scoped>
.mode-toggle {
	position: absolute;
	top: 16px;
	right: 16px;
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 4px;
	background: rgba(17, 21, 28, 0.92);
	border: 1px solid var(--border-strong);
	border-radius: 6px;
	box-shadow: 0 6px 22px rgba(0, 0, 0, 0.55);
	z-index: 10;
}

.seg {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	font-family: var(--mono);
	font-size: 12px;
	letter-spacing: 0.5px;
	color: var(--text-dim);
	border: none;
	background: transparent;
	padding: 5px 10px;
	border-radius: 4px;
}

.seg.active {
	color: var(--text-bright);
	background: var(--accent-dim);
	box-shadow: inset 0 0 0 1px var(--accent);
}

.dot {
	width: 7px;
	height: 7px;
	border-radius: 50%;
	background: var(--text-dim);
}

.dot.fetching {
	background: var(--accent);
	animation: dot-pulse 1.2s ease-in-out infinite;
}

.dot.ok {
	background: var(--agl-green);
}

.dot.error {
	background: var(--conflict);
}

.live-meta {
	font-family: var(--mono);
	font-size: 11px;
	color: var(--text-dim);
	padding-right: 6px;
	white-space: nowrap;
}

.err {
	color: var(--conflict);
}

@keyframes dot-pulse {
	0%, 100% { opacity: 0.6; }
	50%      { opacity: 1; }
}
</style>
