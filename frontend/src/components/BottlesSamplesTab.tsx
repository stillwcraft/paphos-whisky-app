import { useEffect, useState } from 'react';

const API_URL = 'https://paphos-whisky-api.onrender.com';

type BottleLabel = 'bottle' | 'samples' | 'event';

type ShopItem = {
  id: number;
  name: string;
  distillery_id: number | null;
  label: BottleLabel;
  price_per_sample: number;
  description: string;
  image_url: string | null;
};

const labelTitles: Record<BottleLabel, string> = {
  bottle: 'Bottle',
  samples: 'Samples',
  event: 'Event',
};

export function BottlesSamplesTab() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadItems = async () => {
      try {
        const response = await fetch(`${API_URL}/api/bottles`);
        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }
        const bottles = await response.json() as ShopItem[];
        setItems(bottles.filter((bottle) => bottle.distillery_id === null));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load bottles.');
      } finally {
        setIsLoading(false);
      }
    };

    void loadItems();
  }, []);

  return (
    <section className="mx-auto w-full max-w-md pt-8">
      <header className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">Whisky Club</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Bottles & Samples</h1>
      </header>
      {isLoading ? (
        <p className="text-center text-sm text-slate-400">Loading bottles...</p>
      ) : error ? (
        <p className="text-center text-sm text-red-300">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-center text-sm text-slate-400">New bottles and samples will appear soon.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2">
          {items.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-2xl bg-slate-800 shadow-lg shadow-black/20">
              <div className="relative h-40">
                {item.image_url ? (
                  <img alt={item.name} className="h-full w-full object-cover" src={item.image_url} />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-amber-700/70 to-slate-950 text-4xl">🥃</div>
                )}
                <span className="absolute left-3 top-3 rounded-full bg-amber-400 px-2.5 py-1 text-[10px] font-semibold text-slate-950">
                  {labelTitles[item.label]}
                </span>
              </div>
              <div className="flex min-h-44 flex-col p-4">
                <h2 className="text-sm font-semibold text-white">{item.name}</h2>
                <p className="mt-2 text-xs leading-5 text-slate-400" style={{ whiteSpace: 'pre-wrap' }}>{item.description}</p>
                <span className="mt-auto pt-4 text-xl font-bold text-amber-400">€{item.price_per_sample}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
