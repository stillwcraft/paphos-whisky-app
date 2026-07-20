import { useCallback, useEffect, useState, type FormEvent } from 'react';

const API_BASE_URL = 'https://paphos-whisky-api.onrender.com';
type I18nString = Partial<Record<'en' | 'ru' | 'uk', string>>;

type Feedback = {
  kind: 'success' | 'error';
  message: string;
};

type AdminEvent = {
  id: number;
  title: string;
  title_i18n?: I18nString;
  name_i18n?: I18nString;
  date: string;
  description: string;
  description_i18n?: I18nString;
  price: number;
  image_url: string | null;
  has_samples: boolean;
  bottle_ids?: number[];
  bottles?: Array<Pick<Bottle, 'id'>>;
};

type EventForm = {
  title: string;
  date: string;
  description: string;
  price: string;
  image_url: string;
  has_samples: boolean;
  bottle_ids: number[];
};

const initialEventForm: EventForm = {
  title: '',
  date: '',
  description: '',
  price: '',
  image_url: '',
  has_samples: false,
  bottle_ids: [],
};

type Distillery = {
  id: number;
  name: string;
  name_i18n?: I18nString;
  image_url: string | null;
  description_i18n?: I18nString;
};

type Bottle = {
  id: number;
  name: string;
  name_i18n?: I18nString;
  distillery_id: number;
  age: number | null;
  abv?: string | null;
  price_per_sample: number;
  description: string;
  description_i18n?: I18nString;
  image_url: string | null;
};

const initialDistilleryForm = {
  name: '',
  image_url: '',
};

const initialBottleForm = {
  name: '',
  distillery_id: '',
  age: '',
  price_per_sample: '',
  description: '',
  image_url: '',
};

const inputClassName = 'w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400';

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (typeof payload === 'object' && payload !== null && 'detail' in payload) {
      return String(payload.detail);
    }
  } catch {
    // Use the generic message when the API does not return JSON.
  }

  return `Ошибка сервера: ${response.status}`;
}

