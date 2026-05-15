<script setup lang="ts">
import MapView from './components/MapView.vue';
import TimeBar from './components/TimeBar.vue';
import ConflictBanner from './components/ConflictBanner.vue';
import SidePanel from './components/SidePanel.vue';
import { useAircraftStore } from './composables/useAircraftStore';

// Instantiate the store at the root so its RAF loop lives for the app's
// lifetime; downstream components all read from the same singleton.
useAircraftStore();
</script>

<template>
	<MapView />
	<ConflictBanner />
	<SidePanel />
	<TimeBar />
</template>
