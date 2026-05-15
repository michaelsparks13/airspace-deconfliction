/**
 * Global handle to the live MapLibre instance. MapView sets this on mount so
 * non-Vue code (and other components) can call queryTerrainElevation, read
 * camera state, etc. without re-implementing the bus.
 *
 * Held in a shallowRef so consumers can `watch()` for mount and avoid the
 * "map is undefined" footgun.
 */

import { shallowRef, type ShallowRef } from 'vue';
import type { Map as MapLibreMap } from 'maplibre-gl';

const mapRef: ShallowRef<MapLibreMap | null> = shallowRef(null);

export function setMap(map: MapLibreMap | null): void {
	mapRef.value = map;
}

export function useMap(): ShallowRef<MapLibreMap | null> {
	return mapRef;
}
