import { useState } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps';

const SCOTLAND_TOPOLOGY_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json';

export type MapDistillery = {
  id: string;
  name: string;
  region: string;
  coordinates: [number, number];
  tasted: boolean;
  rating?: number;
};

type WhiskyRegion = {
  id: string;
  name: string;
  color: string;
  center: [number, number];
  zoom: number;
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
};

type ScotlandWhiskyMapProps = {
  distilleries: MapDistillery[];
  onSelectDistillery: (distillery: MapDistillery) => void;
};

const initialPosition = {
  coordinates: [-4.2, 57.3] as [number, number],
  zoom: 1,
};

const whiskyRegions: WhiskyRegion[] = [
  {
    id: 'highland',
    name: 'Highland',
    color: '#4C4230',
    center: [-4.5, 57.85],
    zoom: 2.3,
    geometry: {
      type: 'Polygon',
      coordinates: [[[-5.85, 56.75], [-3.95, 56.8], [-2.75, 57.35], [-2.75, 58.65], [-3.65, 59.05], [-5.45, 58.9], [-6.1, 57.85], [-5.85, 56.75]]],
    },
  },
  {
    id: 'speyside',
    name: 'Speyside',
    color: '#806631',
    center: [-3.28, 57.42],
    zoom: 4.8,
    geometry: {
      type: 'Polygon',
      coordinates: [[[-3.85, 57.08], [-2.93, 57.08], [-2.87, 57.72], [-3.65, 57.77], [-3.85, 57.08]]],
    },
  },
  {
    id: 'lowland',
    name: 'Lowland',
    color: '#3F4A3B',
    center: [-3.8, 55.95],
    zoom: 3.1,
    geometry: {
      type: 'Polygon',
      coordinates: [[[-5.55, 55.45], [-2.55, 55.45], [-2.62, 56.65], [-3.95, 56.95], [-5.25, 56.68], [-5.55, 55.45]]],
    },
  },
  {
    id: 'islay',
    name: 'Islay',
    color: '#65443A',
    center: [-6.15, 55.72],
    zoom: 6.2,
    geometry: {
      type: 'Polygon',
      coordinates: [[[-6.52, 55.48], [-5.82, 55.48], [-5.77, 55.98], [-6.48, 56.02], [-6.52, 55.48]]],
    },
  },
  {
    id: 'campbeltown',
    name: 'Campbeltown',
    color: '#6B5136',
    center: [-5.6, 55.45],
    zoom: 5.2,
    geometry: {
      type: 'Polygon',
      coordinates: [[[-5.95, 55.08], [-5.28, 55.08], [-5.25, 55.84], [-5.76, 55.92], [-5.95, 55.08]]],
    },
  },
  {
    id: 'island',
    name: 'Island',
    color: '#51435B',
    center: [-5.75, 57.55],
    zoom: 2.7,
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        [[[-6.55, 56.88], [-5.82, 56.88], [-5.62, 57.62], [-6.35, 57.8], [-6.55, 56.88]]],
        [[[-7.8, 57.15], [-6.8, 57.15], [-6.72, 57.72], [-7.72, 57.72], [-7.8, 57.15]]],
        [[[-3.5, 58.65], [-2.45, 58.65], [-2.38, 59.28], [-3.45, 59.28], [-3.5, 58.65]]],
      ],
    },
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
    const nextRegion = selectedRegion?.id === region.id ? null : region;
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
        projectionConfig={{ center: [-4.2, 57.3], scale: 4200 }}
        className="h-full w-full touch-pan-y"
      >
        <ZoomableGroup
          center={position.coordinates}
          zoom={position.zoom}
          minZoom={1}
          maxZoom={8}
          onMoveEnd={setPosition}
        >
          <Geographies geography={SCOTLAND_TOPOLOGY_URL}>
            {({ geographies }) => geographies
              .filter((geography) => geography.properties.name === 'United Kingdom')
              .map((geography) => (
              <Geography
                key={geography.rsmKey}
                geography={geography}
                style={{
                  default: {
                    fill: '#16161A',
                    stroke: 'rgba(197, 160, 89, 0.25)',
                    strokeWidth: 0.8,
                    outline: 'none',
                  },
                  hover: {
                    fill: '#22222A',
                    stroke: '#C5A059',
                    strokeWidth: 1.2,
                    cursor: 'pointer',
                    outline: 'none',
                  },
                  pressed: {
                    fill: '#2A2A33',
                    outline: 'none',
                  },
                }}
              />
              ))}
          </Geographies>

          <Geographies geography={{
            type: 'FeatureCollection',
            features: whiskyRegions.map((region) => ({
              type: 'Feature',
              properties: { id: region.id, name: region.name },
              geometry: region.geometry,
            })),
          }}>
            {({ geographies }) => geographies.map((geography) => {
              const region = whiskyRegions.find((item) => item.id === geography.properties.id);
              if (!region) return null;
              const isSelected = selectedRegion?.id === region.id;

              return (
                <Geography
                  key={region.id}
                  geography={geography}
                  onClick={() => selectRegion(region)}
                  style={{
                    default: {
                      fill: isSelected ? '#C5A059' : region.color,
                      fillOpacity: isSelected ? 0.9 : 0.72,
                      stroke: isSelected ? '#F4F4F5' : 'rgba(197, 160, 89, 0.55)',
                      strokeWidth: isSelected ? 1.5 : 0.8,
                      cursor: 'pointer',
                      outline: 'none',
                    },
                    hover: {
                      fill: '#C5A059',
                      fillOpacity: 0.9,
                      stroke: '#F4F4F5',
                      strokeWidth: 1.2,
                      cursor: 'pointer',
                      outline: 'none',
                    },
                    pressed: {
                      fill: '#E0BF78',
                      outline: 'none',
                    },
                  }}
                />
              );
            })}
          </Geographies>

          {whiskyRegions.map((region) => (
            <Marker key={`${region.id}-label`} coordinates={region.center}>
              <text
                fill="#F4F4F5"
                fontSize={5}
                fontWeight={700}
                pointerEvents="none"
                textAnchor="middle"
              >
                {region.name}
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
              <circle
                r={distillery.tasted ? 6 : 5}
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

      <div className="absolute right-3 top-3 flex gap-2">
        <button
          aria-label="Zoom in"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#C5A059]/30 bg-[#16161A]/90 font-bold text-[#C5A059] shadow-lg"
          type="button"
          onClick={() => changeZoom(1)}
        >
          +
        </button>
        <button
          aria-label="Zoom out"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#C5A059]/30 bg-[#16161A]/90 font-bold text-[#C5A059] shadow-lg"
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
