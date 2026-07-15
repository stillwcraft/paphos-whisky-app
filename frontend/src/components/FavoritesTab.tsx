import { useEffect, useMemo, useState } from 'react';
import { initData, useSignal } from '@tma.js/sdk-react';

const API_URL = 'https://paphos-whisky-api.onrender.com';

type Bottle = {
  id: number;
  name: string;
  distillery_id: number | null;
  age: string | null;
  abv: string | null;
  price_per_sample: number;
  description: string;
  image_url: string | null;
  favorites_count: number;
  tried_count: number;
};

type Distillery = { id: number; name: string };
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

export function FavoritesTab() {
  const initDataState = useSignal(initData.state);
  const telegramId = initDataState?.user?.id;
  const [favoriteBottles, setFavoriteBottles] = useState<FavoriteBottle[]>([]);
  const [userStates, setUserStates] = useState<Record<number, UserBottleState>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingBottleId, setIsUpdatingBottleId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedBottleId, setExpandedBottleId] = useState<number | null>(null);
  const [isPhotoExpanded, setIsPhotoExpanded] = useState(false);

  useEffect(() => {
    const loadFavorites = async () => {
      if (!telegramId) {
        setFavoriteBottles([]);
        setUserStates({});
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const [bottlesResponse, distilleriesResponse, statesResponse] = await Promise.all([
          fetch(`${API_URL}/api/bottles`),
          fetch(`${API_URL}/api/distilleries`),
          fetch(`${API_URL}/api/bottles/user-states?telegram_id=${encodeURIComponent(telegramId)}`),
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
        setUserStates(statesByBottle);
        setFavoriteBottles(bottles
          .filter((bottle) => statesByBottle[bottle.id]?.is_favorite)
          .map((bottle) => ({ ...bottle, distilleryName: bottle.distillery_id ? distilleryNames.get(bottle.distillery_id) ?? 'Independent bottle' : 'Independent bottle' })));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load favorites.');
      } finally {
        setIsLoading(false);
      }
    };

    void loadFavorites();
  }, [telegramId]);

  const closeBottle = () => {
    setIsPhotoExpanded(false);
    setExpandedBottleId(null);
  };
  const expandedBottle = useMemo(
    () => favoriteBottles.find((bottle) => bottle.id === expandedBottleId),
    [expandedBottleId, favoriteBottles],
  );

  const toggleAction = async (bottle: FavoriteBottle, actionType: 'favorite' | 'tried') => {
    if (!telegramId) {
      setError('Open the app in Telegram to save bottle marks.');
      return;
    }

    setIsUpdatingBottleId(bottle.id);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/bottles/${bottle.id}/toggle-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_id: telegramId, action_type: actionType }),
      });
      if (!response.ok) throw new Error(await getError(response));

      const result = await response.json() as ToggleActionResponse;
      setUserStates((current) => ({
        ...current,
        [bottle.id]: {
          bottle_id: bottle.id,
          is_favorite: result.is_favorite,
          is_tried: result.is_tried,
        },
      }));
      setFavoriteBottles((current) => result.is_favorite
        ? current.map((item) => item.id === bottle.id
          ? { ...item, favorites_count: result.favorites_count, tried_count: result.tried_count }
          : item)
        : current.filter((item) => item.id !== bottle.id));
      if (actionType === 'favorite' && !result.is_favorite) {
        closeBottle();
      }
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Could not update this bottle.');
    } finally {
      setIsUpdatingBottleId(null);
    }
  };

  if (!telegramId) {
    return <section className="flex min-h-[calc(100vh-7rem)] items-center justify-center"><p className="max-w-xs text-center text-sm leading-6 text-slate-400">Open the app in Telegram to view your favorites.</p></section>;
  }
  if (isLoading) return <p className="pt-12 text-center text-sm text-slate-400">Loading favorites...</p>;
  if (error && favoriteBottles.length === 0) return <p className="pt-12 text-center text-sm text-red-300">{error}</p>;

  return (
    <section className="mx-auto w-full max-w-md pt-8">
      <header className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">Whisky Club</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Favorites</h1>
      </header>
      {error && <p className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</p>}
      {favoriteBottles.length === 0 ? (
        <div className="flex min-h-[calc(100vh-14rem)] items-center justify-center text-center">
          <div className="max-w-xs"><div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-3xl text-slate-500">☆</div><h2 className="text-xl font-semibold text-white">Favorites are empty</h2><p className="mt-3 text-sm leading-6 text-slate-400">Add bottles from the Distilleries tab to see them here.</p></div>
        </div>
      ) : (
        <ul className="space-y-3">
          {favoriteBottles.map((bottle) => (
            <li key={bottle.id}>
              <button
                className="flex w-full items-center gap-3 rounded-2xl border border-amber-400/15 bg-slate-800/70 p-4 text-left transition-colors hover:bg-slate-800"
                onClick={() => { setIsPhotoExpanded(false); setExpandedBottleId(bottle.id); }}
                type="button"
              >
                <BottleImage alt="" className="h-14 w-12 shrink-0 rounded-lg object-cover" imageUrl={bottle.image_url} />
                <span className="min-w-0 flex-1"><span className="block truncate text-base font-semibold text-white">{bottle.name}</span><span className="mt-1 block text-sm text-amber-400">{bottle.distilleryName}</span><span className="mt-2 block text-xs text-slate-400">{[bottle.age, bottle.abv].filter(Boolean).join(' · ')}</span></span>
                <span aria-label="Favorite" className="text-xl text-amber-400">★</span>
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
              <BottleImage alt={expandedBottle.name} className="h-full w-full object-contain" imageUrl={expandedBottle.image_url} />
              <button aria-label="Close bottle details" className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/80 text-xl text-white backdrop-blur transition-colors hover:bg-slate-700" onClick={(event) => { event.stopPropagation(); closeBottle(); }} type="button">✕</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-6 pb-4">
              <p className="text-sm font-semibold text-amber-400">{expandedBottle.distilleryName}</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">{expandedBottle.name}</h2>
              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-slate-800 p-3"><dt className="text-slate-400">Age</dt><dd className="mt-1 font-semibold text-white">{expandedBottle.age || 'NAS'}</dd></div><div className="rounded-xl bg-slate-800 p-3"><dt className="text-slate-400">ABV</dt><dd className="mt-1 font-semibold text-white">{expandedBottle.abv || '—'}</dd></div></dl>
              <p className="mt-5 text-lg font-semibold text-amber-400">€{expandedBottle.price_per_sample}</p>
              <p className="mt-5 text-sm leading-7 text-slate-300" style={{ whiteSpace: 'pre-wrap' }}>{expandedBottle.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-white/10 bg-slate-900 p-4">
              <button className="rounded-xl border border-amber-300 bg-amber-400 px-3 py-3 text-sm font-semibold text-slate-950 transition-colors disabled:cursor-not-allowed disabled:opacity-60" disabled={isUpdatingBottleId === expandedBottle.id} onClick={(event) => { event.stopPropagation(); void toggleAction(expandedBottle, 'favorite'); }} type="button">⭐ Favorites {expandedBottle.favorites_count > 0 && `(${expandedBottle.favorites_count})`}</button>
              <button className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${userStates[expandedBottle.id]?.is_tried ? 'border-orange-300 bg-orange-400 text-slate-950' : 'border-slate-600 text-slate-100 hover:bg-white/5'}`} disabled={isUpdatingBottleId === expandedBottle.id} onClick={(event) => { event.stopPropagation(); void toggleAction(expandedBottle, 'tried'); }} type="button">🥃 Tried {expandedBottle.tried_count > 0 && `(${expandedBottle.tried_count})`}</button>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
