import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initData, useSignal } from '@tma.js/sdk-react';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { telegramAuthHeaders } from '@/telegramAuth.ts';
import { localizedApiUrl } from '@/localization.ts';
import { BottleTagChart } from '@/components/BottleTagChart.tsx';
import { BottleReviewOverlay } from '@/components/BottleReviewOverlay.tsx';
import { normalizePaginatedResponse, paginatedUrl, type PaginatedResponse, useInfiniteScroll } from '@/pagination.ts';

const API_BASE_URL = 'https://paphos-whisky-api.onrender.com';
const EVENTS_PAGE_SIZE = 8;
const EVENTS_CACHE_STALE_TIME = 5 * 60 * 1000;
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
  location: string | null;
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

type EventListPage = {
  items: EventSummary[];
  hasMore: boolean;
};

type EventListCache = EventListPage & {
  updatedAt: number;
};

type SheetMode = 'registration' | 'samples';
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

function eventsCacheKey(languageCode: string) {
  return `paphos-whisky:events:${languageCode}`;
}

function readEventsCache(languageCode: string): EventListCache | null {
  try {
    const value = window.sessionStorage.getItem(eventsCacheKey(languageCode));
    if (!value) return null;
    const cached: unknown = JSON.parse(value);
    if (
      typeof cached !== 'object'
      || cached === null
      || !('items' in cached)
      || !Array.isArray(cached.items)
      || !('hasMore' in cached)
      || typeof cached.hasMore !== 'boolean'
      || !('updatedAt' in cached)
      || typeof cached.updatedAt !== 'number'
    ) {
      return null;
    }
    return cached as EventListCache;
  } catch {
    return null;
  }
}

function writeEventsCache(languageCode: string, page: EventListPage) {
  try {
    window.sessionStorage.setItem(eventsCacheKey(languageCode), JSON.stringify({
      ...page,
      updatedAt: Date.now(),
    }));
  } catch {
    // The in-memory TanStack cache remains available if session storage is unavailable.
  }
}

