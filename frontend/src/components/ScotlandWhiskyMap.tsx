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
const SMALL_ISLAND_MAX_SIZE = 12;

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
    labelCoordinates: [-2.8, 57.85],
    zoom: 3.2,
  },
  {
    sourceName: 'Highlands',
    label: 'Highland',
    center: [-4.2, 57.55],
    labelCoordinates: [-4.2, 58.85],
    zoom: 2.3,
  },
  {
    sourceName: 'Islands',
    label: 'Island',
    center: [-5.6, 57.8],
    labelCoordinates: [-7.1, 57.45],
    zoom: 1.8,
  },
  {
    sourceName: 'Lowlands',
    label: 'Lowland',
    center: [-3.7, 55.45],
    labelCoordinates: [-2.55, 55.2],
    zoom: 2.5,
  },
  {
    sourceName: 'Islay',
    label: 'Islay',
    center: [-6.27, 55.75],
    labelCoordinates: [-6.75, 55.78],
    zoom: 5.5,
  },
  {
    sourceName: 'Campbeltown',
    label: 'Campbeltown',
    center: [-5.64, 55.42],
    labelCoordinates: [-5.85, 55.2],
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
  const markerRadius = 2.5 / Math.pow(position.zoom, 1.35);
  const isDistantZoom = position.zoom <= 1.5;
  const [mapDistilleries, setMapDistilleries] = useState<MapDistillery[]>([]);
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);
  const [selectedDistillery, setSelectedDistillery] = useState<MapDistillery | null>(null);
  const [selectedBottles, setSelectedBottles] = useState<BottlePreview[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailLoadError, setDetailLoadError] = useState<string | null>(null);
  const visibleMapDistilleries = mapDistilleries
    .filter(hasCoordinates)
    .filter((distillery, index) => (
      !isDistantZoom
      || distillery.tasted
      || distillery.id === selectedDistillery?.id
      || index % 3 === 0
    ));
  const canvasDistilleries = visibleMapDistilleries.filter((distillery) => (
    distillery.id !== selectedDistillery?.id
    && (selectedRegion === null || distillery.region !== selectedRegion.sourceName)
  ));

  const filterMapGestures = useCallback((event: unknown) => {
    if (!(event instanceof Event)) return false;
    // d3-zoom passes touchend to its double-tap zoom handler.
    if (event.type === 'dblclick' || event.type === 'touchend') {
      return false;
    }
    return event.type === 'touchstart'
      || (event instanceof MouseEvent
        && event.type === 'mousedown'
        && !event.ctrlKey
        && event.button === 0);
  }, []);
  const scheduleMapClick = (action: () => void) => {
    action();
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
    <section className={`relative w-full overflow-hidden bg-[#0a0a0c] ${
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

      <div className={`relative w-full overflow-hidden bg-[#0a0a0c] ${
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
          <defs>
            <linearGradient id="land-obsidian" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1c1c22" />
              <stop offset="100%" stopColor="#16161a" />
            </linearGradient>
            <linearGradient id="gold-region-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFE28A" />
              <stop offset="100%" stopColor="#C5A059" />
            </linearGradient>
          </defs>
          <ZoomableGroup
            center={position.coordinates}
            zoom={position.zoom}
            minZoom={1}
            maxZoom={16}
            translateExtent={[[0, 0], [390, 640]]}
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
                  strokeWidth: 1.2,
                  strokeLinejoin: 'round' as const,
                  strokeLinecap: 'round' as const,
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
                  ? 'drop-shadow(0 0 4px rgba(255, 226, 138, 0.6))'
                  : 'drop-shadow(0px 4px 4px rgba(0,0,0,0.9))';
                const regionShadow = isSelected
                  ? 'drop-shadow(0 0 8px rgba(255, 226, 138, 0.7)) drop-shadow(0 0 20px rgba(197, 160, 89, 0.4))'
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
                            scheduleMapClick(() => selectRegion(region));
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

            {whiskyRegions.map((region) => (
              <Marker key={`${region.sourceName}-label`} coordinates={region.labelCoordinates}>
                <foreignObject
                  x={-70 / position.zoom}
                  y={-16 / position.zoom}
                  width={140 / position.zoom}
                  height={32 / position.zoom}
                  pointerEvents="none"
                  style={{ overflow: 'visible' }}
                >
                  <div
                    className="flex h-8 w-[140px] items-center justify-center"
                    style={{ transform: `scale(${1 / position.zoom})`, transformOrigin: 'top left' }}
                  >
                    <span className={`pointer-events-none whitespace-nowrap rounded-full border px-2.5 py-1 font-serif text-[10px] uppercase tracking-widest backdrop-blur-md transition-all ${
                      selectedRegion?.sourceName === region.sourceName
                        ? 'border-[#FFE28A] bg-[#C5A059]/30 text-[#FFF2C2] ring-1 ring-[#FFE28A]/70 shadow-[0_0_18px_rgba(255,226,138,0.65)]'
                        : 'border-[#C5A059]/40 bg-[#141417]/85 text-[#FFE28A] shadow-md'
                    }`}>
                      {region.label}
                    </span>
                  </div>
                </foreignObject>
              </Marker>
            ))}

            <foreignObject x={0} y={0} width={390} height={640} pointerEvents="none">
              <DistilleryMarkersCanvas
                distilleries={canvasDistilleries}
                markerRadius={markerRadius}
                isDistantZoom={isDistantZoom}
              />
            </foreignObject>
            {visibleMapDistilleries.map((distillery) => {
              const isSelected = selectedDistillery?.id === distillery.id;
              const isInSelectedRegion = selectedRegion !== null
                && selectedRegion.sourceName === distillery.region;
              const imageUrl = (isSelected && selectedDistillery?.image_url) || distillery.image_url;
              const hitRadius = isSelected || isInSelectedRegion
                ? Math.max(18 / position.zoom, 5)
                : Math.max(markerRadius * 3, 5);

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
                  {(isSelected || isInSelectedRegion) && (
                    <foreignObject
                      x={-18 / position.zoom}
                      y={-18 / position.zoom}
                      width={36 / position.zoom}
                      height={36 / position.zoom}
                      pointerEvents="none"
                      style={{ overflow: 'visible' }}
                    >
                      <div
                        className="relative z-20 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-[#141417] bg-[#141417] text-xs text-[#FFE28A] ring-2 ring-white/90 shadow-[0_6px_20px_rgba(0,0,0,0.95)]"
                        style={{ transform: `scale(${1 / position.zoom})`, transformOrigin: 'top left' }}
                      >
                        {imageUrl ? (
                          <img src={imageUrl} alt="" className="h-full w-full rounded-full object-cover" />
                        ) : distillery.name.charAt(0)}
                      </div>
                    </foreignObject>
                  )}
                  <circle r={hitRadius} fill="transparent" pointerEvents="all" />
                </Marker>
              );
            })}
          </ZoomableGroup>
        </ComposableMap>

        <div className="absolute right-3 top-3 flex flex-col space-y-2">
          <button
            aria-label="Zoom in"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#C5A059]/30 bg-[#1a1a1e]/80 text-xl text-[#C5A059] shadow-lg backdrop-blur-md transition-all hover:border-[#C5A059]/70 active:scale-95"
            type="button"
            onClick={() => changeZoom(1)}
          >
            +
          </button>
          <button
            aria-label="Zoom out"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#C5A059]/30 bg-[#1a1a1e]/80 text-xl text-[#C5A059] shadow-lg backdrop-blur-md transition-all hover:border-[#C5A059]/70 active:scale-95"
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
        <button
          type="button"
          aria-label={`Open ${activeDistillery.name}`}
          onClick={() => { void selectDistillery(activeDistillery); }}
          className="absolute bottom-4 left-1/2 flex w-[90%] max-w-xs -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-[#C5A059]/40 bg-[#1a1a1e]/80 p-3 text-left shadow-2xl backdrop-blur-md"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#C5A059] bg-[#141417] text-[#C5A059]">
            {activeDistillery.logo_url || activeDistillery.image_url ? (
              <img
                src={activeDistillery.logo_url || activeDistillery.image_url || undefined}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : activeDistillery.name.charAt(0)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-serif text-sm text-[#F4F4F5]">{activeDistillery.name}</span>
            {activeDistillery.region && (
              <span className="block truncate text-xs text-[#C5A059]">
                {whiskyRegions.find((region) => region.sourceName === activeDistillery.region)?.label
                  ?? activeDistillery.region}
              </span>
            )}
          </span>
          <span aria-hidden="true" className="shrink-0 text-xl text-[#C5A059]">→</span>
        </button>
      )}
      {mapLoadError && (
        <p className="absolute bottom-3 right-3 text-xs text-[#9E9D9A]">{mapLoadError}</p>
      )}
    </section>
  );
}

type DistilleryMarkersCanvasProps = {
  distilleries: PositionedMapDistillery[];
  markerRadius: number;
  isDistantZoom: boolean;
};

function DistilleryMarkersCanvas({
  distilleries,
  markerRadius,
  isDistantZoom,
}: DistilleryMarkersCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = 390 * pixelRatio;
    canvas.height = 640 * pixelRatio;
    canvas.style.width = '390px';
    canvas.style.height = '640px';
    let animationFrame = 0;

    const draw = (timestamp: number) => {
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, 390, 640);

      distilleries.forEach((distillery) => {
        const [x, y] = projectMapCoordinates(distillery.longitude, distillery.latitude);
        const radius = markerRadius;

        const pulseScale = 1 + Math.sin(timestamp / 290 + distillery.id) * 0.14;
        context.beginPath();
        context.arc(x, y, radius * 2.2 * pulseScale, 0, Math.PI * 2);
        context.fillStyle = distillery.tasted
          ? 'rgba(255, 226, 138, 0.26)'
          : 'rgba(255, 226, 138, 0.16)';
        context.fill();

        context.save();
        context.shadowColor = 'rgba(255, 226, 138, 0.8)';
        context.shadowBlur = isDistantZoom ? 6 : 4;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fillStyle = 'rgba(197, 160, 89, 0.38)';
        context.fill();
        context.restore();

        const markerGradient = context.createRadialGradient(
          x - radius * 0.35,
          y - radius * 0.4,
          radius * 0.1,
          x,
          y,
          radius,
        );
        markerGradient.addColorStop(0, '#FFF8D5');
        markerGradient.addColorStop(0.35, '#FFE28A');
        markerGradient.addColorStop(0.72, '#C5A059');
        markerGradient.addColorStop(1, '#6F501E');

        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fillStyle = markerGradient;
        context.fill();

        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.lineWidth = 0.75;
        context.strokeStyle = distillery.tasted ? '#FFF2C2' : '#A77E35';
        context.stroke();
      });

      animationFrame = requestAnimationFrame(draw);
    };

    draw(performance.now());
    return () => cancelAnimationFrame(animationFrame);
  }, [distilleries, isDistantZoom, markerRadius]);

  return <canvas ref={canvasRef} aria-hidden="true" style={{ display: 'block', pointerEvents: 'none' }} />;
}

function projectMapCoordinates(longitude: number, latitude: number): [number, number] {
  const degreesToRadians = Math.PI / 180;
  const centerLongitude = -4.2 * degreesToRadians;
  const centerLatitude = mercatorLatitude(57.3);
  const projectedLongitude = longitude * degreesToRadians;

  return [
    195 + (projectedLongitude - centerLongitude) * 2200,
    320 - (mercatorLatitude(latitude) - centerLatitude) * 2200,
  ];
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
