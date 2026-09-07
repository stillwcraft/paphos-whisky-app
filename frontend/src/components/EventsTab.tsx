import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initData, useSignal } from '@tma.js/sdk-react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { telegramAuthHeaders } from '@/telegramAuth.ts';
import { localizedApiUrl } from '@/localization.ts';
import { BottleTagChart } from '@/components/BottleTagChart.tsx';
import { BottleReviewOverlay } from '@/components/BottleReviewOverlay.tsx';

const API_BASE_URL = 'https://paphos-whisky-api.onrender.com';
type I18nString = Partial<Record<'en' | 'ru' | 'uk', string>>;

type EventLineupBottle = {
  id: number;
  name: string;
  name_i18n?: I18nString;
  distillery_id: number | null;
  age: string | null;
  abv: string | null;
  cask: string | null;
  bottles: string | null;
  price_per_sample: number;
  description: string;
  description_i18n?: I18nString;
  image_url: string | null;
  background_url: string | null;
  favorites_count: number;
  tried_count: number;
};

type LineupBottleActionState = {
  is_favorite: boolean;
  is_tried: boolean;
};

type ToggleLineupResponse = LineupBottleActionState & {
  bottle_id: number;
  favorites_count: number;
  tried_count: number;
};

type EventSummary = {
  id: number;
  title: string;
  title_i18n?: I18nString;
  name_i18n?: I18nString;
  date: string;
  price: number;
  samples_price: number | null;
  image_url_left: string | null;
  image_url: string | null;
  image_url_right: string | null;
  has_samples: boolean;
  show_participants: boolean;
  registered_count: number;
  samples_count: number;
  bottle_count: number;
};

type EventDetail = EventSummary & {
  description: string;
  description_i18n?: I18nString;
  bottles: EventLineupBottle[];
};

type Member = {
  id: number;
  registered: boolean;
  samples: boolean;
};

type SheetMode = 'registration' | 'samples';
type SheetTab = 'main' | 'events' | 'members';
type Feedback = { kind: 'error'; message: string } | null;

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (typeof payload === 'object' && payload !== null && 'detail' in payload) {
      return String(payload.detail);
    }
  } catch {
    // Use the response status when the API does not return a JSON error.
  }

  return `Ошибка сервера: ${response.status}`;
}

function formatDate(date: string) {
  const parsedDate = new Date(date);
  return Number.isNaN(parsedDate.valueOf())
    ? date
    : new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(parsedDate);
}

