import { useCallback, useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { initData, useSignal } from '@tma.js/sdk-react';
import { telegramAuthHeaders } from '@/telegramAuth.ts';

const API_URL = 'https://paphos-whisky-api.onrender.com';
const DEEP_LINK_BASE_URL = 'https://t.me/CyprusWhiskyClubBot/NoMoreDram';
type Label = 'bottle' | 'samples' | 'event';
type Locale = 'en' | 'ru' | 'uk';
type I18nString = Record<Locale, string>;
type I18nResponse = Partial<I18nString>;

type EventItem = {
  id: number; title: string; title_i18n?: I18nResponse; name_i18n?: I18nResponse;
  date: string; description: string; description_i18n?: I18nResponse; price: number;
  samples_price: number | null; image_url_left: string | null; image_url: string | null;
  image_url_right: string | null; has_samples: boolean;
  show_participants: boolean; registered_count: number; samples_count: number;
  bottles?: Array<Pick<Bottle, 'id'>>;
};
type Distillery = {
  id: number; name: string; name_i18n?: I18nResponse; image_url: string | null;
  description: string | null; description_i18n?: I18nResponse;
};
type TastingTag = {
  id: number; name: string; name_i18n?: I18nResponse;
  description_i18n?: I18nResponse; icon_url: string;
};
type Bottle = {
  id: number; name: string; name_i18n?: I18nResponse; distillery_id: number | null;
  label: Label; age: string | null; abv: string | null; cask: string | null;
  bottles: string | null; price_per_sample: number; description: string;
  description_i18n?: I18nResponse; image_url: string | null; background_url: string | null;
};
type BottleBackground = {
  id: number; name: string; image_url: string;
};
type EventForm = {
  title: string; title_i18n: I18nString; date: string; description: string;
  description_i18n: I18nString; price: number; samples_price: number | null;
  image_url_left: string | null; image_url: string | null; image_url_right: string | null;
  has_samples: boolean; show_participants: boolean; bottle_ids: number[];
};
type DistilleryForm = {
  name: string; name_i18n: I18nString; image_url: string | null;
  description: string | null; description_i18n: I18nString;
};
type TastingTagForm = {
  name: string; name_i18n: I18nString; description_i18n: I18nString; icon_url: string;
};
type BottleForm = {
  name: string; name_i18n: I18nString; label: Label; age: string; abv: string;
  cask: string; bottles: string; price_per_sample: string; description: string;
  description_i18n: I18nString; image_url: string; background_url: string | null;
};
type Deletion = { kind: 'event'; item: EventItem } | { kind: 'distillery'; item: Distillery } | { kind: 'tag'; item: TastingTag } | { kind: 'bottle'; item: Bottle };

const locales: Locale[] = ['en', 'ru', 'uk'];
const emptyI18n = (): I18nString => ({ en: '', ru: '', uk: '' });

function toI18n(translations: I18nResponse | undefined, fallback: string | null | undefined): I18nString {
  return {
    en: translations?.en ?? fallback ?? '',
    ru: translations?.ru ?? '',
    uk: translations?.uk ?? '',
  };
}

const emptyEvent = (): EventForm => ({
  title: '', title_i18n: emptyI18n(), date: '', description: '',
  description_i18n: emptyI18n(), price: 0, samples_price: null, image_url_left: null,
  image_url: null, image_url_right: null,
  has_samples: false, show_participants: true, bottle_ids: [],
});
const emptyDistillery = (): DistilleryForm => ({
  name: '', name_i18n: emptyI18n(), image_url: null, description: null,
  description_i18n: emptyI18n(),
});
const emptyTastingTag = (): TastingTagForm => ({
  name: '', name_i18n: emptyI18n(), description_i18n: emptyI18n(), icon_url: '',
});
const emptyBottle = (): BottleForm => ({
  name: '', name_i18n: emptyI18n(), label: 'bottle', age: '', abv: '', cask: '',
  bottles: '', price_per_sample: '', description: '', description_i18n: emptyI18n(),
  image_url: '', background_url: null,
});

function eventFormFromItem(item: EventItem): EventForm {
  return {
    title: item.title, title_i18n: toI18n(item.title_i18n ?? item.name_i18n, item.title),
    date: item.date, description: item.description,
    description_i18n: toI18n(item.description_i18n, item.description), price: item.price,
    samples_price: item.samples_price, image_url_left: item.image_url_left,
    image_url: item.image_url, image_url_right: item.image_url_right,
    has_samples: item.has_samples,
    show_participants: item.show_participants,
    bottle_ids: item.bottles?.map((bottle) => bottle.id) ?? [],
  };
}

function distilleryFormFromItem(item: Distillery): DistilleryForm {
  return {
    name: item.name, name_i18n: toI18n(item.name_i18n, item.name),
    image_url: item.image_url, description: item.description,
    description_i18n: toI18n(item.description_i18n, item.description),
  };
}

function tastingTagFormFromItem(item: TastingTag): TastingTagForm {
  return {
    name: item.name, name_i18n: toI18n(item.name_i18n, item.name),
    description_i18n: toI18n(item.description_i18n, ''),
    icon_url: item.icon_url,
  };
}

function bottleFormFromItem(item: Bottle): BottleForm {
  return {
    name: item.name, name_i18n: toI18n(item.name_i18n, item.name), label: item.label,
    age: item.age ?? '', abv: item.abv ?? '', cask: item.cask ?? '',
    bottles: item.bottles ?? '', price_per_sample: String(item.price_per_sample),
    description: item.description,
    description_i18n: toI18n(item.description_i18n, item.description),
    image_url: item.image_url ?? '',
    background_url: item.background_url,
  };
}

async function getError(response: Response) {
  try {
    const data: unknown = await response.json();
    if (typeof data === 'object' && data !== null && 'detail' in data) return String(data.detail);
  } catch { /* Status below is sufficient. */ }
  return `Server error: ${response.status}`;
}

function Accordion({ children, title }: { children: ReactNode; title: string }) {
  return <details style={sectionStyle}><summary style={summaryStyle}>{title}</summary><div style={{ marginTop: 14 }}>{children}</div></details>;
}

function I18nTextEditor({
  label, translations, onChange, multiline = false, required = false,
}: {
  label: string;
  translations: I18nString;
  onChange: (translations: I18nString) => void;
  multiline?: boolean;
  required?: boolean;
}) {
  const [locale, setLocale] = useState<Locale>('en');
  const changeValue = (value: string) => onChange({ ...translations, [locale]: value });
  const languageButtons = locales.map((language) => (
    <button
      key={language}
      onClick={() => setLocale(language)}
      style={language === locale ? activeLocaleButtonStyle : localeButtonStyle}
      type="button"
    >
      [{language.toUpperCase()}]
    </button>
  ));

  return (
    <label style={fieldGroupStyle}>
      <span style={fieldLabelStyle}>{label} <span style={localeRowStyle}>{languageButtons}</span></span>
      {multiline ? (
        <textarea
          required={required}
          rows={4}
          style={{ ...inputStyle, resize: 'vertical', whiteSpace: 'pre-wrap' }}
          value={translations[locale]}
          onChange={(event) => changeValue(event.target.value)}
        />
      ) : (
        <input
          required={required}
          style={inputStyle}
          value={translations[locale]}
          onChange={(event) => changeValue(event.target.value)}
        />
      )}
    </label>
  );
}

function BottleFields({ backgrounds, form, setForm, includeLabel }: { backgrounds: BottleBackground[]; form: BottleForm; setForm: (form: BottleForm) => void; includeLabel: boolean }) {
  return <div style={formStyle}>
    <I18nTextEditor
      label="Name"
      required
      translations={form.name_i18n}
      onChange={(name_i18n) => setForm({ ...form, name: name_i18n.en, name_i18n })}
    />
    <input placeholder="Photo URL" style={inputStyle} value={form.image_url} onChange={(event) => setForm({ ...form, image_url: event.target.value })} />
    <label style={fieldGroupStyle}>
      <span style={fieldLabelStyle}>Card Background Pattern</span>
      <select style={inputStyle} value={form.background_url ?? ''} onChange={(event) => setForm({ ...form, background_url: event.target.value || null })}>
        <option value="">Default / None</option>
        {backgrounds.map((background) => <option key={background.id} value={background.image_url}>{background.name}</option>)}
      </select>
    </label>
    <input required min="0" placeholder="Price" step="0.1" style={inputStyle} type="number" value={form.price_per_sample} onChange={(event) => setForm({ ...form, price_per_sample: event.target.value })} />
    <input placeholder="Age (optional)" style={inputStyle} value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })} />
    <input placeholder="ABV (optional)" style={inputStyle} value={form.abv} onChange={(event) => setForm({ ...form, abv: event.target.value })} />
    <label style={fieldGroupStyle}>
      <span style={fieldLabelStyle}>Cask Type</span>
      <input aria-label="Cask Type" name="cask" placeholder="например, First-fill Oloroso Sherry Butt" style={inputStyle} value={form.cask} onChange={(event) => setForm({ ...form, cask: event.target.value })} />
    </label>
    <label style={fieldGroupStyle}>
      <span style={fieldLabelStyle}>Total Bottles / Outturn</span>
      <input aria-label="Total Bottles / Outturn" name="bottles" placeholder="например, 1 of 312 or Limited Release" style={inputStyle} value={form.bottles} onChange={(event) => setForm({ ...form, bottles: event.target.value })} />
    </label>
    {includeLabel && <select style={inputStyle} value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value as Label })}><option value="bottle">bottle</option><option value="samples">samples</option><option value="event">event</option></select>}
    <I18nTextEditor
      label="Description"
      multiline
      required
      translations={form.description_i18n}
      onChange={(description_i18n) => setForm({ ...form, description: description_i18n.en, description_i18n })}
    />
  </div>;
}

