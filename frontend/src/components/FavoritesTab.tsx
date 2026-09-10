import { useEffect, useMemo, useState } from 'react';
import { initData, useSignal } from '@tma.js/sdk-react';
import { useTranslation } from 'react-i18next';
import { telegramAuthHeaders } from '@/telegramAuth.ts';
import { localizedApiUrl } from '@/localization.ts';
import { BottleTagChart } from '@/components/BottleTagChart.tsx';
import { BottleReviewOverlay } from '@/components/BottleReviewOverlay.tsx';

const API_URL = 'https://paphos-whisky-api.onrender.com';
const PERSONAL_DATA_UNAVAILABLE = 'Favorites are temporarily unavailable. Please try again later.';
type I18nString = Partial<Record<'en' | 'ru' | 'uk', string>>;

type Bottle = {
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

type Distillery = { id: number; name: string; name_i18n?: I18nString; description_i18n?: I18nString };
type UserBottleState = { bottle_id: number; is_favorite: boolean; is_tried: boolean };
type FavoriteBottle = Bottle & { distilleryName: string };
type ToggleActionResponse = UserBottleState & { favorites_count: number; tried_count: number };

function BottleImage({
  alt,
  className,
  imageUrl,
}: {
  alt: string;
  className: string;
  imageUrl: string | null;
}) {
  return imageUrl
    ? <img alt={alt} className={className} src={imageUrl} />
    : <div aria-label={alt} className={`${className} flex items-center justify-center bg-gradient-to-br from-amber-700/70 to-slate-950 text-4xl`} role="img">🥃</div>;
}

async function getError(response: Response) {
  try {
    const payload: unknown = await response.json();
    if (typeof payload === 'object' && payload !== null && 'detail' in payload) {
      return String(payload.detail);
    }
  } catch {
    // Use the HTTP status below when the response has no JSON error body.
  }
  return `Server error: ${response.status}`;
}

function displayError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  return message.includes('Telegram auth is not configured')
    ? PERSONAL_DATA_UNAVAILABLE
    : message;
}

