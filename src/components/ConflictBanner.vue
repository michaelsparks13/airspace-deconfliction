<script setup lang="ts">
import { computed } from 'vue';
import { useDeconfliction } from '../composables/useDeconfliction';
import { fmtFeet, fmtNmi } from '../geo/units';

const { conflicts } = useDeconfliction();

const visible = computed(() => conflicts.value.length > 0);
const primary = computed(() => conflicts.value[0]);
const additional = computed(() => Math.max(0, conflicts.value.length - 1));
</script>

<template>
	<Transition name="banner">
		<div v-if="visible && primary" class="conflict-banner" role="alert" aria-live="assertive">
			<div class="bell" aria-hidden="true">
				<svg viewBox="0 0 24 24" width="20" height="20">
					<path
						d="M12 2 L22 20 L2 20 Z"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linejoin="round"
					/>
					<line x1="12" y1="9" x2="12" y2="14" stroke="currentColor" stroke-width="2" />
					<circle cx="12" cy="17" r="1" fill="currentColor" />
				</svg>
			</div>
			<div class="label">CONFLICT</div>
			<div class="pair">
				<span class="callsign">{{ primary.aCallsign }}</span>
				<span class="sep" aria-hidden="true">↔</span>
				<span class="callsign">{{ primary.bCallsign }}</span>
			</div>
			<div class="metrics">
				<span class="metric">{{ fmtNmi(primary.lateralMeters) }}</span>
				<span class="metric-sep" aria-hidden="true">·</span>
				<span class="metric">{{ fmtFeet(primary.verticalMeters) }}</span>
			</div>
			<div v-if="additional > 0" class="additional">+{{ additional }} more</div>
		</div>
	</Transition>
</template>

<style scoped>
.conflict-banner {
	position: absolute;
	top: 16px;
	left: 50%;
	transform: translateX(-50%);
	min-width: 360px;
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 8px 16px;
	background: rgba(40, 6, 6, 0.95);
	border: 1px solid var(--conflict);
	border-radius: 4px;
	box-shadow: 0 0 0 2px var(--conflict-glow), 0 6px 22px rgba(0, 0, 0, 0.55);
	color: var(--text-bright);
	z-index: 20;
	animation: banner-pulse 1.5s ease-in-out infinite;
}

.bell {
	color: var(--conflict);
}

.label {
	font-family: var(--mono);
	font-weight: 700;
	letter-spacing: 1.5px;
	font-size: 12px;
	color: var(--conflict);
}

.pair {
	display: flex;
	align-items: center;
	gap: 6px;
	font-weight: 600;
}

.callsign {
	font-family: var(--mono);
	font-size: 13px;
}

.sep {
	color: var(--text-dim);
	font-size: 13px;
}

.metrics {
	display: flex;
	align-items: center;
	gap: 6px;
	font-family: var(--mono);
	font-size: 12px;
	color: var(--text);
	margin-left: 4px;
}

.metric-sep {
	color: var(--text-dim);
}

.additional {
	font-size: 11px;
	color: var(--text-dim);
	margin-left: 6px;
}

@keyframes banner-pulse {
	0%, 100% { box-shadow: 0 0 0 2px var(--conflict-glow), 0 6px 22px rgba(0, 0, 0, 0.55); }
	50%      { box-shadow: 0 0 0 5px var(--conflict-glow), 0 6px 22px rgba(0, 0, 0, 0.55); }
}

.banner-enter-from { opacity: 0; transform: translate(-50%, -8px); }
.banner-enter-active { transition: opacity 160ms ease, transform 160ms ease; }
.banner-leave-to { opacity: 0; transform: translate(-50%, -8px); }
.banner-leave-active { transition: opacity 120ms ease, transform 120ms ease; }
</style>
