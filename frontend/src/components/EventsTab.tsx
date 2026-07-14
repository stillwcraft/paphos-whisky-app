import { useState } from 'react';

type EventStatus = 'past' | 'current' | 'future';

type TastingEvent = {
  id: number;
  title: string;
  date: string;
  location: string;
  image: string;
  status: EventStatus;
  description: string;
  bottles: string[];
};

const events: TastingEvent[] = [
  {
    id: 1,
    title: 'Islay: торф и морской бриз',
    date: '18 января 2026',
    location: 'The Cigar Room, Лимасол',
    image: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=320&q=80',
    status: 'past',
    description: 'Вечер, посвященный островному характеру Islay и его легендарным винокурням.',
    bottles: ['Ardbeg Uigeadail', 'Lagavulin 16', 'Caol Ila 12'],
  },
  {
    id: 2,
    title: 'Шотландская классика',
    date: '22 марта 2026',
    location: 'Vinyl Bar, Пафос',
    image: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=320&q=80',
    status: 'past',
    description: 'Сравнили узнаваемые стили Highland, Speyside и Lowland в камерной компании клуба.',
    bottles: ['GlenDronach 15', 'Balvenie DoubleWood 12', 'Auchentoshan Three Wood'],
  },
  {
    id: 3,
    title: 'Релизы независимых боттлеров',
    date: '25 июля 2026',
    location: 'Whisky Library, Пафос',
    image: 'https://images.unsplash.com/photo-1568213816046-0ee1c42bd559?auto=format&fit=crop&w=320&q=80',
    status: 'current',
    description: 'Открываем редкие релизы от независимых боттлеров и обсуждаем, как читать этикетки.',
    bottles: ['Signatory Vintage Bunnahabhain 2013', 'Gordon & MacPhail Linkwood 2009', 'Cadenhead Glenlossie 2010'],
  },
  {
    id: 4,
    title: 'Японский виски: баланс и точность',
    date: '29 августа 2026',
    location: 'Rooftop 51, Лимасол',
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=320&q=80',
    status: 'future',
    description: 'Будущая встреча клуба о японской школе виски, блендах и гармонии вкуса.',
    bottles: ['Nikka From The Barrel', 'Hibiki Japanese Harmony', 'Mars Kasei'],
  },
];

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-9 w-9" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

type EventModalProps = {
  event: TastingEvent;
  onClose: () => void;
};

function EventModal({ event, onClose }: EventModalProps) {
  return (
    <div className="fixed inset-0 z-20 flex items-end bg-slate-950/75 p-4 backdrop-blur-sm sm:items-center sm:justify-center" role="presentation">
      <section
        aria-labelledby="event-modal-title"
        aria-modal="true"
        role="dialog"
        className="w-full max-w-md rounded-3xl border border-amber-100/10 bg-slate-900 p-6 shadow-2xl shadow-black/50"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">{event.date}</p>
        <h2 id="event-modal-title" className="mt-2 text-2xl font-semibold text-white">{event.title}</h2>
        <p className="mt-1 text-sm text-slate-400">{event.location}</p>
        <p className="mt-5 text-sm leading-6 text-slate-300">{event.description}</p>
        <h3 className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-amber-400">В бутылках</h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-200">
          {event.bottles.map((bottle) => <li key={bottle}>• {bottle}</li>)}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="mt-7 w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-300"
        >
          Закрыть
        </button>
      </section>
    </div>
  );
}

export function EventsTab() {
  const [selectedEvent, setSelectedEvent] = useState<TastingEvent | null>(null);

  return (
    <section className="w-full max-w-md pb-5 pt-8">
      <header className="mb-8 px-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">Whisky Club</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Хронология дегустаций</h1>
      </header>

      <div className="relative mx-auto px-5">
        <div className="absolute bottom-12 left-12 top-12 border-l border-dashed border-amber-300/40" aria-hidden="true" />
        <ol className="space-y-8">
          {events.map((event) => {
            const isPast = event.status === 'past';
            const isCurrent = event.status === 'current';
            const isFuture = event.status === 'future';

            return (
              <li key={event.id} className="relative flex gap-5">
                <button
                  type="button"
                  aria-label={`Открыть детали: ${event.title}`}
                  onClick={() => setSelectedEvent(event)}
                  className={`relative z-10 flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                    isCurrent
                      ? 'animate-pulse border-amber-400 ring-4 ring-amber-400/30'
                      : isFuture
                        ? 'border-slate-500 bg-slate-800 text-slate-400 shadow-inner shadow-black/50'
                        : 'border-slate-600'
                  }`}
                >
                  {isFuture ? (
                    <ClockIcon />
                  ) : (
                    <img
                      src={event.image}
                      alt=""
                      className={`h-full w-full object-cover ${isPast ? 'grayscale opacity-50' : ''}`}
                    />
                  )}
                </button>

                <article className={`min-w-0 flex-1 rounded-2xl border p-4 ${isCurrent ? 'border-amber-400/30 bg-amber-400/5' : 'border-white/10 bg-slate-800/70'}`}>
                  <p className="text-xs font-medium text-amber-400">{event.date}</p>
                  <h2 className="mt-1 text-base font-semibold text-white">{event.title}</h2>
                  <p className="mt-1 text-sm text-slate-400">{event.location}</p>
                  {isCurrent && (
                    <button
                      type="button"
                      className="mt-4 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-300"
                    >
                      Записаться
                    </button>
                  )}
                </article>
              </li>
            );
          })}
        </ol>
      </div>

      {selectedEvent && <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    </section>
  );
}