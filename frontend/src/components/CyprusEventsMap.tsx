import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type Ref, type SetStateAction } from 'react';
import { initData, useSignal } from '@tma.js/sdk-react';
import { AttributionControl, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L, { DivIcon, Icon, latLngBounds, type DivIconOptions, type LatLngTuple, type Map as LeafletMap } from 'leaflet';
import { useTranslation } from 'react-i18next';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import { localizedApiUrl } from '@/localization.ts';
import { eventEndTime, isEventCurrentOrUpcoming } from '@/helpers/eventTime.ts';
import { SocialEventCard, type Drink, type SocialEvent, type SocialProfile } from './social/SocialEventCard.tsx';
import { SocialEventForm, type SocialEventDraft, type SocialEventUpdateDraft } from './social/SocialEventForms.tsx';
import { SocialAgeGate, SocialChatPanel, SocialReportsPanel, type ChatMessage, type JoinRequest, type Report } from './social/SocialPanels.tsx';
import { SocialApi, SocialApiError } from './social/socialApi.ts';
import { CyprusMapLoading } from './CyprusMapLoading.tsx';
import { cyprusMapCache, type SocialMapMarker } from './cyprusMapCache.ts';

const API_URL = 'https://paphos-whisky-api.onrender.com';
const CYPRUS_CENTER: LatLngTuple = [34.95, 33.25];
const CYPRUS_MAP_BOUNDS = latLngBounds([34.15, 31.8], [36.0, 34.9]);
const CYPRUS_LOCATION_BOUNDS = latLngBounds([34.55, 32.25], [35.75, 34.65]);
const GLOBAL_RANGE_MAX = 29;
const cyprusDateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Nicosia', year: 'numeric', month: '2-digit', day: '2-digit',
});
function cyprusDateKey(date: Date): string {
  const parts = cyprusDateFormatter.formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function rangeEndDate(now: number, day: number): string {
  const [year, month, date] = cyprusDateKey(new Date(now)).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date + day)).toISOString().slice(0, 10);
}
const eventIcon = new Icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});
const drinkEmojis: Record<Drink, string> = { beer: '🍺', wine: '🍷', spirits: '🥃', cocktails: '🍸', coffee: '☕' };
const socialIcons: Record<Drink, DivIcon> = Object.fromEntries(
  (Object.entries(drinkEmojis) as [Drink, string][])
    .map(([drink, emoji]) => [drink, new DivIcon({
      html: `<span style="display:flex;align-items:center;justify-content:center;width:38px;height:38px;border:2px solid #C5A059;border-radius:50%;background:#141417;font-size:22px;box-shadow:0 2px 12px #0009">${emoji}</span>`,
      className: '',
      iconSize: [38, 38],
      iconAnchor: [19, 38],
    })]),
) as Record<Drink, DivIcon>;
const globalIcons = new Map<string, DivIcon>();

class FreshContentDivIcon extends DivIcon {
  constructor(private readonly createContent: () => HTMLElement, options: DivIconOptions) {
    super(options);
  }

  override createIcon(oldIcon?: HTMLElement): HTMLElement {
    this.options.html = this.createContent();
    return super.createIcon(oldIcon);
  }
}

function globalEventIcon(imageUrl: string): DivIcon {
  const cached = globalIcons.get(imageUrl);
  if (cached) return cached;
  const icon = new FreshContentDivIcon(() => {
    const frame = document.createElement('div');
    frame.style.cssText = 'width:38px;height:38px;border:2px solid #C5A059;border-radius:50%;overflow:hidden;background:#141417;box-shadow:0 2px 12px #0009';
    const image = document.createElement('img');
    image.src = imageUrl;
    image.alt = '';
    image.style.cssText = 'width:100%;height:100%;object-fit:cover';
    frame.appendChild(image);
    return frame;
  }, { className: '', iconSize: [38, 38], iconAnchor: [19, 38] });
  globalIcons.set(imageUrl, icon);
  return icon;
}

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

function DismissSelectedOnMapClick({ onClick }: { onClick: () => void }) {
  useMapEvents({ click: onClick });
  return null;
}

