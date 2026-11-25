import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps';
import { backButton, hapticFeedback } from '@tma.js/sdk-react';
import { useTranslation } from 'react-i18next';
import { useAnalytics } from '@/hooks/useAnalytics.ts';

const SCOTLAND_TOPOLOGY_URL = '/assets/maps/ScotchRegions.topo.json';
const API_URL = 'https://paphos-whisky-api.onrender.com';
const MAP_WIDTH = 390;
const MAP_HEIGHT = 640;
const MAP_SCALE = 3300;
// Shifted south so the mainland sits above the collapsed sheet; Shetland falls off the top.
const MAP_CENTER: [number, number] = [-4.6, 56.31];
const SMALL_ISLAND_MAX_SIZE = 12;
const MAX_ZOOM = 8;
// Map units (at zoom 1) hidden by the bottom sheet, used to lift a focused region into view.
const SHEET_PEEK_OFFSET = 80;
const SHEET_OPEN_OFFSET = 190;
const PIN_RADIUS = 14;
const PIN_SPACING = PIN_RADIUS * 2 + 4;

export type MapDistillery = {
  id: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
  image_url?: string | null;
  logo_url?: string | null;
  region?: string | null;
  bottle_count?: number;
};

type PositionedMapDistillery = MapDistillery & {
  latitude: number;
  longitude: number;
};

type BottlePreview = {
  id: number;
  name: string;
  image_url: string | null;
  age: string | null;
  abv: string | null;
};

type ScotlandWhiskyMapProps = {
  onSelectDistillery: (distillery: MapDistillery) => void;
  selectedDistilleryId?: number | null;
  onSelectedDistilleryHandled?: () => void;
  onClose: () => void;
  /** Drive Telegram's native Back button instead of the in-map close button. */
  telegramBackButton?: boolean;
};

type WhiskyRegion = {
  sourceName: string;
  label: string;
  center: [number, number];
  labelCoordinates: [number, number];
  zoom: number;
};

type RegionStats = { total: number; tasted: number };

type MapPosition = { coordinates: [number, number]; zoom: number };

const initialPosition: MapPosition = {
  coordinates: MAP_CENTER,
  zoom: 1,
};

const whiskyRegions: WhiskyRegion[] = [
  {
    sourceName: 'Highlands',
    label: 'Highland',
    center: [-4.4, 57.45],
    labelCoordinates: [-4.75, 57.95],
    zoom: 1.6,
  },
  {
    sourceName: 'Speyside',
    label: 'Speyside',
    center: [-3.3, 57.45],
    labelCoordinates: [-2.75, 57.75],
    zoom: 3,
  },
  {
    sourceName: 'Islands',
    label: 'Island',
    center: [-5.9, 57.3],
    labelCoordinates: [-7.05, 57.35],
    zoom: 1.6,
  },
  {
    sourceName: 'Lowlands',
    label: 'Lowland',
    center: [-3.7, 55.7],
    labelCoordinates: [-2.95, 55.3],
    zoom: 2,
  },
  {
    sourceName: 'Islay',
    label: 'Islay',
    center: [-6.2, 55.75],
    labelCoordinates: [-7.1, 56.1],
    zoom: 5,
  },
  {
    sourceName: 'Campbeltown',
    label: 'Campbeltown',
    center: [-5.6, 55.42],
    labelCoordinates: [-5.75, 55.05],
    zoom: 5,
  },
];

const isTasted = (distillery: MapDistillery) => (distillery.bottle_count ?? 0) > 0;

const regionLabel = (sourceName: string | null | undefined) => (
  whiskyRegions.find((region) => region.sourceName === sourceName)?.label ?? sourceName ?? ''
);

