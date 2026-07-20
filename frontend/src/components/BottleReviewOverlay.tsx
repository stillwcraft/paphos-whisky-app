import { useEffect, useState } from 'react';
import { telegramAuthHeaders } from '@/telegramAuth.ts';

const API_URL = 'https://paphos-whisky-api.onrender.com';

type TastingTag = {
  id: number;
  name: string;
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
};

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

export function BottleReviewOverlay({ bottleId, telegramId, initDataRaw, onClose, onSaved }: Props) {
  const [nose, setNose] = useState(80);
  const [taste, setTaste] = useState(80);
  const [finish, setFinish] = useState(80);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [tags, setTags] = useState<TastingTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const averageScore = Math.round((nose + taste + finish) / 3);

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
          fetch(`${API_URL}/api/tasting-tags`, { signal: controller.signal }),
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
        setSelectedTagIds(review.tag_ids);
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
  }, [bottleId, telegramId, initDataRaw]);

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId],
    );
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
          tag_ids: selectedTagIds,
        }),
      });
      if (!response.ok) throw new Error(await extractErrorMessage(response));
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save review.');
    } finally {
      setIsSaving(false);
    }
  };

  const sliders: SliderConfig[] = [
    { label: 'Nose', value: nose, onChange: (v) => setNose(v) },
    { label: 'Taste', value: taste, onChange: (v) => setTaste(v) },
    { label: 'Finish', value: finish, onChange: (v) => setFinish(v) },
  ];

  return (
    <div className="fixed inset-x-0 bottom-0 top-10 z-50 bg-slate-950/95 p-4 backdrop-blur-sm">
      <article className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden rounded-3xl border border-amber-100/10 bg-slate-900 shadow-2xl shadow-black/50">
        <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-4">
          <button
            aria-label="Close review without saving"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
          <h2 className="text-lg font-semibold text-white">My review</h2>
        </div>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-slate-400">Загрузка...</p>
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
              <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-400">Points</p>
            </div>

            <div className="space-y-5 px-5">
              {sliders.map(({ label, value, onChange }) => (
                <div key={label}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-300">{label}</span>
                    <span className="text-sm font-semibold text-amber-400">{value}/100</span>
                  </div>
                  <input
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-amber-400"
                    max={100}
                    min={0}
                    onChange={(e) => onChange(Number(e.target.value))}
                    type="range"
                    value={value}
                  />
                </div>
              ))}
            </div>

            {tags.length > 0 && (
              <div className="mt-6 px-5 pb-6">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Вкусовые ноты</h3>
                <div className="grid grid-cols-2 gap-2">
                  {tags.map((tag) => {
                    const isSelected = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                          isSelected
                            ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                            : 'border-slate-600 text-slate-300 hover:border-slate-400 hover:bg-white/5'
                        }`}
                        onClick={() => toggleTag(tag.id)}
                        type="button"
                      >
                        <img alt="" aria-hidden="true" className="h-4 w-4 object-contain" src={tag.icon_url} />
                        <span>{tag.name}</span>
                        {isSelected && <span aria-hidden="true" className="text-amber-400">✓</span>}
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
            className="w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading || isSaving}
            onClick={() => void handleSave()}
            type="button"
          >
            💾 Save review
          </button>
        </div>
      </article>
    </div>
  );
}
