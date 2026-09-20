import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps';
import { useAnalytics } from '@/hooks/useAnalytics.ts';

const SCOTLAND_TOPOLOGY_URL = '/assets/maps/ScotchRegions.topo.json';
const API_URL = 'https://paphos-whisky-api.onrender.com';
// Match d3-zoom's double-tap window before treating a tap as a selection.
const MAP_TAP_DELAY = 500;

export type MapDistillery = {
  id: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
  image_url?: string | null;
  logo_url?: string | null;
  region?: string | null;
  tasted?: boolean;
  rating?: number;
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
};

type WhiskyRegion = {
  sourceName: string;
  label: string;
  center: [number, number];
  labelCoordinates: [number, number];
  zoom: number;
};

const initialPosition = {
  coordinates: [-4.2, 57.3] as [number, number],
  zoom: 1,
};

const whiskyRegions: WhiskyRegion[] = [
  {
    sourceName: 'Speyside',
    label: 'Speyside',
    center: [-3.5, 57.25],
    labelCoordinates: [-2.05, 57.78],
    zoom: 3.2,
  },
  {
    sourceName: 'Highlands',
    label: 'Highland',
    center: [-4.2, 57.55],
    labelCoordinates: [-2.55, 58.5],
    zoom: 2.3,
  },
  {
    sourceName: 'Islands',
    label: 'Island',
    center: [-5.6, 57.8],
    labelCoordinates: [-8.25, 57.25],
    zoom: 1.8,
  },
  {
    sourceName: 'Lowlands',
    label: 'Lowland',
    center: [-3.7, 55.45],
    labelCoordinates: [-1.5, 55.2],
    zoom: 2.5,
  },
  {
    sourceName: 'Islay',
    label: 'Islay',
    center: [-6.27, 55.75],
    labelCoordinates: [-7.05, 55.55],
    zoom: 5.5,
  },
  {
    sourceName: 'Campbeltown',
    label: 'Campbeltown',
    center: [-5.64, 55.42],
    labelCoordinates: [-6.55, 54.95],
    zoom: 5.5,
  },
];

