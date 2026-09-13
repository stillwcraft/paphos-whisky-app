import { useState } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps';

const SCOTLAND_TOPOLOGY_URL = 'https://raw.githubusercontent.com/jovrtn/ScotchRegions/35f68d55a517c95c476c7500333ab4a540c1bbbe/topojson/ScotchRegions.topo.json';

export type MapDistillery = {
  id: string;
  name: string;
  region: string;
  coordinates: [number, number];
  tasted: boolean;
  rating?: number;
};

type ScotlandWhiskyMapProps = {
  distilleries: MapDistillery[];
  onSelectDistillery: (distillery: MapDistillery) => void;
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
    labelCoordinates: [-3.7, 59.05],
    zoom: 2.3,
  },
  {
    sourceName: 'Islands',
    label: 'Island',
    center: [-5.6, 57.8],
    labelCoordinates: [-7.55, 57.25],
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
    labelCoordinates: [-6.35, 55.18],
    zoom: 5.5,
  },
];

export const mockMapDistilleries: MapDistillery[] = [
  { id: 'ardbeg', name: 'Ardbeg', region: 'Islay', coordinates: [-6.108, 55.64], tasted: true, rating: 87 },
  { id: 'laphroaig', name: 'Laphroaig', region: 'Islay', coordinates: [-6.152, 55.64], tasted: true, rating: 89 },
  { id: 'the-macallan', name: 'The Macallan', region: 'Speyside', coordinates: [-3.226, 57.49], tasted: false },
  { id: 'glenfiddich', name: 'Glenfiddich', region: 'Speyside', coordinates: [-3.127, 57.46], tasted: true, rating: 85 },
  { id: 'talisker', name: 'Talisker', region: 'Isle of Skye', coordinates: [-6.361, 57.302], tasted: false },
];

export function ScotlandWhiskyMap({
  distilleries,
  onSelectDistillery,
}: ScotlandWhiskyMapProps) {
  const [position, setPosition] = useState(initialPosition);
  const [activeDistillery, setActiveDistillery] = useState<MapDistillery | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<WhiskyRegion | null>(null);

  const changeZoom = (amount: number) => {
    setPosition((current) => ({
      ...current,
      zoom: Math.min(8, Math.max(1, current.zoom + amount)),
    }));
  };

  const selectDistillery = (distillery: MapDistillery) => {
    setActiveDistillery(distillery);
    onSelectDistillery(distillery);
  };

  const selectRegion = (region: WhiskyRegion) => {
    const nextRegion = selectedRegion?.sourceName === region.sourceName ? null : region;
    setSelectedRegion(nextRegion);
    setPosition(nextRegion
      ? { coordinates: nextRegion.center, zoom: nextRegion.zoom }
      : initialPosition);
  };

  return (
    <section className="relative h-full w-full overflow-hidden bg-[#0D0D0E]">
      <ComposableMap
        width={390}
        height={640}
        projection="geoMercator"
        projectionConfig={{ center: [-4.2, 57.3], scale: 1200 }}
        className="h-full w-full touch-pan-y"
      >
        <ZoomableGroup
          center={position.coordinates}
          zoom={position.zoom}
          minZoom={1}
          maxZoom={8}
          onMoveEnd={setPosition}
        >
          <g style={{ filter: 'drop-shadow(0px 10px 25px rgba(0, 0, 0, 0.9))' }}>
            <Geographies geography={SCOTLAND_TOPOLOGY_URL}>
              {({ geographies }) => geographies.map((geography) => {
                const region = whiskyRegions.find(
                  (item) => item.sourceName === geography.properties.name,
                );
                if (!region) return null;
                const isSelected = selectedRegion?.sourceName === region.sourceName;

                return (
                  <Geography
                    key={geography.rsmKey}
                    geography={geography}
                    onClick={() => selectRegion(region)}
                    style={{
                      default: {
                        fill: isSelected ? '#1E1E24' : '#141417',
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
                fillOpacity={selectedRegion?.sourceName === region.sourceName ? 0.85 : 0.25}
                fontSize={5}
                fontFamily="'Cinzel', 'Playfair Display', serif"
                fontWeight={600}
                pointerEvents="none"
                textAnchor="middle"
                style={{
                  filter: selectedRegion?.sourceName === region.sourceName
                    ? 'drop-shadow(0 0 8px rgba(197, 160, 89, 0.6))'
                    : undefined,
                  letterSpacing: '0.3em',
                }}
              >
                {region.label.toUpperCase()}
              </text>
            </Marker>
          ))}

          {distilleries.map((distillery) => (
            <Marker
              key={distillery.id}
              coordinates={distillery.coordinates}
              onMouseEnter={() => setActiveDistillery(distillery)}
              onFocus={() => setActiveDistillery(distillery)}
              onClick={() => selectDistillery(distillery)}
            >
              {distillery.tasted && (
                <circle r={12} fill="#C5A059" fillOpacity={0.12} />
              )}
              <circle
                r={6}
                fill={distillery.tasted ? '#C5A059' : '#3A3935'}
                stroke={distillery.tasted ? '#FFF' : 'rgba(197, 160, 89, 0.4)'}
                strokeWidth={1}
                style={distillery.tasted
                  ? { filter: 'drop-shadow(0 0 6px rgba(197, 160, 89, 0.8))' }
                  : undefined}
              />
            </Marker>
          ))}
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

      {activeDistillery && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl border border-[#C5A059]/30 bg-[#16161A]/95 px-3 py-2 shadow-xl">
          <p className="font-serif text-sm text-[#F4F4F5]">{activeDistillery.name}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-[#C5A059]">
            {activeDistillery.region}
          </p>
          <p className="mt-1 text-xs text-[#9E9D9A]">
            {activeDistillery.tasted
              ? `★ Tasted${activeDistillery.rating ? ` · ${activeDistillery.rating}` : ''}`
              : 'Not tasted yet'}
          </p>
        </div>
      )}
    </section>
  );
}
