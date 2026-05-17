// Global handle to the live MapLibre instance. MapView sets it on mount,
// so non-Vue code can call queryTerrainElevation, read camera state, etc.
// without re-implementing the bus. shallowRef so consumers can watch() for
// mount instead of hitting "map is undefined".

import { shallowRef, type ShallowRef } from 'vue';
import type { Map as MapLibreMap } from 'maplibre-gl';

const mapRef: ShallowRef<MapLibreMap | null> = shallowRef(null);

export function setMap(map: MapLibreMap | null): void {
	mapRef.value = map;
}

export function useMap(): ShallowRef<MapLibreMap | null> {
	return mapRef;
}
