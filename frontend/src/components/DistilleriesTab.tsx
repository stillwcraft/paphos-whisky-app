import { useEffect, useState } from 'react';
import { initData, useSignal } from '@tma.js/sdk-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { telegramAuthHeaders } from '@/telegramAuth.ts';
import { localizedApiUrl } from '@/localization.ts';
import { BottleTagChart } from '@/components/BottleTagChart.tsx';
import { BottleReviewOverlay } from '@/components/BottleReviewOverlay.tsx';

const API_URL = 'https://paphos-whisky-api.onrender.com';
type I18nString = Partial<Record<'en' | 'ru' | 'uk', string>>;

type Bottle = {
  id: number;
  name: string;
  name_i18n?: I18nString;
  distillery_id: number;
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

type Distillery = {
  id: number;
  name: string;
  name_i18n?: I18nString;
  image_url: string | null;
  description: string | null;
  description_i18n?: I18nString;
  bottles: Bottle[];
};

type BottleActionState = {
  is_favorite: boolean;
  is_tried: boolean;
};

type ToggleActionResponse = BottleActionState & {
  bottle_id: number;
  favorites_count: number;
  tried_count: number;
};

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-5 w-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CatalogImage({
  alt,
  className,
  source,
}: {
  alt: string;
  className: string;
  source: string | null;
}) {
  if (!source) {
    return (
      <div
        aria-label={alt}
        className={`${className} flex items-center justify-center bg-gradient-to-br from-amber-700/70 via-slate-700 to-slate-950 text-4xl`}
        role="img"
      >
        🥃
      </div>
    );
  }

  return <img alt={alt} className={className} src={source} />;
}

async function errorMessage(response: Response) {
  try {
    const payload: unknown = await response.json();
    if (typeof payload === 'object' && payload !== null && 'detail' in payload) {
      return String(payload.detail);
    }
  } catch {
    // Fall through to the HTTP status when the response is not JSON.
  }

  return `Server error: ${response.status}`;
}

async function loadCatalog(languageCode: string | undefined): Promise<Distillery[]> {
  const distilleriesResponse = await fetch(localizedApiUrl(`${API_URL}/api/distilleries`, languageCode));
  if (!distilleriesResponse.ok) {
    throw new Error(await errorMessage(distilleriesResponse));
  }

  const loadedDistilleries = await distilleriesResponse.json() as Array<
    Omit<Distillery, 'bottles'> & { bottles?: Bottle[] }
  >;
  const needsBottleFallback = loadedDistilleries.some(
    (distillery) => !Array.isArray(distillery.bottles),
  );
  let fallbackBottles: Bottle[] = [];

  // Keep the storefront usable while an older deployed API still returns
  // distilleries without the new nested bottles field.
  if (needsBottleFallback) {
    const bottlesResponse = await fetch(localizedApiUrl(`${API_URL}/api/bottles`, languageCode));
    if (!bottlesResponse.ok) {
      throw new Error(await errorMessage(bottlesResponse));
    }
    fallbackBottles = await bottlesResponse.json() as Bottle[];
  }

  return loadedDistilleries.map((distillery) => ({
    ...distillery,
    bottles: Array.isArray(distillery.bottles)
      ? distillery.bottles
      : fallbackBottles.filter((bottle) => bottle.distillery_id === distillery.id),
  }));
}

export function DistilleriesTab({
  selectedBottleId = null,
  onSelectedBottleHandled,
  selectedDistilleryId = null,
  onSelectedDistilleryHandled,
}: {
  selectedBottleId?: number | null;
  onSelectedBottleHandled?: () => void;
  selectedDistilleryId?: number | null;
  onSelectedDistilleryHandled?: () => void;
}) {
  const { i18n, t } = useTranslation();
  const initDataState = useSignal(initData.state);
  const initDataRaw = useSignal(initData.raw);
  const languageCode = i18n.language;
  const telegramId = initDataState?.user?.id;
  const queryClient = useQueryClient();
  const [openDistilleryId, setOpenDistilleryId] = useState<number | null>(null);
  const [selectedDistillery, setSelectedDistillery] = useState<Distillery | null>(null);
  const [selectedBottle, setSelectedBottle] = useState<Bottle | null>(null);
  const [isPhotoExpanded, setIsPhotoExpanded] = useState(false);
  const [userStates, setUserStates] = useState<Record<number, BottleActionState>>({});
  const [isUpdatingBottleId, setIsUpdatingBottleId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewRevision, setReviewRevision] = useState(0);

  const catalogQuery = useQuery({
    queryKey: ['catalog', languageCode],
    queryFn: () => loadCatalog(languageCode),
    staleTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
  });
  const distilleries = catalogQuery.data ?? [];
  const catalogError = catalogQuery.error instanceof Error
    ? catalogQuery.error.message
    : catalogQuery.error
      ? 'Could not load the catalogue.'
      : null;

  useEffect(() => {
    if (selectedDistilleryId === null || catalogQuery.isLoading) {
      return;
    }

    const distillery = distilleries.find((item) => item.id === selectedDistilleryId);
    if (distillery) {
      setSelectedDistillery(distillery);
    }
    onSelectedDistilleryHandled?.();
  }, [
    catalogQuery.isLoading,
    distilleries,
    onSelectedDistilleryHandled,
    selectedDistilleryId,
  ]);

  useEffect(() => {
    if (selectedBottleId === null || catalogQuery.isLoading) {
      return;
    }

    const bottle = distilleries
      .flatMap((distillery) => distillery.bottles)
      .find((item) => item.id === selectedBottleId);
    if (bottle) {
      setIsPhotoExpanded(false);
      setSelectedBottle(bottle);
      setIsReviewOpen(false);
      onSelectedBottleHandled?.();
      return;
    }

    let isCancelled = false;
    const loadBottle = async () => {
      try {
        const response = await fetch(localizedApiUrl(`${API_URL}/api/bottles`, languageCode));
        if (!response.ok) {
          throw new Error(await errorMessage(response));
        }
        const loadedBottle = (await response.json() as Bottle[]).find(
          (item) => item.id === selectedBottleId,
        );
        if (!loadedBottle) {
          throw new Error('Bottle not found.');
        }
        if (!isCancelled) {
          setIsPhotoExpanded(false);
          setSelectedBottle(loadedBottle);
          setIsReviewOpen(false);
        }
      } catch (error) {
        if (!isCancelled) {
          setFeedback(error instanceof Error ? error.message : 'Could not load bottle.');
        }
      } finally {
        if (!isCancelled) {
          onSelectedBottleHandled?.();
        }
      }
    };
    void loadBottle();

    return () => {
      isCancelled = true;
    };
  }, [
    catalogQuery.isLoading,
    distilleries,
    languageCode,
    onSelectedBottleHandled,
    selectedBottleId,
  ]);

  useEffect(() => {
    const loadUserStates = async () => {
      if (!telegramId) {
        setUserStates({});
        return;
      }

      try {
        const statesResponse = await fetch(
          `${API_URL}/api/bottles/user-states?telegram_id=${encodeURIComponent(telegramId)}`,
          { headers: telegramAuthHeaders(initDataRaw) },
        );
        if (!statesResponse.ok) {
          throw new Error(await errorMessage(statesResponse));
        }

        const states = await statesResponse.json() as Array<BottleActionState & { bottle_id: number }>;
        setUserStates(Object.fromEntries(states.map((state) => [
          state.bottle_id,
          { is_favorite: state.is_favorite, is_tried: state.is_tried },
        ])));
      } catch {
        // Personal marks require configured Telegram server authentication.
        setUserStates({});
      }
    };

    void loadUserStates();
  }, [initDataRaw, telegramId]);

  const toggleAction = async (bottle: Bottle, actionType: 'favorite' | 'tried') => {
    if (!telegramId) {
      setFeedback(t('bottle.open_telegram_to_save_marks'));
      return;
    }

    setIsUpdatingBottleId(bottle.id);
    setFeedback(null);

    try {
      const response = await fetch(`${API_URL}/api/bottles/${bottle.id}/toggle-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...telegramAuthHeaders(initDataRaw) },
        body: JSON.stringify({ telegram_id: telegramId, action_type: actionType }),
      });
      if (!response.ok) {
        throw new Error(await errorMessage(response));
      }

      const result = await response.json() as ToggleActionResponse;
      setUserStates((current) => ({
        ...current,
        [bottle.id]: {
          is_favorite: result.is_favorite,
          is_tried: result.is_tried,
        },
      }));
      queryClient.setQueryData<Distillery[]>(['catalog', languageCode], (current) => current?.map((distillery) => ({
        ...distillery,
        bottles: distillery.bottles.map((currentBottle) => currentBottle.id === bottle.id
          ? {
            ...currentBottle,
            favorites_count: result.favorites_count,
            tried_count: result.tried_count,
          }
          : currentBottle),
      })));
      setSelectedBottle((current) => current?.id === bottle.id
        ? {
          ...current,
          favorites_count: result.favorites_count,
          tried_count: result.tried_count,
        }
        : current);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Could not update this bottle.');
    } finally {
      setIsUpdatingBottleId(null);
    }
  };

  const selectedBottleState = selectedBottle ? userStates[selectedBottle.id] : undefined;
  const closeBottleDetails = () => {
    setIsPhotoExpanded(false);
    setSelectedBottle(null);
    setIsReviewOpen(false);
  };

  return (
    <section className="mx-auto w-full max-w-md pb-5 pt-[calc(env(safe-area-inset-top)+1rem)]">
      {(feedback || catalogError) && (
        <p className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          {feedback || catalogError}
        </p>
      )}

      {catalogQuery.isLoading ? (
        <p className="text-center text-sm text-slate-400">{t('common.loading')}</p>
      ) : distilleries.length === 0 ? (
        <p className="text-center text-sm text-slate-400">{t('bottle.catalog_empty')}</p>
      ) : (
        <div className="space-y-4">
          {distilleries.map((distillery) => {
            const isOpen = openDistilleryId === distillery.id;
            const panelId = `distillery-${distillery.id}-bottles`;

            return (
              <article key={distillery.id} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-800/70 shadow-lg shadow-black/20">
                <button
                  aria-label={t('bottle.open_distillery_details', { name: distillery.name })}
                  className="block h-44 w-full overflow-hidden text-left"
                  onClick={() => setSelectedDistillery(distillery)}
                  type="button"
                >
                  <CatalogImage
                    alt={distillery.name}
                    className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                    source={distillery.image_url}
                  />
                </button>
                <div className="flex items-center justify-between gap-3 px-5 py-4">
                  <h2 className="min-w-0 truncate text-lg font-semibold text-white">{distillery.name}</h2>
                  <button
                    aria-controls={panelId}
                    aria-expanded={isOpen}
                    aria-label={t(isOpen ? 'bottle.hide_bottles' : 'bottle.show_bottles', { name: distillery.name })}
                    className="rounded-lg p-2 text-amber-400 transition-colors hover:bg-white/5"
                    onClick={() => setOpenDistilleryId((current) => current === distillery.id ? null : distillery.id)}
                    type="button"
                  >
                    <ChevronIcon isOpen={isOpen} />
                  </button>
                </div>
                <div
                  className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                  id={panelId}
                >
                  <div className="overflow-hidden">
                    {distillery.bottles.length === 0 ? (
                      <p className="border-t border-white/10 px-5 py-4 text-sm text-slate-400">{t('bottle.no_bottles')}</p>
                    ) : (
                      <ul className="border-t border-white/10 px-4 py-2">
                        {distillery.bottles.map((bottle) => (
                          <li key={bottle.id}>
                            <button
                              className="relative w-full overflow-hidden rounded-xl text-left transition-colors hover:bg-white/5"
                              onClick={() => {
                                setIsPhotoExpanded(false);
                                setSelectedBottle(bottle);
                                setIsReviewOpen(false);
                              }}
                              type="button"
                            >
                              {bottle.background_url && <img alt="" className="pointer-events-none absolute bottom-1 right-2 z-0 h-[90%] w-auto object-contain opacity-35" src={bottle.background_url} style={{ maskImage: 'linear-gradient(to left, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)', WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)' }} />}
                              <span className="relative z-10 flex items-center gap-3 px-1 py-3">
                                <CatalogImage
                                  alt=""
                                  className="h-14 w-12 shrink-0 rounded-lg object-cover"
                                  source={bottle.image_url}
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium text-slate-100">{bottle.name}</span>
                                  <span className="mt-1 block text-xs text-slate-400">
                                    {[bottle.age, bottle.abv].filter(Boolean).join(' · ') || t('bottle.whisky')}
                                  </span>
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {selectedDistillery && (
        <div className="fixed inset-x-0 bottom-0 top-10 z-40 bg-slate-950/95 p-4 backdrop-blur-sm">
          <article className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden rounded-3xl border border-amber-100/10 bg-slate-900 shadow-2xl shadow-black/50">
            <div className="relative">
              <CatalogImage alt={selectedDistillery.name} className="h-56 w-full object-cover" source={selectedDistillery.image_url} />
              <button
                aria-label={t('bottle.close_distillery_details')}
                className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/80 text-xl text-white backdrop-blur transition-colors hover:bg-slate-700"
                onClick={() => setSelectedDistillery(null)}
                type="button"
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <h2 className="text-2xl font-semibold text-white">{selectedDistillery.name}</h2>
              <p className="mt-5 text-sm leading-7 text-slate-300" style={{ whiteSpace: 'pre-wrap' }}>
                {selectedDistillery.description || t('bottle.description_soon')}
              </p>
            </div>
          </article>
        </div>
      )}

      {selectedBottle && (
        <div
          className="fixed inset-x-0 bottom-0 top-10 z-40 bg-slate-950/95 p-4 backdrop-blur-sm"
          onClick={() => {
            if (isPhotoExpanded) {
              setIsPhotoExpanded(false);
            }
          }}
        >
          <article className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden rounded-3xl border border-amber-100/10 bg-slate-900 shadow-2xl shadow-black/50">
            <div
              className="relative shrink-0 cursor-zoom-in overflow-hidden"
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
              {selectedBottle.image_url ? (
                <div className="flex h-full items-center justify-center rounded-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#C5A059]/20 via-[#16161A]/50 to-transparent py-6">
                  <img alt={selectedBottle.name} className="h-full w-full object-contain drop-shadow-[0_10px_15px_rgba(0,0,0,0.8)]" src={selectedBottle.image_url} />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center rounded-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#C5A059]/20 via-[#16161A]/50 to-transparent py-6"><CatalogImage alt={selectedBottle.name} className="h-full w-full object-contain drop-shadow-[0_10px_15px_rgba(0,0,0,0.8)]" source={null} /></div>
              )}
              <button
                aria-label={t('bottle.close_details')}
                className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/80 text-xl text-white backdrop-blur transition-colors hover:bg-slate-700"
                onClick={(event) => {
                  event.stopPropagation();
                  closeBottleDetails();
                }}
                type="button"
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-6 pb-4">
              <div className="mb-4 flex items-baseline justify-between gap-4"><h2 className="min-w-0 font-serif text-2xl font-bold text-[#F4F4F5]">{selectedBottle.name}</h2><span className="shrink-0 text-xl font-semibold text-[#C5A059]">€{selectedBottle.price_per_sample}</span></div>
              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="flex h-[78px] min-w-0 flex-col justify-between rounded-xl bg-slate-800 p-3">
                  <dt className="text-slate-400">{t('bottle.age')}</dt>
                  <dd className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-white">{selectedBottle.age || t('bottle.nas')}</dd>
                </div>
                <div className="flex h-[78px] min-w-0 flex-col justify-between rounded-xl bg-slate-800 p-3">
                  <dt className="text-slate-400">{t('bottle.abv')}</dt>
                  <dd className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-white">{selectedBottle.abv || t('common.na')}</dd>
                </div>
                <div className="flex h-[78px] min-w-0 flex-col justify-between rounded-xl bg-slate-800 p-3">
                  <dt className="text-slate-400">{t('bottle.cask')}</dt>
                  <dd
                    className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-white"
                    style={{ fontSize: selectedBottle.cask && selectedBottle.cask.length > 15 ? '11px' : '14px', lineHeight: 1.2 }}
                    title={selectedBottle.cask ?? undefined}
                  >
                    {selectedBottle.cask || t('common.na')}
                  </dd>
                </div>
                <div className="flex h-[78px] min-w-0 flex-col justify-between rounded-xl bg-slate-800 p-3">
                  <dt className="text-slate-400">{t('bottle.bottles')}</dt>
                  <dd className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-white" title={selectedBottle.bottles ?? undefined}>{selectedBottle.bottles || t('common.na')}</dd>
                </div>
              </dl>
              <BottleTagChart bottleId={selectedBottle.id} refreshRevision={reviewRevision} />
              <p className="mt-5 text-sm leading-7 text-slate-300" style={{ whiteSpace: 'pre-wrap' }}>{selectedBottle.description}</p>
            </div>
            <div className="flex gap-3 border-t border-white/10 bg-slate-900 p-4">
              <button
                aria-label={t('bottle.favorites')}
                className={`rounded-xl border border-[#C5A059]/30 p-3.5 text-[#C5A059] transition-all hover:bg-[#C5A059]/10 disabled:cursor-not-allowed disabled:opacity-60 ${selectedBottleState?.is_favorite ? 'bg-[#C5A059]/10' : ''}`}
                disabled={isUpdatingBottleId === selectedBottle.id}
                onClick={() => void toggleAction(selectedBottle, 'favorite')}
                type="button"
              >
                <svg aria-hidden="true" className="h-5 w-5" fill={selectedBottleState?.is_favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M6 3.75A1.75 1.75 0 0 1 7.75 2h8.5A1.75 1.75 0 0 1 18 3.75V22l-6-3.5L6 22V3.75Z" /></svg>
              </button>
              <button
                className="flex-1 rounded-xl bg-[#C5A059] py-3.5 text-sm font-semibold uppercase tracking-wider text-black shadow-[0_0_15px_rgba(197,160,89,0.3)] transition-all hover:bg-[#b59049]"
                onClick={() => {
                  if (!telegramId) {
                    setFeedback(t('bottle.open_telegram_to_write_review'));
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
      {isReviewOpen && selectedBottle && telegramId !== undefined && (
        <BottleReviewOverlay
          bottleId={selectedBottle.id}
          initDataRaw={initDataRaw}
          onClose={() => setIsReviewOpen(false)}
          onSaved={() => setReviewRevision((current) => current + 1)}
          telegramId={telegramId}
        />
      )}
    </section>
  );
}
