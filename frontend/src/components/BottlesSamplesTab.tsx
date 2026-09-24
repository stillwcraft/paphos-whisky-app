import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { localizedApiUrl } from '@/localization.ts';
import { normalizePaginatedResponse, paginatedUrl, type PaginatedResponse, useInfiniteScroll } from '@/pagination.ts';

const API_URL = 'https://paphos-whisky-api.onrender.com';

type BottleLabel = 'bottle' | 'samples' | 'event';
type I18nString = Partial<Record<'en' | 'ru' | 'uk', string>>;

type ShopItem = {
  id: number;
  name: string;
  name_i18n?: I18nString;
  distillery_id: number | null;
  label: BottleLabel;
  age: string | null;
  abv: string | null;
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
  className,
  imageUrl,
}: {
  className: string;
  imageUrl: string | null;
}) {
  if (!imageUrl) {
    return <div aria-hidden="true" className={`${className} flex items-center justify-center bg-gradient-to-br from-amber-700/70 to-slate-950 text-4xl`}>🥃</div>;
  }

  return <img alt="" className={className} src={imageUrl} />;
}

export function BottlesSamplesTab() {
  const { i18n, t } = useTranslation();
  const languageCode = i18n.language;
  const [items, setItems] = useState<ShopItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedBottleId, setFocusedBottleId] = useState<number | null>(null);
  const [blurredCardId, setBlurredCardId] = useState<number | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadItems = useCallback(async (offset: number, replace = false) => {
    if (replace) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    try {
      const response = await fetch(localizedApiUrl(
        paginatedUrl(`${API_URL}/api/bottles?independent_only=true`, 24, offset),
        languageCode,
      ));
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      const page = normalizePaginatedResponse(await response.json() as PaginatedResponse<ShopItem> | ShopItem[]);
      const independentBottles = page.items.filter((bottle) => bottle.distillery_id === null);
      setItems((current) => replace ? independentBottles : [...current, ...independentBottles]);
      setHasMore(page.has_more);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load bottles.');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [languageCode]);

  useEffect(() => {
    void loadItems(0, true);
  }, [loadItems]);

  const loadMore = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      void loadItems(items.length);
    }
  }, [hasMore, isLoadingMore, items.length, loadItems]);
  const sentinelRef = useInfiniteScroll(loadMore, hasMore && !isLoading && !isLoadingMore, scrollRef);

  const updateFocusedBottle = useCallback(() => {
    const root = scrollRef.current;
    if (!root) return;

    const center = root.getBoundingClientRect().top + root.clientHeight / 2;
    let nearestId: number | null = null;
    let nearestDistance = Infinity;
    root.querySelectorAll<HTMLElement>('[data-bottle-id]').forEach((card) => {
      const bounds = card.getBoundingClientRect();
      const distance = Math.abs(bounds.top + bounds.height / 2 - center);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestId = Number(card.dataset.bottleId);
      }
    });
    setFocusedBottleId(nearestId);
  }, []);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const centerMargin = Math.max(0, (root.clientHeight - 4) / 2);
    const observer = new IntersectionObserver(updateFocusedBottle, {
      root,
      rootMargin: `-${centerMargin}px 0px -${centerMargin}px 0px`,
    });

    root.querySelectorAll('[data-bottle-id]').forEach((card) => observer.observe(card));
    updateFocusedBottle();
    return () => observer.disconnect();
  }, [items, isLoading, updateFocusedBottle]);

  useEffect(() => () => {
    if (scrollTimerRef.current !== null) clearTimeout(scrollTimerRef.current);
  }, []);

  const handleScroll = () => {
    setIsScrolling(true);
    updateFocusedBottle();
    if (scrollTimerRef.current !== null) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      setIsScrolling(false);
      scrollTimerRef.current = null;
    }, 150);
  };

  return (
    <section className="mx-auto w-full max-w-md pt-[calc(env(safe-area-inset-top)+1rem)]">
      {isLoading ? (
        <p className="text-center text-sm text-slate-400">{t('common.loading')}</p>
      ) : error ? (
        <p className="text-center text-sm text-red-300">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-center text-sm text-slate-400">{t('bottle.no_items')}</p>
      ) : (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-[calc(100vh-80px)] -space-y-28 overflow-y-scroll overscroll-contain snap-y snap-mandatory"
          style={{
            paddingTop: 'max(0px, calc((100vh - 80px - 520px) / 2))',
            paddingBottom: 'max(7rem, calc((100vh - 80px - 520px) / 2))',
          }}
        >
          {items.map((bottle, index) => {
            const isFocused = focusedBottleId === bottle.id && !isScrolling;
            const isBlurred = blurredCardId === bottle.id;
            return (
              <div
                key={bottle.id}
                data-bottle-id={bottle.id}
                className="pointer-events-none relative flex h-[520px] snap-center items-center justify-center"
                style={{ zIndex: isFocused ? items.length + 1 : items.length - index }}
              >
                <motion.div
                  role="button"
                  tabIndex={0}
                  aria-label={isBlurred ? t('bottle.close_details') : t('bottle.open_details', { name: bottle.name })}
                  aria-pressed={isBlurred}
                  onClick={() => setBlurredCardId((current) => current === bottle.id ? null : bottle.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setBlurredCardId((current) => current === bottle.id ? null : bottle.id);
                    }
                  }}
                  animate={{ rotate: isFocused ? 0 : index % 2 === 0 ? 6 : -6, scale: isFocused ? 1.05 : 0.92, opacity: isFocused ? 1 : 0.8 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 24 }}
                  className={`pointer-events-auto relative h-[460px] w-[calc(100%-2rem)] max-w-sm overflow-hidden rounded-3xl bg-[#16161A] text-left shadow-xl shadow-black/40 ${
                    isFocused ? 'ring-2 ring-[#C5A059]' : 'ring-1 ring-[#C5A059]/20'
                  }`}
                >
                  <BottleImage imageUrl={bottle.image_url} className={`h-full w-full object-cover transition-[filter] duration-300 ${isBlurred ? 'blur-xl brightness-50' : ''}`} />
                  {isBlurred ? (
                    <div className="absolute inset-0 flex flex-col overflow-y-auto bg-black/20 p-6 text-white">
                      <span className="w-fit rounded-full border border-[#C5A059]/40 bg-black/50 px-3 py-1 text-xs font-semibold text-[#C5A059]">{t(labelTitleKeys[bottle.label])}</span>
                      <h2 className="mt-6 text-2xl font-semibold">{bottle.name}</h2>
                      <p className="mt-2 text-sm text-[#C5A059]">{t('bottle.independent')}</p>
                      <div className="mt-6 flex flex-wrap gap-3 text-sm">
                        <span>{t('bottle.age')}: {bottle.age || t('bottle.nas')}</span>
                        {bottle.abv && <span>{t('bottle.abv')}: {bottle.abv}</span>}
                      </div>
                      <p className="mt-5 text-xl font-bold text-[#C5A059]">{t('bottle.sample_price')}: €{bottle.price_per_sample}</p>
                      <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-200">{bottle.description || t('bottle.description_soon')}</p>
                      <span className="mt-auto pt-6 text-center text-sm font-medium text-[#C5A059]">{t('bottle.tap_again_to_close')}</span>
                    </div>
                  ) : (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-6 pt-20 text-white">
                      <h2 className="text-xl font-semibold">{bottle.name}</h2>
                      <p className="mt-2 text-sm text-[#C5A059]">{t('bottle.tap_for_details')}</p>
                    </div>
                  )}
                </motion.div>
              </div>
            );
          })}
          {hasMore && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
          {isLoadingMore && <p className="py-3 text-center text-sm text-slate-400">{t('common.loading')}</p>}
        </div>
      )}
    </section>
  );
}
