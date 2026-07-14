import { distilleries, type Bottle } from '@/components/DistilleriesTab.tsx';

type FavoritesTabProps = {
  favorites: Array<string | number>;
  toggleFavorite: (bottleId: string | number) => void;
};

type FavoriteBottle = Bottle & {
  distilleryName: string;
};

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
      <path d="m12 3.5 2.63 5.33 5.88.85-4.25 4.14 1 5.85L12 16.9l-5.26 2.77 1-5.85-4.25-4.14 5.88-.85L12 3.5Z" />
    </svg>
  );
}

export function FavoritesTab({ favorites, toggleFavorite }: FavoritesTabProps) {
  const favoriteBottles: FavoriteBottle[] = distilleries
    .flatMap((distillery) => distillery.bottles.map((bottle) => ({
      ...bottle,
      distilleryName: distillery.name,
    })))
    .filter((bottle) => favorites.includes(bottle.id));

  if (favoriteBottles.length === 0) {
    return (
      <section className="flex min-h-[calc(100vh-7rem)] items-center justify-center">
        <div className="max-w-xs text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-3xl text-slate-500">
            ☆
          </div>
          <h1 className="text-xl font-semibold text-white">Избранное пока пусто</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Вы еще не добавили ни одной бутылки. Сделайте это во вкладке Дистиллерии.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-md pt-8">
      <header className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">Whisky Club</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Избранные бутылки</h1>
      </header>

      <ul className="space-y-3">
        {favoriteBottles.map((bottle) => (
          <li key={bottle.id} className="flex items-center gap-3 rounded-2xl border border-amber-400/15 bg-slate-800/70 p-4">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold text-white">{bottle.name}</h2>
              <p className="mt-1 text-sm text-amber-400">{bottle.distilleryName}</p>
              <p className="mt-2 text-xs text-slate-400">{bottle.age} лет · {bottle.abv}% ABV</p>
            </div>
            <button
              type="button"
              aria-label={`Удалить ${bottle.name} из избранного`}
              onClick={() => toggleFavorite(bottle.id)}
              className="rounded-lg p-2 text-yellow-400 transition-colors hover:bg-white/5 hover:text-yellow-300"
            >
              <StarIcon />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}