export function ScotlandWhiskyMap({
  onSelectDistillery,
  selectedDistilleryId = null,
  onSelectedDistilleryHandled,
  onClose,
  telegramBackButton = false,
}: ScotlandWhiskyMapProps) {
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const [position, setPosition] = useState<MapPosition>(initialPosition);
  const [selectedRegion, setSelectedRegion] = useState<WhiskyRegion | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapDistilleries, setMapDistilleries] = useState<MapDistillery[]>([]);
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);
  const [selectedDistillery, setSelectedDistillery] = useState<MapDistillery | null>(null);
  const [selectedBottles, setSelectedBottles] = useState<BottlePreview[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailLoadError, setDetailLoadError] = useState<string | null>(null);
  const [hasTelegramBack, setHasTelegramBack] = useState(false);

  const markerRadius = 3 / Math.pow(position.zoom, 1.35);
  const positionedDistilleries = useMemo(() => mapDistilleries.filter(hasCoordinates), [mapDistilleries]);
  const regionStats = useMemo(() => {
    const stats = new Map<string, RegionStats>();
    for (const distillery of positionedDistilleries) {
      if (!distillery.region) continue;
      const current = stats.get(distillery.region) ?? { total: 0, tasted: 0 };
      current.total += 1;
      if (isTasted(distillery)) current.tasted += 1;
      stats.set(distillery.region, current);
    }
    return stats;
  }, [positionedDistilleries]);
  const tastedCount = positionedDistilleries.filter(isTasted).length;

  const pinDistilleries = useMemo(() => positionedDistilleries.filter((distillery) => (
    distillery.id === selectedDistillery?.id
    || (selectedDistillery === null && selectedRegion !== null && distillery.region === selectedRegion.sourceName)
  )), [positionedDistilleries, selectedDistillery, selectedRegion]);
  const pinOffsets = useMemo(
    () => spreadPins(pinDistilleries, PIN_SPACING / position.zoom),
    [pinDistilleries, position.zoom],
  );
  const dotDistilleries = useMemo(() => {
    const pinned = new Set(pinDistilleries.map((distillery) => distillery.id));
    return positionedDistilleries.filter((distillery) => !pinned.has(distillery.id));
  }, [pinDistilleries, positionedDistilleries]);

  const filterMapGestures = useCallback((event: unknown) => {
    if (!(event instanceof Event)) return false;
    // d3-zoom passes touchend to its double-tap zoom handler.
    if (event.type === 'dblclick' || event.type === 'touchend') {
      return false;
    }
    return event.type === 'wheel'
      || event.type === 'touchstart'
      || (event instanceof MouseEvent
        && event.type === 'mousedown'
        && !event.ctrlKey
        && event.button === 0);
  }, []);
  const handleMoveEnd = useCallback((nextPosition: MapPosition) => {
    setPosition(nextPosition.zoom <= initialPosition.zoom ? initialPosition : nextPosition);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadMapDistilleries = async () => {
      try {
        const response = await fetch(`${API_URL}/api/distilleries/map`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Could not load map distilleries (${response.status})`);
        }
        const data: unknown = await response.json();
        if (!Array.isArray(data)) {
          throw new Error('Map distilleries response is invalid');
        }
        setMapDistilleries(data.filter(isMapDistillery));
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setMapLoadError(error instanceof Error ? error.message : 'Could not load map distilleries');
      }
    };

    void loadMapDistilleries();
    return () => controller.abort();
  }, []);

  const selectDistillery = useCallback(async (distillery: MapDistillery) => {
    hapticFeedback.selectionChanged.ifAvailable();
    trackEvent('map_distillery_selected', {
      distillery_id: distillery.id,
      region: distillery.region ?? null,
    });
    setSelectedDistillery(distillery);
    setSelectedBottles([]);
    setDetailLoadError(null);
    setIsLoadingDetails(true);
    setPosition({
      coordinates: [distillery.longitude!, distillery.latitude!],
      zoom: MAX_ZOOM,
    });

    try {
      const [distilleryResponse, bottlesResponse] = await Promise.all([
        fetch(`${API_URL}/api/distilleries/${distillery.id}`),
        fetch(`${API_URL}/api/distilleries/${distillery.id}/bottles?limit=100&offset=0`),
      ]);
      if (!distilleryResponse.ok || !bottlesResponse.ok) {
        throw new Error('Could not load distillery details');
      }
      const detail: MapDistillery = await distilleryResponse.json();
      const bottles: unknown = await bottlesResponse.json();
      const bottleItems = Array.isArray(bottles)
        ? bottles
        : isBottlePage(bottles)
          ? bottles.items
          : [];

      setSelectedDistillery({ ...distillery, ...detail });
      setSelectedBottles(bottleItems.filter(isBottlePreview));
      onSelectDistillery(detail);
    } catch (error) {
      setDetailLoadError(error instanceof Error ? error.message : 'Could not load distillery details');
    } finally {
      setIsLoadingDetails(false);
    }
  }, [onSelectDistillery, trackEvent]);

  useEffect(() => {
    if (selectedDistilleryId === null || mapDistilleries.length === 0) {
      return;
    }

    const distillery = mapDistilleries.find(
      (item) => item.id === selectedDistilleryId && hasCoordinates(item),
    );
    if (distillery) {
      void selectDistillery(distillery);
    }
    onSelectedDistilleryHandled?.();
  }, [
    mapDistilleries,
    onSelectedDistilleryHandled,
    selectedDistilleryId,
    selectDistillery,
  ]);

  const clearDistillery = () => {
    setSelectedDistillery(null);
    setSelectedBottles([]);
    setDetailLoadError(null);
  };

  const focusRegion = (region: WhiskyRegion | null, sheetOpen: boolean) => {
    hapticFeedback.selectionChanged.ifAvailable();
    clearDistillery();
    setSelectedRegion(region);
    setIsSheetOpen(sheetOpen);
    setPosition(region
      ? {
        coordinates: liftCoordinates(region.center, region.zoom, sheetOpen ? SHEET_OPEN_OFFSET : SHEET_PEEK_OFFSET),
        zoom: region.zoom,
      }
      : initialPosition);
    if (region) {
      trackEvent('map_region_selected', { region: region.sourceName });
    }
  };

  const resetMap = () => {
    clearDistillery();
    setSelectedRegion(null);
    setIsSheetOpen(false);
    setPosition(initialPosition);
  };

  const toggleRegion = (region: WhiskyRegion) => {
    if (selectedDistillery || selectedRegion?.sourceName === region.sourceName) {
      resetMap();
      return;
    }
    focusRegion(region, true);
  };

  const goBack = () => {
    if (selectedDistillery) {
      if (selectedRegion) focusRegion(selectedRegion, isSheetOpen);
      else resetMap();
    } else if (selectedRegion) {
      resetMap();
    } else if (isSheetOpen) {
      setIsSheetOpen(false);
    } else {
      onClose();
    }
  };
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;

  useEffect(() => {
    if (!telegramBackButton || !backButton.show.isAvailable() || !backButton.onClick.isAvailable()) return;
    const wasVisible = backButton.isVisible();
    const unsubscribe = backButton.onClick(() => goBackRef.current());
    backButton.show();
    setHasTelegramBack(true);
    return () => {
      unsubscribe();
      if (!wasVisible) backButton.hide.ifAvailable();
      setHasTelegramBack(false);
    };
  }, [telegramBackButton]);

  return (
    <section className={`relative w-full bg-[#0a0a0c] ${
      selectedDistillery ? 'flex h-full flex-col gap-3 overflow-x-hidden overflow-y-auto px-4 py-3' : 'h-full overflow-hidden'
    }`}>
      {selectedDistillery && (
        <div className="flex h-16 shrink-0 items-center justify-center">
          {selectedDistillery.logo_url ? (
            <img
              src={selectedDistillery.logo_url}
              alt={selectedDistillery.name}
              className="max-h-14 max-w-[220px] object-contain"
            />
          ) : (
            <h2 className="font-serif text-xl text-[#EAD7AE]">{selectedDistillery.name}</h2>
          )}
        </div>
      )}

      <div className={`relative w-full overflow-hidden bg-[#0a0a0c] ${
        selectedDistillery
          ? 'min-h-[220px] flex-1 rounded-2xl border border-[#C5A059]/60 shadow-2xl'
          : 'h-full'
      }`}>
        <ComposableMap
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
          projection="geoMercator"
          projectionConfig={{ center: MAP_CENTER, scale: MAP_SCALE }}
          className="h-full w-full touch-none"
          onClick={resetMap}
        >
          <defs>
            <linearGradient id="land-obsidian" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1c1c22" />
              <stop offset="100%" stopColor="#16161a" />
            </linearGradient>
            <linearGradient id="gold-region-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B3226" />
              <stop offset="100%" stopColor="#2a241b" />
            </linearGradient>
            <filter id="region-label-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#FFE28A" floodOpacity={0.65} />
            </filter>
            <filter id="distillery-pin-shadow" x="-100%" y="-100%" width="300%" height="300%">
              <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#000" floodOpacity={0.9} />
            </filter>
          </defs>
          <ZoomableGroup
            center={position.coordinates}
            zoom={position.zoom}
            minZoom={1}
            maxZoom={16}
            translateExtent={[[0, -MAP_HEIGHT / 2], [MAP_WIDTH, MAP_HEIGHT]]}
            filterZoomEvent={filterMapGestures}
            onMoveEnd={handleMoveEnd}
          >
            <Geographies geography={SCOTLAND_TOPOLOGY_URL}>
              {({ geographies, path }) => geographies.map((geography) => {
                const region = whiskyRegions.find(
                  (item) => item.sourceName === geography.properties.name,
                );
                if (!region) return null;
                const isSelected = selectedRegion?.sourceName === region.sourceName;
                const regionStyle = {
                  fill: isSelected ? 'url(#gold-region-grad)' : 'url(#land-obsidian)',
                  stroke: isSelected ? '#FFE28A' : '#5A482A',
                  strokeWidth: isSelected ? 1.4 : 1.2,
                  strokeLinejoin: 'round' as const,
                  strokeLinecap: 'round' as const,
                  vectorEffect: 'non-scaling-stroke' as const,
                  opacity: 1,
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.4s ease',
                };
                const shapes: { svgPath: string | null; isSmallIsland: boolean }[] =
                  region.sourceName === 'Islands' && geography.geometry.type === 'MultiPolygon'
                    ? geography.geometry.coordinates.map((coordinates: number[][][]) => {
                      const polygon = { type: 'Polygon' as const, coordinates };
                      const [[minX, minY], [maxX, maxY]] = path.bounds(polygon);
                      return {
                        svgPath: path(polygon),
                        isSmallIsland: Math.max(maxX - minX, maxY - minY) < SMALL_ISLAND_MAX_SIZE,
                      };
                    })
                    : [{ svgPath: geography.svgPath, isSmallIsland: false }];
                const smallIslandShadow = isSelected
                  ? 'drop-shadow(0 0 4px rgba(255, 226, 138, 0.5))'
                  : 'drop-shadow(0px 4px 4px rgba(0,0,0,0.9))';
                const regionShadow = isSelected
                  ? 'drop-shadow(0 0 8px rgba(255, 226, 138, 0.45))'
                  : 'drop-shadow(0px 8px 16px rgba(0,0,0,0.9))';

                return (
                  <g key={geography.rsmKey}>
                    {shapes.map((shape, index) => (
                      <g
                        key={index}
                        style={{
                          filter: shape.isSmallIsland ? smallIslandShadow : regionShadow,
                        }}
                      >
                        <Geography
                          geography={{ ...geography, svgPath: shape.svgPath }}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleRegion(region);
                          }}
                          style={{
                            default: regionStyle,
                            hover: regionStyle,
                            pressed: regionStyle,
                          }}
                        />
                      </g>
                    ))}
                  </g>
                );
              })}
            </Geographies>

            <foreignObject x={0} y={-MAP_HEIGHT / 2} width={MAP_WIDTH} height={MAP_HEIGHT * 1.5} pointerEvents="none">
              <DistilleryDotsCanvas distilleries={dotDistilleries} markerRadius={markerRadius} />
            </foreignObject>

            {whiskyRegions.map((region) => {
              const isActive = selectedRegion?.sourceName === region.sourceName;
              const stats = regionStats.get(region.sourceName);
              const text = stats ? `${region.label.toUpperCase()} · ${stats.total}` : region.label.toUpperCase();
              const badgeWidth = text.length * 7.4 + 22;
              return (
                <Marker key={`${region.sourceName}-label`} coordinates={region.labelCoordinates}>
                  <g
                    transform={`scale(${1 / position.zoom})`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${region.label}: ${stats?.total ?? 0}`}
                    aria-pressed={isActive}
                    className="map-region-pill cursor-pointer"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleRegion(region);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggleRegion(region);
                      }
                    }}
                  >
                    <rect
                      x={-badgeWidth / 2}
                      y={-14}
                      width={badgeWidth}
                      height={28}
                      rx={14}
                      fill={isActive ? '#3B3226' : '#141417'}
                      fillOpacity={0.95}
                      stroke={isActive ? '#FFE28A' : '#C5A059'}
                      strokeOpacity={isActive ? 1 : 0.55}
                      strokeWidth={isActive ? 1.5 : 1}
                      filter={isActive ? 'url(#region-label-glow)' : undefined}
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={isActive ? '#FFF2C2' : '#FFE28A'}
                      fontSize={11}
                      fontFamily="Georgia, 'Times New Roman', serif"
                      letterSpacing={1}
                      pointerEvents="none"
                    >
                      {text}
                    </text>
                  </g>
                </Marker>
              );
            })}

            {pinDistilleries.map((distillery) => {
              const [dx, dy] = pinOffsets.get(distillery.id) ?? [0, 0];
              const isSelected = selectedDistillery?.id === distillery.id;
              const tasted = isTasted(distillery);
              const imageUrl = distillery.logo_url || distillery.image_url;
              return (
                <Marker key={distillery.id} coordinates={[distillery.longitude, distillery.latitude]}>
                  {(dx !== 0 || dy !== 0) && (
                    <>
                      <line x1={0} y1={0} x2={dx} y2={dy} stroke="#C5A059" strokeOpacity={0.6} strokeWidth={1 / position.zoom} />
                      <circle r={1.8 / position.zoom} fill="#C5A059" />
                    </>
                  )}
                  <g
                    transform={`translate(${dx} ${dy}) scale(${1 / position.zoom})`}
                    role="button"
                    tabIndex={0}
                    aria-label={distillery.name}
                    className="map-distillery-pin cursor-pointer"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      void selectDistillery(distillery);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        void selectDistillery(distillery);
                      }
                    }}
                  >
                    <defs>
                      <clipPath id={`distillery-image-${distillery.id}`}>
                        <circle r={PIN_RADIUS - 3} />
                      </clipPath>
                    </defs>
                    <circle
                      r={isSelected ? PIN_RADIUS + 3 : PIN_RADIUS}
                      fill={tasted ? '#C5A059' : '#141417'}
                      stroke={isSelected ? '#FFF2C2' : '#C5A059'}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      filter="url(#distillery-pin-shadow)"
                    />
                    {imageUrl ? (
                      <>
                        <circle r={PIN_RADIUS - 3} fill="#0D0D0E" />
                        <image
                          href={imageUrl}
                          x={-(PIN_RADIUS - 3)}
                          y={-(PIN_RADIUS - 3)}
                          width={(PIN_RADIUS - 3) * 2}
                          height={(PIN_RADIUS - 3) * 2}
                          clipPath={`url(#distillery-image-${distillery.id})`}
                          preserveAspectRatio="xMidYMid slice"
                        />
                      </>
                    ) : (
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={tasted ? '#1a140a' : '#FFE28A'}
                        fontSize={12}
                        pointerEvents="none"
                      >
                        {distillery.name.charAt(0)}
                      </text>
                    )}
                    <circle r={PIN_RADIUS + 6} fill="transparent" pointerEvents="all" />
                  </g>
                </Marker>
              );
            })}
          </ZoomableGroup>
        </ComposableMap>

        {!selectedDistillery && (
          <DistillerySheet
            distilleries={positionedDistilleries}
            regionStats={regionStats}
            tastedCount={tastedCount}
            selectedRegion={selectedRegion}
            isOpen={isSheetOpen}
            searchQuery={searchQuery}
            loadError={mapLoadError}
            onOpenChange={(open) => {
              setIsSheetOpen(open);
              if (selectedRegion) {
                setPosition({
                  coordinates: liftCoordinates(selectedRegion.center, selectedRegion.zoom, open ? SHEET_OPEN_OFFSET : SHEET_PEEK_OFFSET),
                  zoom: selectedRegion.zoom,
                });
              }
            }}
            onSearchChange={setSearchQuery}
            onSelectRegion={(region) => focusRegion(region, true)}
            onSelectDistillery={(distillery) => { void selectDistillery(distillery); }}
            t={t}
          />
        )}
      </div>

      {selectedDistillery && (
        <div className="min-w-0 shrink-0">
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
            {selectedBottles.map((bottle) => (
              <article
                key={bottle.id}
                className="w-28 shrink-0 snap-start rounded-2xl border border-[#C5A059]/25 bg-[#16161A] p-2 shadow-xl"
              >
                <div className="flex h-20 items-center justify-center rounded-xl bg-[#0D0D0E]">
                  {bottle.image_url ? (
                    <img src={bottle.image_url} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-[#6E6D6A]">🥃</span>
                  )}
                </div>
                <p className="mt-2 truncate text-center text-xs text-[#F4F4F5]">{bottle.name}</p>
                <p className="mt-1 text-center text-[10px] text-[#C5A059]">
                  {[bottle.age, bottle.abv].filter(Boolean).join(' · ')}
                </p>
              </article>
            ))}
            {isLoadingDetails && <p className="py-4 text-sm text-[#9E9D9A]">{t('common.loading')}</p>}
            {!isLoadingDetails && !detailLoadError && selectedBottles.length === 0 && (
              <p className="py-4 text-sm text-[#9E9D9A]">{t('map_view.no_bottles')}</p>
            )}
            {detailLoadError && <p className="py-4 text-sm text-[#9E9D9A]">{detailLoadError}</p>}
          </div>
        </div>
      )}
      {(!hasTelegramBack || selectedDistillery) && (
        <button
          aria-label={selectedDistillery ? t('map_view.back') : t('map_view.close')}
          className={`absolute z-30 flex h-10 w-10 items-center justify-center rounded-xl border border-[#C5A059]/50 bg-[#141417]/90 text-[#C5A059] shadow-lg backdrop-blur-md transition-colors hover:border-[#C5A059] active:bg-[#C5A059]/20 ${
            selectedDistillery ? 'left-4 top-4' : 'right-3 top-3'
          }`}
          onClick={selectedDistillery ? goBack : onClose}
          type="button"
        >
          <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
            {selectedDistillery ? <path d="M15 5 8 12l7 7" /> : <path d="M6 6 18 18M18 6 6 18" />}
          </svg>
        </button>
      )}
    </section>
  );
}