function ClusteredEventMarkers({ catalog, social, onCatalogClick, onSocialClick }: {
  catalog: PositionedEvent[];
  social: SocialMapMarker[];
  onCatalogClick: (event: PositionedEvent) => void;
  onSocialClick: (id: number) => void;
}) {
  const map = useMap();
  const groupRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef(new Map<string, { marker: L.Marker; signature: string }>());
  const markerVisualsRef = useRef(new WeakMap<L.Marker, { imageUrl: string | null; fallback: string }>());
  const catalogRef = useRef(new Map<number, PositionedEvent>());
  const clickRef = useRef({ onCatalogClick, onSocialClick });
  clickRef.current = { onCatalogClick, onSocialClick };
  catalogRef.current = new Map(catalog.map((event) => [event.id, event]));

  useEffect(() => {
    const group = L.markerClusterGroup({
      maxClusterRadius: 48,
      showCoverageOnHover: false,
      spiderLegPolylineOptions: { color: '#C5A059', weight: 1.5, opacity: 0.8 },
      iconCreateFunction: (cluster) => new FreshContentDivIcon(() => {
        const visuals = cluster.getAllChildMarkers().map((marker) => markerVisualsRef.current.get(marker));
        const imageUrl = visuals.find((visual) => visual?.imageUrl)?.imageUrl;
        const fallback = visuals.find((visual) => visual?.fallback)?.fallback ?? '✦';
        const frame = document.createElement('span');
        frame.className = 'cyprus-event-cluster-visual';
        if (imageUrl) {
          const image = document.createElement('img');
          image.src = imageUrl;
          image.alt = '';
          image.onerror = () => {
            image.remove();
            frame.textContent = fallback;
          };
          frame.appendChild(image);
        } else {
          frame.textContent = fallback;
        }
        const badge = document.createElement('span');
        badge.className = 'cyprus-event-cluster-count';
        badge.textContent = String(cluster.getChildCount());
        const content = document.createElement('div');
        content.className = 'cyprus-event-cluster-content';
        content.append(frame, badge);
        return content;
      }, {
        className: 'cyprus-event-cluster',
        iconSize: [42, 42],
        iconAnchor: [21, 21],
      }),
    });
    groupRef.current = group;
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
      groupRef.current = null;
      markersRef.current.clear();
    };
  }, [map]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const next = new Map<string, { signature: string; create: () => L.Marker }>();
    for (const event of catalog) {
      next.set(`catalog-${event.id}`, {
        signature: `${event.latitude}:${event.longitude}`,
        create: () => {
          const marker = L.marker([event.latitude, event.longitude], { icon: eventIcon });
          markerVisualsRef.current.set(marker, { imageUrl: null, fallback: '📅' });
          return marker.on('click', () => {
            const current = catalogRef.current.get(event.id);
            if (current) clickRef.current.onCatalogClick(current);
          });
        },
      });
    }
    for (const event of social) {
      next.set(`social-${event.id}`, {
        signature: `${event.latitude}:${event.longitude}:${event.event_type}:${event.drink}:${event.image_url ?? ''}`,
        create: () => {
          const imageUrl = event.event_type === 'global' ? event.image_url : null;
          const marker = L.marker([event.latitude, event.longitude], {
            icon: imageUrl ? globalEventIcon(imageUrl) : socialIcons[event.drink] ?? eventIcon,
          });
          markerVisualsRef.current.set(marker, { imageUrl, fallback: drinkEmojis[event.drink] ?? '✦' });
          return marker.on('click', () => clickRef.current.onSocialClick(event.id));
        },
      });
    }
    const removed: L.Marker[] = [];
    for (const [key, item] of markersRef.current) {
      if (next.get(key)?.signature !== item.signature) {
        removed.push(item.marker);
        markersRef.current.delete(key);
      }
    }
    if (removed.length) group.removeLayers(removed);
    const added: L.Marker[] = [];
    for (const [key, item] of next) {
      if (!markersRef.current.has(key)) {
        const marker = item.create();
        markersRef.current.set(key, { marker, signature: item.signature });
        added.push(marker);
      }
    }
    if (added.length) group.addLayers(added);
  }, [catalog, social]);

  return null;
}

