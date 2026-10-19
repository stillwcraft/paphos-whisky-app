import type { MapEvent, SocialMapMarker } from './cyprusMapCache.ts';

export type CyprusMapLayer = {
  id: string;
  labelKey: string;
  showGlobalRange: boolean;
  includesCatalogEvent: (event: MapEvent) => boolean;
  includesSocialEvent: (event: SocialMapMarker) => boolean;
};

export const DEFAULT_CYPRUS_MAP_LAYER: CyprusMapLayer = {
  id: 'global-events',
  labelKey: 'cyprus_map.global_range',
  showGlobalRange: true,
  includesCatalogEvent: () => true,
  includesSocialEvent: () => true,
};

export const CYPRUS_MAP_LAYERS: readonly CyprusMapLayer[] = [
  DEFAULT_CYPRUS_MAP_LAYER,
];
