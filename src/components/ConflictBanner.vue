<script setup lang="ts">
import { computed } from 'vue';
import { useDeconfliction } from '../composables/useDeconfliction';
import { describeConflict, type Conflict, type Severity } from '../deconfliction';

const { conflicts } = useDeconfliction();

const visible = computed(() => conflicts.value.length > 0);
const primary = computed<Conflict | null>(() => conflicts.value[0] ?? null);
const additional = computed(() => Math.max(0, conflicts.value.length - 1));

const severity = computed<Severity>(() => primary.value?.severity ?? 'advisory');
const headline = computed(() => (severity.value === 'critical' ? 'CONFLICT' : 'CAUTION'));
const detail = computed(() => (primary.value ? describeConflict(primary.value) : ''));
const kindTag = computed(() => {
	switch (primary.value?.kind) {
		case 'block-bust': return 'BLOCK';
		case 'stack-proximity': return 'PROXIMITY';
		case 'column-incursion': return 'COLUMN';
		case 'intruder': return 'INTRUDER';
		default: return '';
	}
});
</script>

<template>
	<Transition name="banner">
		<div
			v-if="visible && primary"
			class="conflict-banner"
			:class="severity"
			role="alert"
			aria-live="assertive"
		>
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
			<div class="label">{{ headline }}</div>
			<div class="kind">{{ kindTag }}</div>
			<div class="detail">{{ detail }}</div>
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
	min-width: 380px;
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 8px 16px;
	border-radius: 4px;
	color: var(--text-bright);
	z-index: 20;
}

.conflict-banner.critical {
	background: rgba(40, 6, 6, 0.95);
	border: 1px solid var(--conflict);
	box-shadow: 0 0 0 2px var(--conflict-glow), 0 6px 22px rgba(0, 0, 0, 0.55);
	animation: banner-pulse 1.5s ease-in-out infinite;
}

.conflict-banner.caution,
.conflict-banner.advisory {
	background: rgba(40, 30, 6, 0.95);
	border: 1px solid var(--agl-amber);
	box-shadow: 0 6px 22px rgba(0, 0, 0, 0.55);
}

.critical .bell,
.critical .label { color: var(--conflict); }
.caution .bell,
.caution .label,
.advisory .bell,
.advisory .label { color: var(--agl-amber); }

.label {
	font-family: var(--mono);
	font-weight: 700;
	letter-spacing: 1.5px;
	font-size: 12px;
}

.kind {
	font-family: var(--mono);
	font-size: 10px;
	letter-spacing: 1px;
	padding: 2px 6px;
	border: 1px solid var(--border-strong);
	border-radius: 3px;
	color: var(--text-dim);
}

.detail {
	font-family: var(--mono);
	font-size: 13px;
	color: var(--text);
}

.additional {
	font-size: 11px;
	color: var(--text-dim);
	margin-left: auto;
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