export function AdminTab() {
  const [eventForm, setEventForm] = useState<EventForm>(initialEventForm);
  const [distilleryForm, setDistilleryForm] = useState(initialDistilleryForm);
  const [bottleForm, setBottleForm] = useState(initialBottleForm);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [distilleries, setDistilleries] = useState<Distillery[]>([]);
  const [bottles, setBottles] = useState<Bottle[]>([]);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  const loadEvents = useCallback(async () => {
    setIsLoadingEvents(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/events`);
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      setEvents(await response.json() as AdminEvent[]);
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Не удалось загрузить события.',
      });
    } finally {
      setIsLoadingEvents(false);
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    try {
      const [distilleriesResponse, bottlesResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/distilleries`),
        fetch(`${API_BASE_URL}/api/bottles`),
      ]);
      if (!distilleriesResponse.ok) {
        throw new Error(await getErrorMessage(distilleriesResponse));
      }
      if (!bottlesResponse.ok) {
        throw new Error(await getErrorMessage(bottlesResponse));
      }

      setDistilleries(await distilleriesResponse.json() as Distillery[]);
      setBottles(await bottlesResponse.json() as Bottle[]);
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Не удалось загрузить каталог.',
      });
    }
  }, []);

  useEffect(() => {
    void loadEvents();
    void loadCatalog();
  }, [loadCatalog, loadEvents]);

  const cancelEditing = () => {
    setEditingEventId(null);
    setEventForm(initialEventForm);
  };

  const startEditing = (currentEvent: AdminEvent) => {
    setEditingEventId(currentEvent.id);
    setEventForm({
      title: currentEvent.title,
      date: currentEvent.date,
      description: currentEvent.description,
      price: String(currentEvent.price),
      image_url: currentEvent.image_url ?? '',
      has_samples: currentEvent.has_samples,
      bottle_ids: currentEvent.bottle_ids ?? currentEvent.bottles?.map((bottle) => bottle.id) ?? [],
    });
    setFeedback(null);
  };

  const submitEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    const isEditing = editingEventId !== null;

    try {
      const response = await fetch(
        isEditing
          ? `${API_BASE_URL}/api/events/${editingEventId}`
          : `${API_BASE_URL}/api/events`,
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...eventForm,
            price: Number(eventForm.price),
            image_url: eventForm.image_url || null,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      await loadEvents();
      cancelEditing();
      setFeedback({
        kind: 'success',
        message: isEditing ? 'Изменения сохранены.' : 'Событие успешно создано.',
      });
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Не удалось сохранить событие.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const submitDistillery = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/distilleries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...distilleryForm,
          image_url: distilleryForm.image_url || null,
        }),
      });
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      setDistilleryForm(initialDistilleryForm);
      await loadCatalog();
      setFeedback({ kind: 'success', message: 'Дистиллерия добавлена.' });
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Не удалось добавить дистиллерию.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteDistillery = async (distillery: Distillery) => {
    if (!window.confirm(`Удалить ${distillery.name} и все её бутылки?`)) {
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/distilleries/${distillery.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      if (bottleForm.distillery_id === String(distillery.id)) {
        setBottleForm(initialBottleForm);
      }
      await loadCatalog();
      setFeedback({ kind: 'success', message: 'Дистиллерия и её бутылки удалены.' });
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Не удалось удалить дистиллерию.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const submitBottle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/bottles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...bottleForm,
          distillery_id: Number(bottleForm.distillery_id),
          age: bottleForm.age ? Number(bottleForm.age) : undefined,
          price_per_sample: Number(bottleForm.price_per_sample),
          image_url: bottleForm.image_url || null,
        }),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      setBottleForm(initialBottleForm);
      await loadCatalog();
      setFeedback({ kind: 'success', message: 'Виски успешно добавлен.' });
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Не удалось добавить виски.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteBottle = async (bottle: Bottle) => {
    setIsSaving(true);
    setFeedback(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/bottles/${bottle.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      await loadCatalog();
      setFeedback({ kind: 'success', message: 'Бутылка удалена.' });
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Не удалось удалить бутылку.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const editingEvent = events.find((event) => event.id === editingEventId);

  return (
    <section className="mx-auto w-full max-w-md space-y-6 py-8">
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">Whisky Club</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Панель администратора</h1>
      </header>

      {feedback && (
        <p className={`rounded-xl border px-4 py-3 text-sm ${
          feedback.kind === 'success'
            ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
            : 'border-red-400/30 bg-red-400/10 text-red-300'
        }`}>
          {feedback.message}
        </p>
      )}

      <form onSubmit={submitEvent} className="space-y-4 rounded-2xl border border-white/10 bg-slate-800/70 p-5">
        <h2 className="text-lg font-semibold text-white">
          {editingEvent ? `📝 Редактировать событие ${editingEvent.title}` : 'Создать событие'}
        </h2>
        <input required value={eventForm.title} onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })} placeholder="Название события" className={inputClassName} />
        <input
          required
          type="datetime-local"
          value={eventForm.date}
          onFocus={(event) => event.currentTarget.blur()}
          onClick={(event) => event.currentTarget.showPicker?.()}
          onChange={(event) => setEventForm({ ...eventForm, date: event.target.value })}
          className={inputClassName}
        />
        <textarea required value={eventForm.description} onChange={(event) => setEventForm({ ...eventForm, description: event.target.value })} placeholder="Описание" rows={4} className={`${inputClassName} resize-none`} />
        <div className="space-y-1.5">
          <p className="px-1 text-xs font-medium text-slate-400">Бутылки для дегустации</p>
          <div className="max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-slate-900 p-2">
            {bottles.length === 0 ? (
              <p className="px-2 py-2 text-xs text-slate-500">Бутылки ещё не добавлены.</p>
            ) : (
              <ul className="space-y-0.5">
                {bottles.map((bottle) => {
                  const isSelected = eventForm.bottle_ids.includes(bottle.id);
                  const distillery = distilleries.find((d) => d.id === bottle.distillery_id);
                  return (
                    <li key={bottle.id}>
                      <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2 transition-colors ${isSelected ? 'border-amber-400/30 bg-amber-400/10' : 'border-transparent hover:bg-white/5'}`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() =>
                            setEventForm((current) => ({
                              ...current,
                              bottle_ids: isSelected
                                ? current.bottle_ids.filter((id) => id !== bottle.id)
                                : [...current.bottle_ids, bottle.id],
                            }))
                          }
                          className="h-4 w-4 shrink-0 accent-amber-400"
                        />
                        {bottle.image_url ? (
                          <img src={bottle.image_url} alt="" className="h-9 w-7 shrink-0 rounded object-cover" />
                        ) : (
                          <div aria-hidden="true" className="flex h-9 w-7 shrink-0 items-center justify-center rounded bg-slate-700 text-sm">🥃</div>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium text-white">{bottle.name}</span>
                          <span className="block text-[10px] text-slate-500">
                            {[distillery?.name, bottle.age !== null ? `${bottle.age}y` : null, bottle.abv].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
        <input required min="0" step="0.01" type="number" value={eventForm.price} onChange={(event) => setEventForm({ ...eventForm, price: event.target.value })} placeholder="Цена, EUR" className={inputClassName} />
        <input type="url" value={eventForm.image_url} onChange={(event) => setEventForm({ ...eventForm, image_url: event.target.value })} placeholder="URL изображения (необязательно)" className={inputClassName} />
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={eventForm.has_samples}
            onChange={(event) => setEventForm({ ...eventForm, has_samples: event.target.checked })}
            className="h-4 w-4 accent-amber-400"
          />
          Доступны сэмплы
        </label>
        <div className="flex gap-3">
          <button disabled={isSaving} type="submit" className="flex-1 rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60">
            {editingEventId === null ? 'Сохранить событие' : 'Сохранить изменения'}
          </button>
          {editingEventId !== null && (
            <button type="button" onClick={cancelEditing} className="rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/5">
              ❌ Отмена
            </button>
          )}
        </div>
      </form>

      <section className="rounded-2xl border border-white/10 bg-slate-800/70 p-5">
        <h2 className="text-lg font-semibold text-white">Текущие события</h2>
        {isLoadingEvents ? (
          <p className="mt-4 text-sm text-slate-400">Загружаем события...</p>
        ) : events.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">Событий пока нет.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {events.map((currentEvent) => (
              <li key={currentEvent.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-slate-900/60 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{currentEvent.title}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {currentEvent.date} · €{currentEvent.price}
                    {currentEvent.has_samples ? ' · Сэмплы доступны' : ''}
                  </p>
                </div>
                <button type="button" onClick={() => startEditing(currentEvent)} className="shrink-0 rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-amber-400 transition-colors hover:bg-slate-600">
                  ✏️ Редактировать
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-800/70 p-5">
        <h2 className="text-lg font-semibold text-white">Управление дистиллериями</h2>
        <form onSubmit={submitDistillery} className="space-y-3">
          <input required value={distilleryForm.name} onChange={(event) => setDistilleryForm({ ...distilleryForm, name: event.target.value })} placeholder="Name" className={inputClassName} />
          <input type="url" value={distilleryForm.image_url} onChange={(event) => setDistilleryForm({ ...distilleryForm, image_url: event.target.value })} placeholder="Image URL" className={inputClassName} />
          <button disabled={isSaving} type="submit" className="w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60">
            Add Distillery
          </button>
        </form>

        {distilleries.length === 0 ? (
          <p className="text-sm text-slate-400">Сначала добавьте дистиллерию.</p>
        ) : (
          <ul className="space-y-3 border-t border-white/10 pt-4">
            {distilleries.map((distillery) => {
              const distilleryBottles = bottles.filter(
                (bottle) => bottle.distillery_id === distillery.id,
              );

              return (
                <li key={distillery.id} className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/60">
                  {distillery.image_url && <img src={distillery.image_url} alt="" className="h-24 w-full object-cover" />}
                  <div className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{distillery.name}</p>
                      <p className="mt-1 text-xs text-slate-400">{distilleryBottles.length} bottles</p>
                    </div>
                    <button type="button" disabled={isSaving} onClick={() => void deleteDistillery(distillery)} className="rounded-lg border border-red-400/30 px-3 py-2 text-xs font-semibold text-red-300 transition-colors hover:bg-red-400/10 disabled:opacity-60">
                      🗑️ Delete
                    </button>
                  </div>
                  {distilleryBottles.length > 0 && (
                    <ul className="border-t border-white/10 px-3">
                      {distilleryBottles.map((bottle) => (
                        <li key={bottle.id} className="flex items-center gap-3 border-b border-white/5 py-3 last:border-0">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-slate-100">{bottle.name}</p>
                            <p className="mt-1 text-xs text-slate-400">
                              {bottle.age ? `${bottle.age} years · ` : ''}€{bottle.price_per_sample} per sample
                            </p>
                          </div>
                          <button type="button" disabled={isSaving} onClick={() => void deleteBottle(bottle)} className="shrink-0 rounded-lg px-2 py-2 text-xs font-semibold text-red-300 hover:bg-red-400/10 disabled:opacity-60">
                            ❌ Remove bottle
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <form onSubmit={submitBottle} className="space-y-4 rounded-2xl border border-white/10 bg-slate-800/70 p-5">
        <h2 className="text-lg font-semibold text-white">Добавить бутылку</h2>
        <select required value={bottleForm.distillery_id} onChange={(event) => setBottleForm({ ...bottleForm, distillery_id: event.target.value })} className={inputClassName}>
          <option value="" disabled>Выберите дистиллерию</option>
          {distilleries.map((distillery) => <option key={distillery.id} value={distillery.id}>{distillery.name}</option>)}
        </select>
        <input required value={bottleForm.name} onChange={(event) => setBottleForm({ ...bottleForm, name: event.target.value })} placeholder="Name" className={inputClassName} />
        <input min="0" type="number" value={bottleForm.age} onChange={(event) => setBottleForm({ ...bottleForm, age: event.target.value })} placeholder="Age (optional)" className={inputClassName} />
        <input required min="0" step="0.01" type="number" value={bottleForm.price_per_sample} onChange={(event) => setBottleForm({ ...bottleForm, price_per_sample: event.target.value })} placeholder="Price per sample" className={inputClassName} />
        <textarea required value={bottleForm.description} onChange={(event) => setBottleForm({ ...bottleForm, description: event.target.value })} placeholder="Description" rows={4} className={`${inputClassName} resize-none`} />
        <input type="url" value={bottleForm.image_url} onChange={(event) => setBottleForm({ ...bottleForm, image_url: event.target.value })} placeholder="Image URL" className={inputClassName} />
        <button disabled={isSaving || distilleries.length === 0} type="submit" className="w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60">
          Add bottle
        </button>
      </form>
    </section>
  );
}
