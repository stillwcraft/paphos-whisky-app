import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type Ref, type SetStateAction } from 'react';
import { initData, useSignal } from '@tma.js/sdk-react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { DivIcon, Icon, latLngBounds, type LatLngTuple, type Map as LeafletMap } from 'leaflet';
import { useTranslation } from 'react-i18next';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
import { localizedApiUrl } from '@/localization.ts';
import { eventEndTime, isEventCurrentOrUpcoming } from '@/helpers/eventTime.ts';
import { normalizePaginatedResponse, paginatedUrl, type PaginatedResponse } from '@/pagination.ts';
import { SocialEventCard, type Drink, type SocialEvent, type SocialProfile } from './social/SocialEventCard.tsx';
import { SocialEventForm, type SocialEventDraft } from './social/SocialEventForms.tsx';
import { SocialAgeGate, SocialChatPanel, SocialReportsPanel, type ChatMessage, type JoinRequest, type Report } from './social/SocialPanels.tsx';
import { SocialApi, SocialApiError } from './social/socialApi.ts';

const API_URL = 'https://paphos-whisky-api.onrender.com';
const CYPRUS_CENTER: LatLngTuple = [34.95, 33.25];
const CYPRUS_MAP_BOUNDS = latLngBounds([34.15, 31.8], [36.0, 34.9]);
const CYPRUS_LOCATION_BOUNDS = latLngBounds([34.55, 32.25], [35.75, 34.65]);
const PAGE_SIZE = 100;
const eventIcon = new Icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});
const socialIcons: Record<Drink, DivIcon> = Object.fromEntries(
  (Object.entries({ beer: '🍺', wine: '🍷', spirits: '🥃', cocktails: '🍸', coffee: '☕' }) as [Drink, string][])
    .map(([drink, emoji]) => [drink, new DivIcon({
      html: `<span style="display:flex;align-items:center;justify-content:center;width:38px;height:38px;border:2px solid #C5A059;border-radius:50%;background:#141417;font-size:22px;box-shadow:0 2px 12px #0009">${emoji}</span>`,
      className: '',
      iconSize: [38, 38],
      iconAnchor: [19, 38],
    })]),
) as Record<Drink, DivIcon>;

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

