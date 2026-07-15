import { useEffect, useState } from 'react';
import { initData, useSignal } from '@tma.js/sdk-react';
import { telegramAuthHeaders } from '@/telegramAuth.ts';

const API_URL = 'https://paphos-whisky-api.onrender.com';

type TelegramUser = {
  id?: number;
  first_name?: string;
  username?: string;
  photo_url?: string;
};

type UserStats = {
  tastings_attended: number;
  tested_releases: number;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initDataUnsafe?: {
          user?: TelegramUser;
        };
      };
    };
  }
}

function UserPlaceholderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-10 w-10" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

export function ProfileTab() {
  const tg = window.Telegram?.WebApp;
  const rawUser = tg?.initDataUnsafe?.user;
  const initDataState = useSignal(initData.state);
  const initDataRaw = useSignal(initData.raw);
  const userId = initDataState?.user?.id ?? rawUser?.id;
  const [stats, setStats] = useState<UserStats>({ tastings_attended: 0, tested_releases: 0 });
  const [statsError, setStatsError] = useState<string | null>(null);
  const name = initDataState?.user?.first_name ?? rawUser?.first_name ?? 'Whisky Club Member';
  const username = initDataState?.user?.username ?? rawUser?.username;
  const photoUrl = initDataState?.user?.photo_url ?? rawUser?.photo_url;

  useEffect(() => {
    if (!userId) {
      return;
    }

    const loadStats = async () => {
      try {
        const response = await fetch(`${API_URL}/api/users/${userId}/stats`, {
          headers: telegramAuthHeaders(initDataRaw),
        });
        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }
        setStats(await response.json() as UserStats);
        setStatsError(null);
      } catch (error) {
        setStatsError(error instanceof Error ? error.message : 'Could not load profile statistics.');
      }
    };

    void loadStats();
  }, [initDataRaw, userId]);

  return (
    <section className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-md items-center py-8">
      <article className="w-full rounded-3xl border border-amber-200/15 bg-slate-900/70 p-6 text-center shadow-2xl shadow-black/30 backdrop-blur">
        <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-amber-400 text-amber-400 shadow-lg shadow-amber-400/20">
          {photoUrl ? (
            <img alt="Avatar" className="h-full w-full rounded-full object-cover" src={photoUrl} />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-800">
              {name ? <span className="text-2xl font-bold">{name[0]?.toUpperCase()}</span> : <UserPlaceholderIcon />}
            </div>
          )}
        </div>

        <h1 className="mt-5 text-2xl font-semibold text-white">{name}</h1>
        <p className="mt-1 text-sm text-slate-400">{username ? `@${username}` : 'Telegram user'}</p>

        {statsError && <p className="mt-5 text-xs text-red-300">{statsError}</p>}
        <div className="mt-7 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-slate-800/80 p-4">
            <p className="text-3xl font-bold text-white">{stats.tastings_attended}</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">Tastings attended</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-800/80 p-4">
            <p className="text-3xl font-bold text-white">{stats.tested_releases}</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">Tested releases</p>
          </div>
        </div>
      </article>
    </section>
  );
}
