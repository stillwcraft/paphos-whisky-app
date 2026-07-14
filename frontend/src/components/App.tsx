import { createContext, useEffect, useState, type ComponentType, type SVGProps } from 'react';
import { initData, useSignal } from '@tma.js/sdk-react';

import { AdminTab } from '@/AdminTab.tsx';
import { EventsTab } from '@/components/EventsTab.tsx';
import { BottlesSamplesTab } from '@/components/BottlesSamplesTab.tsx';
import { DistilleriesTab } from '@/components/DistilleriesTab.tsx';
import { FavoritesTab } from '@/components/FavoritesTab.tsx';
import { ProfileTab } from '@/components/ProfileTab.tsx';

type TabId = 'events' | 'distilleries' | 'bottles' | 'favorites' | 'profile' | 'admin';

type IconProps = SVGProps<SVGSVGElement>;

type FavoritesContextValue = {
  favorites: Array<string | number>;
  toggleFavorite: (bottleId: string | number) => void;
};

export const FavoritesContext = createContext<FavoritesContextValue | null>(null);
const ADMIN_TELEGRAM_ID = 8546526596; // Replace 0 with your Telegram user ID.

type Tab = {
  id: TabId;
  label: string;
  screen: string;
  Icon: ComponentType<IconProps>;
};

const iconProps: IconProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  viewBox: '0 0 24 24',
};

const CalendarIcon = (props: IconProps) => (
  <svg {...iconProps} {...props}>
    <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
    <path d="M7.5 3.5v4M16.5 3.5v4M3.5 10h17M8 14h.01M12 14h.01M16 14h.01" />
  </svg>
);

const DistilleryIcon = (props: IconProps) => (
  <svg {...iconProps} {...props}>
    <path d="M4 20.5h16M6 20.5V10l6-4 6 4v10.5M9 20.5v-5h6v5M4 10h16M12 6V3.5M8 10v2M16 10v2" />
  </svg>
);

const BottleIcon = (props: IconProps) => (
  <svg {...iconProps} {...props}>
    <path d="M9 3.5h6M10 3.5v4l-2.5 3v8A2.5 2.5 0 0 0 10 21h4a2.5 2.5 0 0 0 2.5-2.5v-8L14 7.5v-4M7.5 12h9" />
  </svg>
);

const StarIcon = (props: IconProps) => (
  <svg {...iconProps} {...props}>
    <path d="m12 3.5 2.63 5.33 5.88.85-4.25 4.14 1 5.85L12 16.9l-5.26 2.77 1-5.85-4.25-4.14 5.88-.85L12 3.5Z" />
  </svg>
);

const UserIcon = (props: IconProps) => (
  <svg {...iconProps} {...props}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </svg>
);

const AdminIcon = (props: IconProps) => (
  <svg {...iconProps} {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V20.3h-3v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7.08 15a1.7 1.7 0 0 0-1.55-1H5.4v-3h.13a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06L8.8 5.94l.06.06A1.7 1.7 0 0 0 10.74 6.34a1.7 1.7 0 0 0 1-1.55V4.7h3v.09a1.7 1.7 0 0 0 1 1.55A1.7 1.7 0 0 0 17.62 6l.06-.06 2.12 2.12-.06.06A1.7 1.7 0 0 0 19.4 10a1.7 1.7 0 0 0 1.55 1h.13v3h-.13a1.7 1.7 0 0 0-1.55 1Z" />
  </svg>
);

const tabs: Tab[] = [
  { id: 'events', label: 'Events', screen: 'Экран Events', Icon: CalendarIcon },
  { id: 'distilleries', label: 'Дистиллерии', screen: 'Экран Дистиллерии', Icon: DistilleryIcon },
  { id: 'bottles', label: 'Бутылки', screen: 'Экран Бутылки и сэмплы', Icon: BottleIcon },
  { id: 'favorites', label: 'Избранное', screen: 'Экран Избранное', Icon: StarIcon },
  { id: 'profile', label: 'Профиль', screen: 'Экран Профиль', Icon: UserIcon },
];
const adminTab: Tab = { id: 'admin', label: 'Админ', screen: 'Админ', Icon: AdminIcon };

type FooterProps = {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  isAdmin: boolean;
};

function Footer({ activeTab, onTabChange, isAdmin }: FooterProps) {
  const visibleTabs = isAdmin ? [...tabs, adminTab] : tabs;

  return (
    <footer className="fixed inset-x-0 bottom-0 z-10 border-t border-amber-100/10 bg-slate-950/95 px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
      <nav aria-label="Основная навигация" className="mx-auto flex max-w-md justify-between">
        {visibleTabs.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;

          return (
            <button
              key={id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onTabChange(id)}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1 text-[10px] font-medium transition-colors ${
                isActive ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </footer>
  );
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('events');
  const [favorites, setFavorites] = useState<Array<string | number>>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const initDataState = useSignal(initData.state);
  const activeScreen = tabs.find((tab) => tab.id === activeTab)?.screen;

  useEffect(() => {
    setIsAdmin(initDataState?.user?.id === ADMIN_TELEGRAM_ID);
  }, [initDataState]);

  const toggleFavorite = (bottleId: string | number) => {
    setFavorites((currentFavorites) => (
      currentFavorites.includes(bottleId)
        ? currentFavorites.filter((id) => id !== bottleId)
        : [...currentFavorites, bottleId]
    ));
  };

  return (
    <FavoritesContext.Provider value={{ favorites, toggleFavorite }}>
      <div className="min-h-screen bg-slate-900 text-white">
        <main className="min-h-screen px-6 pb-28">
          {activeTab === 'events' ? (
            <EventsTab />
          ) : activeTab === 'distilleries' ? (
            <DistilleriesTab favorites={favorites} toggleFavorite={toggleFavorite} />
          ) : activeTab === 'bottles' ? (
            <BottlesSamplesTab />
          ) : activeTab === 'favorites' ? (
            <FavoritesTab favorites={favorites} toggleFavorite={toggleFavorite} />
          ) : activeTab === 'profile' ? (
            <ProfileTab />
          ) : activeTab === 'admin' && isAdmin ? (
            <AdminTab />
          ) : (
            <div className="flex min-h-screen items-center justify-center text-center">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">
                  Whisky Club
                </p>
                <h1 className="text-2xl font-semibold">{activeScreen}</h1>
              </div>
            </div>
          )}
        </main>
        <Footer activeTab={activeTab} onTabChange={setActiveTab} isAdmin={isAdmin} />
      </div>
    </FavoritesContext.Provider>
  );
}