export function ScotlandWhiskyMap({
  onSelectDistillery,
  selectedDistilleryId = null,
  onSelectedDistilleryHandled,
}: ScotlandWhiskyMapProps) {
  const { trackEvent } = useAnalytics();
  const [position, setPosition] = useState(initialPosition);
  const [activeDistillery, setActiveDistillery] = useState<MapDistillery | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<WhiskyRegion | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const markerRadius = 2.5 / Math.pow(position.zoom, 1.35);
  const [mapDistilleries, setMapDistilleries] = useState<MapDistillery[]>([]);
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);
  const [selectedDistillery, setSelectedDistillery] = useState<MapDistillery | null>(null);
  const [selectedBottles, setSelectedBottles] = useState<BottlePreview[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailLoadError, setDetailLoadError] = useState<string | null>(null);

  const pendingMapClick = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreClicksUntil = useRef(0);
  const cancelMapClick = useCallback(() => {
    if (pendingMapClick.current !== null) {
      clearTimeout(pendingMapClick.current);
      pendingMapClick.current = null;
    }
  }, []);
  useEffect(() => cancelMapClick, [cancelMapClick]);

  const handleMapMove = useCallback(() => {
    cancelMapClick();
    ignoreClicksUntil.current = Date.now() + MAP_TAP_DELAY;
  }, [cancelMapClick]);
  const filterMapGestures = useCallback((event: unknown) => {
    if (!(event instanceof Event)) return false;
    // d3-zoom passes touchend to its double-tap zoom handler.
    if (event.type === 'dblclick' || event.type === 'touchend') {
      handleMapMove();
      return false;
    }
    return event.type === 'touchstart'
      || (event instanceof MouseEvent
        && event.type === 'mousedown'
        && !event.ctrlKey
        && event.button === 0);
  }, [handleMapMove]);
  const scheduleMapClick = (action: () => void) => {
    cancelMapClick();
    if (Date.now() < ignoreClicksUntil.current) return;
    pendingMapClick.current = setTimeout(() => {
      pendingMapClick.current = null;
      action();
    }, MAP_TAP_DELAY);
  };
  const handleMoveEnd = useCallback((nextPosition: typeof initialPosition) => {
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

  const changeZoom = (amount: number) => {
    cancelMapClick();
    setPosition((current) => {
      const zoom = Math.min(8, Math.max(initialPosition.zoom, current.zoom + amount));
      return zoom === initialPosition.zoom ? initialPosition : { ...current, zoom };
    });
  };

  const selectDistillery = useCallback(async (distillery: MapDistillery) => {
    trackEvent('map_distillery_selected', {
      distillery_id: distillery.id,
      region: distillery.region ?? null,
    });
    setActiveDistillery(distillery);
    setSelectedDistillery(distillery);
    setSelectedBottles([]);
    setDetailLoadError(null);
    setIsLoadingDetails(true);
    setPosition({
      coordinates: [distillery.longitude!, distillery.latitude!],
      zoom: 8,
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

      setSelectedDistillery(detail);
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

  const resetMap = () => {
    setActiveDistillery(null);
    setSelectedDistillery(null);
    setSelectedBottles([]);
    setDetailLoadError(null);
    setSelectedRegion(null);
    setPosition(initialPosition);
  };

  const selectRegion = (region: WhiskyRegion) => {
    if (selectedDistillery) {
      resetMap();
      return;
    }
    const nextRegion = selectedRegion?.sourceName === region.sourceName ? null : region;
    setSelectedRegion(nextRegion);
    setPosition(nextRegion
      ? { coordinates: nextRegion.center, zoom: nextRegion.zoom }
      : initialPosition);
  };

  return (
    <section className={`relative w-full overflow-hidden bg-[#0D0D0E] ${
      selectedDistillery ? 'flex h-full flex-col gap-3 px-4 py-3' : 'h-full'
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

      <div className={`relative w-full overflow-hidden ${
        selectedDistillery
          ? 'h-[42dvh] min-h-[250px] shrink-0 rounded-2xl border border-[#C5A059]/60 shadow-2xl'
          : 'h-full'
      }`}>
        <ComposableMap
        width={390}
        height={640}
        projection="geoMercator"
        projectionConfig={{ center: [-4.2, 57.3], scale: 2200 }}
        className="h-full w-full touch-none"
        onClick={() => scheduleMapClick(resetMap)}
      >
        <ZoomableGroup
          center={position.coordinates}
          zoom={position.zoom}
          minZoom={1}
          maxZoom={16}
          translateExtent={[[0, 0], [390, 640]]}
          filterZoomEvent={filterMapGestures}
          onMoveStart={cancelMapClick}
          onMove={handleMapMove}
          onMoveEnd={handleMoveEnd}
        >
          <g style={{ filter: 'drop-shadow(0px 10px 25px rgba(0, 0, 0, 0.9))' }}>
            <Geographies geography={SCOTLAND_TOPOLOGY_URL}>
              {({ geographies }) => geographies.map((geography) => {
                const region = whiskyRegions.find(
                  (item) => item.sourceName === geography.properties.name,
                );
                if (!region) return null;
                const isSelected = selectedRegion?.sourceName === region.sourceName;
                const isHighlighted = isSelected || hoveredRegion === region.sourceName;

                return (
                  <Geography
                    key={geography.rsmKey}
                    geography={geography}
                    onMouseEnter={() => setHoveredRegion(region.sourceName)}
                    onMouseLeave={() => setHoveredRegion(null)}
                    onClick={(event) => {
                      event.stopPropagation();
                      scheduleMapClick(() => selectRegion(region));
                    }}
                    style={{
                      default: {
                        fill: isHighlighted ? '#1E1E24' : '#141417',
                        stroke: 'rgba(197, 160, 89, 0.3)',
                        strokeWidth: 0.8,
                        cursor: 'pointer',
                        outline: 'none',
                        transition: 'fill 0.3s ease',
                      },
                      hover: {
                        fill: '#1E1E24',
                        stroke: 'rgba(197, 160, 89, 0.3)',
                        strokeWidth: 0.8,
                        cursor: 'pointer',
                        outline: 'none',
                        transition: 'fill 0.3s ease',
                      },
                      pressed: {
                        fill: '#24242C',
                        outline: 'none',
                      },
                    }}
                  />
                );
              })}
            </Geographies>
          </g>

          {whiskyRegions.map((region) => (
            <Marker key={`${region.sourceName}-label`} coordinates={region.labelCoordinates}>
              <text
                fill="#C5A059"
                fillOpacity={
                  selectedRegion?.sourceName === region.sourceName
                  || hoveredRegion === region.sourceName
                    ? 0.85
                    : 0.25
                }
                fontSize={5}
                fontFamily="'Cinzel', 'Playfair Display', serif"
                fontWeight={600}
                pointerEvents="none"
                textAnchor="middle"
                style={{
                  filter: selectedRegion?.sourceName === region.sourceName
                    || hoveredRegion === region.sourceName
                    ? 'drop-shadow(0 0 8px rgba(197, 160, 89, 0.6))'
                    : undefined,
                  letterSpacing: '0.3em',
                }}
              >
                {region.label.toUpperCase()}
              </text>
            </Marker>
          ))}

          {mapDistilleries
            .filter(hasCoordinates)
            .map((distillery) => {
              const isInSelectedRegion = selectedRegion?.sourceName === distillery.region;
              return (
                <Marker
                  key={distillery.id}
                  coordinates={[distillery.longitude, distillery.latitude]}
                  onMouseEnter={() => setActiveDistillery(distillery)}
                  onFocus={() => setActiveDistillery(distillery)}
                onClick={(event) => {
                  event.stopPropagation();
                  scheduleMapClick(() => { void selectDistillery(distillery); });
                }}
                >
                  {selectedDistillery?.id === distillery.id ? (
                    <>
                      <defs>
                        <clipPath id={`distillery-image-${distillery.id}`}>
                          <circle r={9} />
                        </clipPath>
                      </defs>
                      <circle r={11} fill="#C5A059" fillOpacity={0.28} />
                      {selectedDistillery.image_url ? (
                        <image
                          href={selectedDistillery.image_url}
                          x={-9}
                          y={-9}
                          width={18}
                          height={18}
                          clipPath={`url(#distillery-image-${distillery.id})`}
                          preserveAspectRatio="xMidYMid slice"
                        />
                      ) : (
                        <circle r={9} fill="#C5A059" />
                      )}
                      <circle r={9} fill="none" stroke="#F4F4F5" strokeWidth={1} />
                    </>
                  ) : isInSelectedRegion ? (
                    <>
                      <defs>
                        <clipPath id={`region-distillery-image-${distillery.id}`}>
                          <circle r={5} />
                        </clipPath>
                      </defs>
                      <circle r={6.5} fill="#C5A059" fillOpacity={0.28} />
                      {distillery.image_url ? (
                        <image
                          href={distillery.image_url}
                          x={-5}
                          y={-5}
                          width={10}
                          height={10}
                          clipPath={`url(#region-distillery-image-${distillery.id})`}
                          preserveAspectRatio="xMidYMid slice"
                        />
                      ) : (
                        <circle r={5} fill="#C5A059" />
                      )}
                      <circle r={5} fill="none" stroke="#F4F4F5" strokeWidth={0.75} />
                    </>
                  ) : (
                    <>
                      {distillery.tasted && (
                        <circle r={markerRadius * 2} fill="#C5A059" fillOpacity={0.12} />
                      )}
                      <circle
                        r={markerRadius}
                        fill={distillery.tasted ? '#C5A059' : '#3A3935'}
                        stroke={distillery.tasted ? '#FFF' : 'rgba(197, 160, 89, 0.4)'}
                        strokeWidth={1}
                        style={distillery.tasted
                          ? { filter: 'drop-shadow(0 0 6px rgba(197, 160, 89, 0.8))' }
                          : undefined}
                      />
                    </>
                  )}
                </Marker>
              );
            })}
        </ZoomableGroup>
        </ComposableMap>

        <div className="absolute right-3 top-3 flex flex-col gap-1 rounded-xl border border-[#C5A059]/30 bg-[#16161A]/80 p-1 text-[#C5A059] shadow-2xl backdrop-blur-md">
        <button
          aria-label="Zoom in"
          className="flex h-8 w-8 items-center justify-center rounded-lg font-bold"
          type="button"
          onClick={() => changeZoom(1)}
        >
          +
        </button>
        <button
          aria-label="Zoom out"
          className="flex h-8 w-8 items-center justify-center rounded-lg font-bold"
          type="button"
          onClick={() => changeZoom(-1)}
        >
          -
        </button>
        </div>
      </div>

      {selectedDistillery ? (
        <div className="min-h-0 flex-1">
          <div className="flex h-full snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
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
            {isLoadingDetails && <p className="py-4 text-sm text-[#9E9D9A]">Loading bottles...</p>}
            {detailLoadError && <p className="py-4 text-sm text-[#9E9D9A]">{detailLoadError}</p>}
          </div>
        </div>
      ) : activeDistillery && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl border border-[#C5A059]/30 bg-[#16161A]/95 px-3 py-2 shadow-xl">
          <p className="font-serif text-sm text-[#F4F4F5]">{activeDistillery.name}</p>
          {activeDistillery.tasted && (
            <p className="mt-1 text-xs text-[#9E9D9A]">
              {`★ Tasted${activeDistillery.rating ? ` · ${activeDistillery.rating}` : ''}`}
            </p>
          )}
        </div>
      )}
      {mapLoadError && (
        <p className="absolute bottom-3 right-3 text-xs text-[#9E9D9A]">{mapLoadError}</p>
      )}
    </section>
  );
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
