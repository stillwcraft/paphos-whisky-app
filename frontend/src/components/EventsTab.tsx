import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initData, useSignal } from '@tma.js/sdk-react';

const API_BASE_URL = 'https://paphos-whisky-api.onrender.com';

type ClubEvent = {
  id: number;
  title: string;
  date: string;
  description: string;
  price: number;
  image_url: string | null;
  has_samples: boolean;
};

type Member = {
  id: number;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  registered: boolean;
  samples: boolean;
};

type SheetMode = 'registration' | 'samples';
type SheetTab = 'main' | 'events' | 'members' | 'profile';
type Feedback = { kind: 'error'; message: string } | null;

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (typeof payload === 'object' && payload !== null && 'detail' in payload) {
      return String(payload.detail);
    }
  } catch {
    // Use the response status when the API does not return a JSON error.
  }

  return `Ошибка сервера: ${response.status}`;
}

function formatDate(date: string) {
  const parsedDate = new Date(date);
  return Number.isNaN(parsedDate.valueOf())
    ? date
    : new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(parsedDate);
}

function BottomSheet({
  activeTab,
  event,
  members,
  mode,
  onClose,
  onCancel,
  onSelectTab,
  upcomingEvent,
}: {
  activeTab: SheetTab;
  event: ClubEvent;
  members: Member[];
  mode: SheetMode;
  onClose: () => void;
  onCancel: () => void;
  onSelectTab: (tab: SheetTab) => void;
  upcomingEvent: ClubEvent | undefined;
}) {
  const visibleMembers = members.filter((member) => (
    mode === 'registration' ? member.registered : member.samples
  ));
  const isRegistration = mode === 'registration';

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-slate-950/75 p-3 backdrop-blur-sm" role="presentation">
      <style>{'@keyframes bottomsheet-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }'}</style>
      <section
        aria-label="Панель события"
        aria-modal="true"
        role="dialog"
        className="mx-auto w-full max-w-md rounded-t-3xl border border-amber-100/10 bg-slate-900 p-5 shadow-2xl shadow-black/50"
        style={{ animation: 'bottomsheet-slide-up 220ms ease-out' }}
      >
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-slate-600" />

        {activeTab === 'main' && (
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">{event.title}</p>
            <h2 className="mt-3 text-xl font-semibold text-white">
              {isRegistration ? 'Вы зарегистрированы' : 'Сэмплы зарезервированы'}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {isRegistration ? 'Ждём вас на дегустации.' : 'Ваш сет будет подготовлен к событию.'}
            </p>
            <button
              type="button"
              onClick={onCancel}
              className="mt-6 w-full rounded-xl bg-red-500/90 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-400"
            >
              {isRegistration ? 'Cancel registration' : 'Cancel'}
            </button>
          </div>
        )}

        {activeTab === 'events' && (
          <div>
            <h2 className="text-xl font-semibold text-white">Ближайший релиз клуба</h2>
            {upcomingEvent ? (
              <article className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-800/70">
                {upcomingEvent.image_url && <img src={upcomingEvent.image_url} alt="" className="h-36 w-full object-cover" />}
                <div className="p-4">
                  <p className="text-xs font-semibold text-amber-400">{formatDate(upcomingEvent.date)}</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">{upcomingEvent.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{upcomingEvent.description}</p>
                  <p className="mt-4 text-sm font-semibold text-amber-400">€{upcomingEvent.price}</p>
                </div>
              </article>
            ) : (
              <p className="mt-4 text-sm text-slate-400">Следующий релиз скоро появится.</p>
            )}
          </div>
        )}

        {activeTab === 'members' && (
          <div>
            <h2 className="text-xl font-semibold text-white">
              {isRegistration ? 'Участники дегустации' : 'Зарезервировали сэмплы'}
            </h2>
            {visibleMembers.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">Пока никого нет.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {visibleMembers.map((member) => (
                  <li key={member.id} className="rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-slate-200">
                    {member.first_name ?? 'Участник'}{member.username ? ` · @${member.username}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="py-6 text-center">
            <h2 className="text-xl font-semibold text-white">Профиль</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Профиль в разработке (скоро здесь можно будет настроить аватар и описание)
            </p>
          </div>
        )}

        <nav aria-label="Навигация шторки" className="mt-6 grid grid-cols-4 gap-2 border-t border-white/10 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-600 px-1 py-2 text-[11px] font-medium text-slate-300 hover:bg-white/5">🏠 Home</button>
          <button type="button" onClick={() => onSelectTab('events')} className="rounded-lg border border-slate-600 px-1 py-2 text-[11px] font-medium text-slate-300 hover:bg-white/5">📅 Events</button>
          <button type="button" onClick={() => onSelectTab('members')} className="rounded-lg border border-slate-600 px-1 py-2 text-[11px] font-medium text-slate-300 hover:bg-white/5">👥 Members</button>
          <button type="button" onClick={() => onSelectTab('profile')} className="rounded-lg border border-slate-600 px-1 py-2 text-[11px] font-medium text-slate-300 hover:bg-white/5">👤 Profile</button>
        </nav>
      </section>
    </div>
  );
}

export function EventsTab() {
  const initDataState = useSignal(initData.state);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState<number | null>(null);
  const [sheetEvent, setSheetEvent] = useState<ClubEvent | null>(null);
  const [sheetMode, setSheetMode] = useState<SheetMode>('registration');
  const [activeTab, setActiveTab] = useState<SheetTab>('main');
  const [members, setMembers] = useState<Member[]>([]);
  const timelineRef = useRef<HTMLDivElement>(null);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/events`);
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }
      setEvents(await response.json() as ClubEvent[]);
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Не удалось загрузить события.',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const upcomingEvent = useMemo(() => {
    const now = Date.now();
    return [...events]
      .filter((event) => new Date(event.date).valueOf() >= now)
      .sort((first, second) => new Date(first.date).valueOf() - new Date(second.date).valueOf())[0];
  }, [events]);
  const orderedEvents = useMemo(
    () => [...events].sort(
      (first, second) => new Date(first.date).valueOf() - new Date(second.date).valueOf(),
    ),
    [events],
  );
  const centeredEventIndex = useMemo(() => {
    const now = new Date();
    const nextEventIndex = orderedEvents.findIndex(
      (event) => new Date(event.date).valueOf() >= now.valueOf(),
    );

    return nextEventIndex === -1 ? orderedEvents.length - 1 : nextEventIndex;
  }, [orderedEvents]);

  useEffect(() => {
    const timeline = timelineRef.current;
    const centeredCard = timeline?.querySelector<HTMLElement>(
      `[data-event-index="${centeredEventIndex}"]`,
    );

    if (!timeline || !centeredCard) {
      return;
    }

    timeline.scrollTo({
      top: centeredCard.offsetTop - (timeline.clientHeight - centeredCard.clientHeight) / 2,
      behavior: 'auto',
    });
  }, [centeredEventIndex, orderedEvents.length]);

  const updateParticipation = async (
    event: ClubEvent,
    mode: SheetMode,
    value: boolean,
    openSheet: boolean,
  ) => {
    const user = initDataState?.user;
    if (!user) {
      setFeedback({ kind: 'error', message: 'Откройте приложение через Telegram, чтобы записаться.' });
      return;
    }

    setIsSubmitting(event.id);
    setFeedback(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/events/${event.id}/${mode === 'registration' ? 'register' : 'samples'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegram_id: user.id,
            username: user.username ?? null,
            first_name: user.first_name ?? null,
            [mode === 'registration' ? 'registered' : 'samples']: value,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      if (openSheet) {
        setSheetEvent(event);
        setSheetMode(mode);
        setActiveTab('main');
        setMembers([]);
      } else {
        setSheetEvent(null);
      }
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Не удалось обновить регистрацию.',
      });
    } finally {
      setIsSubmitting(null);
    }
  };

  const loadMembers = useCallback(async () => {
    if (!sheetEvent) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${sheetEvent.id}/members`);
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }
      setMembers(await response.json() as Member[]);
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Не удалось загрузить участников.',
      });
    }
  }, [sheetEvent]);

  const selectSheetTab = (tab: SheetTab) => {
    setActiveTab(tab);
    if (tab === 'members') {
      void loadMembers();
    }
  };

  const closeSheet = () => {
    setSheetEvent(null);
    setActiveTab('main');
    setMembers([]);
  };

  return (
    <section className="mx-auto w-full max-w-md pb-5 pt-8">
      <header className="mb-8 px-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">Whisky Club</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Events</h1>
      </header>

      {feedback && <p className="mx-5 mb-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">{feedback.message}</p>}

      {isLoading ? (
        <p className="px-5 text-center text-sm text-slate-400">Загружаем события...</p>
      ) : events.length === 0 ? (
        <p className="px-5 text-center text-sm text-slate-400">События скоро появятся.</p>
      ) : (
        <div ref={timelineRef} className="h-[min(34rem,calc(100vh-13rem))] min-h-[28rem] snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth">
          <ol className="h-full space-y-4 px-5">
            <li aria-hidden="true" className="pointer-events-none" style={{ height: 'calc(50% - 9rem)' }} />
            {orderedEvents.map((event, index) => {
              const isPast = new Date(event.date).valueOf() < new Date().valueOf();
              const isDisabled = isPast || isSubmitting === event.id;

              return (
                <li
                  key={event.id}
                  data-event-index={index}
                  className="h-72 snap-center overflow-hidden rounded-2xl border border-white/10 bg-slate-800/70 shadow-xl shadow-black/20"
                >
                  {event.image_url && <img src={event.image_url} alt="" className="h-24 w-full object-cover" />}
                  <article className="flex h-[calc(100%-6rem)] flex-col p-4">
                    <p className="text-xs font-semibold text-amber-400">{formatDate(event.date)}</p>
                    <h2 className="mt-2 text-lg font-semibold text-white">{event.title}</h2>
                    <p className="mt-2 max-h-12 overflow-hidden text-sm leading-6 text-slate-300">{event.description}</p>
                    <p className="mt-3 text-sm font-semibold text-amber-400">€{event.price}</p>
                    <div className="mt-auto flex gap-2 pt-3">
                      <button
                        type="button"
                        disabled={isDisabled}
                        onClick={() => void updateParticipation(event, 'registration', true, true)}
                        className="flex-1 rounded-lg bg-amber-400 px-3 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Register
                      </button>
                      {event.has_samples && (
                        <button
                          type="button"
                          disabled={isDisabled}
                          onClick={() => void updateParticipation(event, 'samples', true, true)}
                          className="flex-1 rounded-lg bg-slate-600 px-3 py-2.5 text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Samples
                        </button>
                      )}
                    </div>
                  </article>
                </li>
              );
            })}
            <li aria-hidden="true" className="pointer-events-none" style={{ height: 'calc(50% - 9rem)' }} />
          </ol>
        </div>
      )}

      {sheetEvent && (
        <BottomSheet
          activeTab={activeTab}
          event={sheetEvent}
          members={members}
          mode={sheetMode}
          onClose={closeSheet}
          onCancel={() => void updateParticipation(sheetEvent, sheetMode, false, false)}
          onSelectTab={selectSheetTab}
          upcomingEvent={upcomingEvent}
        />
      )}
    </section>
  );
}