async function fetchEventsPage(
  languageCode: string,
  offset: number,
  signal?: AbortSignal,
): Promise<EventListPage> {
  const response = await fetch(localizedApiUrl(
    paginatedUrl(`${API_BASE_URL}/api/events`, EVENTS_PAGE_SIZE, offset),
    languageCode,
  ), { signal });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
  const page = normalizePaginatedResponse(
    await response.json() as PaginatedResponse<EventSummary> | EventSummary[],
  );
  return { items: page.items, hasMore: page.has_more };
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

function isEventTodayOrFuture(date: string, now = new Date()) {
  const eventDate = new Date(date);
  if (Number.isNaN(eventDate.valueOf())) {
    return false;
  }

  const eventDay = new Date(
    eventDate.getFullYear(),
    eventDate.getMonth(),
    eventDate.getDate(),
  );
  const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return eventDay >= currentDay;
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

function calendarUrl(event: EventSummary): string | null {
  const start = new Date(event.date);
  if (Number.isNaN(start.valueOf())) return null;
  const end = new Date(start.valueOf() + 2 * 60 * 60 * 1000);
  const calendarDate = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${calendarDate(start)}/${calendarDate(end)}`,
  });
  if (event.location) params.set('location', event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function LineupInspectorOverlay({
  bottles,
  onClose,
  onOpenReview,
}: {
  bottles: EventLineupBottle[];
  onClose: () => void;
  onOpenReview: (bottle: EventLineupBottle) => void;
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
        @keyframes lineup-inspector-action-pulse {
          0%, 100% { filter: drop-shadow(0 0 0 rgba(197, 160, 89, 0)); transform: scale(1); }
          50% { filter: drop-shadow(0 0 0.5rem rgba(197, 160, 89, 0.8)); transform: scale(1.1); }
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
        aria-label="Open bottle review"
        className="absolute bottom-16 right-3 flex h-12 w-12 items-center justify-center"
        onClick={(event) => {
          event.stopPropagation();
          onOpenReview(bottle);
        }}
        type="button"
      >
        <img
          alt=""
          aria-hidden="true"
          className="h-10 w-10 object-contain"
          src="/assets/nav/Review.webp"
          style={{ animation: 'lineup-inspector-action-pulse 1.8s ease-in-out infinite' }}
        />
      </button>
      <button
        aria-label="Close lineup inspector"
        className="absolute bottom-3 right-3 flex h-12 w-12 items-center justify-center"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        type="button"
      >
        <img
          alt=""
          aria-hidden="true"
          className="h-10 w-10 object-contain"
          src="/assets/nav/Close.webp"
          style={{ animation: 'lineup-inspector-action-pulse 1.8s ease-in-out infinite' }}
        />
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
  isInitialEvent,
  timelineRootRef,
}: {
  event: EventSummary;
  isFocused: boolean;
  onOpen: () => void;
  onOpenLineup: () => void;
  resetToCenterRevision: number;
  isInitialEvent: boolean;
  timelineRootRef: React.RefObject<HTMLDivElement>;
}) {
  const { i18n } = useTranslation();
  const cardRef = useRef<HTMLElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(1);
  const [isCardVisible, setIsCardVisible] = useState(false);
  const [isCenterImageReady, setIsCenterImageReady] = useState(false);
  const [loadedImageIndexes, setLoadedImageIndexes] = useState<number[]>(
    isInitialEvent ? [1] : [],
  );
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
    return () => {
      cancelAnimationFrame(frame);
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
      { root: timelineRootRef.current, rootMargin: '100% 0px', threshold: 0 },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [timelineRootRef]);

  useEffect(() => {
    if (isCardVisible || isInitialEvent) {
      setLoadedImageIndexes((current) => (
        current.includes(1) ? current : [...current, 1]
      ));
    }
  }, [isCardVisible, isInitialEvent]);

  useEffect(() => {
    if (!event.image_url) {
      setIsCenterImageReady(true);
    }
  }, [event.image_url]);

  const updateActiveImage = () => {
    const gallery = galleryRef.current;
    if (!gallery || gallery.clientWidth === 0) {
      return;
    }
    const nextIndex = Math.min(2, Math.max(0, Math.round(gallery.scrollLeft / gallery.clientWidth)));
    setActiveImageIndex(nextIndex);
    setLoadedImageIndexes((current) => (
      current.includes(nextIndex) ? current : [...current, nextIndex]
    ));
  };

  const selectImage = (index: number) => {
    const gallery = galleryRef.current;
    if (!gallery) {
      return;
    }
    setLoadedImageIndexes((current) => (
      current.includes(index) ? current : [...current, index]
    ));
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
        @keyframes event-lineup-pulse { 0%, 100% { filter: drop-shadow(0 0 0 rgba(197, 160, 89, 0)); transform: scale(1); } 50% { filter: drop-shadow(0 0 0.5rem rgba(197, 160, 89, 0.8)); transform: scale(1.1); } }
      `}</style>
      <div
        ref={galleryRef}
        className="event-gallery flex h-full snap-x snap-mandatory overflow-x-auto"
        onScroll={updateActiveImage}
        style={{ scrollbarWidth: 'none' }}
      >
        {imageUrls.map((imageUrl, index) => {
          const isInitialImage = isInitialEvent && index === 1;
          const shouldLoadImage = loadedImageIndexes.includes(index);

          return (
            <button
              key={index}
              aria-label={`Open ${event.title}`}
              className="min-w-full snap-center bg-slate-800"
              onClick={onOpen}
              type="button"
            >
              {imageUrl && shouldLoadImage ? (
                <img
                  alt=""
                  className="h-full w-full object-cover"
                  decoding="async"
                  fetchPriority={isInitialImage ? 'high' : 'auto'}
                  loading={isInitialImage ? 'eager' : 'lazy'}
                  onError={index === 1 ? () => setIsCenterImageReady(true) : undefined}
                  onLoad={index === 1 ? () => setIsCenterImageReady(true) : undefined}
                  src={imageUrl}
                />
              ) : (
                <div aria-hidden="true" className="h-full w-full bg-gradient-to-br from-amber-700/70 to-slate-950" />
              )}
            </button>
          );
        })}
      </div>
      {isCardVisible && isCenterImageReady && activeImageIndex === 1 && (event.distillery_logo_url || bannerDate.dayAndTime) && (
        <>
          {event.distillery_logo_url && (
            <div className="pointer-events-none absolute inset-x-0 top-[8%] z-10 flex h-[15%] justify-center">
              <img
                alt=""
                className="h-full w-[70%] scale-125 object-contain"
                decoding="async"
                loading="lazy"
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
         className="absolute bottom-3 right-3 z-20 flex h-12 w-12 items-center justify-center"
         onClick={(clickEvent) => {
           clickEvent.stopPropagation();
           onOpenLineup();
         }}
         type="button"
       >
         <img
           alt=""
           aria-hidden="true"
           className="h-10 w-10 object-contain"
           src="/assets/nav/Bottles.webp"
           style={{ animation: 'event-lineup-pulse 1.8s ease-in-out infinite' }}
         />
       </button>
      )}
    </article>
  );
}

function BottomSheet({
  event,
  mode,
  onClose,
  onCancel,
  isCancelling,
  error,
}: {
  event: EventSummary;
  mode: SheetMode;
  onClose: () => void;
  onCancel: () => void;
  isCancelling: boolean;
  error: string | null;
}) {
  const { i18n, t } = useTranslation();
  const isRegistration = mode === 'registration';
  const date = new Date(event.date);
  const hasDate = !Number.isNaN(date.valueOf());
  const dateLabel = hasDate
    ? new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
    : event.date;
  const timeLabel = hasDate
    ? new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' }).format(date)
    : null;
  const calendarLink = calendarUrl(event);

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-slate-950/75 p-3 backdrop-blur-sm" role="presentation">
      <style>{'@keyframes bottomsheet-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }'}</style>
      <section
        aria-label={t('event.registration_panel')}
        aria-modal="true"
        role="dialog"
        className="relative mx-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-t-3xl border border-[#C5A059]/20 bg-[#111113] p-6 shadow-2xl shadow-black/50"
        style={{ animation: 'bottomsheet-slide-up 220ms ease-out' }}
      >
        <button
          aria-label={t('event.close_panel')}
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-xl text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          onClick={onClose}
          type="button"
        >
          ✕
        </button>
        <div className="text-center">
          <svg aria-hidden="true" className="mx-auto mt-4 h-14 w-14 text-[#C5A059] drop-shadow-[0_0_12px_rgba(197,160,89,0.5)]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="19" />
            <path d="m15 24 6 6 12-13" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#C5A059]">{event.title}</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            {t(isRegistration ? 'event.registered' : 'event.samples_reserved')}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {t(isRegistration ? 'event.registration_message' : 'event.samples_message')}
          </p>
        </div>

        <div className="mt-6 space-y-3 rounded-2xl border border-[#C5A059]/20 bg-[#1A1A1E] p-4 text-sm text-slate-200">
          <div className="flex items-center gap-3">
            <svg aria-hidden="true" className="h-5 w-5 shrink-0 text-[#C5A059]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">
              <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18" />
            </svg>
            <span>{dateLabel}{timeLabel && ` · ${timeLabel}`}</span>
          </div>
          {event.location && (
            <div className="flex items-center gap-3">
              <svg aria-hidden="true" className="h-5 w-5 shrink-0 text-[#C5A059]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">
                <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" />
              </svg>
              <span>{event.location}</span>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col items-center gap-3">
          {calendarLink ? (
            <a className="block w-full rounded-xl bg-gradient-to-r from-[#C5A059] to-[#8A5A2B] px-4 py-3.5 text-center text-sm font-semibold text-[#111113] transition-opacity hover:opacity-90" href={calendarLink} rel="noopener noreferrer" target="_blank">
              {t('event.add_to_calendar')}
            </a>
          ) : (
            <span className="w-full rounded-xl border border-[#C5A059]/20 px-4 py-3.5 text-center text-sm text-slate-400">
              {t('event.calendar_date_unavailable')}
            </span>
          )}
          <button
            type="button"
            disabled={isCancelling}
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-red-400/70 transition-colors hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t(isRegistration ? 'event.cancel_registration' : 'event.cancel_reservation')}
          </button>
          {error && <p role="alert" className="text-center text-sm text-red-400">{error}</p>}
        </div>
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
  const [events, setEvents] = useState<EventSummary[]>(
    () => readEventsCache(languageCode)?.items ?? [],
  );
  const [eventDetails, setEventDetails] = useState<Record<number, EventDetail>>({});
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(
    () => readEventsCache(languageCode)?.hasMore ?? false,
  );
  const [isSubmitting, setIsSubmitting] = useState<number | null>(null);
  const [sheetEvent, setSheetEvent] = useState<EventSummary | null>(null);
  const [sheetMode, setSheetMode] = useState<SheetMode>('registration');
  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);
  const [loadingEventDetailId, setLoadingEventDetailId] = useState<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineScrollTimerRef = useRef<number | null>(null);
  const virtualWindowFrameRef = useRef<number | null>(null);
  const [focusedEventId, setFocusedEventId] = useState<number | null>(null);
  const [virtualCenterIndex, setVirtualCenterIndex] = useState(0);
  const [galleryResetRevision, setGalleryResetRevision] = useState(0);
  const [lineupInspectorEvent, setLineupInspectorEvent] = useState<EventDetail | null>(null);
  const [lineupBottle, setLineupBottle] = useState<EventLineupBottle | null>(null);
  const [isLineupPhotoExpanded, setIsLineupPhotoExpanded] = useState(false);
  const [isLineupReviewOpen, setIsLineupReviewOpen] = useState(false);
  const [lineupReviewRevision, setLineupReviewRevision] = useState(0);
  const [lineupUserStates, setLineupUserStates] = useState<Record<number, LineupBottleActionState>>({});
  const [isUpdatingLineupBottle, setIsUpdatingLineupBottle] = useState<number | null>(null);

  const eventsQuery = useQuery({
    queryKey: ['events', languageCode, EVENTS_PAGE_SIZE],
    queryFn: ({ signal }) => fetchEventsPage(languageCode, 0, signal),
    staleTime: EVENTS_CACHE_STALE_TIME,
    initialData: () => readEventsCache(languageCode) ?? undefined,
    initialDataUpdatedAt: () => readEventsCache(languageCode)?.updatedAt,
  });
  const isLoading = eventsQuery.isPending && events.length === 0;

  const loadEvents = useCallback(async (offset: number) => {
    setIsLoadingMore(true);
    try {
      const page = await fetchEventsPage(languageCode, offset);
      setEvents((current) => {
        const nextEvents = [...current, ...page.items];
        writeEventsCache(languageCode, { items: nextEvents, hasMore: page.hasMore });
        return nextEvents;
      });
      setHasMore(page.hasMore);
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Не удалось загрузить события.',
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [languageCode]);

  useEffect(() => {
    const cachedEvents = readEventsCache(languageCode);
    setEvents(cachedEvents?.items ?? []);
    setHasMore(cachedEvents?.hasMore ?? false);
    setEventDetails({});
    setExpandedEventId(null);
  }, [languageCode]);

  useEffect(() => {
    const page = eventsQuery.data;
    if (!page) {
      return;
    }
    setEvents((current) => {
      const refreshedEventIds = new Set(page.items.map((event) => event.id));
      const nextEvents = [
        ...page.items,
        ...current.filter((event) => !refreshedEventIds.has(event.id)),
      ];
      writeEventsCache(languageCode, { items: nextEvents, hasMore: page.hasMore });
      return nextEvents;
    });
    setHasMore(page.hasMore);
  }, [eventsQuery.data, languageCode]);

  useEffect(() => {
    if (!eventsQuery.error) {
      return;
    }
    setFeedback({
      kind: 'error',
      message: eventsQuery.error instanceof Error
        ? eventsQuery.error.message
        : 'Не удалось загрузить события.',
    });
  }, [eventsQuery.error]);

  const orderedEvents = useMemo(
    () => [...events].sort(
      (first, second) => new Date(first.date).valueOf() - new Date(second.date).valueOf(),
    ),
    [events],
  );
  const centeredEventIndex = useMemo(() => {
    const nextEventIndex = orderedEvents.findIndex(
      (event) => isEventTodayOrFuture(event.date),
    );

    return nextEventIndex === -1 ? orderedEvents.length - 1 : nextEventIndex;
  }, [orderedEvents]);
  const initialEventId = orderedEvents[centeredEventIndex]?.id;
  const virtualWindowStart = Math.max(0, virtualCenterIndex - 2);
  const virtualWindowEnd = Math.min(orderedEvents.length - 1, virtualCenterIndex + 2);

  useEffect(() => {
    setVirtualCenterIndex(centeredEventIndex);
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
    if (virtualWindowFrameRef.current !== null) {
      window.cancelAnimationFrame(virtualWindowFrameRef.current);
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
    if (virtualWindowFrameRef.current === null) {
      virtualWindowFrameRef.current = window.requestAnimationFrame(() => {
        virtualWindowFrameRef.current = null;
        const timeline = timelineRef.current;
        if (!timeline) {
          return;
        }

        const viewportCenter = timeline.scrollTop + timeline.clientHeight / 2;
        const focusedCard = Array.from(
          timeline.querySelectorAll<HTMLElement>('[data-event-index]'),
        ).reduce<HTMLElement | null>((closestCard, card) => {
          if (!closestCard) {
            return card;
          }
          const cardCenter = card.offsetTop + card.clientHeight / 2;
          const closestCardCenter = closestCard.offsetTop + closestCard.clientHeight / 2;
          return Math.abs(cardCenter - viewportCenter) < Math.abs(closestCardCenter - viewportCenter)
            ? card
            : closestCard;
        }, null);
        const index = Number(focusedCard?.dataset.eventIndex);
        if (Number.isInteger(index)) {
          setVirtualCenterIndex((current) => current === index ? current : index);
        }
      });
    }
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

  const loadMoreEvents = useCallback(() => {
    if (hasMore && !isLoadingMore) void loadEvents(events.length);
  }, [events.length, hasMore, isLoadingMore, loadEvents]);
  const eventSentinelRef = useInfiniteScroll(
    loadMoreEvents,
    hasMore && !isLoading && !isLoadingMore,
    timelineRef,
  );

  const closeSheet = () => {
    if (sheetEvent) {
      void refreshEventCounts(sheetEvent.id);
    }
    setSheetEvent(null);
  };

  const closeLineupBottle = () => {
    setLineupBottle(null);
    setIsLineupPhotoExpanded(false);
    setIsLineupReviewOpen(false);
  };
  const closeLineupInspector = () => {
    setLineupInspectorEvent(null);
    closeLineupBottle();
  };
  const openLineupReview = (bottle: EventLineupBottle) => {
    if (!telegramId) {
      setFeedback({ kind: 'error', message: t('bottle.open_telegram_to_write_review') });
      return;
    }
    setLineupBottle(bottle);
    setIsLineupPhotoExpanded(false);
    setIsLineupReviewOpen(true);
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
                {index >= virtualWindowStart && index <= virtualWindowEnd ? (
                  <EventGalleryCard
                    event={{ ...event, bottles: eventDetails[event.id]?.bottles }}
                    isFocused={focusedEventId === event.id}
                    onOpen={() => void openEventDetails(event.id)}
                    onOpenLineup={() => void openLineup(event.id)}
                    resetToCenterRevision={galleryResetRevision}
                    isInitialEvent={event.id === initialEventId}
                    timelineRootRef={timelineRef}
                  />
                ) : (
                  <div aria-hidden="true" className="h-[calc(100dvh-7rem)] min-h-[24rem] w-full" />
                )}
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
              {expandedEvent.description && (
                <div className="mt-5 text-sm leading-7 text-slate-300 [&_em]:italic [&_li]:ml-5 [&_li]:list-disc [&_ol]:my-3 [&_ol]:list-decimal [&_p]:mb-4 [&_strong]:font-semibold [&_ul]:my-3">
                  <div className="markdown-content">
                    <ReactMarkdown>{expandedEvent.description}</ReactMarkdown>
                  </div>
                </div>
              )}

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
                const isPast = !isEventTodayOrFuture(expandedEvent.date);
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

      {lineupBottle && !lineupInspectorEvent && (
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
                onClick={() => openLineupReview(lineupBottle)}
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
          onClose={closeLineupInspector}
          onOpenReview={openLineupReview}
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
          event={sheetEvent}
          mode={sheetMode}
          onClose={closeSheet}
          onCancel={() => void updateParticipation(sheetEvent, sheetMode, false, false)}
          isCancelling={isSubmitting === sheetEvent.id}
          error={feedback?.message ?? null}
        />
      )}
    </section>
  );
}
