<script setup lang="ts">
import { computed } from 'vue';
import { useAircraftStore } from '../composables/useAircraftStore';
import { useDeconfliction } from '../composables/useDeconfliction';
import { isInsideTfr } from '../map/tfr';
import { fmtFeet, fmtKnots, metersToFeet } from '../geo/units';
import { AGL_BANDS } from '../config';
import type { Aircraft, AircraftCategory } from '../data/types';
import Legend from './Legend.vue';

const store = useAircraftStore();
const { conflicts, criticalIds, cautionIds } = useDeconfliction();

const CATEGORY_GLYPH: Record<AircraftCategory, string> = {
	'helo-type1': 'H',
	'air-tanker': 'T',
	'recon-fw': 'F',
	'atgs-fw': 'A',
	'uas-sheriff': 'Q',
};

interface Row {
	aircraft: Aircraft;
	agl: number;
	aglBand: 'red' | 'amber' | 'green';
	insideTfr: boolean;
	inConflict: boolean;
	inWarning: boolean;
}

function bandFor(agl: number): Row['aglBand'] {
	if (agl < AGL_BANDS.redMaxMeters) return 'red';
	if (agl < AGL_BANDS.amberMaxMeters) return 'amber';
	return 'green';
}

const rows = computed<Row[]>(() => {
	const list = store.aircraft.value;
	return list.map((a) => {
		const inConflict = criticalIds.value.has(a.id);
		return {
			aircraft: a,
			agl: a.aglMeters,
			aglBand: bandFor(a.aglMeters),
			insideTfr: isInsideTfr(a.lon, a.lat),
			inConflict,
			inWarning: !inConflict && cautionIds.value.has(a.id),
		};
	});
});

const conflictsCount = computed(
	() => conflicts.value.filter((c) => c.severity === 'critical').length,
);
const warningsCount = computed(
	() => conflicts.value.filter((c) => c.severity !== 'critical').length,
);

const inTfrCount = computed(() => rows.value.filter((r) => r.insideTfr).length);
</script>

<template>
	<aside class="side-panel" aria-label="Aircraft & airspace status">
		<header class="panel-head">
			<div class="incident">
				<div class="title">San Juan Complex</div>
				<div class="sub">CO-SJF-FAKE-2026 · fictional prototype</div>
			</div>
			<div class="stats">
				<div class="stat">
					<div class="stat-val" :class="{ on: conflictsCount > 0 }">{{ conflictsCount }}</div>
					<div class="stat-key">conflicts</div>
				</div>
				<div class="stat">
					<div class="stat-val" :class="{ warn: warningsCount > 0 }">{{ warningsCount }}</div>
					<div class="stat-key">caution</div>
				</div>
				<div class="stat">
					<div class="stat-val">{{ inTfrCount }}/{{ rows.length }}</div>
					<div class="stat-key">in TFR</div>
				</div>
			</div>
		</header>

		<ol class="aircraft-list">
			<li
				v-for="row in rows"
				:key="row.aircraft.id"
				class="row"
				:class="{
					'in-conflict': row.inConflict,
					'in-warning': row.inWarning,
					'in-tfr': row.insideTfr,
				}"
			>
				<div class="cell cell--icon">
					<span
						class="cat-glyph"
						:class="{ uas: row.aircraft.crew === 'uas' }"
						:title="row.aircraft.category"
					>{{ CATEGORY_GLYPH[row.aircraft.category] }}</span>
				</div>

				<div class="cell cell--name">
					<div class="callsign">{{ row.aircraft.callsign }}</div>
					<div class="meta">
						<span class="crew-tag">{{ row.aircraft.crew === 'uas' ? 'UAS' : 'manned' }}</span>
						<span v-if="row.insideTfr" class="tfr-tag">IN TFR</span>
					</div>
				</div>

				<div class="cell cell--alt">
					<div class="alt-msl">{{ fmtFeet(row.aircraft.altitudeMslMeters) }}</div>
					<div class="alt-agl" :class="row.aglBand">
						<span class="agl-dot" />
						{{ Math.round(metersToFeet(row.agl)).toLocaleString() }} AGL
					</div>
				</div>

				<div class="cell cell--speed">
					<div class="speed">{{ fmtKnots(row.aircraft.groundspeedMps) }}</div>
					<div
						class="vrate"
						:class="{
							climb: (row.aircraft.verticalRateMps ?? 0) > 0.5,
							descend: (row.aircraft.verticalRateMps ?? 0) < -0.5,
						}"
					>
						<template v-if="(row.aircraft.verticalRateMps ?? 0) > 0.5">↑</template>
						<template v-else-if="(row.aircraft.verticalRateMps ?? 0) < -0.5">↓</template>
						<template v-else>·</template>
					</div>
				</div>

				<div v-if="row.inConflict" class="conflict-marker" aria-hidden="true" />
				<div v-else-if="row.inWarning" class="warning-marker" aria-hidden="true" />
			</li>
		</ol>

		<Legend />
	</aside>
</template>