function useAutoDismissError(message: string | null, setMessage: Dispatch<SetStateAction<string | null>>, enabled = true) {
  useEffect(() => {
    if (!message || !enabled) return;
    const timeout = window.setTimeout(() => setMessage(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [message, setMessage, enabled]);
}

function BaseMap({ children, className, mapRef }: {
  children: ReactNode;
  className: string;
  mapRef?: Ref<LeafletMap>;
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
      className={className}
    >
      <ResizeMap />
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
  const api = useMemo(() => initDataRaw ? new SocialApi(initDataRaw) : null, [initDataRaw]);
  const [events, setEvents] = useState<PositionedEvent[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [socialEvents, setSocialEvents] = useState<SocialEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selected, setSelected] = useState<PositionedEvent | null>(null);
  const [selectedSocialId, setSelectedSocialId] = useState<number | null>(null);
  const [panel, setPanel] = useState<'age' | 'create' | 'chat' | 'reports' | null>(null);
  const [friends, setFriends] = useState<SocialProfile[]>([]);
  const [profile, setProfile] = useState<SocialProfile | null>(null);
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
  const [isLoading, setIsLoading] = useState(true);
  const selectedSocial = socialEvents.find((event) => event.id === selectedSocialId) ?? null;
  const upcomingEvents = events.filter((event) => isEventCurrentOrUpcoming(event.date, now));
  const activeSelected = selected && upcomingEvents.some((event) => event.id === selected.id) ? selected : null;

  useEffect(() => {
    const nextEnd = events.reduce<number | null>((nearest, event) => {
      const end = eventEndTime(event.date);
      return end !== null && end > now && (nearest === null || end < nearest) ? end : nearest;
    }, null);
    if (nextEnd === null) return;
    const timeout = window.setTimeout(() => setNow(Date.now()), Math.min(nextEnd - now + 1, 2_147_483_647));
    return () => window.clearTimeout(timeout);
  }, [events, now]);

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);

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

  const reloadSocial = useCallback(async () => {
    if (!api) return;
    const items = await api.events();
    setSocialEvents(items);
  }, [api]);

  useEffect(() => {
    if (!api) return;
    let active = true;
    void api.profile().then((me) => {
      if (!active) return;
      setProfile(me);
      if (me.age === null && !isAdmin) setPanel('age');
      else setPanel((current) => current === 'age' ? null : current);
    }).catch((reason: unknown) => {
      if (active) setSocialError(reason instanceof Error ? reason.message : t('social.error'));
    });
    return () => { active = false; };
  }, [api, isAdmin, t]);

  const ageConfirmed = profile !== null && (profile.age !== null || isAdmin);

  useEffect(() => {
    if (!api || !ageConfirmed) return;
    let active = true;
    void api.events().then((items) => {
      if (active) setSocialEvents(items);
    }).catch((reason: unknown) => {
      if (active) setSocialError(reason instanceof Error ? reason.message : t('social.error'));
    });
    return () => { active = false; };
  }, [api, ageConfirmed, t]);

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
      setSocialEvents((current) => current.some((item) => item.id === event.id) ? current : [...current, event]);
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
        event.is_owner ? api.joinRequests(event.id) : Promise.resolve([]),
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
        const positioned = items.filter(hasPosition);
        positioned.forEach((event) => {
          if (eventEndTime(event.date) === null) console.warn(`Event ${event.id} has an invalid date: ${event.date}`);
        });
        setNow(Date.now());
        setEvents(positioned);
        setError(null);
        setLoadFailed(false);
      } catch (reason) {
        if (controller.signal.aborted) return;
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
    <section className="relative h-full w-full bg-[#141417]" aria-label={t('cyprus_map.title')}>
      <BaseMap className="h-full w-full" mapRef={mapRef}>
        <DismissSelectedOnMapClick onClick={() => { setSelected(null); setSelectedSocialId(null); }} />
        {upcomingEvents.map((event) => (
          <Marker
            key={event.id}
            icon={eventIcon}
            position={[event.latitude, event.longitude]}
            eventHandlers={{ click: () => { setSelected(event); setSelectedSocialId(null); setPanel(null); } }}
          />
        ))}
        {socialEvents.map((event) => (
          <Marker
            key={`social-${event.id}`}
            icon={socialIcons[event.drink] ?? eventIcon}
            position={[event.latitude, event.longitude]}
            eventHandlers={{ click: () => { setSelectedSocialId(event.id); setSelected(null); setPanel(null); } }}
          />
        ))}
      </BaseMap>
      {!panel && !activeSelected && !selectedSocial && (
        <div className="absolute bottom-[calc(2rem+env(safe-area-inset-bottom))] right-4 z-[1000] flex flex-col gap-3">
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
      )}
      {error && <p role="alert" className="absolute bottom-16 left-4 right-4 z-[1000] rounded-xl bg-[#141417]/95 p-3 text-sm text-red-300">{error}</p>}
      {!error && (isLoading || (!loadFailed && upcomingEvents.length === 0 && socialEvents.length === 0)) && (
        <p role="status" className="absolute bottom-16 left-4 right-4 z-[1000] rounded-xl bg-[#141417]/95 p-3 text-center text-sm text-slate-300">
          {t(isLoading ? 'common.loading' : 'cyprus_map.empty')}
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
            onClose={() => setSelectedSocialId(null)}
            onCheer={() => { if (api) void run(async () => { await api.cheer(selectedSocial.id); await reloadSocial(); }); }}
            onJoin={() => { if (api) void run(async () => {
              const result = await api.join(selectedSocial.id);
              await reloadSocial();
              if (result.notification_status !== 'sent') setSocialNotice(t('social.join_notification_failed'));
            }); }}
            onShare={() => share(selectedSocial)}
            onChat={() => openChat(selectedSocial)}
            onReport={(reason) => { if (api) void run(async () => { await api.report(selectedSocial.id, reason); setSocialNotice(t('social.report_sent')); }); }}
            onBlock={() => { if (api) void run(async () => { await api.blockEvent(selectedSocial.id); setSelectedSocialId(null); await reloadSocial(); }); }}
          />
        </div>
      )}
      {panel === 'create' && api && (
        <SocialEventForm
          friends={friends}
          LocationPicker={EventLocationPicker}
          busy={busy}
          error={socialError}
          onCancel={() => { setPanel(null); setSocialError(null); }}
          onSubmit={(draft: SocialEventDraft, photo: File) => void run(async () => {
            const photoKey = await api.upload(photo, 'event');
            const created = await api.createEvent(draft, photoKey);
            await reloadSocial();
            setPanel(null);
            if (Object.values(created.notifications).some((status) => status !== 'sent')) {
              setSocialNotice(t('social.notification_failed'));
            }
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
            await reloadSocial();
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
