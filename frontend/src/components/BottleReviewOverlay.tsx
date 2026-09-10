import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { telegramAuthHeaders } from '@/telegramAuth.ts';
import { localizedApiUrl } from '@/localization.ts';
import { ReviewShareModal } from '@/components/ReviewShareModal.tsx';

const API_URL = 'https://paphos-whisky-api.onrender.com';
type I18nString = Partial<Record<'en' | 'ru' | 'uk', string>>;

type TastingTag = {
  id: number;
  name: string;
  name_i18n?: I18nString;
  description_i18n?: I18nString;
  icon_url: string;
};

type ReviewResponse = {
  id: number | null;
  telegram_id: number;
  bottle_id: number;
  nose: number;
  taste: number;
  finish: number;
  tag_ids: number[];
  tag_intensities: ReviewTagIntensity[];
};

type ReviewTagIntensity = {
  tasting_tag_id: number;
  intensity: 1 | 2 | 3;
};

type TagIntensity = 0 | 1 | 2 | 3;

type SliderConfig = {
  label: string;
  value: number;
  onChange: (value: number) => void;
};

type Props = {
  bottleId: number;
  telegramId: number;
  initDataRaw: string | undefined;
  onClose: () => void;
  onSaved: () => void;
};

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (typeof payload === 'object' && payload !== null && 'detail' in payload) {
      return String(payload.detail);
    }
  } catch {
    // Fall through to the HTTP status when the response has no JSON error body.
  }
  return `Server error: ${response.status}`;
}

function getScoreVerdict(score: number): { title: string; subtitle: string } {
  if (score >= 95) return { title: 'Истинный шедевр.', subtitle: 'Безупречный баланс и бесконечный финиш.' };
  if (score >= 90) return { title: 'Жемчужина коллекции.', subtitle: 'Яркий характер и высший класс.' };
  if (score >= 80) return { title: 'Достойная классика.', subtitle: 'Отличный выбор для хорошего вечера.' };
  if (score >= 70) return { title: 'На любителя.', subtitle: 'Резковатый профиль с хромающим балансом.' };
  return { title: 'Лучше пропустить.', subtitle: 'Явные дефекты и резкий спирт.' };
}

