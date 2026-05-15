<script setup lang="ts">
import { computed } from 'vue';
import MapView from './components/MapView.vue';
import TimeBar from './components/TimeBar.vue';
import ConflictBanner from './components/ConflictBanner.vue';
import ModeToggle from './components/ModeToggle.vue';
import SidePanel from './components/SidePanel.vue';
import { useAircraftStore } from './composables/useAircraftStore';

// Instantiate the store at the root so its RAF loop + live-mode polling live
// for the app's lifetime; downstream components all read from the same singleton.
const store = useAircraftStore();
const inReplayMode = computed(() => store.mode.value === 'replay');
</script>

<template>
	<MapView />
	<ConflictBanner />
	<ModeToggle />
	<SidePanel />
	<TimeBar v-if="inReplayMode" />
</template>
