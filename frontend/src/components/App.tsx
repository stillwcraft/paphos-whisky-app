import { useCallback, useEffect, useState } from 'react';
import { initData, retrieveLaunchParams, useSignal } from '@tma.js/sdk-react';
import { useTranslation } from 'react-i18next';

import { AdminTab } from '@/components/AdminTab.tsx';
import { EventsTab } from '@/components/EventsTab.tsx';
import { BottlesSamplesTab } from '@/components/BottlesSamplesTab.tsx';
import { DistilleriesTab } from '@/components/DistilleriesTab.tsx';
import { FavoritesTab } from '@/components/FavoritesTab.tsx';
import { ProfileTab } from '@/components/ProfileTab.tsx';

type TabId = 'events' | 'distilleries' | 'bottles' | 'favorites' | 'profile' | 'admin';

const ADMIN_TELEGRAM_ID = Number(import.meta.env.VITE_ADMIN_TELEGRAM_ID);

type Tab = {
  id: TabId;
  labelKey: string;
  iconSrc: string;
};

const tabs: Tab[] = [
  { id: 'events', labelKey: 'tabs.events', iconSrc: '/assets/nav/Events.webp' },
  { id: 'distilleries', labelKey: 'tabs.distilleries', iconSrc: '/assets/nav/Dist.webp' },
  { id: 'bottles', labelKey: 'tabs.bottles', iconSrc: '/assets/nav/Bottles.webp' },
  { id: 'favorites', labelKey: 'tabs.favorites', iconSrc: '/assets/nav/Fav.webp' },
  { id: 'profile', labelKey: 'tabs.profile', iconSrc: '/assets/nav/Profile.webp' },
];
const adminTab: Tab = { id: 'admin', labelKey: 'tabs.admin', iconSrc: '/assets/nav/Admin.webp' };

type FooterProps = {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  isAdmin: boolean;
};

function Footer({ activeTab, onTabChange, isAdmin }: FooterProps) {
  const { t } = useTranslation();
  const visibleTabs = isAdmin ? [...tabs, adminTab] : tabs;

  return (
    <footer className="fixed inset-x-0 bottom-0 z-10 border-t border-[#C5A059]/15 bg-[#0A0A0B] px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
      <nav aria-label={t('common.main_navigation')} className="mx-auto flex max-w-md justify-between">
        {visibleTabs.map(({ id, labelKey, iconSrc }) => {
          const isActive = activeTab === id;

          return (
            <button
              key={id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onTabChange(id)}
              className={`flex min-w-0 flex-1 flex-col items-center rounded-lg px-1 py-1 text-[10px] transition-all duration-300 ease-out ${
                isActive ? 'text-[#C5A059] font-medium' : 'text-[#6E6D6A] font-normal hover:text-[#F4F4F5]'
              }`}
            >
              <img
                src={iconSrc}
                alt=""
                aria-hidden="true"
                className={`h-14 w-14 object-contain transition-all duration-300 ease-out ${
                  isActive
                    ? 'scale-110 opacity-100'
                    : 'scale-100 opacity-40 grayscale contrast-125 hover:opacity-70 hover:grayscale-0'
                }`}
                style={isActive ? { filter: 'drop-shadow(0px 2px 8px rgba(197, 160, 89, 0.6))' } : undefined}
              />
              <span className="mt-1">{t(labelKey)}</span>
            </button>
          );
        })}
      </nav>
    </footer>
  );
}

export function App() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>('events');
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<number | null>(null);
  const [selectedDistilleryId, setSelectedDistilleryId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const initDataState = useSignal(initData.state);
  const activeScreen = t(`tabs.${activeTab}`);
  const clearSelectedEvent = useCallback(() => setSelectedEventId(null), []);
  const clearSelectedBottle = useCallback(() => setSelectedBottleId(null), []);
  const clearSelectedDistillery = useCallback(() => setSelectedDistilleryId(null), []);

  useEffect(() => {
    setIsAdmin(
      Number.isSafeInteger(ADMIN_TELEGRAM_ID)
      && initDataState?.user?.id === ADMIN_TELEGRAM_ID,
    );
  }, [initDataState]);

  useEffect(() => {
    const startParam = retrieveLaunchParams().tgWebAppStartParam
      ?? window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    if (!startParam) {
      return;
    }

    const eventMatch = /^event_(\d+)$/.exec(startParam);
    if (eventMatch) {
      setActiveTab('events');
      setSelectedEventId(Number(eventMatch[1]));
      return;
    }

    const bottleMatch = /^bottle_(\d+)$/.exec(startParam);
    if (bottleMatch) {
      setActiveTab('distilleries');
      setSelectedBottleId(Number(bottleMatch[1]));
      return;
    }

    const distilleryMatch = /^distillery_(\d+)$/.exec(startParam);
    if (distilleryMatch) {
      setActiveTab('distilleries');
      setSelectedDistilleryId(Number(distilleryMatch[1]));
      return;
    }

    const matchingTab = tabs.find((tab) => tab.id === startParam);
    if (matchingTab) {
      setActiveTab(matchingTab.id);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#0D0D0E] text-[#F4F4F5]">
      <main className="min-h-screen px-6 pb-28">
          {activeTab === 'events' ? (
            <EventsTab
              selectedEventId={selectedEventId}
              onSelectedEventHandled={clearSelectedEvent}
            />
          ) : activeTab === 'distilleries' ? (
            <DistilleriesTab
              selectedBottleId={selectedBottleId}
              onSelectedBottleHandled={clearSelectedBottle}
              selectedDistilleryId={selectedDistilleryId}
              onSelectedDistilleryHandled={clearSelectedDistillery}
            />
          ) : activeTab === 'bottles' ? (
            <BottlesSamplesTab />
          ) : activeTab === 'favorites' ? (
            <FavoritesTab />
          ) : activeTab === 'profile' ? (
            <ProfileTab />
          ) : activeTab === 'admin' && isAdmin ? (
            <AdminTab />
          ) : (
            <div className="flex min-h-screen items-center justify-center text-center">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#C5A059]">
                  Whisky Club
                </p>
                <h1 className="text-2xl font-semibold">{activeScreen}</h1>
              </div>
            </div>
          )}
      </main>
      <Footer activeTab={activeTab} onTabChange={setActiveTab} isAdmin={isAdmin} />
    </div>
  );
}