export function BottleReviewOverlay({ bottleId, telegramId, initDataRaw, onClose, onSaved }: Props) {
  const { i18n, t } = useTranslation();
  const languageCode = i18n.language;
  const [nose, setNose] = useState(80);
  const [taste, setTaste] = useState(80);
  const [finish, setFinish] = useState(80);
  const [tagIntensities, setTagIntensities] = useState<Record<number, TagIntensity>>({});
  const [tags, setTags] = useState<TastingTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedReviewId, setSavedReviewId] = useState<number | null>(null);

  const averageScore = Math.round((nose + taste + finish) / 3);
  const scoreVerdict = getScoreVerdict(averageScore);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [reviewRes, tagsRes] = await Promise.all([
          fetch(
            `${API_URL}/api/reviews?telegram_id=${encodeURIComponent(telegramId)}&bottle_id=${encodeURIComponent(bottleId)}`,
            { headers: telegramAuthHeaders(initDataRaw), signal: controller.signal },
          ),
          fetch(localizedApiUrl(`${API_URL}/api/tasting-tags`, languageCode), { signal: controller.signal }),
        ]);

        if (!active) return;

        if (!reviewRes.ok) throw new Error(await extractErrorMessage(reviewRes));
        if (!tagsRes.ok) throw new Error(await extractErrorMessage(tagsRes));

        const [review, fetchedTags] = await Promise.all([
          reviewRes.json() as Promise<ReviewResponse>,
          tagsRes.json() as Promise<TastingTag[]>,
        ]);

        if (!active) return;

        setNose(review.nose);
        setTaste(review.taste);
        setFinish(review.finish);
        setTagIntensities(Object.fromEntries(
          (review.tag_intensities.length > 0
            ? review.tag_intensities
            : review.tag_ids.map((tagId) => ({ tasting_tag_id: tagId, intensity: 1 as const })))
            .map((tag) => [tag.tasting_tag_id, tag.intensity]),
        ));
        setTags(fetchedTags);
      } catch (err) {
        if (!active) return;
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Could not load review data.');
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadData();

    return () => {
      active = false;
      controller.abort();
    };
  }, [bottleId, telegramId, initDataRaw, languageCode]);

  const toggleTag = (tagId: number) => {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    setTagIntensities((current) => {
      const nextIntensity = (((current[tagId] ?? 0) + 1) % 4) as TagIntensity;
      const next = { ...current };
      if (nextIntensity === 0) {
        delete next[tagId];
      } else {
        next[tagId] = nextIntensity;
      }
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...telegramAuthHeaders(initDataRaw) },
        body: JSON.stringify({
          telegram_id: telegramId,
          bottle_id: bottleId,
          nose,
          taste,
          finish,
          tag_intensities: Object.entries(tagIntensities).map(([tagId, intensity]) => ({
            tasting_tag_id: Number(tagId),
            intensity,
          })),
        }),
      });
      if (!response.ok) throw new Error(await extractErrorMessage(response));
      const savedReview = await response.json() as ReviewResponse;
      if (savedReview.id === null) throw new Error('Review was saved without an ID.');
      onSaved();
      setSavedReviewId(savedReview.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save review.');
    } finally {
      setIsSaving(false);
    }
  };

  const sliders: SliderConfig[] = [
    { label: t('review.nose'), value: nose, onChange: (v) => setNose(v) },
    { label: t('review.taste'), value: taste, onChange: (v) => setTaste(v) },
    { label: t('review.finish'), value: finish, onChange: (v) => setFinish(v) },
  ];

  return (
    <>
    <div className="fixed inset-x-0 bottom-0 top-10 z-50 bg-slate-950/95 p-4 backdrop-blur-sm">
      <style>{`
        .review-slider::-webkit-slider-thumb {
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: #C5A059;
          box-shadow: 0 0 12px rgba(197, 160, 89, 0.5);
        }
        .review-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border: 0;
          border-radius: 9999px;
          background: #C5A059;
          box-shadow: 0 0 12px rgba(197, 160, 89, 0.5);
        }
      `}</style>
      <article className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden rounded-3xl border border-amber-100/10 bg-slate-900 shadow-2xl shadow-black/50">
        <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-4">
          <button
            aria-label={t('review.close_without_saving')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
          <h2 className="text-lg font-semibold text-white">{t('review.title')}</h2>
        </div>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-slate-400">{t('common.loading')}</p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {error && (
              <p className="mx-5 mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
                {error}
              </p>
            )}

            <div className="py-6 text-center">
              <p className="tabular-nums text-7xl font-bold text-amber-400">{averageScore}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-400">{t('review.points')}</p>
              <p className="mt-1 text-base font-bold text-[#C5A059]">{scoreVerdict.title}</p>
              <p className="mt-0.5 text-xs font-normal text-[#9E9D9A]">{scoreVerdict.subtitle}</p>
            </div>

            <div className="space-y-5 px-5">
              {sliders.map(({ label, value, onChange }) => (
                <div key={label}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-300">{label}</span>
                    <span className="text-sm font-semibold text-amber-400">{value}/100</span>
                  </div>
                  <input
                    className="review-slider h-2 w-full cursor-pointer appearance-none rounded-full"
                    max={100}
                    min={0}
                    onChange={(e) => {
                      onChange(Number(e.target.value));
                      window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();
                    }}
                    style={{
                      background: `linear-gradient(to right, #7A5C28, #C5A059 ${value}%, #3A3A3E ${value}%)`,
                    }}
                    type="range"
                    value={value}
                  />
                </div>
              ))}
            </div>

            {tags.length > 0 && (
              <div className="mt-6 px-5 pb-6">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{t('review.tasting_notes')}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {tags.map((tag) => {
                    const intensity = tagIntensities[tag.id] ?? 0;
                    return (
                      <button
                        key={tag.id}
                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                          intensity === 3
                            ? 'border-[#C5A059] bg-[#C5A059] font-bold text-black shadow-[0_0_15px_rgba(197,160,89,0.6)]'
                            : intensity === 2
                              ? 'border-[#C5A059] bg-[#C5A059] font-semibold text-black'
                              : intensity === 1
                                ? 'border-[#C5A059]/50 bg-transparent font-medium text-[#F4F4F5]'
                                : 'border-white/10 font-medium text-[#9E9D9A] hover:border-white/25'
                        }`}
                        onClick={() => toggleTag(tag.id)}
                        type="button"
                      >
                        <img alt="" aria-hidden="true" className="h-4 w-4 object-contain" src={tag.icon_url} />
                        <span>{tag.name}</span>
                        {intensity === 3 && <span aria-hidden="true">★</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="shrink-0 border-t border-white/10 bg-slate-900 p-4">
          <button
            className="w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold uppercase tracking-wider text-slate-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading || isSaving}
            onClick={() => void handleSave()}
            type="button"
          >
            {t('review.save')}
          </button>
        </div>
      </article>
    </div>
    {savedReviewId !== null && (
      <ReviewShareModal
        initDataRaw={initDataRaw}
        onClose={onClose}
        reviewId={savedReviewId}
      />
    )}
    </>
  );
}
