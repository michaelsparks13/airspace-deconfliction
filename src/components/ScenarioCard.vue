<script setup lang="ts">
import { ref } from 'vue';

const expanded = ref(true);

function toggle() {
	expanded.value = !expanded.value;
}
</script>

<template>
	<div class="scenario-card" :class="{ collapsed: !expanded }">
		<button
			v-if="!expanded"
			type="button"
			class="pill"
			aria-label="Show scenario briefing"
			@click="toggle"
		>
			<span class="pill-icon" aria-hidden="true">i</span>
			<span class="pill-label">SCENARIO</span>
		</button>

		<article v-else class="card" aria-label="Scenario briefing">
			<header class="head">
				<div class="eyebrow">SCENARIO</div>
				<button
					type="button"
					class="close"
					aria-label="Collapse scenario briefing"
					@click="toggle"
				>
					<svg viewBox="0 0 14 14" width="12" height="12" aria-hidden="true">
						<path
							d="M2 2 L12 12 M12 2 L2 12"
							fill="none"
							stroke="currentColor"
							stroke-width="1.6"
							stroke-linecap="round"
						/>
					</svg>
				</button>
			</header>

			<h2 class="title">San Juan Mountains — demo incident</h2>

			<div class="body">
				<p>
					A fictional initial-attack wildfire in the San Juan Mountains near Telluride,
					Colorado. You're watching a 90-second replay of the airspace over it.
				</p>
				<p>
					Five aircraft are working inside the Fire Traffic Area — a Type 1 helicopter,
					an air tanker, fixed-wing recon, Air Attack (the ATGS), and a sheriff's UAS —
					stacked by altitude block. A sixth aircraft, a stray VFR pilot who didn't
					check NOTAMs, transits the TFR northbound and threads right over the fire.
				</p>
				<p>Conflicts surface in the alert banner and side panel as they develop.</p>
			</div>

			<footer class="foot">
				Fictional scenario — callsigns, tracks, and the fire perimeter are not real.
			</footer>
		</article>
	</div>
</template>

<style scoped>
.scenario-card {
	position: absolute;
	top: 16px;
	left: 16px;
	z-index: 10;
}

.card {
	width: 300px;
	padding: 12px 14px 10px;
	background: rgba(17, 21, 28, 0.95);
	border: 1px solid var(--border-strong);
	border-radius: 6px;
	backdrop-filter: blur(8px);
	box-shadow: 0 6px 22px rgba(0, 0, 0, 0.6);
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
}

.eyebrow {
	font-family: var(--mono);
	font-size: 10px;
	letter-spacing: 1.5px;
	color: var(--text-dim);
	text-transform: uppercase;
}

.close {
	width: 22px;
	height: 22px;
	padding: 0;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	color: var(--text-dim);
	border-color: var(--border);
	border-radius: 4px;
}

.close:hover {
	color: var(--text-bright);
}

.title {
	margin: 0;
	font-family: var(--sans);
	font-weight: 700;
	font-size: 14px;
	letter-spacing: 0.2px;
	color: var(--text-bright);
}

.body {
	display: flex;
	flex-direction: column;
	gap: 6px;
	font-size: 12px;
	line-height: 1.5;
	color: var(--text);
}

.body p {
	margin: 0;
}

.foot {
	margin-top: 4px;
	padding-top: 8px;
	border-top: 1px solid var(--border);
	font-family: var(--mono);
	font-size: 10px;
	letter-spacing: 0.3px;
	color: var(--text-dim);
	line-height: 1.5;
}

.pill {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 6px 10px 6px 8px;
	background: rgba(17, 21, 28, 0.95);
	border: 1px solid var(--border-strong);
	border-radius: 999px;
	backdrop-filter: blur(8px);
	box-shadow: 0 6px 22px rgba(0, 0, 0, 0.6);
	color: var(--text);
	cursor: pointer;
}

.pill:hover {
	border-color: var(--accent);
	color: var(--text-bright);
}

.pill-icon {
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
	font-size: 11px;
	font-style: italic;
	font-weight: 700;
	line-height: 1;
}

.pill-label {
	font-family: var(--mono);
	font-size: 10px;
	letter-spacing: 1.5px;
	text-transform: uppercase;
}
</style>
