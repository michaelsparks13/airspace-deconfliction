<script setup lang="ts">
import MapView from './components/MapView.vue';
import TimeBar from './components/TimeBar.vue';
import { useAircraftStore } from './composables/useAircraftStore';

// Instantiate the store at the root so its RAF loop lives for the app's
// lifetime; downstream components (MapView, TimeBar, future SidePanel) all
// read from the same singleton.
useAircraftStore();
</script>

<template>
	<MapView />
	<TimeBar />
</template>
