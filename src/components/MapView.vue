<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { createMap } from '../map/setupMap';
import 'maplibre-gl/dist/maplibre-gl.css';

const containerEl = ref<HTMLDivElement | null>(null);
const mapRef = shallowRef<MapLibreMap | null>(null);

onMounted(() => {
	if (!containerEl.value) return;
	const map = createMap(containerEl.value);
	mapRef.value = map;

	// Helpful during slice-1 verification — confirms terrain source is loading.
	map.on('error', (e) => {
		console.warn('[maplibre]', e?.error?.message ?? e);
	});
});

onBeforeUnmount(() => {
	mapRef.value?.remove();
	mapRef.value = null;
});
</script>

<template>
	<div ref="containerEl" class="map-root" />
</template>

<style scoped>
.map-root {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
}
</style>