type DistillerySheetProps = {
  distilleries: PositionedMapDistillery[];
  regionStats: Map<string, RegionStats>;
  tastedCount: number;
  selectedRegion: WhiskyRegion | null;
  isOpen: boolean;
  searchQuery: string;
  loadError: string | null;
  onOpenChange: (open: boolean) => void;
  onSearchChange: (query: string) => void;
  onSelectRegion: (region: WhiskyRegion | null) => void;
  onSelectDistillery: (distillery: PositionedMapDistillery) => void;
  t: ReturnType<typeof useTranslation>['t'];
};

function DistillerySheet({
  distilleries,
  regionStats,
  tastedCount,
  selectedRegion,
  isOpen,
  searchQuery,
  loadError,
  onOpenChange,
  onSearchChange,
  onSelectRegion,
  onSelectDistillery,
  t,
}: DistillerySheetProps) {
  const dragStartY = useRef<number | null>(null);
  const query = searchQuery.trim().toLocaleLowerCase();
  const items = distilleries
    .filter((distillery) => (query
      ? distillery.name.toLocaleLowerCase().includes(query)
      : selectedRegion === null || distillery.region === selectedRegion.sourceName))
    .sort((a, b) => Number(isTasted(b)) - Number(isTasted(a)) || a.name.localeCompare(b.name));
  const total = distilleries.length;
  const scopeStats = selectedRegion ? regionStats.get(selectedRegion.sourceName) : undefined;
  const scope = scopeStats ?? { tasted: tastedCount, total };
  const progress = scope.total > 0 ? Math.round((scope.tasted / scope.total) * 100) : 0;

  const onHandlePointerDown = (event: ReactPointerEvent) => {
    dragStartY.current = event.clientY;
  };
  const onHandlePointerUp = (event: ReactPointerEvent) => {
    if (dragStartY.current === null) return;
    const delta = event.clientY - dragStartY.current;
    dragStartY.current = null;
    if (delta < -24) onOpenChange(true);
    else if (delta > 24) onOpenChange(false);
    else onOpenChange(!isOpen);
  };

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[20px] border-t border-[#C5A059]/40 bg-[#16161A]/97 shadow-[0_-12px_32px_rgba(0,0,0,0.6)] backdrop-blur-md transition-[height] duration-300 ease-out ${
        isOpen ? 'h-[52%]' : 'h-[118px]'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-label={isOpen ? t('map_view.collapse_list') : t('map_view.expand_list')}
        aria-expanded={isOpen}
        className="flex h-6 w-full shrink-0 touch-none items-center justify-center"
        onPointerDown={onHandlePointerDown}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={() => { dragStartY.current = null; }}
      >
        <span className="h-1 w-10 rounded-full bg-[#3a3a3e]" />
      </button>

      <div className="shrink-0 px-4">
        <label className="flex items-center gap-2 rounded-xl bg-[#0D0D0E] px-3 py-2 text-sm text-[#F4F4F5]">
          <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-[#6E6D6A]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={searchQuery}
            placeholder={t('map_view.search_placeholder')}
            className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-[#6E6D6A]"
            onFocus={() => { if (!isOpen) onOpenChange(true); }}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
        <div className="mt-2 flex items-center justify-between text-xs text-[#9E9D9A]">
          <span>
            {selectedRegion && scopeStats
              ? t('map_view.region_progress', { region: selectedRegion.label, tasted: scopeStats.tasted, total: scopeStats.total })
              : t('map_view.progress', { tasted: tastedCount, total })}
          </span>
          <span className="text-[#C5A059]">{progress}%</span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#2a2a2e]">
          <div className="h-full rounded-full bg-[#C5A059] transition-[width] duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {isOpen && (
        <>
          <div className="mt-3 flex shrink-0 gap-2 overflow-x-auto px-4 pb-2">
            <RegionChip label={t('map_view.all_regions')} count={total} active={selectedRegion === null} onClick={() => onSelectRegion(null)} />
            {whiskyRegions.filter((region) => regionStats.has(region.sourceName)).map((region) => (
              <RegionChip
                key={region.sourceName}
                label={region.label}
                count={regionStats.get(region.sourceName)?.total ?? 0}
                active={selectedRegion?.sourceName === region.sourceName}
                onClick={() => onSelectRegion(region)}
              />
            ))}
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3">
            {items.map((distillery) => {
              const tasted = isTasted(distillery);
              const imageUrl = distillery.logo_url || distillery.image_url;
              return (
                <li key={distillery.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 border-t border-[#2a2a2e] px-4 py-2.5 text-left active:bg-[#C5A059]/10"
                    onClick={() => onSelectDistillery(distillery)}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 text-sm ${
                      tasted ? 'border-[#C5A059] bg-[#C5A059] text-[#1a140a]' : 'border-[#C5A059]/70 bg-[#141417] text-[#C5A059]'
                    }`}>
                      {imageUrl
                        ? <img src={imageUrl} alt="" className="h-full w-full rounded-full bg-[#0D0D0E] object-cover" />
                        : distillery.name.charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-serif text-sm text-[#F4F4F5]">{distillery.name}</span>
                      <span className={`block truncate text-xs ${tasted ? 'text-[#C5A059]' : 'text-[#9E9D9A]'}`}>
                        {[
                          (query || selectedRegion === null) ? regionLabel(distillery.region) : null,
                          tasted ? t('map_view.bottles', { count: distillery.bottle_count }) : t('map_view.not_tasted'),
                        ].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-[#6E6D6A]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </li>
              );
            })}
            {items.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-[#9E9D9A]">
                {loadError ?? t('map_view.nothing_found')}
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}

function RegionChip({ label, count, active, onClick }: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [active]);
  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={active}
      className={`shrink-0 rounded-full border px-3 py-1 text-xs whitespace-nowrap transition-colors ${
        active ? 'border-[#C5A059] bg-[#C5A059] text-[#1a140a]' : 'border-[#C5A059]/50 text-[#FFE28A]'
      }`}
      onClick={onClick}
    >
      {label} <span className={active ? 'text-[#1a140a]/70' : 'text-[#C5A059]'}>{count}</span>
    </button>
  );
}

type DistilleryDotsCanvasProps = {
  distilleries: PositionedMapDistillery[];
  markerRadius: number;
};

function DistilleryDotsCanvas({ distilleries, markerRadius }: DistilleryDotsCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const height = MAP_HEIGHT * 1.5;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    // Oversample so dots stay crisp when the group is zoomed in.
    const pixelRatio = (window.devicePixelRatio || 1) * 2;
    canvas.width = MAP_WIDTH * pixelRatio;
    canvas.height = height * pixelRatio;
    canvas.style.width = `${MAP_WIDTH}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, MAP_HEIGHT / 2 * pixelRatio);
    context.clearRect(0, -MAP_HEIGHT / 2, MAP_WIDTH, height);

    for (const distillery of distilleries) {
      const [x, y] = projectMapCoordinates(distillery.longitude, distillery.latitude);
      const tasted = isTasted(distillery);
      context.beginPath();
      context.arc(x, y, markerRadius * 2.2, 0, Math.PI * 2);
      context.fillStyle = 'rgba(255, 226, 138, 0.14)';
      context.fill();

      context.beginPath();
      context.arc(x, y, markerRadius, 0, Math.PI * 2);
      context.fillStyle = tasted ? '#E2BC6A' : '#141417';
      context.fill();
      context.lineWidth = markerRadius * 0.4;
      context.strokeStyle = tasted ? '#FFF2C2' : '#C5A059';
      context.stroke();
    }
  }, [distilleries, height, markerRadius]);

  return <canvas ref={canvasRef} aria-hidden="true" style={{ display: 'block', pointerEvents: 'none' }} />;
}

/** Pushes overlapping pins apart (in zoom-1 map units) and returns each pin's offset from its true spot. */
function spreadPins(distilleries: PositionedMapDistillery[], minDistance: number) {
  const points = distilleries.map((distillery) => {
    const [x, y] = projectMapCoordinates(distillery.longitude, distillery.latitude);
    return { id: distillery.id, originX: x, originY: y, x, y };
  });
  for (let iteration = 0; iteration < 60; iteration += 1) {
    let moved = false;
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const a = points[i];
        const b = points[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distance = Math.hypot(dx, dy);
        if (distance >= minDistance) continue;
        if (distance < 1e-6) {
          const angle = (2 * Math.PI * j) / points.length;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }
        const push = (minDistance - Math.hypot(b.x - a.x, b.y - a.y)) / 2;
        a.x -= (dx / distance) * push;
        a.y -= (dy / distance) * push;
        b.x += (dx / distance) * push;
        b.y += (dy / distance) * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return new Map(points.map((point) => [point.id, [point.x - point.originX, point.y - point.originY] as [number, number]]));
}

/** Moves the view centre south so `coordinates` lands above a sheet covering `offset` map units. */
function liftCoordinates(coordinates: [number, number], zoom: number, offset: number): [number, number] {
  const [x, y] = projectMapCoordinates(coordinates[0], coordinates[1]);
  return unprojectMapCoordinates(x, y + offset / zoom);
}

function projectMapCoordinates(longitude: number, latitude: number): [number, number] {
  const degreesToRadians = Math.PI / 180;
  return [
    MAP_WIDTH / 2 + (longitude - MAP_CENTER[0]) * degreesToRadians * MAP_SCALE,
    MAP_HEIGHT / 2 - (mercatorLatitude(latitude) - mercatorLatitude(MAP_CENTER[1])) * MAP_SCALE,
  ];
}

function unprojectMapCoordinates(x: number, y: number): [number, number] {
  const radiansToDegrees = 180 / Math.PI;
  const longitude = MAP_CENTER[0] + ((x - MAP_WIDTH / 2) / MAP_SCALE) * radiansToDegrees;
  const mercator = mercatorLatitude(MAP_CENTER[1]) - (y - MAP_HEIGHT / 2) / MAP_SCALE;
  return [longitude, (2 * Math.atan(Math.exp(mercator)) - Math.PI / 2) * radiansToDegrees];
}

function mercatorLatitude(latitude: number) {
  const clampedLatitude = Math.max(-89.999, Math.min(89.999, latitude));
  return Math.log(Math.tan(Math.PI / 4 + (clampedLatitude * Math.PI) / 360));
}

function isBottlePage(value: unknown): value is { items: unknown[] } {
  return typeof value === 'object'
    && value !== null
    && 'items' in value
    && Array.isArray(value.items);
}

function isBottlePreview(value: unknown): value is BottlePreview {
  return typeof value === 'object'
    && value !== null
    && 'id' in value
    && typeof value.id === 'number'
    && 'name' in value
    && typeof value.name === 'string'
    && 'image_url' in value;
}

function isMapDistillery(value: unknown): value is MapDistillery {
  return typeof value === 'object'
    && value !== null
    && typeof (value as MapDistillery).id === 'number'
    && typeof (value as MapDistillery).name === 'string';
}

function hasCoordinates(
  distillery: MapDistillery,
): distillery is MapDistillery & { latitude: number; longitude: number } {
  return Number.isFinite(distillery.latitude) && Number.isFinite(distillery.longitude);
}