<style scoped>
.side-panel {
	position: absolute;
	top: 16px;
	right: 16px;
	bottom: 88px;       /* clear the TimeBar */
	width: 340px;
	padding: 12px;
	background: rgba(17, 21, 28, 0.95);
	border: 1px solid var(--border-strong);
	border-radius: 6px;
	backdrop-filter: blur(8px);
	box-shadow: 0 6px 22px rgba(0, 0, 0, 0.6);
	display: flex;
	flex-direction: column;
	gap: 10px;
	overflow: hidden;
	z-index: 5;
}

.panel-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 12px;
	padding-bottom: 10px;
	border-bottom: 1px solid var(--border);
	margin-top: 28px;   /* leave room for the ModeToggle floating top-right */
}

.title {
	font-family: var(--sans);
	font-weight: 700;
	color: var(--text-bright);
	font-size: 14px;
	letter-spacing: 0.2px;
}

.sub {
	font-family: var(--mono);
	font-size: 10px;
	color: var(--text-dim);
	margin-top: 2px;
}

.stats {
	display: flex;
	gap: 10px;
}

.stat {
	text-align: right;
}

.stat-val {
	font-family: var(--mono);
	font-size: 18px;
	font-weight: 700;
	color: var(--text-bright);
	line-height: 1;
}

.stat-val.on {
	color: var(--conflict);
	text-shadow: 0 0 8px var(--conflict-glow);
}

.stat-val.warn {
	color: var(--agl-amber);
}

.stat-key {
	font-size: 10px;
	color: var(--text-dim);
	margin-top: 2px;
	text-transform: uppercase;
	letter-spacing: 0.8px;
}

.aircraft-list {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 4px;
	overflow-y: auto;
	flex: 1 1 auto;
	min-height: 0;
}

.row {
	position: relative;
	display: grid;
	grid-template-columns: 28px 1fr auto auto;
	grid-column-gap: 8px;
	align-items: center;
	padding: 6px 8px;
	background: var(--bg-panel-2);
	border: 1px solid transparent;
	border-radius: 4px;
	transition: border-color 120ms, background 120ms;
}

.row.in-tfr {
	border-left: 2px solid #ff7a3b;
	padding-left: 7px;
}

.row.in-conflict {
	border-color: var(--conflict);
	background: rgba(60, 12, 12, 0.55);
	animation: row-pulse 1.5s ease-in-out infinite;
}

.row.in-warning {
	border-color: var(--agl-amber);
	background: rgba(56, 40, 8, 0.45);
}

@keyframes row-pulse {
	0%, 100% { box-shadow: inset 0 0 0 0 var(--conflict-glow); }
	50%      { box-shadow: inset 0 0 0 1px var(--conflict-glow); }
}

.cell--icon {
	display: flex;
	align-items: center;
	justify-content: center;
}

.cat-glyph {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 22px;
	height: 22px;
	border-radius: 50%;
	border: 1px solid var(--border-strong);
	background: var(--bg-panel);
	color: var(--text-bright);
	font-family: var(--mono);
	font-size: 11px;
	font-weight: 700;
}

.cat-glyph.uas {
	border-style: dashed;
	color: var(--text-dim);
}

.callsign {
	font-family: var(--mono);
	font-size: 13px;
	color: var(--text-bright);
	letter-spacing: 0.3px;
}

.meta {
	display: flex;
	gap: 6px;
	margin-top: 2px;
	font-size: 10px;
	color: var(--text-dim);
}

.crew-tag {
	text-transform: uppercase;
	letter-spacing: 0.6px;
}

.tfr-tag {
	color: #ff7a3b;
	font-weight: 600;
	letter-spacing: 0.6px;
}

.cell--alt {
	text-align: right;
	min-width: 84px;
}

.alt-msl {
	font-family: var(--mono);
	font-size: 12px;
	color: var(--text-bright);
}

.alt-agl {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 4px;
	font-family: var(--mono);
	font-size: 11px;
	margin-top: 2px;
}

.agl-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: var(--text-dim);
}

.alt-agl.red    .agl-dot { background: var(--agl-red); box-shadow: 0 0 4px var(--agl-red); }
.alt-agl.amber  .agl-dot { background: var(--agl-amber); }
.alt-agl.green  .agl-dot { background: var(--agl-green); }

.alt-agl.red    { color: var(--agl-red); }
.alt-agl.amber  { color: var(--agl-amber); }
.alt-agl.green  { color: var(--agl-green); }

.cell--speed {
	text-align: right;
	min-width: 56px;
}

.speed {
	font-family: var(--mono);
	font-size: 12px;
	color: var(--text);
}

.vrate {
	font-family: var(--mono);
	font-size: 11px;
	color: var(--text-dim);
	margin-top: 2px;
}

.vrate.climb { color: var(--agl-green); }
.vrate.descend { color: var(--agl-red); }

.conflict-marker {
	position: absolute;
	top: 6px;
	right: 6px;
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: var(--conflict);
	box-shadow: 0 0 6px var(--conflict);
}

.warning-marker {
	position: absolute;
	top: 6px;
	right: 6px;
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: var(--agl-amber);
}
</style>
