import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initData, useSignal } from '@tma.js/sdk-react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { telegramAuthHeaders } from '@/telegramAuth.ts';
import { localizedApiUrl } from '@/localization.ts';
import { BottleTagChart } from '@/components/BottleTagChart.tsx';
import { BottleReviewOverlay } from '@/components/BottleReviewOverlay.tsx';
import { normalizePaginatedResponse, paginatedUrl, type PaginatedResponse, useInfiniteScroll } from '@/pagination.ts';

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
  distillery_id: number | null;
  distillery_logo_url: string | null;
  event_date_formatted: string;
  image_url_left: string | null;
  image_url: string | null;
  image_url_right: string | null;
  has_samples: boolean;
  show_participants: boolean;
  registered_count: number;
  samples_count: number;
  bottle_count: number;
  bottles?: EventLineupBottle[];
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

function formatEventBannerDate(
  date: string,
  language: string,
): { month: string; dayAndTime: string } {
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.valueOf())) {
    return { month: '', dayAndTime: date };
  }

  const month = new Intl.DateTimeFormat(language, {
    month: 'long',
  }).format(parsedDate).toLocaleUpperCase(language);
  const day = new Intl.DateTimeFormat(language, {
    day: 'numeric',
  }).format(parsedDate);
  const timePart = new Intl.DateTimeFormat(language, {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
  }).format(parsedDate);
  return { month, dayAndTime: `${day} | ${timePart}` };
}

