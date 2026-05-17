<script setup lang="ts">
// Mirrors src/aircraft/visuals.ts + src/config.ts so swatches stay in sync.
import { AGL_BANDS } from '../config';
import { metersToFeet } from '../geo/units';

const redMaxFt = Math.round(metersToFeet(AGL_BANDS.redMaxMeters));
const amberMaxFt = Math.round(metersToFeet(AGL_BANDS.amberMaxMeters));
</script>

<template>
	<div class="legend">
		<div class="section-title">Legend</div>

		<div class="row">
			<div class="row-title">AGL bands</div>
			<div class="swatches">
				<span class="swatch swatch--ring red"><span class="dot" /></span>
				<span class="label">&lt; {{ redMaxFt }} ft AGL</span>
			</div>
			<div class="swatches">
				<span class="swatch swatch--ring amber"><span class="dot" /></span>
				<span class="label">{{ redMaxFt }}–{{ amberMaxFt }} ft AGL</span>
			</div>
			<div class="swatches">
				<span class="swatch swatch--ring green"><span class="dot" /></span>
				<span class="label">&gt; {{ amberMaxFt }} ft AGL</span>
			</div>
		</div>

		<div class="row">
			<div class="row-title">Aircraft</div>
			<div class="swatches">
				<span class="cat-icon">H</span>
				<span class="label">Helicopter</span>
			</div>
			<div class="swatches">
				<span class="cat-icon">F</span>
				<span class="label">Fixed-wing (manned)</span>
			</div>
			<div class="swatches">
				<span class="cat-icon uas">Q</span>
				<span class="label">UAS (dashed stem)</span>
			</div>
		</div>

		<div class="row">
			<div class="row-title">Airspace</div>
			<div class="swatches">
				<span class="swatch swatch--fill tfr" />
				<span class="label">Fire perimeter / TFR</span>
			</div>
			<div class="swatches">
				<span class="swatch swatch--fill column" />
				<span class="label">Convective column (no-fly)</span>
			</div>
			<div class="swatches">
				<span class="swatch swatch--fill icom" />
				<span class="label">12 NM ICOM ring</span>
			</div>
		</div>

		<div class="row">
			<div class="row-title">Conflicts</div>
			<div class="swatches">
				<span class="swatch swatch--ring conflict"><span class="dot" /></span>
				<span class="label">Critical: column incursion or imminent CPA</span>
			</div>
			<div class="swatches">
				<span class="swatch swatch--ring amber"><span class="dot" /></span>
				<span class="label">Caution: block-bust, intruder, or near-CPA</span>
			</div>
		</div>
	</div>
</template>

<style scoped>
.legend {
	border-top: 1px solid var(--border);
	padding-top: 10px;
	margin-top: 10px;
}

.section-title {
	font-family: var(--mono);
	font-size: 10px;
	letter-spacing: 1.5px;
	color: var(--text-dim);
	text-transform: uppercase;
	margin-bottom: 8px;
}

.row {
	margin-bottom: 10px;
}

.row-title {
	font-size: 11px;
	color: var(--text-dim);
	margin-bottom: 4px;
}

.swatches {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 2px 0;
	font-size: 12px;
}

.swatch {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 18px;
	height: 18px;
	flex: 0 0 auto;
}

.swatch--ring .dot {
	width: 12px;
	height: 12px;
	border-radius: 50%;
	background: transparent;
	border: 3px solid currentColor;
	box-shadow: 0 0 6px currentColor;
}

.swatch.red    { color: var(--agl-red); }
.swatch.amber  { color: var(--agl-amber); }
.swatch.green  { color: var(--agl-green); }
.swatch.conflict { color: var(--conflict); }

.swatch--fill {
	width: 18px;
	height: 12px;
	border-radius: 2px;
}

.swatch--fill.tfr {
	background: rgba(255, 122, 59, 0.4);
	border: 1px solid #ff7a3b;
}

.swatch--fill.column {
	background: rgba(255, 59, 59, 0.35);
	border: 1px solid #ff3b3b;
}

.swatch--fill.icom {
	background: transparent;
	border: 1px solid #6fb8ff;
}

.cat-icon {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 18px;
	height: 18px;
	border-radius: 50%;
	border: 1px solid var(--border-strong);
	background: var(--bg-panel-2);
	color: var(--text-bright);
	font-family: var(--mono);
	font-size: 10px;
	font-weight: 700;
}

.cat-icon.uas {
	border-style: dashed;
	color: var(--text-dim);
}

.label {
	color: var(--text);
}
</style>
