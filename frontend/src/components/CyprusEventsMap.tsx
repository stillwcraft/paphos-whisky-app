import { useEffect, useState, type ReactNode } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Icon, type LatLngTuple } from 'leaflet';
import { useTranslation } from 'react-i18next';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
import { localizedApiUrl } from '@/localization.ts';
import { normalizePaginatedResponse, paginatedUrl, type PaginatedResponse } from '@/pagination.ts';

const API_URL = 'https://paphos-whisky-api.onrender.com';
const CYPRUS_CENTER: LatLngTuple = [34.95, 33.25];
const PAGE_SIZE = 100;
const eventIcon = new Icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});

type EventMarker = {
  id: number;
  title: string;
  date: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
};
type PositionedEvent = EventMarker & { latitude: number; longitude: number };

function hasPosition(event: EventMarker): event is PositionedEvent {
  return event.latitude !== null && event.longitude !== null
    && Number.isFinite(event.latitude) && Number.isFinite(event.longitude);
}

function ResizeMap() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

function BaseMap({ children, className }: { children: ReactNode; className: string }) {
  return (
    <MapContainer
      center={CYPRUS_CENTER}
      zoom={8}
      minZoom={7}
      maxZoom={18}
      maxBounds={[[34.15, 31.8], [36.0, 34.9]]}
      scrollWheelZoom={false}
      zoomControl={false}
      className={className}
    >
      <ResizeMap />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {children}
    </MapContainer>
  );
}

export function CyprusEventsMap({
  onSelectEvent,
}: {
  onSelectEvent: (eventId: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const [events, setEvents] = useState<PositionedEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PositionedEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const items: EventMarker[] = [];
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
          const response = await fetch(
            localizedApiUrl(paginatedUrl(`${API_URL}/api/events`, PAGE_SIZE, offset), i18n.language),
            { signal: controller.signal },
          );
          if (!response.ok) throw new Error(`${t('cyprus_map.load_error')} (${response.status})`);
          const page = normalizePaginatedResponse(
            await response.json() as PaginatedResponse<EventMarker> | EventMarker[],
          );
          items.push(...page.items);
          hasMore = page.has_more;
          offset += page.items.length;
          if (hasMore && page.items.length === 0) throw new Error(t('cyprus_map.load_error'));
        }
        setEvents(items.filter(hasPosition));
        setError(null);
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : t('cyprus_map.load_error'));
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [i18n.language, t]);

  return (
    <section className="relative h-full w-full bg-[#141417]" aria-label={t('cyprus_map.title')}>
      <BaseMap className="h-full w-full">
        {events.map((event) => (
          <Marker
            key={event.id}
            icon={eventIcon}
            position={[event.latitude, event.longitude]}
            eventHandlers={{ click: () => setSelected(event) }}
          />
        ))}
      </BaseMap>
      <div className="pointer-events-none absolute left-4 right-4 top-[calc(1rem+env(safe-area-inset-top))] z-[1000]">
        <h1 className="inline-block rounded-xl border border-[#C5A059]/30 bg-[#141417]/90 px-4 py-3 font-serif text-[#FFE28A] backdrop-blur-md">
          {t('cyprus_map.title')}
        </h1>
      </div>
      {error && <p role="alert" className="absolute bottom-16 left-4 right-4 z-[1000] rounded-xl bg-[#141417]/95 p-3 text-sm text-red-300">{error}</p>}
      {!error && (isLoading || events.length === 0) && (
        <p role="status" className="absolute bottom-16 left-4 right-4 z-[1000] rounded-xl bg-[#141417]/95 p-3 text-center text-sm text-slate-300">
          {t(isLoading ? 'common.loading' : 'cyprus_map.empty')}
        </p>
      )}
      {selected && (
        <button
          type="button"
          className="absolute bottom-[calc(2.5rem+env(safe-area-inset-bottom))] left-4 right-4 z-[1000] mx-auto flex max-w-md flex-col rounded-xl border border-[#C5A059]/50 bg-[#141417]/95 p-4 text-left text-[#F4F4F5] shadow-xl backdrop-blur-md"
          onClick={() => onSelectEvent(selected.id)}
        >
          <span className="font-serif text-[#FFE28A]">{selected.title}</span>
          <span className="text-sm text-slate-300">{[selected.date, selected.location].filter(Boolean).join(' · ')}</span>
          <span className="mt-1 text-xs text-[#C5A059]">{t('cyprus_map.open_event')}</span>
        </button>
      )}
    </section>
  );
}

function LocationClickHandler({ onChange }: { onChange: (latitude: number, longitude: number) => void }) {
  useMapEvents({ click: (event) => onChange(event.latlng.lat, event.latlng.lng) });
  return null;
}

function FocusLocation({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (latitude !== null && longitude !== null) map.panTo([latitude, longitude]);
  }, [latitude, longitude, map]);
  return null;
}

export function EventLocationPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (latitude: number | null, longitude: number | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <p className="text-sm text-[#C5A059]">{t('cyprus_map.pick_location')}</p>
      <div className="h-56 overflow-hidden rounded-xl border border-[#C5A059]/30">
        <BaseMap className="h-full w-full">
          <FocusLocation latitude={latitude} longitude={longitude} />
          <LocationClickHandler onChange={onChange} />
          {latitude !== null && longitude !== null && (
            <Marker icon={eventIcon} position={[latitude, longitude]} />
          )}
        </BaseMap>
      </div>
      {latitude !== null && longitude !== null && (
        <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
          <span>{latitude.toFixed(5)}, {longitude.toFixed(5)}</span>
          <button type="button" className="text-[#C5A059]" onClick={() => onChange(null, null)}>
            {t('cyprus_map.clear_location')}
          </button>
        </div>
      )}
    </div>
  );
}