export function FavoritesTab() {
  const { i18n, t } = useTranslation();
  const initDataState = useSignal(initData.state);
  const initDataRaw = useSignal(initData.raw);
  const telegramId = initDataState?.user?.id;
  const languageCode = i18n.language;
  const [favoriteBottles, setFavoriteBottles] = useState<FavoriteBottle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingBottleId, setIsUpdatingBottleId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedBottleId, setExpandedBottleId] = useState<number | null>(null);
  const [isPhotoExpanded, setIsPhotoExpanded] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewRevision, setReviewRevision] = useState(0);

  useEffect(() => {
    const loadFavorites = async () => {
      if (!telegramId) {
        setFavoriteBottles([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const [bottlesResponse, distilleriesResponse, statesResponse] = await Promise.all([
          fetch(localizedApiUrl(`${API_URL}/api/bottles`, languageCode)),
          fetch(localizedApiUrl(`${API_URL}/api/distilleries`, languageCode)),
          fetch(`${API_URL}/api/bottles/user-states?telegram_id=${encodeURIComponent(telegramId)}`, {
            headers: telegramAuthHeaders(initDataRaw),
          }),
        ]);
        if (!bottlesResponse.ok) throw new Error(await getError(bottlesResponse));
        if (!distilleriesResponse.ok) throw new Error(await getError(distilleriesResponse));
        if (!statesResponse.ok) throw new Error(await getError(statesResponse));

        const [bottles, distilleries, states] = await Promise.all([
          bottlesResponse.json() as Promise<Bottle[]>,
          distilleriesResponse.json() as Promise<Distillery[]>,
          statesResponse.json() as Promise<UserBottleState[]>,
        ]);
        const statesByBottle = Object.fromEntries(states.map((state) => [state.bottle_id, state])) as Record<number, UserBottleState>;
        const distilleryNames = new Map(distilleries.map((distillery) => [distillery.id, distillery.name]));
        setFavoriteBottles(bottles
          .filter((bottle) => statesByBottle[bottle.id]?.is_favorite)
          .map((bottle) => ({
            ...bottle,
            distilleryName: bottle.distillery_id
              ? distilleryNames.get(bottle.distillery_id) ?? t('bottle.independent')
              : t('bottle.independent'),
          })));
      } catch (loadError) {
        setError(displayError(loadError, 'Could not load favorites.'));
      } finally {
        setIsLoading(false);
      }
    };

    void loadFavorites();
  }, [initDataRaw, languageCode, t, telegramId]);

  const closeBottle = () => {
    setIsPhotoExpanded(false);
    setExpandedBottleId(null);
    setIsReviewOpen(false);
  };
  const expandedBottle = useMemo(
    () => favoriteBottles.find((bottle) => bottle.id === expandedBottleId),
    [expandedBottleId, favoriteBottles],
  );

  const toggleAction = async (bottle: FavoriteBottle, actionType: 'favorite' | 'tried') => {
    if (!telegramId) {
      setError(t('bottle.open_telegram_to_save_marks'));
      return;
    }

    setIsUpdatingBottleId(bottle.id);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/bottles/${bottle.id}/toggle-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...telegramAuthHeaders(initDataRaw) },
        body: JSON.stringify({ telegram_id: telegramId, action_type: actionType }),
      });
      if (!response.ok) throw new Error(await getError(response));

      const result = await response.json() as ToggleActionResponse;
      setFavoriteBottles((current) => result.is_favorite
        ? current.map((item) => item.id === bottle.id
          ? { ...item, favorites_count: result.favorites_count, tried_count: result.tried_count }
          : item)
        : current.filter((item) => item.id !== bottle.id));
      if (actionType === 'favorite' && !result.is_favorite) {
        closeBottle();
      }
    } catch (toggleError) {
      setError(displayError(toggleError, 'Could not update this bottle.'));
    } finally {
      setIsUpdatingBottleId(null);
    }
  };

  if (!telegramId) {
    return <section className="flex min-h-[calc(100vh-7rem)] items-center justify-center"><p className="max-w-xs text-center text-sm leading-6 text-slate-400">{t('bottle.open_telegram_to_view_favorites')}</p></section>;
  }
  if (isLoading) return <p className="pt-12 text-center text-sm text-slate-400">{t('common.loading')}</p>;
  if (error && favoriteBottles.length === 0) return <p className="pt-12 text-center text-sm text-red-300">{error}</p>;

  return (
    <section className="mx-auto w-full max-w-md pt-[calc(env(safe-area-inset-top)+1rem)]">
      {error && <p className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</p>}
      {favoriteBottles.length === 0 ? (
        <div className="flex min-h-[calc(100vh-14rem)] items-center justify-center text-center">
          <div className="max-w-xs"><div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-3xl text-slate-500">☆</div><h2 className="text-xl font-semibold text-white">{t('favorites.empty_title')}</h2><p className="mt-3 text-sm leading-6 text-slate-400">{t('favorites.empty_description')}</p></div>
        </div>
      ) : (
        <ul className="space-y-3">
          {favoriteBottles.map((bottle) => (
            <li key={bottle.id}>
              <button
                className="relative w-full overflow-hidden rounded-2xl border border-amber-400/15 bg-slate-800/70 text-left transition-colors hover:bg-slate-800"
                onClick={() => { setIsPhotoExpanded(false); setExpandedBottleId(bottle.id); setIsReviewOpen(false); }}
                type="button"
              >
                {bottle.background_url && <img alt="" className="pointer-events-none absolute bottom-1 right-6 z-0 h-[90%] w-auto object-contain opacity-35" src={bottle.background_url} style={{ maskImage: 'linear-gradient(to left, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)', WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)' }} />}
                <span className="relative z-10 flex items-center gap-3 p-4">
                  <BottleImage alt="" className="h-14 w-12 shrink-0 rounded-lg object-cover" imageUrl={bottle.image_url} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-base font-semibold text-white">{bottle.name}</span><span className="mt-1 block text-sm text-amber-400">{bottle.distilleryName}</span><span className="mt-2 block text-xs text-slate-400">{[bottle.age, bottle.abv].filter(Boolean).join(' · ')}</span></span>
                  <span aria-label={t('bottle.favorite')} className="text-xl text-amber-400">★</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {expandedBottle && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 bg-slate-950/95 p-4 backdrop-blur-sm"
          onClick={() => { if (isPhotoExpanded) setIsPhotoExpanded(false); }}
          style={{ top: '40px', height: 'calc(100vh - 40px)' }}
        >
          <article className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden rounded-3xl border border-amber-100/10 bg-slate-900 shadow-2xl shadow-black/50">
            <div
              className={`relative shrink-0 overflow-hidden ${isPhotoExpanded ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
              onClick={(event) => { event.stopPropagation(); setIsPhotoExpanded((current) => !current); }}
              style={{ height: isPhotoExpanded ? '55vh' : '200px', maxHeight: '60vh', transition: 'all 0.3s ease-in-out' }}
            >
              <div className="flex h-full items-center justify-center rounded-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#C5A059]/20 via-[#16161A]/50 to-transparent py-6"><BottleImage alt={expandedBottle.name} className="h-full w-full object-contain drop-shadow-[0_10px_15px_rgba(0,0,0,0.8)]" imageUrl={expandedBottle.image_url} /></div>
              <button aria-label={t('bottle.close_details')} className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/80 text-xl text-white backdrop-blur transition-colors hover:bg-slate-700" onClick={(event) => { event.stopPropagation(); closeBottle(); }} type="button">✕</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-6 pb-4">
              <p className="text-sm font-semibold text-amber-400">{expandedBottle.distilleryName}</p>
              <div className="mb-4 mt-3 flex items-baseline justify-between gap-4"><h2 className="min-w-0 font-serif text-2xl font-bold text-[#F4F4F5]">{expandedBottle.name}</h2><span className="shrink-0 text-xl font-semibold text-[#C5A059]">€{expandedBottle.price_per_sample}</span></div>
              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-slate-800 p-3"><dt className="text-slate-400">{t('bottle.age')}</dt><dd className="mt-1 font-semibold text-white">{expandedBottle.age || t('bottle.nas')}</dd></div><div className="rounded-xl bg-slate-800 p-3"><dt className="text-slate-400">{t('bottle.abv')}</dt><dd className="mt-1 font-semibold text-white">{expandedBottle.abv || t('common.na')}</dd></div></dl>
              <BottleTagChart bottleId={expandedBottle.id} refreshRevision={reviewRevision} />
              <p className="mt-5 text-sm leading-7 text-slate-300" style={{ whiteSpace: 'pre-wrap' }}>{expandedBottle.description}</p>
            </div>
            <div className="flex gap-3 border-t border-white/10 bg-slate-900 p-4">
              <button aria-label={t('bottle.favorites')} className="rounded-xl border border-[#C5A059]/30 bg-[#C5A059]/10 p-3.5 text-[#C5A059] transition-all hover:bg-[#C5A059]/20 disabled:cursor-not-allowed disabled:opacity-60" disabled={isUpdatingBottleId === expandedBottle.id} onClick={(event) => { event.stopPropagation(); void toggleAction(expandedBottle, 'favorite'); }} type="button"><svg aria-hidden="true" className="h-5 w-5" fill="currentColor" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M6 3.75A1.75 1.75 0 0 1 7.75 2h8.5A1.75 1.75 0 0 1 18 3.75V22l-6-3.5L6 22V3.75Z" /></svg></button>
              <button
                className="flex-1 rounded-xl bg-[#C5A059] py-3.5 text-sm font-semibold uppercase tracking-wider text-black shadow-[0_0_15px_rgba(197,160,89,0.3)] transition-all hover:bg-[#b59049]"
                onClick={(event) => {
                  event.stopPropagation();
                  if (!telegramId) {
                    setError(t('bottle.open_telegram_to_write_review'));
                    return;
                  }
                  setIsReviewOpen(true);
                }}
                type="button"
              >
                {t('bottle.review')}
              </button>
            </div>
          </article>
        </div>
      )}
      {isReviewOpen && expandedBottle && telegramId !== undefined && (
        <BottleReviewOverlay
          bottleId={expandedBottle.id}
          initDataRaw={initDataRaw}
          onClose={() => setIsReviewOpen(false)}
          onSaved={() => setReviewRevision((current) => current + 1)}
          telegramId={telegramId}
        />
      )}
    </section>
  );
}
