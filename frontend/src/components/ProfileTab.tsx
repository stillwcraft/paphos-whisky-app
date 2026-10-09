import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import { initData, useSignal } from '@tma.js/sdk-react';
import { useTranslation } from 'react-i18next';
import { WhiskyTrail } from '@/components/WhiskyTrail.tsx';
import { FavoritesTab } from '@/components/FavoritesTab.tsx';
import { SocialProfilePanel, type TagRequest } from './social/SocialPanels.tsx';
import { SocialApi } from './social/socialApi.ts';
import type { SocialProfile } from './social/SocialEventCard.tsx';

type TelegramUser = {
  id?: number;
  first_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initDataUnsafe?: {
          start_param?: string;
          user?: TelegramUser;
        };
        HapticFeedback?: {
          selectionChanged: () => void;
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred?: (type: 'error' | 'success' | 'warning') => void;
        };
        downloadFile?: (
          params: { url: string; file_name: string },
          callback?: (accepted: boolean) => void,
        ) => void;
        switchInlineQuery: (query: string, chooseChatTypes?: string[]) => void;
        openTelegramLink?: (url: string) => void;
      };
    };
  }
}

export function ProfileTab() {
  const { t, i18n } = useTranslation();
  const tg = window.Telegram?.WebApp;
  const rawUser = tg?.initDataUnsafe?.user;
  const initDataState = useSignal(initData.state);
  const initDataRaw = useSignal(initData.raw);
  const userId = initDataState?.user?.id ?? rawUser?.id;
  const currentLanguage = (i18n.resolvedLanguage ?? i18n.language).toLowerCase().split(/[-_]/, 1)[0];
  const [activeScreen, setActiveScreen] = useState(0);
  const [favoritesVisited, setFavoritesVisited] = useState(false);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const api = useMemo(() => initDataRaw ? new SocialApi(initDataRaw) : null, [initDataRaw]);
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [tagRequests, setTagRequests] = useState<TagRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (localStorage.getItem('app_lang')) return;
    const language = initDataState?.user?.language_code ?? rawUser?.language_code;
    const supported = language?.toLowerCase().split(/[-_]/, 1)[0];
    if (supported === 'en' || supported === 'uk' || supported === 'ru') {
      void i18n.changeLanguage(supported);
    }
  }, [initDataState?.user?.language_code, rawUser?.language_code, i18n]);

  useEffect(() => {
    if (activeScreen !== 1 || !api) return;
    let active = true;
    setLoading(true);
    void Promise.all([api.profile(), api.tagRequests()])
      .then(([me, tags]) => {
        if (!active) return;
        setProfile(me);
        setTagRequests(tags);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : t('social.error'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [activeScreen, api, t]);

  const run = async (action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('social.error'));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    const target = event.target;
    if (event.touches.length !== 1 || (target instanceof Element && target.closest('button, input, textarea, select, a, label, [data-profile-swipe-ignore]'))) {
      touchStart.current = null;
      return;
    }
    touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  };

  const goToScreen = (index: number) => {
    if (index === 2) setFavoritesVisited(true);
    carouselRef.current?.scrollTo({ left: index * carouselRef.current.clientWidth, behavior: 'smooth' });
  };

  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || event.changedTouches.length !== 1) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      goToScreen(Math.max(0, Math.min(2, activeScreen + (dx < 0 ? 1 : -1))));
    }
  };

  return (
    <section className="mx-auto w-full max-w-md pb-8 pt-[env(safe-area-inset-top)]" onTouchStartCapture={handleTouchStart} onTouchEndCapture={handleTouchEnd} onTouchCancelCapture={() => { touchStart.current = null; }}>
      <div ref={carouselRef} className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" onScroll={(event) => {
        const { scrollLeft, clientWidth } = event.currentTarget;
        if (clientWidth) {
          const index = Math.min(2, Math.max(0, Math.round(scrollLeft / clientWidth)));
          setActiveScreen(index);
          if (index === 2) setFavoritesVisited(true);
        }
      }}>
          <div className="min-w-0 w-full shrink-0 snap-start">
            <WhiskyTrail
              firstName={initDataState?.user?.first_name ?? rawUser?.first_name}
              initDataRaw={initDataRaw}
              language={currentLanguage}
              telegramId={userId}
              username={initDataState?.user?.username ?? rawUser?.username}
            />
          </div>
          <div className="min-w-0 w-full shrink-0 snap-start">
            {!api ? (
              <p role="alert" className="rounded-2xl border border-[#C5A059]/30 bg-[#141417] p-5 text-red-300">{t('social.auth_required')}</p>
            ) : loading && !profile ? (
              <p role="status" className="rounded-2xl border border-[#C5A059]/30 bg-[#141417] p-5 text-slate-300">{t('common.loading')}</p>
            ) : profile ? (
              <SocialProfilePanel
                profile={profile}
                tagRequests={tagRequests}
                telegramAvatarUrl={initDataState?.user?.photo_url ?? rawUser?.photo_url}
                busy={busy}
                error={error}
                notice={notice}
                onSave={(name, avatar) => void run(async () => {
                  const key = avatar ? await api.upload(avatar, 'avatar') : undefined;
                  setProfile(await api.updateProfile(name, profile.age, key));
                })}
                onRemoveAvatar={() => void run(async () => {
                  setProfile(await api.updateProfile(profile.display_name, profile.age, undefined, true));
                })}
                onAcceptTag={(id) => void run(async () => {
                  await api.acceptTag(id);
                  setTagRequests(await api.tagRequests());
                })}
                onDeclineTag={(id) => void run(async () => {
                  await api.declineTag(id);
                  setTagRequests(await api.tagRequests());
                })}
              />
            ) : (
              <p role="alert" className="rounded-2xl border border-[#C5A059]/30 bg-[#141417] p-5 text-red-300">{error ?? t('social.error')}</p>
            )}
        </div>
        <div className="min-w-0 w-full shrink-0 snap-start">
          {favoritesVisited && <FavoritesTab />}
        </div>
      </div>
      <nav aria-label={t('profile.screens')} className="mt-1 flex justify-center gap-1">
        {[t('profile.whisky_journey'), t('social.profile'), t('tabs.favorites')].map((label, index) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            aria-current={activeScreen === index ? 'page' : undefined}
            onClick={() => goToScreen(index)}
            className="group flex h-9 w-9 items-center justify-center rounded-full"
          >
            <span className={`h-2.5 w-2.5 rounded-full transition-colors ${activeScreen === index ? 'bg-[#C5A059]' : 'bg-[#C5A059]/30 group-hover:bg-[#C5A059]/60'}`} />
          </button>
        ))}
      </nav>
    </section>
  );
}