function EventGalleryCard({
  event,
  onOpen,
}: {
  event: EventSummary;
  onOpen: () => void;
}) {
  const galleryRef = useRef<HTMLDivElement>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(1);
  const imageUrls = [
    event.image_url_left ?? event.image_url,
    event.image_url,
    event.image_url_right ?? event.image_url,
  ];

  useEffect(() => {
    const gallery = galleryRef.current;
    if (!gallery) {
      return;
    }

    const scrollToCenter = () => gallery.scrollTo({
      left: gallery.clientWidth,
      behavior: 'auto',
    });
    const frame = requestAnimationFrame(scrollToCenter);
    return () => cancelAnimationFrame(frame);
  }, []);

  const updateActiveImage = () => {
    const gallery = galleryRef.current;
    if (!gallery || gallery.clientWidth === 0) {
      return;
    }
    setActiveImageIndex(Math.min(2, Math.max(0, Math.round(gallery.scrollLeft / gallery.clientWidth))));
  };

  const selectImage = (index: number) => {
    const gallery = galleryRef.current;
    if (!gallery) {
      return;
    }
    gallery.scrollTo({
      left: gallery.clientWidth * index,
      behavior: 'smooth',
    });
  };

  return (
    <article className="relative h-[calc(100dvh-7rem)] min-h-[24rem] w-full snap-center overflow-hidden rounded-2xl bg-slate-800 shadow-xl shadow-black/20">
      <style>{'.event-gallery::-webkit-scrollbar { display: none; }'}</style>
      <div
        ref={galleryRef}
        className="event-gallery flex h-full snap-x snap-mandatory overflow-x-auto"
        onScroll={updateActiveImage}
        style={{ scrollbarWidth: 'none' }}
      >
        {imageUrls.map((imageUrl, index) => (
          <button
            key={index}
            aria-label={`Open ${event.title}`}
            className="min-w-full snap-center bg-slate-800"
            onClick={onOpen}
            type="button"
          >
            {imageUrl ? (
              <img alt="" className="h-full w-full object-cover" src={imageUrl} />
            ) : (
              <div aria-hidden="true" className="h-full w-full bg-gradient-to-br from-amber-700/70 to-slate-950" />
            )}
          </button>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
        {[0, 1, 2].map((index) => (
          <button
            key={index}
            aria-label={`Show image ${index + 1}`}
            aria-pressed={activeImageIndex === index}
            className={`h-2 w-2 rounded-full transition-colors ${activeImageIndex === index ? 'bg-amber-400' : 'bg-white/50'}`}
            onClick={() => selectImage(index)}
            type="button"
          />
        ))}
      </div>
    </article>
  );
}

function BottomSheet({
  activeTab,
  event,
  members,
  mode,
  onClose,
  onCancel,
  onSelectTab,
  upcomingEvent,
}: {
  activeTab: SheetTab;
  event: EventSummary;
  members: Member[];
  mode: SheetMode;
  onClose: () => void;
  onCancel: () => void;
  onSelectTab: (tab: SheetTab) => void;
  upcomingEvent: EventSummary | undefined;
}) {
  const visibleMembers = members.filter((member) => (
    mode === 'registration' ? member.registered : member.samples
  ));
  const isRegistration = mode === 'registration';

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-slate-950/75 p-3 backdrop-blur-sm" role="presentation">
      <style>{'@keyframes bottomsheet-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }'}</style>
      <section
        aria-label="Панель события"
        aria-modal="true"
        role="dialog"
        className="relative mx-auto w-full max-w-md rounded-t-3xl border border-amber-100/10 bg-slate-900 p-5 shadow-2xl shadow-black/50"
        style={{ animation: 'bottomsheet-slide-up 220ms ease-out' }}
      >
        <button
          aria-label="Close event panel"
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-xl text-slate-100 transition-colors hover:bg-slate-700"
          onClick={onClose}
          type="button"
        >
          ✕
        </button>
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-slate-600" />

        {activeTab === 'main' && (
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">{event.title}</p>
            <h2 className="mt-3 text-xl font-semibold text-white">
              {isRegistration ? 'Вы зарегистрированы' : 'Сэмплы зарезервированы'}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {isRegistration ? 'Ждём вас на дегустации.' : 'Ваш сет будет подготовлен к событию.'}
            </p>
            <button
              type="button"
              onClick={onCancel}
              className="mt-6 w-full rounded-xl bg-red-500/90 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-400"
            >
              {isRegistration ? 'Cancel registration' : 'Cancel reservation'}
            </button>
          </div>
        )}

        {activeTab === 'events' && (
          <div>
            <h2 className="text-xl font-semibold text-white">Ближайший релиз клуба</h2>
            {upcomingEvent ? (
              <article className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-800/70">
                {upcomingEvent.image_url && <img src={upcomingEvent.image_url} alt="" className="h-36 w-full object-cover" />}
                <div className="p-4">
                  <p className="text-xs font-semibold text-amber-400">{formatDate(upcomingEvent.date)}</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">{upcomingEvent.title}</h3>
                  <p className="mt-4 text-sm font-semibold text-amber-400">€{upcomingEvent.price}</p>
                </div>
              </article>
            ) : (
              <p className="mt-4 text-sm text-slate-400">Следующий релиз скоро появится.</p>
            )}
          </div>
        )}

        {activeTab === 'members' && (
          <div>
            <h2 className="text-xl font-semibold text-white">
              {isRegistration ? 'Участники дегустации' : 'Зарезервировали сэмплы'}
            </h2>
            {visibleMembers.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">Пока никого нет.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {visibleMembers.map((member, index) => (
                  <li key={member.id} className="rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-slate-200">
                    Member {index + 1}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <nav aria-label="Навигация шторки" className="mt-6 flex justify-between gap-3 border-t border-white/10 pt-4">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-600 px-2 py-3 text-sm font-medium text-slate-300 hover:bg-white/5">🏠 Home</button>
          <button type="button" onClick={() => onSelectTab('events')} className="flex-1 rounded-lg border border-slate-600 px-2 py-3 text-sm font-medium text-slate-300 hover:bg-white/5">📅 Events</button>
          <button type="button" onClick={() => onSelectTab('members')} className="flex-1 rounded-lg border border-slate-600 px-2 py-3 text-sm font-medium text-slate-300 hover:bg-white/5">👥 Members</button>
        </nav>
      </section>
    </div>
  );
}

export function EventsTab({
  selectedEventId = null,
  onSelectedEventHandled,
}: {
  selectedEventId?: number | null;
  onSelectedEventHandled?: () => void;
}) {
  const { i18n, t } = useTranslation();
  const initDataState = useSignal(initData.state);
  const initDataRaw = useSignal(initData.raw);
  const languageCode = i18n.language;
  const telegramId = initDataState?.user?.id;
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [eventDetails, setEventDetails] = useState<Record<number, EventDetail>>({});
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState<number | null>(null);
  const [sheetEvent, setSheetEvent] = useState<EventSummary | null>(null);
  const [sheetMode, setSheetMode] = useState<SheetMode>('registration');
  const [activeTab, setActiveTab] = useState<SheetTab>('main');
  const [members, setMembers] = useState<Member[]>([]);
  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);
  const [loadingEventDetailId, setLoadingEventDetailId] = useState<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [lineupBottle, setLineupBottle] = useState<EventLineupBottle | null>(null);
  const [isLineupPhotoExpanded, setIsLineupPhotoExpanded] = useState(false);
  const [isLineupReviewOpen, setIsLineupReviewOpen] = useState(false);
  const [lineupReviewRevision, setLineupReviewRevision] = useState(0);
  const [lineupUserStates, setLineupUserStates] = useState<Record<number, LineupBottleActionState>>({});
  const [isUpdatingLineupBottle, setIsUpdatingLineupBottle] = useState<number | null>(null);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(localizedApiUrl(`${API_BASE_URL}/api/events`, languageCode));
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }
      setEvents(await response.json() as EventSummary[]);
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Не удалось загрузить события.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [languageCode]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    setEventDetails({});
    setExpandedEventId(null);
  }, [languageCode]);

  const upcomingEvent = useMemo(() => {
    const now = Date.now();
    return [...events]
      .filter((event) => new Date(event.date).valueOf() >= now)
      .sort((first, second) => new Date(first.date).valueOf() - new Date(second.date).valueOf())[0];
  }, [events]);
  const orderedEvents = useMemo(
    () => [...events].sort(
      (first, second) => new Date(first.date).valueOf() - new Date(second.date).valueOf(),
    ),
    [events],
  );
  const centeredEventIndex = useMemo(() => {
    const now = new Date();
    const nextEventIndex = orderedEvents.findIndex(
      (event) => new Date(event.date).valueOf() >= now.valueOf(),
    );

    return nextEventIndex === -1 ? orderedEvents.length - 1 : nextEventIndex;
  }, [orderedEvents]);

  useEffect(() => {
    const timeline = timelineRef.current;
    const centeredCard = timeline?.querySelector<HTMLElement>(
      `[data-event-index="${centeredEventIndex}"]`,
    );

    if (!timeline || !centeredCard) {
      return;
    }

    timeline.scrollTo({
      top: centeredCard.offsetTop - (timeline.clientHeight - centeredCard.clientHeight) / 2,
      behavior: 'auto',
    });
  }, [centeredEventIndex, orderedEvents.length]);

  const expandedEvent = expandedEventId === null ? null : eventDetails[expandedEventId] ?? null;

  const fetchEventDetail = useCallback(async (
    eventId: number,
    signal?: AbortSignal,
  ): Promise<EventDetail> => {
    const response = await fetch(
      localizedApiUrl(`${API_BASE_URL}/api/events/${eventId}`, languageCode),
      { signal },
    );
    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }
    const detail = await response.json() as EventDetail;
    setEventDetails((current) => ({ ...current, [detail.id]: detail }));
    return detail;
  }, [languageCode]);

  useEffect(() => {
    if (events.length === 0) {
      return;
    }

    const controller = new AbortController();
    void Promise.allSettled(
      events.map((event) => fetchEventDetail(event.id, controller.signal)),
    );
    return () => controller.abort();
  }, [events, fetchEventDetail]);

  const openEventDetails = useCallback(async (eventId: number) => {
    setExpandedEventId(eventId);
    if (eventDetails[eventId]) {
      return;
    }

    setLoadingEventDetailId(eventId);
    try {
      await fetchEventDetail(eventId);
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Не удалось загрузить детали события.',
      });
    } finally {
      setLoadingEventDetailId((current) => current === eventId ? null : current);
    }
  }, [eventDetails, fetchEventDetail]);

  useEffect(() => {
    if (selectedEventId === null) {
      return;
    }

    void openEventDetails(selectedEventId);
    onSelectedEventHandled?.();
  }, [onSelectedEventHandled, openEventDetails, selectedEventId]);

  const refreshEventCounts = useCallback(async (eventId: number) => {
    try {
      const detail = await fetchEventDetail(eventId);
      setEvents((current) => current.map((event) => event.id === eventId
        ? {
          ...event,
          registered_count: detail.registered_count,
          samples_count: detail.samples_count,
        }
        : event));
    } catch {
      // Counts remain unchanged until the next list refresh if the background request fails.
    }
  }, [fetchEventDetail]);

  useEffect(() => {
    if (!telegramId || !expandedEvent?.bottles?.length) {
      setLineupUserStates({});
      return;
    }

    const controller = new AbortController();
    const loadStates = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/bottles/user-states?telegram_id=${encodeURIComponent(telegramId)}`,
          { headers: telegramAuthHeaders(initDataRaw), signal: controller.signal },
        );
        if (!response.ok) return;
        const states = await response.json() as Array<LineupBottleActionState & { bottle_id: number }>;
        setLineupUserStates(Object.fromEntries(
          states.map((s) => [s.bottle_id, { is_favorite: s.is_favorite, is_tried: s.is_tried }]),
        ));
      } catch {
        // silently fail — lineup user states are optional enhancement
      }
    };
    void loadStates();
    return () => controller.abort();
  }, [expandedEvent, initDataRaw, telegramId]);

  const updateParticipation = async (
    event: EventSummary,
    mode: SheetMode,
    value: boolean,
    openSheet: boolean,
  ) => {
    const user = initDataState?.user;
    if (!user) {
      setFeedback({ kind: 'error', message: 'Откройте приложение через Telegram, чтобы записаться.' });
      return;
    }

    setIsSubmitting(event.id);
    setFeedback(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/events/${event.id}/${mode === 'registration' ? 'register' : 'samples'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...telegramAuthHeaders(initDataRaw) },
          body: JSON.stringify({
            telegram_id: user.id,
            username: user.username ?? null,
            first_name: user.first_name ?? null,
            [mode === 'registration' ? 'registered' : 'samples']: value,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      if (openSheet) {
        setExpandedEventId(null);
        setSheetEvent(event);
        setSheetMode(mode);
        setActiveTab('main');
        setMembers([]);
      } else {
        setSheetEvent(null);
        void refreshEventCounts(event.id);
      }
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Не удалось обновить регистрацию.',
      });
    } finally {
      setIsSubmitting(null);
    }
  };

  const loadMembers = useCallback(async () => {
    if (!sheetEvent) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${sheetEvent.id}/members`, {
        headers: telegramAuthHeaders(initDataRaw),
      });
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }
      setMembers(await response.json() as Member[]);
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Не удалось загрузить участников.',
      });
    }
  }, [initDataRaw, sheetEvent]);

  const selectSheetTab = (tab: SheetTab) => {
    setActiveTab(tab);
    if (tab === 'members') {
      void loadMembers();
    }
  };

  const closeSheet = () => {
    if (sheetEvent) {
      void refreshEventCounts(sheetEvent.id);
    }
    setSheetEvent(null);
    setActiveTab('main');
    setMembers([]);
  };

  const closeLineupBottle = () => {
    setLineupBottle(null);
    setIsLineupPhotoExpanded(false);
    setIsLineupReviewOpen(false);
  };

  const toggleLineupBottleAction = async (bottle: EventLineupBottle, actionType: 'favorite' | 'tried') => {
    if (!telegramId) {
      setFeedback({ kind: 'error', message: t('bottle.open_telegram_to_save_marks') });
      return;
    }
    setIsUpdatingLineupBottle(bottle.id);
    setFeedback(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/bottles/${bottle.id}/toggle-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...telegramAuthHeaders(initDataRaw) },
        body: JSON.stringify({ telegram_id: telegramId, action_type: actionType }),
      });
      if (!response.ok) throw new Error(await getErrorMessage(response));
      const result = await response.json() as ToggleLineupResponse;
      setLineupUserStates((current) => ({
        ...current,
        [bottle.id]: { is_favorite: result.is_favorite, is_tried: result.is_tried },
      }));
      setLineupBottle((current) => current?.id === bottle.id
        ? {
          ...current,
          favorites_count: result.favorites_count,
          tried_count: result.tried_count,
        }
        : current);
      setEventDetails((current) => Object.fromEntries(
        Object.entries(current).map(([eventId, event]) => [
          eventId,
          {
            ...event,
            bottles: event.bottles.map((currentBottle) => currentBottle.id === bottle.id
              ? {
                ...currentBottle,
                favorites_count: result.favorites_count,
                tried_count: result.tried_count,
              }
              : currentBottle),
          },
        ]),
      ));
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Could not update bottle.',
      });
    } finally {
      setIsUpdatingLineupBottle(null);
    }
  };

  return (
    <section className="mx-auto w-full max-w-md pb-6 pt-[env(safe-area-inset-top)]">
      {feedback && <p className="mx-5 mb-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">{feedback.message}</p>}

      {isLoading ? (
        <p className="px-5 text-center text-sm text-slate-400">Загружаем события...</p>
      ) : events.length === 0 ? (
        <p className="px-5 text-center text-sm text-slate-400">События скоро появятся.</p>
      ) : (
        <div
          ref={timelineRef}
          className="h-[calc(100dvh-6rem)] min-h-[24rem] snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth"
        >
          <ol className="h-full space-y-4">
            {orderedEvents.map((event, index) => (
              <li key={event.id} data-event-index={index}>
                <EventGalleryCard event={event} onOpen={() => void openEventDetails(event.id)} />
              </li>
            ))}
          </ol>
        </div>
      )}

      {expandedEventId !== null && (
        <div className="fixed inset-x-0 bottom-0 top-10 z-40 bg-slate-950/95 p-4 backdrop-blur-sm">
          <style>{'@keyframes event-expand { from { opacity: 0; transform: translateY(2rem); } to { opacity: 1; transform: translateY(0); } }'}</style>
          <article className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden rounded-3xl border border-amber-100/10 bg-slate-900 shadow-2xl shadow-black/50" style={{ animation: 'event-expand 220ms ease-out' }}>
            {expandedEvent ? <>
            <div className="relative">
              {expandedEvent.image_url && <img src={expandedEvent.image_url} alt="" className="h-56 w-full object-cover" />}
              <button
                type="button"
                aria-label="Закрыть карточку события"
                onClick={() => setExpandedEventId(null)}
                className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/80 text-xl text-white backdrop-blur transition-colors hover:bg-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-6 pb-28">
              <p className="text-xs font-semibold text-amber-400">{formatDate(expandedEvent.date)}</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">{expandedEvent.title}</h2>
              <div className="mt-5 text-sm leading-7 text-slate-300 [&_em]:italic [&_li]:ml-5 [&_li]:list-disc [&_ol]:my-3 [&_ol]:list-decimal [&_p]:mb-4 [&_strong]:font-semibold [&_ul]:my-3">
                <div className="markdown-content">
                  <ReactMarkdown>{expandedEvent.description}</ReactMarkdown>
                </div>
              </div>

              {expandedEvent.bottles && expandedEvent.bottles.length > 0 && (
                <section className="mt-6">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-amber-400">
                    {t('event.tasting_lineup')}
                  </h3>
                  <ul className="space-y-2">
                    {expandedEvent.bottles.map((bottle) => (
                      <li key={bottle.id}>
                        <button
                          className="relative w-full overflow-hidden rounded-2xl border border-amber-400/15 bg-slate-800/70 text-left transition-colors hover:bg-slate-800"
                          onClick={() => {
                            setLineupBottle(bottle);
                            setIsLineupPhotoExpanded(false);
                            setIsLineupReviewOpen(false);
                          }}
                          type="button"
                        >
                          {bottle.background_url && <img alt="" className="pointer-events-none absolute -bottom-2 -right-3 z-0 h-[120%] w-auto object-contain opacity-35" src={bottle.background_url} style={{ maskImage: 'linear-gradient(to left, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)', WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)' }} />}
                          <span className="relative z-10 flex items-center gap-3 p-3">
                            <span className="h-12 w-10 shrink-0 overflow-hidden rounded-lg">
                              {bottle.image_url
                                ? <img alt="" className="h-full w-full object-cover" src={bottle.image_url} />
                                : <span aria-hidden="true" className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-700/70 to-slate-950 text-2xl">🥃</span>
                              }
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-white">{bottle.name}</span>
                              <span className="mt-1 block text-xs text-slate-400">
                                {[bottle.age, bottle.abv].filter(Boolean).join(' · ') || t('bottle.whisky')}
                              </span>
                            </span>
                            <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-amber-400/60" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="m9 18 6-6-6-6" />
                            </svg>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <div className="mt-6 flex justify-between gap-3 text-lg font-semibold text-amber-400">
                <span>€{expandedEvent.price}</span>
                {expandedEvent.samples_price !== null && <span>🥃 €{expandedEvent.samples_price}</span>}
              </div>
            </div>
            <div className="border-t border-white/10 bg-slate-900 p-4">
              {(() => {
                const isPast = new Date(expandedEvent.date).valueOf() < new Date().valueOf();
                const isDisabled = isPast || isSubmitting === expandedEvent.id;

                return (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={isDisabled}
                      onClick={() => void updateParticipation(expandedEvent, 'registration', true, true)}
                      className="flex-1 rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Register
                      {expandedEvent.show_participants && <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-slate-950">{expandedEvent.registered_count}</span>}
                    </button>
                    {expandedEvent.has_samples && (
                      <button
                        type="button"
                        disabled={isDisabled}
                        onClick={() => void updateParticipation(expandedEvent, 'samples', true, true)}
                        className="flex-1 rounded-xl bg-slate-600 px-4 py-3 text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Samples
                        {expandedEvent.show_participants && <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-200 px-1 text-[11px] font-bold text-red-950">{expandedEvent.samples_count}</span>}
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
            </> : <div className="relative flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-400">
              <button
                aria-label="Закрыть карточку события"
                className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/80 text-xl text-white backdrop-blur transition-colors hover:bg-slate-700"
                onClick={() => setExpandedEventId(null)}
                type="button"
              >
                ✕
              </button>
              {loadingEventDetailId === expandedEventId ? 'Loading event details…' : 'Could not load event details.'}
            </div>}
          </article>
        </div>
      )}

      {lineupBottle && (
        <div
          className="fixed inset-x-0 bottom-0 top-10 z-50 bg-slate-950/95 p-4 backdrop-blur-sm"
          onClick={() => { if (isLineupPhotoExpanded) setIsLineupPhotoExpanded(false); }}
        >
          <article className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden rounded-3xl border border-amber-100/10 bg-slate-900 shadow-2xl shadow-black/50">
            <div
              className={`relative shrink-0 overflow-hidden ${isLineupPhotoExpanded ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
              onClick={(e) => { e.stopPropagation(); setIsLineupPhotoExpanded((c) => !c); }}
              style={{ height: isLineupPhotoExpanded ? '55vh' : '200px', maxHeight: '60vh', transition: 'all 0.3s ease-in-out' }}
            >
              {lineupBottle.image_url
                ? <img alt={lineupBottle.name} className="h-full w-full object-contain" src={lineupBottle.image_url} />
                : <div aria-hidden="true" className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-700/70 via-slate-700 to-slate-950 text-6xl">🥃</div>
              }
              <button
                aria-label={t('bottle.close_details')}
                className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/80 text-xl text-white backdrop-blur transition-colors hover:bg-slate-700"
                onClick={(e) => { e.stopPropagation(); closeLineupBottle(); }}
                type="button"
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-6 pb-4">
              <h2 className="text-2xl font-semibold text-white">{lineupBottle.name}</h2>
              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="flex h-[78px] min-w-0 flex-col justify-between rounded-xl bg-slate-800 p-3">
                  <dt className="text-slate-400">{t('bottle.age')}</dt>
                  <dd className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-white">{lineupBottle.age || t('bottle.nas')}</dd>
                </div>
                <div className="flex h-[78px] min-w-0 flex-col justify-between rounded-xl bg-slate-800 p-3">
                  <dt className="text-slate-400">{t('bottle.abv')}</dt>
                  <dd className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-white">{lineupBottle.abv || t('common.na')}</dd>
                </div>
                <div className="flex h-[78px] min-w-0 flex-col justify-between rounded-xl bg-slate-800 p-3">
                  <dt className="text-slate-400">{t('bottle.cask')}</dt>
                  <dd
                    className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-white"
                    style={{ fontSize: lineupBottle.cask && lineupBottle.cask.length > 15 ? '11px' : '14px', lineHeight: 1.2 }}
                    title={lineupBottle.cask ?? undefined}
                  >
                    {lineupBottle.cask || t('common.na')}
                  </dd>
                </div>
                <div className="flex h-[78px] min-w-0 flex-col justify-between rounded-xl bg-slate-800 p-3">
                  <dt className="text-slate-400">{t('bottle.bottles')}</dt>
                  <dd className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-white" title={lineupBottle.bottles ?? undefined}>
                    {lineupBottle.bottles || t('common.na')}
                  </dd>
                </div>
              </dl>
              <BottleTagChart bottleId={lineupBottle.id} refreshRevision={lineupReviewRevision} />
              <p className="mt-5 text-lg font-semibold text-amber-400">€{lineupBottle.price_per_sample}</p>
              <p className="mt-5 text-sm leading-7 text-slate-300" style={{ whiteSpace: 'pre-wrap' }}>{lineupBottle.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-white/10 bg-slate-900 p-4">
              <button
                className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  lineupUserStates[lineupBottle.id]?.is_favorite
                    ? 'border-amber-300 bg-amber-400 text-slate-950'
                    : 'border-slate-600 text-slate-100 hover:bg-white/5'
                }`}
                disabled={isUpdatingLineupBottle === lineupBottle.id}
                onClick={() => void toggleLineupBottleAction(lineupBottle, 'favorite')}
                type="button"
              >
                ⭐ {t('bottle.favorites')} {lineupBottle.favorites_count > 0 && `(${lineupBottle.favorites_count})`}
              </button>
              <button
                className="rounded-xl border border-slate-600 px-3 py-3 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/5"
                onClick={() => {
                  if (!telegramId) {
                    setFeedback({ kind: 'error', message: t('bottle.open_telegram_to_write_review') });
                    return;
                  }
                  setIsLineupReviewOpen(true);
                }}
                type="button"
              >
                📝 {t('bottle.review')}
              </button>
            </div>
          </article>
        </div>
      )}

      {isLineupReviewOpen && lineupBottle && telegramId !== undefined && (
        <BottleReviewOverlay
          bottleId={lineupBottle.id}
          initDataRaw={initDataRaw}
          onClose={() => setIsLineupReviewOpen(false)}
          onSaved={() => setLineupReviewRevision((current) => current + 1)}
          telegramId={telegramId}
        />
      )}

      {sheetEvent && (
        <BottomSheet
          activeTab={activeTab}
          event={sheetEvent}
          members={members}
          mode={sheetMode}
          onClose={closeSheet}
          onCancel={() => void updateParticipation(sheetEvent, sheetMode, false, false)}
          onSelectTab={selectSheetTab}
          upcomingEvent={upcomingEvent}
        />
      )}
    </section>
  );
}
