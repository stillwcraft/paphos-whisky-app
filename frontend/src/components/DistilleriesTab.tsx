import { useState } from 'react';

export type Bottle = {
  id: number;
  name: string;
  age: number;
  abv: number;
};

export type Distillery = {
  id: number;
  name: string;
  bottles: Bottle[];
};

type DistilleriesTabProps = {
  favorites: Array<string | number>;
  toggleFavorite: (bottleId: string | number) => void;
};

export const distilleries: Distillery[] = [
  {
    id: 1,
    name: 'The Macallan',
    bottles: [
      { id: 101, name: 'Sherry Oak 12 Years Old', age: 12, abv: 40 },
      { id: 102, name: 'Double Cask 15 Years Old', age: 15, abv: 43 },
      { id: 103, name: 'Rare Cask', age: 18, abv: 43 },
    ],
  },
  {
    id: 2,
    name: 'Springbank',
    bottles: [
      { id: 201, name: 'Springbank 10 Years Old', age: 10, abv: 46 },
      { id: 202, name: 'Springbank 15 Years Old', age: 15, abv: 46 },
      { id: 203, name: 'Springbank 18 Years Old', age: 18, abv: 46 },
    ],
  },
  {
    id: 3,
    name: 'Port Charlotte',
    bottles: [
      { id: 301, name: 'Port Charlotte 10', age: 10, abv: 50 },
      { id: 302, name: 'Islay Barley 2014', age: 8, abv: 50 },
      { id: 303, name: 'SC: 01 2012', age: 9, abv: 55.2 },
    ],
  },
];

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`h-5 w-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function StarIcon({ isFavorite }: { isFavorite: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={isFavorite ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="m12 3.5 2.63 5.33 5.88.85-4.25 4.14 1 5.85L12 16.9l-5.26 2.77 1-5.85-4.25-4.14 5.88-.85L12 3.5Z" />
    </svg>
  );
}

export function DistilleriesTab({ favorites, toggleFavorite }: DistilleriesTabProps) {
  const [openDistilleryId, setOpenDistilleryId] = useState<number | null>(null);

  const toggleDistillery = (distilleryId: number) => {
    setOpenDistilleryId((currentId) => currentId === distilleryId ? null : distilleryId);
  };

  return (
    <section className="mx-auto w-full max-w-md pt-8">
      <header className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">Whisky Club</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Дистиллерии</h1>
      </header>

      <div className="space-y-3">
        {distilleries.map((distillery) => {
          const isOpen = openDistilleryId === distillery.id;
          const panelId = `distillery-${distillery.id}-bottles`;

          return (
            <article key={distillery.id} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-800/70">
              <h2>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggleDistillery(distillery.id)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left text-base font-semibold text-white transition-colors hover:bg-white/5"
                >
                  {distillery.name}
                  <ChevronIcon isOpen={isOpen} />
                </button>
              </h2>
              <div
                id={panelId}
                className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
              >
                <div className="overflow-hidden">
                  <ul className="border-t border-white/10 px-5 py-1">
                    {distillery.bottles.map((bottle) => {
                      const isFavorite = favorites.includes(bottle.id);

                      return (
                        <li key={bottle.id} className="flex items-center gap-3 border-b border-white/5 py-3 last:border-0">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-100">{bottle.name}</p>
                            <p className="mt-1 text-xs text-slate-400">{bottle.age} лет · {bottle.abv}% ABV</p>
                          </div>
                          <button
                            type="button"
                            aria-label={isFavorite ? `Удалить ${bottle.name} из избранного` : `Добавить ${bottle.name} в избранное`}
                            onClick={() => toggleFavorite(bottle.id)}
                            className={`rounded-lg p-2 transition-colors hover:bg-white/5 ${
                              isFavorite ? 'text-yellow-400' : 'text-gray-400 hover:text-slate-200'
                            }`}
                          >
                            <StarIcon isFavorite={isFavorite} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}