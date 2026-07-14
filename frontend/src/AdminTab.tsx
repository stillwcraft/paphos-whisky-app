import { useState, type FormEvent } from 'react';

const API_BASE_URL = 'https://paphos-whisky-api.onrender.com';

type Feedback = {
  kind: 'success' | 'error';
  message: string;
};

const initialEventForm = {
  title: '',
  date: '',
  description: '',
  price: '',
  image_url: '',
};

const initialBottleForm = {
  name: '',
  distillery: '',
  age: '',
  price_per_sample: '',
  description: '',
  image_url: '',
};

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
  const [eventForm, setEventForm] = useState(initialEventForm);
  const [bottleForm, setBottleForm] = useState(initialBottleForm);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const submitEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...eventForm,
          price: Number(eventForm.price),
          image_url: eventForm.image_url || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      setEventForm(initialEventForm);
      setFeedback({ kind: 'success', message: 'Событие успешно создано.' });
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Не удалось создать событие.',
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
          age: bottleForm.age ? Number(bottleForm.age) : undefined,
          price_per_sample: Number(bottleForm.price_per_sample),
          image_url: bottleForm.image_url || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      setBottleForm(initialBottleForm);
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
        <h2 className="text-lg font-semibold text-white">Создать событие</h2>
        <input required value={eventForm.title} onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })} placeholder="Название события" className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400" />
        <input required value={eventForm.date} onChange={(event) => setEventForm({ ...eventForm, date: event.target.value })} placeholder="Дата" className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400" />
        <textarea required value={eventForm.description} onChange={(event) => setEventForm({ ...eventForm, description: event.target.value })} placeholder="Описание" rows={4} className="w-full resize-none rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400" />
        <input required min="0" step="0.01" type="number" value={eventForm.price} onChange={(event) => setEventForm({ ...eventForm, price: event.target.value })} placeholder="Цена, EUR" className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400" />
        <input type="url" value={eventForm.image_url} onChange={(event) => setEventForm({ ...eventForm, image_url: event.target.value })} placeholder="URL изображения (необязательно)" className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400" />
        <button disabled={isSaving} type="submit" className="w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60">Сохранить событие</button>
      </form>

      <form onSubmit={submitBottle} className="space-y-4 rounded-2xl border border-white/10 bg-slate-800/70 p-5">
        <h2 className="text-lg font-semibold text-white">Добавить виски</h2>
        <input required value={bottleForm.name} onChange={(event) => setBottleForm({ ...bottleForm, name: event.target.value })} placeholder="Название виски" className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400" />
        <input required value={bottleForm.distillery} onChange={(event) => setBottleForm({ ...bottleForm, distillery: event.target.value })} placeholder="Дистиллерия" className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400" />
        <input min="0" type="number" value={bottleForm.age} onChange={(event) => setBottleForm({ ...bottleForm, age: event.target.value })} placeholder="Возраст (необязательно)" className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400" />
        <input required min="0" step="0.01" type="number" value={bottleForm.price_per_sample} onChange={(event) => setBottleForm({ ...bottleForm, price_per_sample: event.target.value })} placeholder="Цена за сэмпл, EUR" className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400" />
        <textarea required value={bottleForm.description} onChange={(event) => setBottleForm({ ...bottleForm, description: event.target.value })} placeholder="Описание" rows={4} className="w-full resize-none rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400" />
        <input type="url" value={bottleForm.image_url} onChange={(event) => setBottleForm({ ...bottleForm, image_url: event.target.value })} placeholder="URL изображения (необязательно)" className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400" />
        <button disabled={isSaving} type="submit" className="w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60">Добавить виски</button>
      </form>
    </section>
  );
}
