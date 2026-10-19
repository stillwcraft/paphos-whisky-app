import type { MapEvent, SocialMapMarker } from './cyprusMapCache.ts';

export type CyprusMapLayer = {
  id: string;
  labelKey: string;
  showGlobalRange: boolean;
  includesCatalogEvent: (event: MapEvent) => boolean;
  includesSocialEvent: (event: SocialMapMarker) => boolean;
};

export const APARTMENT_LAYER_ENABLED = false;

export const DEFAULT_CYPRUS_MAP_LAYER: CyprusMapLayer = {
  id: 'global-events',
  labelKey: 'cyprus_map.global_range',
  showGlobalRange: true,
  includesCatalogEvent: () => true,
  includesSocialEvent: (event) => (event.map_layer ?? 'events') === 'events',
};

export const APARTMENTS_CYPRUS_MAP_LAYER: CyprusMapLayer = {
  id: 'apartments-for-sale',
  labelKey: 'cyprus_map.apartments_for_sale',
  showGlobalRange: false,
  includesCatalogEvent: () => false,
  includesSocialEvent: (event) => event.event_type === 'global' && event.map_layer === 'apartments',
};

export const CYPRUS_MAP_LAYERS: readonly CyprusMapLayer[] = [
  DEFAULT_CYPRUS_MAP_LAYER,
  ...(APARTMENT_LAYER_ENABLED ? [APARTMENTS_CYPRUS_MAP_LAYER] : []),
];

export function socialEventMapLayer(event: Pick<SocialMapMarker, 'map_layer'>): CyprusMapLayer {
  return APARTMENT_LAYER_ENABLED && event.map_layer === 'apartments'
    ? APARTMENTS_CYPRUS_MAP_LAYER
    : DEFAULT_CYPRUS_MAP_LAYER;
}
