import { createContext, useState, type ComponentType, type SVGProps } from 'react';

import { EventsTab } from '@/components/EventsTab.tsx';
import { BottlesSamplesTab } from '@/components/BottlesSamplesTab.tsx';
import { DistilleriesTab } from '@/components/DistilleriesTab.tsx';
import { FavoritesTab } from '@/components/FavoritesTab.tsx';
import { ProfileTab } from '@/components/ProfileTab.tsx';

type TabId = 'events' | 'distilleries' | 'bottles' | 'favorites' | 'profile';

type IconProps = SVGProps<SVGSVGElement>;

type FavoritesContextValue = {
  favorites: Array<string | number>;
  toggleFavorite: (bottleId: string | number) => void;
};

export const FavoritesContext = createContext<FavoritesContextValue | null>(null);

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

const tabs: Tab[] = [
  { id: 'events', label: 'Ивенты', screen: 'Экран Ивенты', Icon: CalendarIcon },
  { id: 'distilleries', label: 'Дистиллерии', screen: 'Экран Дистиллерии', Icon: DistilleryIcon },
  { id: 'bottles', label: 'Бутылки', screen: 'Экран Бутылки и сэмплы', Icon: BottleIcon },
  { id: 'favorites', label: 'Избранное', screen: 'Экран Избранное', Icon: StarIcon },
  { id: 'profile', label: 'Профиль', screen: 'Экран Профиль', Icon: UserIcon },
];

type FooterProps = {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
};

function Footer({ activeTab, onTabChange }: FooterProps) {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-10 border-t border-amber-100/10 bg-slate-950/95 px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
      <nav aria-label="Основная навигация" className="mx-auto flex max-w-md justify-between">
        {tabs.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;

          return (
            <button
              key={id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onTabChange(id)}
              className={`flex min-w-14 flex-col items-center gap-1 rounded-lg px-1 py-1 text-[10px] font-medium transition-colors ${
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
  const activeScreen = tabs.find((tab) => tab.id === activeTab)?.screen;

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
        <Footer activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </FavoritesContext.Provider>
  );
}
