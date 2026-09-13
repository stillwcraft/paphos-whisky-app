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

const initialPosition = {
  coordinates: [-4.2, 57.3] as [number, number],
  zoom: 1,
};

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
          <Geographies geography={SCOTLAND_TOPOLOGY_URL}>
            {({ geographies }) => geographies.map((geography) => (
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
