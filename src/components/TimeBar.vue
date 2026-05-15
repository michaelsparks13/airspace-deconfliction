<script setup lang="ts">
import { computed } from 'vue';
import { useAircraftStore } from '../composables/useAircraftStore';
import { REPLAY } from '../config';

const replay = useAircraftStore();

const tDisplay = computed(() => {
	const t = Math.floor(replay.currentTime.value);
	const m = Math.floor(t / 60);
	const s = t % 60;
	return `T+${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
});

function onScrub(e: Event) {
	const target = e.target as HTMLInputElement;
	const t = (Number(target.value) / 1000) * replay.duration;
	replay.seek(t);
}

const scrubPosition = computed(() => Math.round(replay.progress.value * 1000));
</script>

<template>
	<div class="time-bar">
		<button
			class="play-btn"
			:aria-label="replay.isPlaying.value ? 'Pause' : 'Play'"
			@click="replay.toggle()"
		>
			<svg v-if="replay.isPlaying.value" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
				<rect x="6" y="5" width="4" height="14" fill="currentColor" />
				<rect x="14" y="5" width="4" height="14" fill="currentColor" />
			</svg>
			<svg v-else viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
				<polygon points="6,4 20,12 6,20" fill="currentColor" />
			</svg>
		</button>

		<input
			type="range"
			class="scrub"
			min="0"
			max="1000"
			:value="scrubPosition"
			@input="onScrub"
			:aria-label="`Scenario time, ${tDisplay}`"
		/>

		<div class="t-display">{{ tDisplay }}</div>

		<div class="speeds" role="group" aria-label="Playback speed">
			<button
				v-for="s in REPLAY.availableSpeeds"
				:key="s"
				:class="['speed-btn', { active: replay.speed.value === s }]"
				@click="replay.setSpeed(s)"
			>{{ s }}×</button>
		</div>
	</div>
</template>

<style scoped>
.time-bar {
	position: absolute;
	left: 16px;
	right: 360px;       /* leave room for the right-rail panel that slice 9 lands */
	bottom: 16px;
	height: 56px;
	padding: 0 14px;
	display: flex;
	align-items: center;
	gap: 14px;
	background: rgba(17, 21, 28, 0.92);
	border: 1px solid var(--border-strong);
	border-radius: 6px;
	backdrop-filter: blur(8px);
	box-shadow: 0 6px 22px rgba(0, 0, 0, 0.6);
	z-index: 10;
}

.play-btn {
	width: 38px;
	height: 38px;
	padding: 0;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	color: var(--text-bright);
}

.scrub {
	flex: 1;
	appearance: none;
	height: 6px;
	background: linear-gradient(
		to right,
		var(--accent) 0%,
		var(--accent) calc(var(--p, 0) * 1%),
		var(--border-strong) calc(var(--p, 0) * 1%),
		var(--border-strong) 100%
	);
	border-radius: 3px;
	outline: none;
	cursor: pointer;
}

.scrub::-webkit-slider-thumb {
	appearance: none;
	width: 14px;
	height: 14px;
	border-radius: 50%;
	background: var(--text-bright);
	cursor: grab;
	box-shadow: 0 0 0 3px rgba(58, 163, 255, 0.25);
}

.scrub::-moz-range-thumb {
	width: 14px;
	height: 14px;
	border-radius: 50%;
	background: var(--text-bright);
	cursor: grab;
	box-shadow: 0 0 0 3px rgba(58, 163, 255, 0.25);
	border: none;
}

.t-display {
	font-family: var(--mono);
	font-size: 13px;
	color: var(--text-bright);
	letter-spacing: 0.5px;
	min-width: 72px;
	text-align: center;
}

.speeds {
	display: flex;
	gap: 4px;
}

.speed-btn {
	padding: 4px 10px;
	font-size: 12px;
	font-family: var(--mono);
	color: var(--text-dim);
	border-color: var(--border);
}

.speed-btn.active {
	color: var(--text-bright);
	border-color: var(--accent);
	background: var(--accent-dim);
}
</style>
