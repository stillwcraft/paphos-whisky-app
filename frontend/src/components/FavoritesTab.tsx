import { useEffect, useState } from 'react';
import { initData, useSignal } from '@tma.js/sdk-react';

const API_URL = 'https://paphos-whisky-api.onrender.com';

type Bottle = {
  id: number;
  name: string;
  age: string | null;
  abv: string | null;
  image_url: string | null;
};

type Distillery = {
  id: number;
  name: string;
  bottles: Bottle[];
};

type UserBottleState = {
  bottle_id: number;
  is_favorite: boolean;
};

type FavoriteBottle = Bottle & {
  distilleryName: string;
};

export function FavoritesTab() {
  const initDataState = useSignal(initData.state);
  const telegramId = initDataState?.user?.id;
  const [favoriteBottles, setFavoriteBottles] = useState<FavoriteBottle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        const [distilleriesResponse, statesResponse] = await Promise.all([
          fetch(`${API_URL}/api/distilleries`),
          fetch(`${API_URL}/api/bottles/user-states?telegram_id=${encodeURIComponent(telegramId)}`),
        ]);
        if (!distilleriesResponse.ok || !statesResponse.ok) {
          throw new Error('Could not load favorites.');
        }

        const [distilleries, states] = await Promise.all([
          distilleriesResponse.json() as Promise<Distillery[]>,
          statesResponse.json() as Promise<UserBottleState[]>,
        ]);
        const favoriteIds = new Set(
          states.filter((state) => state.is_favorite).map((state) => state.bottle_id),
        );
        setFavoriteBottles(distilleries.flatMap((distillery) => distillery.bottles
          .filter((bottle) => favoriteIds.has(bottle.id))
          .map((bottle) => ({ ...bottle, distilleryName: distillery.name }))));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load favorites.');
      } finally {
        setIsLoading(false);
      }
    };

    void loadFavorites();
  }, [telegramId]);

  if (!telegramId) {
    return (
      <section className="flex min-h-[calc(100vh-7rem)] items-center justify-center">
        <p className="max-w-xs text-center text-sm leading-6 text-slate-400">Open the app in Telegram to view your favorites.</p>
      </section>
    );
  }

  if (isLoading) {
    return <p className="pt-12 text-center text-sm text-slate-400">Loading favorites...</p>;
  }

  if (error) {
    return <p className="pt-12 text-center text-sm text-red-300">{error}</p>;
  }

  if (favoriteBottles.length === 0) {
    return (
      <section className="flex min-h-[calc(100vh-7rem)] items-center justify-center">
        <div className="max-w-xs text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-3xl text-slate-500">☆</div>
          <h1 className="text-xl font-semibold text-white">Favorites are empty</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">Add bottles from the Distilleries tab to see them here.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-md pt-8">
      <header className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">Whisky Club</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Favorites</h1>
      </header>
      <ul className="space-y-3">
        {favoriteBottles.map((bottle) => (
          <li key={bottle.id} className="flex items-center gap-3 rounded-2xl border border-amber-400/15 bg-slate-800/70 p-4">
            {bottle.image_url ? (
              <img alt="" className="h-14 w-12 rounded-lg object-cover" src={bottle.image_url} />
            ) : (
              <div className="flex h-14 w-12 items-center justify-center rounded-lg bg-slate-700 text-xl">🥃</div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold text-white">{bottle.name}</h2>
              <p className="mt-1 text-sm text-amber-400">{bottle.distilleryName}</p>
              <p className="mt-2 text-xs text-slate-400">{[bottle.age, bottle.abv].filter(Boolean).join(' · ')}</p>
            </div>
            <span aria-label="Favorite" className="text-xl text-amber-400">★</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