export function AdminTab() {
  const initDataRaw = useSignal(initData.raw);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [distilleries, setDistilleries] = useState<Distillery[]>([]);
  const [tastingTags, setTastingTags] = useState<TastingTag[]>([]);
  const [backgrounds, setBackgrounds] = useState<BottleBackground[]>([]);
  const [bottles, setBottles] = useState<Bottle[]>([]);
  const [eventForm, setEventForm] = useState<EventForm>(emptyEvent);
  const [distilleryForm, setDistilleryForm] = useState<DistilleryForm>(emptyDistillery);
  const [tastingTagForm, setTastingTagForm] = useState<TastingTagForm>(emptyTastingTag);
  const [catalogBottleForm, setCatalogBottleForm] = useState<BottleForm>(emptyBottle);
  const [tabBottleForm, setTabBottleForm] = useState<BottleForm>(emptyBottle);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [editingDistilleryId, setEditingDistilleryId] = useState<number | null>(null);
  const [editingTastingTagId, setEditingTastingTagId] = useState<number | null>(null);
  const [editingCatalogBottleId, setEditingCatalogBottleId] = useState<number | null>(null);
  const [editingTabBottleId, setEditingTabBottleId] = useState<number | null>(null);
  const [catalogDistilleryId, setCatalogDistilleryId] = useState<number | null>(null);
  const [openBottleLists, setOpenBottleLists] = useState<number[]>([]);
  const [deletion, setDeletion] = useState<Deletion | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savingTastingTag, setSavingTastingTag] = useState(false);
  const [backgroundName, setBackgroundName] = useState('');
  const [backgroundImageUrl, setBackgroundImageUrl] = useState('');

  const loadContent = useCallback(async () => {
    try {
      const [eventsResponse, distilleriesResponse, tastingTagsResponse, bottlesResponse, backgroundsResponse] = await Promise.all([
        fetch(`${API_URL}/api/events`), fetch(`${API_URL}/api/distilleries`), fetch(`${API_URL}/api/tasting-tags`), fetch(`${API_URL}/api/bottles`),
        fetch(`${API_URL}/api/admin/bottle-backgrounds`, { headers: telegramAuthHeaders(initDataRaw) }),
      ]);
      if (!eventsResponse.ok) throw new Error(await getError(eventsResponse));
      if (!distilleriesResponse.ok) throw new Error(await getError(distilleriesResponse));
      if (!tastingTagsResponse.ok) throw new Error(await getError(tastingTagsResponse));
      if (!bottlesResponse.ok) throw new Error(await getError(bottlesResponse));
      if (!backgroundsResponse.ok) throw new Error(await getError(backgroundsResponse));
      const eventSummaries = await eventsResponse.json() as Array<Pick<EventItem, 'id'>>;
      const eventDetailResponses = await Promise.all(
        eventSummaries.map((event) => fetch(`${API_URL}/api/events/${event.id}?lang=en`)),
      );
      const failedEventDetail = eventDetailResponses.find((response) => !response.ok);
      if (failedEventDetail) throw new Error(await getError(failedEventDetail));
      setEvents(await Promise.all(
        eventDetailResponses.map((response) => response.json() as Promise<EventItem>),
      ));
      setDistilleries(await distilleriesResponse.json() as Distillery[]);
      setTastingTags(await tastingTagsResponse.json() as TastingTag[]);
      setBottles(await bottlesResponse.json() as Bottle[]);
      setBackgrounds(await backgroundsResponse.json() as BottleBackground[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load admin content.');
    }
  }, [initDataRaw]);

  useEffect(() => { void loadContent(); }, [loadContent]);
  const resetEvent = () => { setEditingEventId(null); setEventForm(emptyEvent()); };
  const resetDistillery = () => { setEditingDistilleryId(null); setDistilleryForm(emptyDistillery()); };
  const resetTastingTag = () => { setEditingTastingTagId(null); setTastingTagForm(emptyTastingTag()); };
  const resetCatalogBottle = () => { setEditingCatalogBottleId(null); setCatalogDistilleryId(null); setCatalogBottleForm(emptyBottle()); };
  const resetTabBottle = () => { setEditingTabBottleId(null); setTabBottleForm(emptyBottle()); };

  const saveEvent = async (event: FormEvent) => {
    event.preventDefault();
    if (!eventForm.title.trim() || !eventForm.description.trim()) {
      setMessage('English title and description are required.');
      return;
    }
    const editing = editingEventId !== null;
    try {
      const response = await fetch(editing ? `${API_URL}/api/events/${editingEventId}` : `${API_URL}/api/events`, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', ...telegramAuthHeaders(initDataRaw) }, body: JSON.stringify(eventForm) });
      if (!response.ok) throw new Error(await getError(response));
      resetEvent(); await loadContent(); setMessage(editing ? 'Event updated.' : 'Event created.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save event.'); }
  };
  const saveDistillery = async (event: FormEvent) => {
    event.preventDefault();
    if (!distilleryForm.name.trim()) {
      setMessage('English name is required.');
      return;
    }
    const editing = editingDistilleryId !== null;
    try {
      const response = await fetch(editing ? `${API_URL}/api/distilleries/${editingDistilleryId}` : `${API_URL}/api/distilleries`, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', ...telegramAuthHeaders(initDataRaw) }, body: JSON.stringify(distilleryForm) });
      if (!response.ok) throw new Error(await getError(response));
      resetDistillery(); await loadContent(); setMessage(editing ? 'Distillery updated.' : 'Distillery created.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save distillery.'); }
  };
  const saveTastingTag = async (event: FormEvent) => {
    event.preventDefault();
    if (!tastingTagForm.name.trim()) {
      setMessage('English name is required.');
      return;
    }
    const editing = editingTastingTagId !== null;
    setSavingTastingTag(true);
    try {
      const response = await fetch(editing ? `${API_URL}/api/admin/tasting-tags/${editingTastingTagId}` : `${API_URL}/api/admin/tasting-tags`, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', ...telegramAuthHeaders(initDataRaw) }, body: JSON.stringify(tastingTagForm) });
      if (!response.ok) throw new Error(await getError(response));
      resetTastingTag(); await loadContent(); setMessage(editing ? 'Tasting tag updated.' : 'Tasting tag created.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save tasting tag.'); } finally { setSavingTastingTag(false); }
  };
  const saveBottle = async (event: FormEvent, form: BottleForm, distilleryId: number | null, editingId: number | null, reset: () => void) => {
    event.preventDefault();
    if (!form.name.trim() || !form.description.trim()) {
      setMessage('English name and description are required.');
      return;
    }
    const editing = editingId !== null;
    try {
      const response = await fetch(editing ? `${API_URL}/api/bottles/${editingId}` : `${API_URL}/api/bottles`, {
        method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', ...telegramAuthHeaders(initDataRaw) },
        body: JSON.stringify({ ...form, distillery_id: distilleryId, age: form.age || null, abv: form.abv || null, cask: form.cask || null, bottles: form.bottles || null, image_url: form.image_url || null, price_per_sample: Number(form.price_per_sample) }),
      });
      if (!response.ok) throw new Error(await getError(response));
      reset(); await loadContent(); setMessage(editing ? 'Card updated.' : 'Card created.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save card.'); }
  };
  const saveBackground = async (event: FormEvent) => {
    event.preventDefault();
    if (!backgroundName.trim() || !backgroundImageUrl.trim()) {
      setMessage('Background name and image URL are required.');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/admin/bottle-backgrounds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...telegramAuthHeaders(initDataRaw) },
        body: JSON.stringify({ name: backgroundName, image_url: backgroundImageUrl }),
      });
      if (!response.ok) throw new Error(await getError(response));
      setBackgroundName('');
      setBackgroundImageUrl('');
      await loadContent();
      setMessage('Background added.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add background.');
    }
  };
  const removeBackground = async (backgroundId: number) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/bottle-backgrounds/${backgroundId}`, {
        method: 'DELETE',
        headers: telegramAuthHeaders(initDataRaw),
      });
      if (!response.ok) throw new Error(await getError(response));
      await loadContent();
      setMessage('Background deleted.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not delete background.');
    }
  };
  const remove = async () => {
    if (!deletion) return;
    const path = deletion.kind === 'event' ? 'events' : deletion.kind === 'distillery' ? 'distilleries' : deletion.kind === 'bottle' ? 'bottles' : 'admin/tasting-tags';
    try {
      const response = await fetch(`${API_URL}/api/${path}/${deletion.item.id}`, { method: 'DELETE', headers: telegramAuthHeaders(initDataRaw) });
      if (!response.ok) throw new Error(await getError(response));
      setDeletion(null); await loadContent(); setMessage('Deleted.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not delete item.'); }
  };
  const editBottle = (bottle: Bottle) => {
    const form = bottleFormFromItem(bottle);
    if (bottle.distillery_id === null) { setTabBottleForm(form); setEditingTabBottleId(bottle.id); } else { setCatalogBottleForm(form); setCatalogDistilleryId(bottle.distillery_id); setEditingCatalogBottleId(bottle.id); setOpenBottleLists((current) => current.includes(bottle.distillery_id!) ? current : [...current, bottle.distillery_id!]); }
  };
  const copyDeepLink = async (kind: 'event' | 'bottle' | 'distillery', id: number) => {
    const link = `${DEEP_LINK_BASE_URL}?startapp=${kind}_${id}`;
    if (!navigator.clipboard) {
      setMessage('Clipboard access is unavailable.');
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      setMessage('Deep link copied.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not copy deep link.');
    }
  };

  return <div style={pageStyle}>
    {message && <p style={messageStyle}>{message}</p>}
    <Accordion title="📅 Manage Events">
      <form onSubmit={saveEvent} style={formStyle}>
        <I18nTextEditor label="Title" required translations={eventForm.title_i18n} onChange={(title_i18n) => setEventForm({ ...eventForm, title: title_i18n.en, title_i18n })} />
        <input required style={inputStyle} type="datetime-local" value={eventForm.date} onChange={(event) => setEventForm({ ...eventForm, date: event.target.value })} />
        <I18nTextEditor label="Description" multiline required translations={eventForm.description_i18n} onChange={(description_i18n) => setEventForm({ ...eventForm, description: description_i18n.en, description_i18n })} />
        <fieldset style={{ ...fieldGroupStyle, border: 0, margin: 0, padding: 0 }}>
          <legend style={fieldLabelStyle}>Tasting Bottles</legend>
          <div style={{ ...listStyle, marginTop: 0, maxHeight: 240, overflowY: 'auto' }}>
            {bottles.length === 0 ? <span style={{ color: '#a0aec0', fontSize: 13 }}>No bottles available.</span> : bottles.map((bottle) => {
              const selected = eventForm.bottle_ids.includes(bottle.id);
              const distillery = distilleries.find((item) => item.id === bottle.distillery_id);
              return <label key={bottle.id} style={{ ...rowStyle, border: selected ? '1px solid #f59e0b' : '1px solid transparent', cursor: 'pointer' }}>
                <span style={{ alignItems: 'center', display: 'flex', gap: 8, minWidth: 0 }}>
                  <input
                    checked={selected}
                    type="checkbox"
                    onChange={() => setEventForm((current) => ({
                      ...current,
                      bottle_ids: selected
                        ? current.bottle_ids.filter((id) => id !== bottle.id)
                        : [...current.bottle_ids, bottle.id],
                    }))}
                  />
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bottle.name}</strong>
                    <small style={{ color: '#a0aec0' }}>{[distillery?.name, bottle.age, bottle.abv].filter(Boolean).join(' · ')}</small>
                  </span>
                </span>
                {bottle.image_url && <img alt="" src={bottle.image_url} style={{ borderRadius: 4, height: 36, objectFit: 'cover', width: 28 }} />}
              </label>;
            })}
          </div>
        </fieldset>
        <input required min="0" placeholder="Price" style={inputStyle} type="number" value={eventForm.price || ''} onChange={(event) => setEventForm({ ...eventForm, price: Number(event.target.value) })} />
        <input min="0" placeholder="Samples Price (EUR)" step="0.1" style={inputStyle} type="number" value={eventForm.samples_price ?? ''} onChange={(event) => setEventForm({ ...eventForm, samples_price: event.target.value === '' ? null : Number(event.target.value) })} />
        <input placeholder="Left Image URL" style={inputStyle} value={eventForm.image_url_left ?? ''} onChange={(event) => setEventForm({ ...eventForm, image_url_left: event.target.value || null })} />
        <input placeholder="Center Image URL (Default)" style={inputStyle} value={eventForm.image_url ?? ''} onChange={(event) => setEventForm({ ...eventForm, image_url: event.target.value || null })} />
        <input placeholder="Right Image URL" style={inputStyle} value={eventForm.image_url_right ?? ''} onChange={(event) => setEventForm({ ...eventForm, image_url_right: event.target.value || null })} />
        <label style={labelStyle}><input checked={eventForm.has_samples} type="checkbox" onChange={(event) => setEventForm({ ...eventForm, has_samples: event.target.checked })} /> Samples available</label>
        <label style={labelStyle}><input checked={eventForm.show_participants} type="checkbox" onChange={(event) => setEventForm({ ...eventForm, show_participants: event.target.checked })} /> Show participants / samples count badge</label>
        <div style={buttonRow}><button style={buttonStyle} type="submit">{editingEventId === null ? 'Create Event' : 'Save Changes'}</button>{editingEventId !== null && <button style={secondaryButtonStyle} type="button" onClick={resetEvent}>Cancel</button>}</div>
      </form>
      <div style={listStyle}>{events.map((item) => <div key={item.id} style={rowStyle}><span>{item.title}</span><span style={actionRow}><button aria-label="Copy event link" title="Copy event link" style={smallButtonStyle} type="button" onClick={() => void copyDeepLink('event', item.id)}>🔗</button><button aria-label="Edit event" title="Edit event" style={smallButtonStyle} type="button" onClick={() => { setEditingEventId(item.id); setEventForm(eventFormFromItem(item)); }}>✏️</button><button aria-label="Delete event" title="Delete event" style={dangerButtonStyle} type="button" onClick={() => setDeletion({ kind: 'event', item })}>🗑️</button></span></div>)}</div>
    </Accordion>
    <Accordion title="📁 Manage Distilleries">
      <form onSubmit={saveDistillery} style={formStyle}>
        <I18nTextEditor label="Name" required translations={distilleryForm.name_i18n} onChange={(name_i18n) => setDistilleryForm({ ...distilleryForm, name: name_i18n.en, name_i18n })} />
        <input placeholder="Image URL" style={inputStyle} value={distilleryForm.image_url ?? ''} onChange={(event) => setDistilleryForm({ ...distilleryForm, image_url: event.target.value || null })} />
        <I18nTextEditor label="Description" multiline translations={distilleryForm.description_i18n} onChange={(description_i18n) => setDistilleryForm({ ...distilleryForm, description: description_i18n.en || null, description_i18n })} />
        <div style={buttonRow}><button style={buttonStyle} type="submit">{editingDistilleryId === null ? 'Add Distillery' : 'Save Changes'}</button>{editingDistilleryId !== null && <button style={secondaryButtonStyle} type="button" onClick={resetDistillery}>Cancel</button>}</div>
      </form>
      <div style={listStyle}>{distilleries.map((distillery) => {
        const isOpen = openBottleLists.includes(distillery.id);
        const distilleryBottles = bottles.filter((bottle) => bottle.distillery_id === distillery.id);
        const editingHere = catalogDistilleryId === distillery.id;
        return <div key={distillery.id} style={cardStyle}><div style={rowStyle}><strong>{distillery.name}</strong><span style={actionRow}><button aria-label="Copy distillery link" title="Copy distillery link" style={smallButtonStyle} type="button" onClick={() => void copyDeepLink('distillery', distillery.id)}>🔗</button><button aria-label="Edit distillery" title="Edit distillery" style={smallButtonStyle} type="button" onClick={() => { setEditingDistilleryId(distillery.id); setDistilleryForm(distilleryFormFromItem(distillery)); }}>✏️</button><button aria-label="Delete distillery" title="Delete distillery" style={dangerButtonStyle} type="button" onClick={() => setDeletion({ kind: 'distillery', item: distillery })}>🗑️</button></span></div>
          <button style={spoilerButtonStyle} type="button" onClick={() => setOpenBottleLists((current) => current.includes(distillery.id) ? current.filter((id) => id !== distillery.id) : [...current, distillery.id])}>🥃 {isOpen ? 'Hide Bottles' : 'Show Bottles'}</button>
          {isOpen && <div style={{ marginTop: 10 }}>{editingHere ? <form onSubmit={(event) => void saveBottle(event, catalogBottleForm, distillery.id, editingCatalogBottleId, resetCatalogBottle)}><BottleFields backgrounds={backgrounds} form={catalogBottleForm} setForm={setCatalogBottleForm} includeLabel={false} /><div style={{ ...buttonRow, marginTop: 10 }}><button style={buttonStyle} type="submit">{editingCatalogBottleId === null ? 'Add Bottle' : 'Save Changes'}</button><button style={secondaryButtonStyle} type="button" onClick={resetCatalogBottle}>Cancel</button></div></form> : <button style={smallButtonStyle} type="button" onClick={() => { setCatalogDistilleryId(distillery.id); setCatalogBottleForm({ ...emptyBottle(), label: 'bottle' }); }}>Add Bottle</button>}
            <div style={listStyle}>{distilleryBottles.map((bottle) => <div key={bottle.id} style={rowStyle}><span>{bottle.name}</span><span style={actionRow}><button aria-label="Copy bottle link" title="Copy bottle link" style={smallButtonStyle} type="button" onClick={() => void copyDeepLink('bottle', bottle.id)}>🔗</button><button aria-label="Edit bottle" title="Edit bottle" style={smallButtonStyle} type="button" onClick={() => editBottle(bottle)}>✏️</button><button aria-label="Remove bottle" title="Remove bottle" style={dangerButtonStyle} type="button" onClick={() => setDeletion({ kind: 'bottle', item: bottle })}>🗑️</button></span></div>)}</div>
          </div>}</div>;
      })}</div>
    </Accordion>
    <Accordion title="🏷️ Manage Tasting Tags">
      <form onSubmit={saveTastingTag} style={formStyle}>
        <I18nTextEditor label="Tag Name" required translations={tastingTagForm.name_i18n} onChange={(name_i18n) => setTastingTagForm({ ...tastingTagForm, name: name_i18n.en, name_i18n })} />
        <I18nTextEditor label="Tag Description" multiline translations={tastingTagForm.description_i18n} onChange={(description_i18n) => setTastingTagForm({ ...tastingTagForm, description_i18n })} />
        <label style={fieldGroupStyle}><span style={fieldLabelStyle}>Icon URL</span><input required placeholder="Icon URL" style={inputStyle} type="url" value={tastingTagForm.icon_url} onChange={(event) => setTastingTagForm({ ...tastingTagForm, icon_url: event.target.value })} /></label>
        <div style={buttonRow}><button disabled={savingTastingTag} style={buttonStyle} type="submit">{savingTastingTag ? 'Saving…' : editingTastingTagId === null ? 'Add Tag' : 'Save Changes'}</button>{editingTastingTagId !== null && <button disabled={savingTastingTag} style={secondaryButtonStyle} type="button" onClick={resetTastingTag}>Cancel</button>}</div>
      </form>
      <div style={listStyle}>{tastingTags.map((tag) => <div key={tag.id} style={rowStyle}><span style={{ alignItems: 'center', display: 'flex', gap: 8 }}><img alt="" src={tag.icon_url} style={tagIconStyle} onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} />{tag.name}</span><span style={actionRow}><button style={smallButtonStyle} type="button" onClick={() => { setEditingTastingTagId(tag.id); setTastingTagForm(tastingTagFormFromItem(tag)); }}>✏️ Edit</button><button style={dangerButtonStyle} type="button" onClick={() => setDeletion({ kind: 'tag', item: tag })}>🗑️ Delete</button></span></div>)}</div>
    </Accordion>
    <Accordion title="🖼 Manage Card Backgrounds">
      <form onSubmit={saveBackground} style={formStyle}>
        <input placeholder="Background Pattern Name" required style={inputStyle} value={backgroundName} onChange={(event) => setBackgroundName(event.target.value)} />
        <input placeholder="Background Image URL" required style={inputStyle} type="url" value={backgroundImageUrl} onChange={(event) => setBackgroundImageUrl(event.target.value)} />
        <div style={buttonRow}><button style={buttonStyle} type="submit">Add Background</button></div>
      </form>
      <div style={listStyle}>{backgrounds.map((background) => <div key={background.id} style={rowStyle}><span style={{ alignItems: 'center', display: 'flex', gap: 8 }}><img alt="" src={background.image_url} style={tagIconStyle} />{background.name}</span><button aria-label={`Delete ${background.name}`} title="Delete background" style={dangerButtonStyle} type="button" onClick={() => void removeBackground(background.id)}>🗑️</button></div>)}</div>
    </Accordion>
    <Accordion title="🥃 Manage Bottles & Samples Tab">
      <form onSubmit={(event) => void saveBottle(event, tabBottleForm, null, editingTabBottleId, resetTabBottle)}><BottleFields backgrounds={backgrounds} form={tabBottleForm} setForm={setTabBottleForm} includeLabel /><div style={{ ...buttonRow, marginTop: 10 }}><button style={buttonStyle} type="submit">{editingTabBottleId === null ? 'Add Card' : 'Save Changes'}</button>{editingTabBottleId !== null && <button style={secondaryButtonStyle} type="button" onClick={resetTabBottle}>Cancel</button>}</div></form>
      <div style={listStyle}>{bottles.filter((bottle) => bottle.distillery_id === null).map((bottle) => <div key={bottle.id} style={rowStyle}><span>{bottle.name} <em style={{ color: '#f59e0b' }}>({bottle.label})</em></span><span style={actionRow}><button aria-label="Copy bottle link" title="Copy bottle link" style={smallButtonStyle} type="button" onClick={() => void copyDeepLink('bottle', bottle.id)}>🔗</button><button aria-label="Edit bottle" title="Edit bottle" style={smallButtonStyle} type="button" onClick={() => editBottle(bottle)}>✏️</button><button aria-label="Remove bottle" title="Remove bottle" style={dangerButtonStyle} type="button" onClick={() => setDeletion({ kind: 'bottle', item: bottle })}>🗑️</button></span></div>)}</div>
    </Accordion>
    {deletion && <div style={modalOverlayStyle} role="presentation"><div aria-modal="true" role="dialog" style={modalStyle}><h3>Confirm deletion</h3><p>Delete {deletion.kind === 'event' ? deletion.item.title : deletion.item.name}?</p><div style={buttonRow}><button style={secondaryButtonStyle} type="button" onClick={() => setDeletion(null)}>Cancel</button><button style={dangerButtonStyle} type="button" onClick={() => void remove()}>Delete</button></div></div></div>}
  </div>;
}

const pageStyle: CSSProperties = { color: '#fff', padding: 16, paddingBottom: 90 };
const sectionStyle: CSSProperties = { background: '#1a202c', borderRadius: 12, marginBottom: 14, padding: 14 };
const summaryStyle: CSSProperties = { color: '#f59e0b', cursor: 'pointer', fontSize: 16, fontWeight: 700 };
const formStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10 };
const fieldGroupStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };
const fieldLabelStyle: CSSProperties = { color: '#cbd5e0', fontSize: 13, fontWeight: 600 };
const inputStyle: CSSProperties = { background: '#2d3748', border: '1px solid #4a5568', borderRadius: 8, boxSizing: 'border-box', color: '#fff', padding: 10, width: '100%' };
const buttonStyle: CSSProperties = { background: '#f59e0b', border: 'none', borderRadius: 8, color: '#000', cursor: 'pointer', fontWeight: 700, padding: '10px 12px' };
const secondaryButtonStyle: CSSProperties = { background: '#2d3748', border: '1px solid #4a5568', borderRadius: 8, color: '#fff', cursor: 'pointer', padding: '8px 10px' };
const smallButtonStyle: CSSProperties = { ...secondaryButtonStyle, color: '#f6c453', fontSize: 12, padding: '6px 8px' };
const dangerButtonStyle: CSSProperties = { ...smallButtonStyle, color: '#fc8181' };
const labelStyle: CSSProperties = { color: '#cbd5e0', fontSize: 14 };
const buttonRow: CSSProperties = { display: 'flex', gap: 8, justifyContent: 'flex-end' };
const actionRow: CSSProperties = { display: 'flex', flexShrink: 0, gap: 6 };
const listStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 };
const rowStyle: CSSProperties = { alignItems: 'center', background: '#2d3748', borderRadius: 8, display: 'flex', fontSize: 14, gap: 8, justifyContent: 'space-between', padding: 8 };
const cardStyle: CSSProperties = { background: '#2d3748', borderRadius: 10, padding: 10 };
const spoilerButtonStyle: CSSProperties = { ...smallButtonStyle, marginTop: 10 };
const messageStyle: CSSProperties = { background: '#2d3748', borderRadius: 8, padding: 10 };
const tagIconStyle: CSSProperties = { background: '#1a202c', borderRadius: '50%', flexShrink: 0, height: 24, objectFit: 'cover', width: 24 };
const localeRowStyle: CSSProperties = { display: 'inline-flex', gap: 4, marginLeft: 6 };
const localeButtonStyle: CSSProperties = { background: 'transparent', border: 'none', color: '#a0aec0', cursor: 'pointer', fontSize: 11, padding: 0 };
const activeLocaleButtonStyle: CSSProperties = { ...localeButtonStyle, color: '#f6c453', fontWeight: 700 };
const modalOverlayStyle: CSSProperties = { alignItems: 'center', background: 'rgba(0,0,0,.7)', display: 'flex', inset: 0, justifyContent: 'center', padding: 20, position: 'fixed', zIndex: 50 };
const modalStyle: CSSProperties = { background: '#1a202c', border: '1px solid #4a5568', borderRadius: 12, maxWidth: 360, padding: 20, width: '100%' };