function useAutoDismissError(message: string | null, setMessage: Dispatch<SetStateAction<string | null>>, enabled = true) {
  useEffect(() => {
    if (!message || !enabled) return;
    const timeout = window.setTimeout(() => setMessage(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [message, setMessage, enabled]);
}

function BaseMap({ children, className, mapRef, attributionPosition = 'bottomright' }: {
  children: ReactNode;
  className: string;
  mapRef?: Ref<LeafletMap>;
  attributionPosition?: 'topright' | 'bottomright';
}) {
  return (
    <MapContainer
      ref={mapRef}
      center={CYPRUS_CENTER}
      zoom={8}
      minZoom={7}
      maxZoom={18}
      maxBounds={CYPRUS_MAP_BOUNDS}
      scrollWheelZoom
      zoomControl={false}
      attributionControl={false}
      className={className}
    >
      <ResizeMap />
      <AttributionControl position={attributionPosition} />
      <TileLayer
        attribution='&copy; <a href="https://stadiamaps.com/attribution/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
      />
      {children}
    </MapContainer>
  );
}

export function CyprusEventsMap({
  isAdmin,
  initialSocialEventId,
  onSocialEventHandled,
  onSelectEvent,
  openReports,
  onReportsHandled,
}: {
  isAdmin: boolean;
  initialSocialEventId: number | null;
  onSocialEventHandled: () => void;
  onSelectEvent: (eventId: number) => void;
  openReports: boolean;
  onReportsHandled: () => void;
}) {
  const { t, i18n } = useTranslation();
  const initDataRaw = useSignal(initData.raw);
  const initDataState = useSignal(initData.state);
  const userId = initDataState?.user?.id ?? null;
  const api = useMemo(() => initDataRaw ? new SocialApi(initDataRaw) : null, [initDataRaw]);
  const [events, setEvents] = useState<PositionedEvent[]>(() => cyprusMapCache.getEvents(i18n.language)?.items ?? []);
  const [now, setNow] = useState(() => Date.now());
  const [globalRange, setGlobalRange] = useState(GLOBAL_RANGE_MAX);
  const [socialEvents, setSocialEvents] = useState<SocialMapMarker[]>(() => cyprusMapCache.getMarkers(userId) ?? []);
  const [socialDetail, setSocialDetail] = useState<SocialEvent | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailRequestId = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [eventsResponseEmpty, setEventsResponseEmpty] = useState(
    () => cyprusMapCache.getEvents(i18n.language)?.responseEmpty ?? false,
  );
  const [socialResponseEmpty, setSocialResponseEmpty] = useState(
    () => cyprusMapCache.getMarkers(userId)?.length === 0,
  );
  const [selected, setSelected] = useState<PositionedEvent | null>(null);
  const [selectedSocialId, setSelectedSocialId] = useState<number | null>(null);
  const [panel, setPanel] = useState<'age' | 'create' | 'edit' | 'chat' | 'reports' | null>(null);
  const [friends, setFriends] = useState<SocialProfile[]>([]);
  const [profile, setProfile] = useState<SocialProfile | null>(() => cyprusMapCache.getProfile(userId) ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [socialNotice, setSocialNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const mapRef = useRef<LeafletMap>(null);
  const locatingRef = useRef(false);
  const mountedRef = useRef(true);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const chatCursor = useRef(0);
  const [isLoading, setIsLoading] = useState(() => cyprusMapCache.getEvents(i18n.language) === undefined);
  const [isSocialLoading, setIsSocialLoading] = useState(() => Boolean(api && cyprusMapCache.getMarkers(userId) === undefined));
  const mapLoading = isLoading || isSocialLoading;
  const ageConfirmed = profile !== null && (profile.age !== null || isAdmin);
  const activeSocialEvents = useMemo(() => {
    if (!api || !ageConfirmed) return [];
    const lastDay = globalRange === GLOBAL_RANGE_MAX ? null : rangeEndDate(now, globalRange);
    return socialEvents.filter((event) => new Date(event.expires_at).getTime() > now
      && (event.event_type !== 'global' || lastDay === null
        || cyprusDateKey(new Date(event.starts_at)) <= lastDay));
  }, [api, ageConfirmed, socialEvents, now, globalRange]);
  const selectedSocial = socialDetail?.id === selectedSocialId && new Date(socialDetail.expires_at).getTime() > now
    ? socialDetail : null;
  const upcomingEvents = useMemo(
    () => events.filter((event) => isEventCurrentOrUpcoming(event.date, now)),
    [events, now],
  );
  const activeSelected = selected && upcomingEvents.some((event) => event.id === selected.id) ? selected : null;

  useEffect(() => {
    const expiryTimes = [
      ...events.map((event) => eventEndTime(event.date)),
      ...socialEvents.map((event) => new Date(event.expires_at).getTime()),
    ];
    const nextEnd = expiryTimes.reduce<number | null>((nearest, end) => {
      return end !== null && end > now && (nearest === null || end < nearest) ? end : nearest;
    }, null);
    if (nextEnd === null) return;
    const timeout = window.setTimeout(() => setNow(Date.now()), Math.min(nextEnd - now + 1, 2_147_483_647));
    return () => window.clearTimeout(timeout);
  }, [events, socialEvents, now]);

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);

  useEffect(() => {
    if (globalRange === GLOBAL_RANGE_MAX) return;
    const interval = window.setInterval(() => {
      const current = Date.now();
      setNow((previous) => cyprusDateKey(new Date(previous)) === cyprusDateKey(new Date(current))
        ? previous : current);
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [globalRange]);

  useAutoDismissError(error, setError);
  useAutoDismissError(linkError, setLinkError);
  useAutoDismissError(locationError, setLocationError);
  useAutoDismissError(socialError, setSocialError, panel === null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const centerOnUser = () => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError(t('cyprus_map.location_unsupported'));
      mapRef.current?.flyTo(CYPRUS_CENTER, 8);
      return;
    }
    if (locatingRef.current) return;
    locatingRef.current = true;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!mountedRef.current) return;
        locatingRef.current = false;
        setLocating(false);
        if (!mapRef.current) {
          setLocationError(t('cyprus_map.location_unavailable'));
          return;
        }
        if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)
          || !CYPRUS_LOCATION_BOUNDS.contains([coords.latitude, coords.longitude])) {
          mapRef.current.flyTo(CYPRUS_CENTER, 8);
          setLocationError(t('cyprus_map.location_outside'));
          return;
        }
        mapRef.current.flyTo([coords.latitude, coords.longitude], 14);
      },
      (reason) => {
        if (!mountedRef.current) return;
        locatingRef.current = false;
        setLocating(false);
        mapRef.current?.flyTo(CYPRUS_CENTER, 8);
        setLocationError(t(reason.code === reason.PERMISSION_DENIED
          ? 'cyprus_map.location_denied'
          : reason.code === reason.TIMEOUT
            ? 'cyprus_map.location_timeout'
            : 'cyprus_map.location_unavailable'));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const reloadSocial = useCallback(async (refreshSelected = true) => {
    if (!api) return;
    try {
      const items = await api.mapEvents();
      setSocialEvents(items);
      setSocialResponseEmpty(items.length === 0);
      cyprusMapCache.setMarkers(userId, items);
      if (refreshSelected && selectedSocialId !== null) {
        const detail = await api.event(selectedSocialId);
        setSocialDetail(detail);
      }
    } catch (reason) {
      setSocialResponseEmpty(false);
      throw reason;
    }
  }, [api, selectedSocialId, userId]);

  useEffect(() => {
    if (!api) {
      setIsSocialLoading(false);
      return;
    }
    let active = true;
    const cachedProfile = cyprusMapCache.getProfile(userId);
    const cachedMarkers = cyprusMapCache.getMarkers(userId);
    setProfile(cachedProfile ?? null);
    setSocialEvents(cachedMarkers ?? []);
    setSocialResponseEmpty(cachedMarkers?.length === 0);
    setIsSocialLoading(cachedMarkers === undefined);
    void api.profile().then((me) => {
      if (!active) return;
      setProfile(me);
      cyprusMapCache.setProfile(userId, me);
      if (me.age === null && !isAdmin) {
        setPanel('age');
        setSocialEvents([]);
        setSocialResponseEmpty(false);
        cyprusMapCache.clearMarkers(userId);
        setIsSocialLoading(false);
      } else {
        setPanel((current) => current === 'age' ? null : current);
      }
    }).catch((reason: unknown) => {
      if (active) {
        cyprusMapCache.clearUser(userId);
        setProfile(null);
        setSocialEvents([]);
        setSocialError(reason instanceof Error ? reason.message : t('social.error'));
        setIsSocialLoading(false);
      }
    });
    return () => { active = false; };
  }, [api, isAdmin, t, userId]);

  useEffect(() => {
    if (!api || !ageConfirmed) return;
    let active = true;
    setIsSocialLoading(cyprusMapCache.getMarkers(userId) === undefined);
    void api.mapEvents().then((items) => {
      if (active) {
        setSocialEvents(items);
        setSocialResponseEmpty(items.length === 0);
        cyprusMapCache.setMarkers(userId, items);
        setIsSocialLoading(false);
      }
    }).catch((reason: unknown) => {
      if (active) {
        setSocialResponseEmpty(false);
        setSocialError(reason instanceof Error ? reason.message : t('social.error'));
        if (reason instanceof SocialApiError && (reason.status === 401 || reason.status === 403)) {
          cyprusMapCache.clearUser(userId);
          setSocialEvents([]);
        }
        setIsSocialLoading(false);
      }
    });
    return () => { active = false; };
  }, [api, ageConfirmed, t, userId]);

  useEffect(() => {
    if (!api || !ageConfirmed) return;
    const interval = window.setInterval(() => {
      void reloadSocial().catch((reason: unknown) => {
        setSocialError(reason instanceof Error ? reason.message : t('social.error'));
      });
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [api, ageConfirmed, reloadSocial, t]);

  useEffect(() => {
    if (!api || !ageConfirmed || initialSocialEventId === null) return;
    let active = true;
    void api.event(initialSocialEventId).then((event) => {
      if (!active) return;
      setLinkError(null);
      setSocialDetail(event);
      setSelectedSocialId(event.id);
      onSocialEventHandled();
    }).catch((reason: unknown) => {
      if (!active) return;
      if (reason instanceof SocialApiError && reason.status === 404) {
        setLinkError(reason.message);
        onSocialEventHandled();
      } else {
        setSocialError(reason instanceof Error ? reason.message : t('social.error'));
      }
    });
    return () => { active = false; };
  }, [api, ageConfirmed, initialSocialEventId, onSocialEventHandled, t]);

  const openSocialEvent = (id: number) => {
    if (!api) {
      setSocialError(t('social.auth_required'));
      return;
    }
    const request = ++detailRequestId.current;
    setSelectedSocialId(id);
    setSocialDetail(null);
    setSelected(null);
    setPanel(null);
    setDetailLoading(true);
    void api.event(id).then((event) => {
      if (request === detailRequestId.current) setSocialDetail(event);
    }).catch((reason: unknown) => {
      if (request === detailRequestId.current) {
        setSelectedSocialId(null);
        setSocialError(reason instanceof Error ? reason.message : t('social.error'));
      }
    }).finally(() => {
      if (request === detailRequestId.current) setDetailLoading(false);
    });
  };

  useEffect(() => {
    if (!api || !openReports || !isAdmin) return;
    let active = true;
    void api.reports().then((items) => {
      if (!active) return;
      setReports(items);
      setPanel('reports');
      onReportsHandled();
    }).catch((reason: unknown) => {
      if (!active) return;
      setSocialError(reason instanceof Error ? reason.message : t('social.error'));
      onReportsHandled();
    });
    return () => { active = false; };
  }, [api, openReports, isAdmin, onReportsHandled, t]);

  const run = async (action: () => Promise<void>) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setSocialError(null);
    setSocialNotice(null);
    try {
      await action();
      return true;
    } catch (reason) {
      setSocialError(reason instanceof Error ? reason.message : t('social.error'));
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const openCreate = () => {
    if (!api) { setSocialError(t('social.auth_required')); return; }
    if (!profile) { setSocialError(t('common.loading')); return; }
    if (!ageConfirmed) { setPanel('age'); return; }
    void run(async () => {
      if (!isAdmin && (await api.activeEventStatus()).has_active_event) {
        setSocialError(t('social.one_active_event'));
        return;
      }
      const [me, contacts] = await Promise.all([api.profile(), api.friends()]);
      setFriends(contacts);
      setProfile(me);
      setSelected(null);
      setSelectedSocialId(null);
      setPanel('create');
    });
  };

  const openChat = (event: SocialEvent) => {
    if (!api) return;
    void run(async () => {
      const [chat, requests] = await Promise.all([
        api.chatSince(event.id),
        event.is_owner && event.event_type !== 'global' ? api.joinRequests(event.id) : Promise.resolve([]),
      ]);
      chatCursor.current = chat.length ? chat[chat.length - 1].id : 0;
      setMessages(chat);
      setJoinRequests(requests);
      setPanel('chat');
    });
  };

  useEffect(() => {
    if (panel !== 'chat' || !api || selectedSocialId === null) return;
    let active = true;
    const interval = window.setInterval(() => {
      void api.chatSince(selectedSocialId, chatCursor.current).then((newMessages) => {
        if (!active || newMessages.length === 0) return;
        chatCursor.current = newMessages[newMessages.length - 1].id;
        setMessages((current) => {
          const ids = new Set(current.map((message) => message.id));
          return [...current, ...newMessages.filter((message) => !ids.has(message.id))].sort((a, b) => a.id - b.id);
        });
      }).catch((reason: unknown) => {
        if (active) setSocialError(reason instanceof Error ? reason.message : t('social.error'));
      });
    }, 5000);
    return () => { active = false; window.clearInterval(interval); };
  }, [panel, api, selectedSocialId, t]);

  const share = (event: SocialEvent) => {
    const url = `https://t.me/CyprusWhiskyClubBot/NoMoreDram?startapp=social_event_${event.id}`;
    const telegramShare = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(event.location)}`;
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(telegramShare);
    } else if (navigator.share) {
      void navigator.share({ title: event.location, url }).catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setSocialError(reason instanceof Error ? reason.message : t('social.error'));
      });
    } else {
      if (!window.open(telegramShare, '_blank', 'noopener,noreferrer')) setSocialError(t('social.share_failed'));
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const cached = cyprusMapCache.getEvents(i18n.language);
    setEvents(cached?.items ?? []);
    setEventsResponseEmpty(cached?.responseEmpty ?? false);
    setIsLoading(cached === undefined);
    const load = async () => {
      try {
        const response = await fetch(localizedApiUrl(`${API_URL}/api/events/map`, i18n.language), {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`${t('cyprus_map.load_error')} (${response.status})`);
        const items = await response.json() as EventMarker[];
        const positioned = items.filter(hasPosition);
        positioned.forEach((event) => {
          if (eventEndTime(event.date) === null) console.warn(`Event ${event.id} has an invalid date: ${event.date}`);
        });
        setNow(Date.now());
        setEvents(positioned);
        setEventsResponseEmpty(items.length === 0);
        cyprusMapCache.setEvents(i18n.language, positioned, items.length === 0);
        setError(null);
        setLoadFailed(false);
      } catch (reason) {
        if (controller.signal.aborted) return;
        setEventsResponseEmpty(false);
        setError(reason instanceof Error ? reason.message : t('cyprus_map.load_error'));
        setLoadFailed(true);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [i18n.language, t]);

  return (
    <section className="relative h-full w-full bg-[#141417]" aria-label={t('cyprus_map.title')} aria-busy={mapLoading}>
      <BaseMap className="cyprus-events-map h-full w-full" mapRef={mapRef} attributionPosition="topright">
        <DismissSelectedOnMapClick onClick={() => { setSelected(null); setSelectedSocialId(null); }} />
        <ClusteredEventMarkers
          catalog={upcomingEvents}
          social={activeSocialEvents}
          onCatalogClick={(event) => { setSelected(event); setSelectedSocialId(null); setPanel(null); }}
          onSocialClick={openSocialEvent}
        />
      </BaseMap>
      {(mapLoading || detailLoading) && <CyprusMapLoading className="absolute inset-0 z-[1300]" />}
      {!mapLoading && !panel && !activeSelected && !selectedSocial && (
        <div className="absolute inset-x-4 bottom-[calc(2rem+env(safe-area-inset-bottom))] z-[1000] flex items-end gap-3">
          <div className="min-w-0 flex-1 rounded-xl border border-[#C5A059]/40 bg-[#141417]/95 px-3 py-1.5 shadow-lg backdrop-blur-md">
            <label htmlFor="global-events-range" className="block truncate text-[11px] font-medium text-[#D9BD82]">
              {t('cyprus_map.global_range')}: {globalRange === GLOBAL_RANGE_MAX
                ? t('cyprus_map.all_available') : globalRange === 0
                  ? t('cyprus_map.today') : t('cyprus_map.days_ahead', { count: globalRange + 1 })}
            </label>
            <div className="relative h-6">
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-[9px] top-3 flex justify-between">
                {Array.from({ length: 30 }, (_, index) => (
                  <span key={index} className={`h-2 w-px -translate-y-1/2 ${index <= globalRange ? 'bg-[#C5A059]' : 'bg-[#6E6D6A]'}`} />
                ))}
              </div>
              <input
                id="global-events-range"
                className="cyprus-event-range absolute inset-0 w-full cursor-pointer"
                type="range"
                min={0}
                max={GLOBAL_RANGE_MAX}
                step={1}
                value={globalRange}
                aria-valuetext={globalRange === GLOBAL_RANGE_MAX
                  ? t('cyprus_map.all_available')
                  : globalRange === 0 ? t('cyprus_map.today') : t('cyprus_map.days_ahead', { count: globalRange + 1 })}
                onChange={(event) => setGlobalRange(Number(event.target.value))}
              />
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-3">
            <button
              type="button"
              aria-label={t('cyprus_map.my_location')}
              title={t('cyprus_map.my_location')}
              aria-busy={locating}
              disabled={locating}
              onClick={centerOnUser}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#C5A059]/50 bg-[#141417]/90 text-[#C5A059] shadow-lg backdrop-blur-md transition-colors hover:border-[#C5A059] active:bg-[#C5A059]/20 disabled:opacity-50"
            >
              <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="7" />
                <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
                <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
              </svg>
            </button>
            <button
              type="button"
              aria-label={t('social.create')}
              title={t('social.create')}
              disabled={busy}
              onClick={openCreate}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#C5A059]/50 bg-[#141417]/90 text-[#C5A059] shadow-lg backdrop-blur-md transition-colors hover:border-[#C5A059] active:bg-[#C5A059]/20 disabled:opacity-50"
            >
              <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="absolute bottom-16 left-4 right-4 z-[1000] rounded-xl bg-[#141417]/95 p-3 text-sm text-red-300">{error}</p>}
      {!error && !mapLoading && !loadFailed && !socialError && eventsResponseEmpty && socialResponseEmpty
        && upcomingEvents.length === 0 && activeSocialEvents.length === 0 && (
        <p role="status" className="absolute bottom-16 left-4 right-4 z-[1000] rounded-xl bg-[#141417]/95 p-3 text-center text-sm text-slate-300">
          {t('cyprus_map.empty')}
        </p>
      )}
      {(locationError || linkError || socialError) && <p role="alert" className="absolute left-4 right-4 top-28 z-[1200] rounded-xl bg-[#351D21] p-3 text-sm text-red-200">{locationError || linkError || socialError}</p>}
      {socialNotice && <p role="status" className="absolute left-4 right-4 top-28 z-[1200] rounded-xl border border-[#C5A059]/40 bg-[#141417] p-3 text-sm text-[#FFE28A]">{socialNotice}</p>}
      {activeSelected && !panel && (
        <button
          type="button"
          className="absolute bottom-[calc(2.5rem+env(safe-area-inset-bottom))] left-4 right-4 z-[1000] mx-auto flex max-w-md flex-col rounded-xl border border-[#C5A059]/50 bg-[#141417]/95 p-4 text-left text-[#F4F4F5] shadow-xl backdrop-blur-md"
          onClick={() => onSelectEvent(activeSelected.id)}
        >
          <span className="font-serif text-[#FFE28A]">{activeSelected.title}</span>
          <span className="text-sm text-slate-300">{[activeSelected.date, activeSelected.location].filter(Boolean).join(' · ')}</span>
          <span className="mt-1 text-xs text-[#C5A059]">{t('cyprus_map.open_event')}</span>
        </button>
      )}
      {selectedSocial && !panel && (
        <div className="absolute bottom-4 left-3 right-3 top-[calc(1rem+env(safe-area-inset-top))] z-[1100] mx-auto flex max-w-md flex-col">
          <SocialEventCard
            event={selectedSocial}
            busy={busy}
            onClose={() => { ++detailRequestId.current; setSelectedSocialId(null); setSocialDetail(null); }}
            onCheer={() => { if (api) void run(async () => { await api.cheer(selectedSocial.id); await reloadSocial(); }); }}
            onJoin={() => { if (api) void run(async () => {
              const result = await api.join(selectedSocial.id);
              await reloadSocial();
              if (result.notification_status !== 'sent') setSocialNotice(t('social.join_notification_failed'));
            }); }}
            onShare={() => share(selectedSocial)}
            onChat={() => openChat(selectedSocial)}
            onReport={(reason) => { if (api) void run(async () => { await api.report(selectedSocial.id, reason); setSocialNotice(t('social.report_sent')); }); }}
            onBlock={() => { if (api) void run(async () => { await api.blockEvent(selectedSocial.id); setSelectedSocialId(null); setSocialDetail(null); await reloadSocial(false); }); }}
            canManage={isAdmin}
            onEdit={() => { setSocialError(null); setPanel('edit'); }}
            onDelete={() => { if (api) void run(async () => {
              await api.deleteEvent(selectedSocial.id);
              setSocialEvents((current) => current.filter((item) => item.id !== selectedSocial.id));
              const cachedMarkers = cyprusMapCache.getMarkers(userId);
              if (cachedMarkers) cyprusMapCache.setMarkers(userId, cachedMarkers.filter((item) => item.id !== selectedSocial.id));
              setSelectedSocialId(null);
              setSocialDetail(null);
              await reloadSocial(false);
            }); }}
          />
        </div>
      )}
      {(panel === 'create' || (panel === 'edit' && selectedSocial)) && api && (
        <SocialEventForm
          key={panel === 'edit' ? `edit-${selectedSocial?.id}` : 'create'}
          editingEvent={panel === 'edit' ? selectedSocial : undefined}
          friends={friends}
          isAdmin={isAdmin}
          LocationPicker={EventLocationPicker}
          busy={busy}
          error={socialError}
          onCancel={() => { setPanel(null); setSocialError(null); }}
          onSubmit={(draft: SocialEventDraft, photo?: File) => void run(async () => {
            if (draft.event_type === 'global') {
              await api.createGlobalEvent(draft);
            } else {
              if (!photo) throw new Error(t('social.photo_and_place_required'));
              const photoKey = await api.upload(photo, 'event');
              const created = await api.createEvent(draft, photoKey).catch((reason: unknown) => {
                if (reason instanceof SocialApiError && reason.status === 409
                    && reason.message === 'Only one active event is allowed') {
                  throw new Error(t('social.one_active_event'));
                }
                throw reason;
              });
              if (Object.values(created.notifications).some((status) => status !== 'sent')) {
                setSocialNotice(t('social.notification_failed'));
              }
            }
            await reloadSocial();
            setPanel(null);
          })}
          onUpdate={(draft: SocialEventUpdateDraft, photo?: File) => void run(async () => {
            if (!selectedSocial) throw new Error(t('cyprus_map.load_error'));
            const photoKey = photo ? await api.upload(photo, 'event') : undefined;
            const updated = await api.updateEvent(selectedSocial.id, draft, photoKey);
            setSocialDetail(updated);
            await reloadSocial();
            setPanel(null);
          })}
        />
      )}
      {panel === 'age' && api && profile && !isAdmin && (
        <div className="absolute inset-0 z-[1300] bg-[#141417]/90">
          <SocialAgeGate busy={busy} error={socialError} onConfirm={(age) => {
            if (!Number.isInteger(age) || age < 18 || age > 120) {
              setSocialError(t('social.age_gate_invalid'));
              return;
            }
            void run(async () => {
              const me = await api.updateProfile(profile.display_name, age, null);
              setProfile(me);
              cyprusMapCache.setProfile(userId, me);
              setPanel(null);
            });
          }} />
        </div>
      )}
      {panel === 'chat' && api && selectedSocial && (
        <SocialChatPanel
          messages={messages}
          requests={joinRequests}
          isOwner={selectedSocial.is_owner}
          busy={busy}
          error={socialError}
          onClose={() => { setPanel(null); setSocialError(null); }}
          onSend={(text) => run(async () => {
            const sent = await api.sendChat(selectedSocial.id, text);
            setMessages((current) => current.some((message) => message.id === sent.id)
              ? current : [...current, sent].sort((a, b) => a.id - b.id));
          })}
          onAccept={(id) => void run(async () => {
            const result = await api.acceptJoin(selectedSocial.id, id);
            setJoinRequests(await api.joinRequests(selectedSocial.id));
            await reloadSocial();
            if (result.notification_status !== 'sent') setSocialNotice(t('social.join_notification_failed'));
          })}
        />
      )}
      {panel === 'reports' && api && (
        <SocialReportsPanel
          reports={reports}
          busy={busy}
          error={socialError}
          onClose={() => { setPanel(null); setSocialError(null); }}
          onVerify={(id) => void run(async () => { await api.verify(id); setSocialNotice(t('social.profile_verified')); })}
          onHide={(id) => void run(async () => {
            await api.hideEvent(id);
            setReports(await api.reports());
            await reloadSocial(false);
          })}
          onResolve={(id) => void run(async () => {
            await api.resolveReport(id);
            setReports(await api.reports());
          })}
        />
      )}
    </section>
  );
}

function LocationClickHandler({
  onChange,
  onInteractionStart,
  onInteractionEnd,
}: {
  onChange: (latitude: number, longitude: number) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
}) {
  useMapEvents({
    click: (event) => onChange(event.latlng.lat, event.latlng.lng),
    movestart: onInteractionStart,
    moveend: onInteractionEnd,
    zoomstart: onInteractionStart,
    zoomend: onInteractionEnd,
  });
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
  expandOnSelect = false,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (latitude: number | null, longitude: number | null) => void;
  expandOnSelect?: boolean;
}) {
  const { t } = useTranslation();
  const mapFrameRef = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<number | null>(null);
  const expandedRef = useRef(false);
  const [formBounds, setFormBounds] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const expanded = formBounds !== null;

  const stopIdleTimer = () => {
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    idleTimer.current = null;
  };
  const collapse = () => {
    stopIdleTimer();
    expandedRef.current = false;
    setFormBounds(null);
  };
  const scheduleCollapse = () => {
    if (!expandedRef.current) return;
    stopIdleTimer();
    idleTimer.current = window.setTimeout(() => {
      expandedRef.current = false;
      setFormBounds(null);
      idleTimer.current = null;
    }, 1500);
  };

  useEffect(() => () => {
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const form = mapFrameRef.current?.closest('form');
    if (!form) return;
    const updateBounds = () => {
      if (!expandedRef.current) return;
      const { top, left, width, height } = form.getBoundingClientRect();
      setFormBounds({ top, left, width, height });
    };
    const observer = new ResizeObserver(updateBounds);
    observer.observe(form);
    window.addEventListener('resize', updateBounds);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateBounds);
    };
  }, [expanded]);

  const selectLocation = (lat: number, lng: number) => {
    onChange(lat, lng);
    if (!expandOnSelect) return;
    const form = mapFrameRef.current?.closest('form');
    if (!form) {
      console.error('The event location picker must be inside a form to expand.');
      return;
    }
    const { top, left, width, height } = form.getBoundingClientRect();
    expandedRef.current = true;
    setFormBounds({ top, left, width, height });
    scheduleCollapse();
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-[#C5A059]">{t('cyprus_map.pick_location')}</p>
      <div
        ref={mapFrameRef}
        className={`${expanded ? 'fixed z-[1200]' : 'h-56'} overflow-hidden rounded-xl border border-[#C5A059]/30 bg-[#141417]`}
        style={formBounds ?? undefined}
        onPointerDownCapture={stopIdleTimer}
        onPointerUpCapture={scheduleCollapse}
        onPointerCancelCapture={scheduleCollapse}
        onWheelCapture={scheduleCollapse}
      >
        <BaseMap className="h-full w-full">
          <FocusLocation latitude={latitude} longitude={longitude} />
          <LocationClickHandler onChange={selectLocation} onInteractionStart={stopIdleTimer} onInteractionEnd={scheduleCollapse} />
          {latitude !== null && longitude !== null && (
            <Marker icon={eventIcon} position={[latitude, longitude]} />
          )}
        </BaseMap>
        {expanded && (
          <button
            type="button"
            aria-label={t('cyprus_map.finish_location')}
            onClick={collapse}
            className="absolute right-4 top-4 z-[1000] flex h-12 w-12 items-center justify-center rounded-xl border border-[#C5A059]/50 bg-[#141417]/90 text-[#C5A059] shadow-lg backdrop-blur-md"
          >
            <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 6 18 18M18 6 6 18" />
            </svg>
          </button>
        )}
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
