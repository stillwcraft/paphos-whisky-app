import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localizedApiUrl } from '@/localization.ts';
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

const API_URL = 'https://paphos-whisky-api.onrender.com';
type I18nString = Partial<Record<'en' | 'ru' | 'uk', string>>;

type BottleTagStat = {
  id: number;
  name: string;
  name_i18n?: I18nString;
  description_i18n?: I18nString;
  icon_url: string;
  count: number;
};

type BottleTagStatsResponse = {
  club_rating: number | null;
  tags: BottleTagStat[];
};

type Props = {
  bottleId: number;
  refreshRevision?: number;
};

type TagTooltipProps = {
  active?: boolean;
  formatVotes: (count: number) => string;
  payload?: Array<{
    payload?: BottleTagStat;
  }>;
};

function TagTooltip({ active, formatVotes, payload }: TagTooltipProps) {
  const tag = payload?.[0]?.payload;

  if (!active || !tag) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-100 shadow-xl">
      <img
        alt=""
        className="h-5 w-5 rounded-full bg-slate-700 object-cover"
        onError={(event) => {
          event.currentTarget.style.visibility = 'hidden';
        }}
        src={tag.icon_url}
      />
      <span>{tag.name}: {formatVotes(tag.count)}</span>
    </div>
  );
}

export function BottleTagChart({ bottleId, refreshRevision }: Props) {
  const { i18n, t } = useTranslation();
  const languageCode = i18n.language;
  const [tagStats, setTagStats] = useState<BottleTagStat[]>([]);
  const [clubRating, setClubRating] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const loadTagStats = async () => {
      setIsLoading(true);
      setError(null);
      setTagStats([]);
      setClubRating(null);

      try {
        const response = await fetch(localizedApiUrl(`${API_URL}/api/bottles/${bottleId}/tag-stats`, languageCode), {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const stats = await response.json() as BottleTagStatsResponse;
        if (active) {
          setTagStats(stats.tags);
          setClubRating(stats.club_rating);
        }
      } catch (loadError) {
        if (!active || (loadError instanceof Error && loadError.name === 'AbortError')) {
          return;
        }
        setError('Не удалось загрузить профиль вкуса.');
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadTagStats();

    return () => {
      active = false;
      controller.abort();
    };
  }, [bottleId, languageCode, refreshRevision]);

  return (
    <section className="mt-5 rounded-2xl border border-white/10 bg-slate-800/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">{t('bottle.flavor_profile')}</h3>
        {typeof clubRating === 'number' && Number.isFinite(clubRating) && (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#C5A059]/30 bg-[#C5A059]/10 px-3 py-1 text-xs font-semibold text-[#C5A059]">
            <span aria-hidden="true">★</span>
            <span>{Math.round(clubRating)}</span>
          </div>
        )}
      </div>
      {isLoading ? (
        <p className="mt-4 text-sm text-slate-400">{t('common.loading')}</p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-300">{error}</p>
      ) : tagStats.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">{t('bottle.no_ratings')}</p>
      ) : (
        <div className="mt-3 h-[180px]">
          <ResponsiveContainer height={180} width="100%">
            <RadarChart data={tagStats} margin={{ top: 12, right: 22, bottom: 12, left: 22 }}>
              <PolarGrid stroke="rgba(197, 160, 89, 0.15)" />
              <PolarAngleAxis dataKey="name" tick={{ fill: '#9E9D9A', fontSize: 10 }} />
              <Tooltip content={<TagTooltip formatVotes={(count) => t('bottle.votes', { count })} />} />
              <Radar dataKey="count" fill="#C5A059" fillOpacity={0.35} stroke="#C5A059" strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
