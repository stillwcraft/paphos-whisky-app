import { useEffect, useState } from 'react';
import { initData, useSignal } from '@tma.js/sdk-react';
import { localizedApiUrl } from '@/localization.ts';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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

type TagIconTickProps = {
  x?: number;
  y?: number;
  payload?: {
    value?: unknown;
  };
};

type TagTooltipProps = {
  active?: boolean;
  payload?: Array<{
    payload?: BottleTagStat;
  }>;
};

function TagIconTick({ x = 0, y = 0, payload }: TagIconTickProps) {
  const iconUrl = typeof payload?.value === 'string' ? payload.value : '';

  return (
    <g aria-hidden="true" transform={`translate(${x - 12}, ${y + 8})`}>
      <circle cx="12" cy="12" fill="#334155" r="12" />
      {iconUrl && (
        <image
          clipPath="circle(12px at 12px 12px)"
          height="24"
          href={iconUrl}
          preserveAspectRatio="xMidYMid slice"
          width="24"
        />
      )}
    </g>
  );
}

function TagTooltip({ active, payload }: TagTooltipProps) {
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
      <span>{tag.name}: {tag.count} votes</span>
    </div>
  );
}

export function BottleTagChart({ bottleId, refreshRevision }: Props) {
  const languageCode = useSignal(initData.state)?.user?.language_code;
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
        <h3 className="text-sm font-semibold text-white">Flavor Profile</h3>
        <span className="text-sm font-semibold text-amber-400">
          Club Rating: {typeof clubRating === 'number' && Number.isFinite(clubRating)
            ? clubRating.toFixed(2)
            : '—'}
        </span>
      </div>
      {isLoading ? (
        <p className="mt-4 text-sm text-slate-400">Загрузка...</p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-300">{error}</p>
      ) : tagStats.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">Пока нет оценок вкуса. Будьте первым!</p>
      ) : (
        <div className="mt-3 h-[180px]">
          <ResponsiveContainer height={180} width="100%">
            <AreaChart data={tagStats} margin={{ top: 10, right: 12, bottom: 0, left: -12 }}>
              <defs>
                <linearGradient id="colorTag" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#eab308" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#eab308" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#475569" strokeDasharray="3 3" vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="icon_url"
                height={40}
                interval={0}
                tick={<TagIconTick />}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickLine={false}
                width={28}
              />
              <Tooltip content={<TagTooltip />} cursor={{ stroke: '#eab308', strokeWidth: 1 }} />
              <Area
                dataKey="count"
                fill="url(#colorTag)"
                stroke="#eab308"
                strokeWidth={2}
                type="monotone"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
