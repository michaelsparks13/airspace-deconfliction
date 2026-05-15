<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { createMap } from '../map/setupMap';
import { setMap } from '../composables/useMap';
import 'maplibre-gl/dist/maplibre-gl.css';

const containerEl = ref<HTMLDivElement | null>(null);
const mapRef = shallowRef<MapLibreMap | null>(null);

onMounted(() => {
	if (!containerEl.value) return;
	const map = createMap(containerEl.value);
	mapRef.value = map;
	setMap(map);

	map.on('error', (e) => {
		console.warn('[maplibre]', e?.error?.message ?? e);
	});
});

onBeforeUnmount(() => {
	setMap(null);
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