function LineupInspectorOverlay({
  bottles,
  onClose,
}: {
  bottles: EventLineupBottle[];
  onClose: () => void;
}) {
  const [activeBottleIndex, setActiveBottleIndex] = useState(0);
  const [areParametersVisible, setAreParametersVisible] = useState(false);
  const swipeStartX = useRef<number | null>(null);
  const bottle = bottles[activeBottleIndex];

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const selectBottle = (index: number) => {
    setActiveBottleIndex(Math.min(Math.max(index, 0), bottles.length - 1));
    setAreParametersVisible(false);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    event.stopPropagation();
    swipeStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const startX = swipeStartX.current;
    const endX = event.changedTouches[0]?.clientX;
    swipeStartX.current = null;

    if (startX === null || endX === undefined || Math.abs(endX - startX) < 48) {
      return;
    }

    selectBottle(activeBottleIndex + (endX < startX ? 1 : -1));
  };

  const parameterBadges = [
    bottle.abv,
    bottle.age,
    bottle.cask,
    bottle.bottles,
    bottle.price_per_sample !== null && bottle.price_per_sample !== undefined
      ? `€${bottle.price_per_sample}`
      : null,
  ].filter((value): value is string => Boolean(value?.trim()));

  return (
    <div
      aria-label="Lineup Inspector"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xl"
      role="dialog"
      onClick={(event) => event.stopPropagation()}
      onTouchEnd={handleTouchEnd}
      onTouchStart={handleTouchStart}
    >
      <style>{`
        @keyframes lineup-inspector-badge {
          from { opacity: 0; transform: translateX(2rem); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes lineup-inspector-bottle-pulse {
          0%, 100% { filter: drop-shadow(0 0 0 rgba(197, 160, 89, 0)); transform: scale(1); }
          50% { filter: drop-shadow(0 0 1.25rem rgba(197, 160, 89, 0.35)); transform: scale(1.015); }
        }
      `}</style>
      <div className="relative mx-auto flex h-full w-full max-w-md items-center justify-center px-8 pb-20 pt-8">
        <div key={bottle.id} className="flex h-full w-full items-center justify-center">
          <button
            aria-expanded={areParametersVisible}
            aria-label={`Toggle details for ${bottle.name}`}
            className="flex h-full w-full items-center justify-center"
            onClick={(event) => {
              event.stopPropagation();
              setAreParametersVisible((current) => !current);
            }}
            type="button"
          >
            {bottle.image_url ? (
              <img
                alt={bottle.name}
                className="max-h-[80vh] w-full object-contain"
                src={bottle.image_url}
                style={{ animation: 'lineup-inspector-bottle-pulse 2s ease-in-out infinite' }}
              />
            ) : (
              <span aria-label={bottle.name} className="flex h-64 w-40 items-center justify-center rounded-3xl border border-[#C5A059]/30 bg-[#16161A]/90 text-7xl" style={{ animation: 'lineup-inspector-bottle-pulse 2s ease-in-out infinite' }}>
                🥃
              </span>
            )}
          </button>
          {areParametersVisible && (
            <div className="pointer-events-none absolute right-4 top-8 flex flex-col items-end gap-2">
              {parameterBadges.map((value, index) => (
                <span
                  key={`${bottle.id}-${value}`}
                  className="rounded-lg border border-[#C5A059]/30 bg-[#16161A]/90 px-3 py-1.5 text-xs text-[#F4F4F5]"
                  style={{ animation: `lineup-inspector-badge 260ms ${250 + index * 80}ms ease-out both` }}
                >
                  {value}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-7 flex justify-center gap-2">
        {bottles.map((lineupBottle, index) => (
          <button
            key={lineupBottle.id}
            aria-label={`Show bottle ${index + 1}`}
            aria-pressed={activeBottleIndex === index}
            className={`h-2 w-2 rounded-full transition-colors ${activeBottleIndex === index ? 'bg-[#C5A059]' : 'bg-white/35'}`}
            onClick={(event) => {
              event.stopPropagation();
              selectBottle(index);
            }}
            type="button"
          />
        ))}
      </div>
      <button
        aria-label="Close lineup inspector"
        className="absolute bottom-5 right-5 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/35 text-2xl text-[#F4F4F5] backdrop-blur transition-colors hover:bg-black/60"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        type="button"
      >
        ✕
      </button>
    </div>
  );
}

function EventGalleryCard({
  event,
  isFocused,
  onOpen,
  onOpenLineup,
  resetToCenterRevision,
}: {
  event: EventSummary;
  isFocused: boolean;
  onOpen: () => void;
  onOpenLineup: () => void;
  resetToCenterRevision: number;
}) {
  const { i18n } = useTranslation();
  const cardRef = useRef<HTMLElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(1);
  const [isCardVisible, setIsCardVisible] = useState(false);
  const [isCenterImageReady, setIsCenterImageReady] = useState(false);
  const imageUrls = [
    event.image_url_left ?? event.image_url,
    event.image_url,
    event.image_url_right ?? event.image_url,
  ];
  const bannerDate = formatEventBannerDate(event.date, i18n.language);

  useEffect(() => {
    const gallery = galleryRef.current;
    if (!gallery) {
      return;
    }

    setIsCenterImageReady(false);
    const scrollToCenter = () => gallery.scrollTo({
      left: gallery.clientWidth,
      behavior: 'auto',
    });
    const frame = requestAnimationFrame(scrollToCenter);
    const revealTimer = window.setTimeout(() => setIsCenterImageReady(true), 250);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(revealTimer);
    };
  }, []);

  useEffect(() => {
    const gallery = galleryRef.current;
    if (!isFocused || resetToCenterRevision === 0 || !gallery) {
      return;
    }

    gallery.scrollTo({ left: gallery.clientWidth, behavior: 'auto' });
    setActiveImageIndex(1);
  }, [isFocused, resetToCenterRevision]);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsCardVisible(entry.isIntersecting),
      { threshold: 0.8 },
    );
    observer.observe(card);
    return () => observer.disconnect();
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
    <article ref={cardRef} className="relative h-[calc(100dvh-7rem)] min-h-[24rem] w-full snap-center overflow-hidden rounded-2xl bg-slate-800 shadow-xl shadow-black/20">
      <style>{`
        .event-gallery::-webkit-scrollbar { display: none; }
        @keyframes event-banner-logo { from { opacity: 0; transform: translateX(-0.75rem); } to { opacity: 1; transform: translateX(0); } }
        @keyframes event-banner-date { from { opacity: 0; transform: translateX(0.75rem); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
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
      {isCardVisible && isCenterImageReady && activeImageIndex === 1 && (event.distillery_logo_url || bannerDate.dayAndTime) && (
        <>
          {event.distillery_logo_url && (
            <div className="pointer-events-none absolute inset-x-0 top-[8%] z-10 flex h-[15%] justify-center">
              <img
                alt=""
                className="h-full w-[70%] scale-125 object-contain"
                src={event.distillery_logo_url}
                style={{ animation: 'event-banner-logo 400ms ease-out both' }}
              />
            </div>
          )}
          {bannerDate && (
            <div className="pointer-events-none absolute inset-x-0 bottom-[8%] z-10 flex h-[15%] items-center justify-center px-8">
              <span
                className="flex flex-col text-center font-bold tracking-wide"
                style={{
                  animation: 'event-banner-date 400ms 400ms ease-out both',
                  color: '#C5A059',
                  fontFamily: 'Montserrat, sans-serif',
                }}
              >
                {bannerDate.month && <span className="text-[clamp(1rem,4vw,1.75rem)]">{bannerDate.month}</span>}
                <span className="text-[clamp(1.5rem,7vw,3.5rem)]">{bannerDate.dayAndTime}</span>
              </span>
            </div>
          )}
        </>
      )}
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
      {activeImageIndex === 1 && event.bottle_count > 0 && (
       <button
         aria-label="Open tasting lineup"
         className="absolute bottom-4 right-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-[#C5A059]/30 bg-black/45 text-[#C5A059] backdrop-blur transition-colors hover:bg-black/65"
         onClick={(clickEvent) => {
           clickEvent.stopPropagation();
           onOpenLineup();
         }}
         type="button"
       >
         <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M9 2h6v5l1 1.5V10l3 3v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7l3-3V8.5L9 7V2Z" fill="currentColor" stroke="none" />
          <path d="M8.5 15h7M8.5 17.5h7" stroke="#16161A" />
         </svg>
       </button>
      )}
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
  hasMoreMembers,
  isLoadingMoreMembers,
  memberScrollRef,
  memberSentinelRef,
}: {
  activeTab: SheetTab;
  event: EventSummary;
  members: Member[];
  mode: SheetMode;
  onClose: () => void;
  onCancel: () => void;
  onSelectTab: (tab: SheetTab) => void;
  upcomingEvent: EventSummary | undefined;
  hasMoreMembers: boolean;
  isLoadingMoreMembers: boolean;
  memberScrollRef: React.RefObject<HTMLDivElement>;
  memberSentinelRef: (node: Element | null) => void;
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
              <div ref={memberScrollRef} className="mt-4 max-h-64 overflow-y-auto">
              <ul className="space-y-2">
                {visibleMembers.map((member, index) => (
                  <li key={member.id} className="rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-slate-200">
                    Member {index + 1}
                  </li>
                ))}
                {hasMoreMembers && <li ref={memberSentinelRef} className="h-px" aria-hidden="true" />}
                {isLoadingMoreMembers && <li className="py-2 text-center text-sm text-slate-400">Loading…</li>}
              </ul>
              </div>
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
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState<number | null>(null);
  const [sheetEvent, setSheetEvent] = useState<EventSummary | null>(null);
  const [sheetMode, setSheetMode] = useState<SheetMode>('registration');
  const [activeTab, setActiveTab] = useState<SheetTab>('main');
  const [members, setMembers] = useState<Member[]>([]);
  const [hasMoreMembers, setHasMoreMembers] = useState(false);
  const [isLoadingMoreMembers, setIsLoadingMoreMembers] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);
  const [loadingEventDetailId, setLoadingEventDetailId] = useState<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const memberScrollRef = useRef<HTMLDivElement>(null);
  const timelineScrollTimerRef = useRef<number | null>(null);
  const [focusedEventId, setFocusedEventId] = useState<number | null>(null);
  const [galleryResetRevision, setGalleryResetRevision] = useState(0);
  const [lineupInspectorEvent, setLineupInspectorEvent] = useState<EventDetail | null>(null);
  const [lineupBottle, setLineupBottle] = useState<EventLineupBottle | null>(null);
  const [isLineupPhotoExpanded, setIsLineupPhotoExpanded] = useState(false);
  const [isLineupReviewOpen, setIsLineupReviewOpen] = useState(false);
  const [lineupReviewRevision, setLineupReviewRevision] = useState(0);
  const [lineupUserStates, setLineupUserStates] = useState<Record<number, LineupBottleActionState>>({});
  const [isUpdatingLineupBottle, setIsUpdatingLineupBottle] = useState<number | null>(null);

  const loadEvents = useCallback(async (offset: number, replace = false) => {
    if (replace) setIsLoading(true);
    else setIsLoadingMore(true);
    try {
      const response = await fetch(localizedApiUrl(
        paginatedUrl(`${API_BASE_URL}/api/events`, 24, offset),
        languageCode,
      ));
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }
      const page = normalizePaginatedResponse(await response.json() as PaginatedResponse<EventSummary> | EventSummary[]);
      setEvents((current) => replace ? page.items : [...current, ...page.items]);
      setHasMore(page.has_more);
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Не удалось загрузить события.',
      });
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [languageCode]);

  useEffect(() => {
    setEventDetails({});
    void loadEvents(0, true);
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

  useEffect(() => () => {
    if (timelineScrollTimerRef.current !== null) {
      window.clearTimeout(timelineScrollTimerRef.current);
    }
  }, []);

  const resetFocusedGallery = () => {
    const timeline = timelineRef.current;
    if (!timeline) {
      return;
    }

    const focusedCard = Array.from(
      timeline.querySelectorAll<HTMLElement>('[data-event-index]'),
    ).reduce<HTMLElement | null>((closestCard, card) => {
      if (!closestCard) {
        return card;
      }

      const viewportCenter = timeline.scrollTop + timeline.clientHeight / 2;
      const cardCenter = card.offsetTop + card.clientHeight / 2;
      const closestCardCenter = closestCard.offsetTop + closestCard.clientHeight / 2;
      return Math.abs(cardCenter - viewportCenter) < Math.abs(closestCardCenter - viewportCenter)
        ? card
        : closestCard;
    }, null);
    const focusedIndex = Number(focusedCard?.dataset.eventIndex);
    const focusedEvent = orderedEvents[focusedIndex];
    if (!focusedEvent) {
      return;
    }

    setFocusedEventId(focusedEvent.id);
    setGalleryResetRevision((current) => current + 1);
  };

  const handleTimelineScroll = () => {
    if (timelineScrollTimerRef.current !== null) {
      window.clearTimeout(timelineScrollTimerRef.current);
    }
    timelineScrollTimerRef.current = window.setTimeout(resetFocusedGallery, 120);
  };

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

  const openLineup = useCallback(async (eventId: number) => {
    try {
      const detail = eventDetails[eventId] ?? await fetchEventDetail(eventId);
      if (detail.bottles.length > 0) {
        setLineupInspectorEvent(detail);
      }
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Не удалось загрузить lineup события.',
      });
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
        const page = normalizePaginatedResponse(await response.json() as PaginatedResponse<LineupBottleActionState & { bottle_id: number }> | Array<LineupBottleActionState & { bottle_id: number }>);
        const states = page.items;
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

  const loadMembers = useCallback(async (offset = 0) => {
    if (!sheetEvent) {
      return;
    }
    setIsLoadingMoreMembers(true);
    try {
      const response = await fetch(paginatedUrl(`${API_BASE_URL}/api/events/${sheetEvent.id}/members`, 24, offset), {
        headers: telegramAuthHeaders(initDataRaw),
      });
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }
      const page = normalizePaginatedResponse(await response.json() as PaginatedResponse<Member> | Member[]);
      setMembers((current) => offset === 0 ? page.items : [...current, ...page.items]);
      setHasMoreMembers(page.has_more);
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Не удалось загрузить участников.',
      });
    } finally {
      setIsLoadingMoreMembers(false);
    }
  }, [initDataRaw, sheetEvent]);

  const loadMoreMembers = useCallback(() => {
    if (hasMoreMembers && !isLoadingMoreMembers) void loadMembers(members.length);
  }, [hasMoreMembers, isLoadingMoreMembers, loadMembers, members.length]);
  const memberSentinelRef = useInfiniteScroll(
    loadMoreMembers,
    hasMoreMembers && !isLoadingMoreMembers,
    memberScrollRef,
  );
  const loadMoreEvents = useCallback(() => {
    if (hasMore && !isLoadingMore) void loadEvents(events.length);
  }, [events.length, hasMore, isLoadingMore, loadEvents]);
  const eventSentinelRef = useInfiniteScroll(
    loadMoreEvents,
    hasMore && !isLoading && !isLoadingMore,
    timelineRef,
  );

  const selectSheetTab = (tab: SheetTab) => {
    setActiveTab(tab);
    if (tab === 'members') {
      setMembers([]);
      setHasMoreMembers(false);
      void loadMembers(0);
    }
  };

  const closeSheet = () => {
    if (sheetEvent) {
      void refreshEventCounts(sheetEvent.id);
    }
    setSheetEvent(null);
    setActiveTab('main');
    setMembers([]);
    setHasMoreMembers(false);
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
          onScroll={handleTimelineScroll}
        >
          <ol className="h-full space-y-4">
            {orderedEvents.map((event, index) => (
              <li key={event.id} data-event-index={index} className="snap-center" style={{ scrollSnapStop: 'always' }}>
                <EventGalleryCard
                  event={{ ...event, bottles: eventDetails[event.id]?.bottles }}
                  isFocused={focusedEventId === event.id}
                  onOpen={() => void openEventDetails(event.id)}
                  onOpenLineup={() => void openLineup(event.id)}
                  resetToCenterRevision={galleryResetRevision}
                />
              </li>
            ))}
            {hasMore && <li ref={eventSentinelRef} className="h-px" aria-hidden="true" />}
            {isLoadingMore && <li className="py-3 text-center text-sm text-slate-400">Loading…</li>}
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
                          {bottle.background_url && <img alt="" className="pointer-events-none absolute bottom-1 right-6 z-0 h-[90%] w-auto object-contain opacity-35" src={bottle.background_url} style={{ maskImage: 'linear-gradient(to left, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)', WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)' }} />}
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
              <div className="flex h-full items-center justify-center rounded-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#C5A059]/20 via-[#16161A]/50 to-transparent py-6">
                {lineupBottle.image_url
                  ? <img alt={lineupBottle.name} className="h-full w-full object-contain drop-shadow-[0_10px_15px_rgba(0,0,0,0.8)]" src={lineupBottle.image_url} />
                  : <div aria-hidden="true" className="flex h-full w-full items-center justify-center text-6xl">🥃</div>
                }
              </div>
              <div className={`absolute right-4 top-1/2 z-10 flex -translate-y-1/2 flex-col items-end gap-2.5 transition-opacity duration-300 ${isLineupPhotoExpanded ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
                {[lineupBottle.abv, lineupBottle.age, lineupBottle.cask, lineupBottle.bottles].filter(Boolean).map((value, index) => (
                  <span key={String(value)} className="whitespace-nowrap rounded-lg border border-[#C5A059]/30 bg-[#16161A]/90 px-3 py-1.5 text-xs text-[#F4F4F5] shadow-lg backdrop-blur-sm" style={{ animation: `bottle-detail-chip 260ms ${250 + index * 80}ms ease-out both` }}>{value}</span>
                ))}
              </div>
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
              <div className="mb-4 flex items-baseline justify-between gap-4"><h2 className="min-w-0 font-serif text-2xl font-bold text-[#F4F4F5]">{lineupBottle.name}</h2><span className="shrink-0 text-xl font-semibold text-[#C5A059]">€{lineupBottle.price_per_sample}</span></div>
              <BottleTagChart bottleId={lineupBottle.id} refreshRevision={lineupReviewRevision} />
              <p className="mt-5 text-sm leading-7 text-slate-300" style={{ whiteSpace: 'pre-wrap' }}>{lineupBottle.description}</p>
            </div>
            <div className="flex gap-3 border-t border-white/10 bg-slate-900 p-4">
              <button
                aria-label={t('bottle.favorites')}
                className={`rounded-xl border border-[#C5A059]/30 p-3.5 text-[#C5A059] transition-all hover:bg-[#C5A059]/10 disabled:cursor-not-allowed disabled:opacity-60 ${
                  lineupUserStates[lineupBottle.id]?.is_favorite
                    ? 'bg-[#C5A059]/10'
                    : ''
                }`}
                disabled={isUpdatingLineupBottle === lineupBottle.id}
                onClick={() => void toggleLineupBottleAction(lineupBottle, 'favorite')}
                type="button"
              >
                <svg aria-hidden="true" className="h-5 w-5" fill={lineupUserStates[lineupBottle.id]?.is_favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M6 3.75A1.75 1.75 0 0 1 7.75 2h8.5A1.75 1.75 0 0 1 18 3.75V22l-6-3.5L6 22V3.75Z" /></svg>
              </button>
              <button
                className="flex-1 rounded-xl bg-[#C5A059] py-3.5 text-sm font-semibold uppercase tracking-wider text-black shadow-[0_0_15px_rgba(197,160,89,0.3)] transition-all hover:bg-[#b59049]"
                onClick={() => {
                  if (!telegramId) {
                    setFeedback({ kind: 'error', message: t('bottle.open_telegram_to_write_review') });
                    return;
                  }
                  setIsLineupReviewOpen(true);
                }}
                type="button"
              >
                {t('bottle.review')}
              </button>
            </div>
          </article>
        </div>
      )}

      {lineupInspectorEvent && (
        <LineupInspectorOverlay
          bottles={lineupInspectorEvent.bottles}
          onClose={() => setLineupInspectorEvent(null)}
        />
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
          hasMoreMembers={hasMoreMembers}
          isLoadingMoreMembers={isLoadingMoreMembers}
          memberScrollRef={memberScrollRef}
          memberSentinelRef={memberSentinelRef}
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
