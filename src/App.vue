<script setup lang="ts">
import MapView from './components/MapView.vue';
import TimeBar from './components/TimeBar.vue';
import ConflictBanner from './components/ConflictBanner.vue';
import SidePanel from './components/SidePanel.vue';
import ScenarioCard from './components/ScenarioCard.vue';
import { useAircraftStore } from './composables/useAircraftStore';

// Instantiate the store at the root so the rAF loop lives for the app's
// lifetime. Children all read the same singleton.
useAircraftStore();
</script>

<template>
	<MapView />
	<ScenarioCard />
	<ConflictBanner />
	<SidePanel />
	<TimeBar />
</template>
