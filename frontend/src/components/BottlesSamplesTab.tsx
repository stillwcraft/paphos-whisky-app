import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localizedApiUrl } from '@/localization.ts';

const API_URL = 'https://paphos-whisky-api.onrender.com';

type BottleLabel = 'bottle' | 'samples' | 'event';
type I18nString = Partial<Record<'en' | 'ru' | 'uk', string>>;

type ShopItem = {
  id: number;
  name: string;
  name_i18n?: I18nString;
  distillery_id: number | null;
  label: BottleLabel;
  price_per_sample: number;
  description: string;
  description_i18n?: I18nString;
  image_url: string | null;
};

const labelTitleKeys: Record<BottleLabel, string> = {
  bottle: 'bottle.item_bottle',
  samples: 'bottle.item_samples',
  event: 'bottle.item_event',
};

function BottleImage({
  alt,
  className,
  imageUrl,
}: {
  alt: string;
  className: string;
  imageUrl: string | null;
}) {
  if (!imageUrl) {
    return <div aria-label={alt} className={`${className} flex items-center justify-center bg-gradient-to-br from-amber-700/70 to-slate-950 text-4xl`} role="img">🥃</div>;
  }

  return <img alt={alt} className={className} src={imageUrl} />;
}

export function BottlesSamplesTab() {
  const { i18n, t } = useTranslation();
  const languageCode = i18n.language;
  const [items, setItems] = useState<ShopItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBottleId, setExpandedBottleId] = useState<number | null>(null);
  const [isPhotoExpanded, setIsPhotoExpanded] = useState(false);

  useEffect(() => {
    const loadItems = async () => {
      try {
        const response = await fetch(localizedApiUrl(`${API_URL}/api/bottles`, languageCode));
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
  }, [languageCode]);

  const expandedBottle = useMemo(
    () => items.find((item) => item.id === expandedBottleId),
    [expandedBottleId, items],
  );
  const closeBottle = () => {
    setIsPhotoExpanded(false);
    setExpandedBottleId(null);
  };

  return (
    <section className="mx-auto w-full max-w-md pt-[env(safe-area-inset-top)]">
      {isLoading ? (
        <p className="text-center text-sm text-slate-400">{t('common.loading')}</p>
      ) : error ? (
        <p className="text-center text-sm text-red-300">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-center text-sm text-slate-400">{t('bottle.no_items')}</p>
      ) : (
        <div className="grid grid-cols-1 auto-rows-fr gap-4 min-[380px]:grid-cols-2">
          {items.map((item) => (
            <article
              key={item.id}
              className="flex h-full min-h-80 cursor-pointer flex-col overflow-hidden rounded-2xl bg-slate-800 shadow-lg shadow-black/20 transition-transform hover:-translate-y-0.5"
              onClick={() => {
                setIsPhotoExpanded(false);
                setExpandedBottleId(item.id);
              }}
            >
              <div className="relative h-40 shrink-0">
                <BottleImage alt={item.name} className="h-full w-full object-cover" imageUrl={item.image_url} />
                <span className="absolute left-3 top-3 rounded-full bg-amber-400 px-2.5 py-1 text-[10px] font-semibold text-slate-950">
                  {t(labelTitleKeys[item.label])}
                </span>
              </div>
              <div className="flex h-full flex-col p-4">
                <div>
                  <h2 className="text-sm font-semibold text-white">{item.name}</h2>
                  <p className="mt-2 text-xs leading-5 text-slate-400" style={{ whiteSpace: 'pre-wrap' }}>{item.description}</p>
                </div>
                <div className="mt-auto pt-4">
                  <span className="text-xl font-bold text-amber-400">€{item.price_per_sample}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {expandedBottle && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 bg-slate-950/95 p-4 backdrop-blur-sm"
          onClick={() => {
            if (isPhotoExpanded) {
              setIsPhotoExpanded(false);
            }
          }}
          style={{ top: '40px', height: 'calc(100vh - 40px)' }}
        >
          <article className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden rounded-3xl border border-amber-100/10 bg-slate-900 shadow-2xl shadow-black/50">
            <div
              className={`relative shrink-0 overflow-hidden ${isPhotoExpanded ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
              onClick={(event) => {
                event.stopPropagation();
                setIsPhotoExpanded((current) => !current);
              }}
              style={{
                height: isPhotoExpanded ? '55vh' : '200px',
                maxHeight: '60vh',
                transition: 'all 0.3s ease-in-out',
              }}
            >
              <BottleImage alt={expandedBottle.name} className="h-full w-full object-contain" imageUrl={expandedBottle.image_url} />
              <button
                aria-label={t('bottle.close_details')}
                className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/80 text-xl text-white backdrop-blur transition-colors hover:bg-slate-700"
                onClick={(event) => {
                  event.stopPropagation();
                  closeBottle();
                }}
                type="button"
              >
                ✕
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
              <div>
                <span className="inline-flex rounded-full bg-amber-400 px-2.5 py-1 text-xs font-semibold text-slate-950">
                  {t(labelTitleKeys[expandedBottle.label])}
                </span>
                <h2 className="mt-4 text-2xl font-semibold text-white">{expandedBottle.name}</h2>
                <p className="mt-5 text-sm leading-7 text-slate-300" style={{ whiteSpace: 'pre-wrap' }}>{expandedBottle.description}</p>
              </div>
              <div className="mt-auto border-t border-white/10 pt-5">
                <p className="text-xl font-bold text-amber-400">€{expandedBottle.price_per_sample}</p>
              </div>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
