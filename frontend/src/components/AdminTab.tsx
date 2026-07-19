import { useCallback, useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { initData, useSignal } from '@tma.js/sdk-react';
import { telegramAuthHeaders } from '@/telegramAuth.ts';

const API_URL = 'https://paphos-whisky-api.onrender.com';
type Label = 'bottle' | 'samples' | 'event';

type EventItem = { id: number; title: string; date: string; description: string; price: number; samples_price: number | null; image_url: string | null; has_samples: boolean; registered_count: number; samples_count: number };
type Distillery = { id: number; name: string; image_url: string | null; description: string | null };
type TastingTag = { id: number; name: string; icon_url: string };
type Bottle = { id: number; name: string; distillery_id: number | null; label: Label; age: string | null; abv: string | null; cask: string | null; bottles: string | null; price_per_sample: number; description: string; image_url: string | null };
type EventForm = Omit<EventItem, 'id' | 'registered_count' | 'samples_count'>;
type DistilleryForm = Omit<Distillery, 'id'>;
type TastingTagForm = Omit<TastingTag, 'id'>;
type BottleForm = { name: string; label: Label; age: string; abv: string; cask: string; bottles: string; price_per_sample: string; description: string; image_url: string };
type Deletion = { kind: 'event'; item: EventItem } | { kind: 'distillery'; item: Distillery } | { kind: 'tag'; item: TastingTag } | { kind: 'bottle'; item: Bottle };

const emptyEvent: EventForm = { title: '', date: '', description: '', price: 0, samples_price: null, image_url: null, has_samples: false };
const emptyDistillery: DistilleryForm = { name: '', image_url: null, description: null };
const emptyTastingTag: TastingTagForm = { name: '', icon_url: '' };
const emptyBottle: BottleForm = { name: '', label: 'bottle', age: '', abv: '', cask: '', bottles: '', price_per_sample: '', description: '', image_url: '' };

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

function BottleFields({ form, setForm, includeLabel }: { form: BottleForm; setForm: (form: BottleForm) => void; includeLabel: boolean }) {
  return <div style={formStyle}>
    <input required placeholder="Name" style={inputStyle} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
    <input placeholder="Photo URL" style={inputStyle} value={form.image_url} onChange={(event) => setForm({ ...form, image_url: event.target.value })} />
    <input required min="0" placeholder="Price" step="0.1" style={inputStyle} type="number" value={form.price_per_sample} onChange={(event) => setForm({ ...form, price_per_sample: event.target.value })} />
    <input placeholder="Age (optional)" style={inputStyle} value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })} />
    <input placeholder="ABV (optional)" style={inputStyle} value={form.abv} onChange={(event) => setForm({ ...form, abv: event.target.value })} />
    <label style={fieldGroupStyle}>
      <span style={fieldLabelStyle}>Cask Type</span>
      <input
        aria-label="Cask Type"
        name="cask"
        placeholder="например, First-fill Oloroso Sherry Butt"
        style={inputStyle}
        value={form.cask}
        onChange={(event) => setForm({ ...form, cask: event.target.value })}
      />
    </label>
    <label style={fieldGroupStyle}>
      <span style={fieldLabelStyle}>Total Bottles / Outturn</span>
      <input
        aria-label="Total Bottles / Outturn"
        name="bottles"
        placeholder="например, 1 of 312 or Limited Release"
        style={inputStyle}
        value={form.bottles}
        onChange={(event) => setForm({ ...form, bottles: event.target.value })}
      />
    </label>
    {includeLabel && <select style={inputStyle} value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value as Label })}><option value="bottle">bottle</option><option value="samples">samples</option><option value="event">event</option></select>}
    <textarea required placeholder="Description" rows={4} style={{ ...inputStyle, resize: 'vertical', whiteSpace: 'pre-wrap' }} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
  </div>;
}

export function AdminTab() {
  const initDataRaw = useSignal(initData.raw);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [distilleries, setDistilleries] = useState<Distillery[]>([]);
  const [tastingTags, setTastingTags] = useState<TastingTag[]>([]);
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

  const loadContent = useCallback(async () => {
    try {
      const [eventsResponse, distilleriesResponse, tastingTagsResponse, bottlesResponse] = await Promise.all([
        fetch(`${API_URL}/api/events`), fetch(`${API_URL}/api/distilleries`), fetch(`${API_URL}/api/tasting-tags`), fetch(`${API_URL}/api/bottles`),
      ]);
      if (!eventsResponse.ok) throw new Error(await getError(eventsResponse));
      if (!distilleriesResponse.ok) throw new Error(await getError(distilleriesResponse));
      if (!tastingTagsResponse.ok) throw new Error(await getError(tastingTagsResponse));
      if (!bottlesResponse.ok) throw new Error(await getError(bottlesResponse));
      setEvents(await eventsResponse.json() as EventItem[]);
      setDistilleries(await distilleriesResponse.json() as Distillery[]);
      setTastingTags(await tastingTagsResponse.json() as TastingTag[]);
      setBottles(await bottlesResponse.json() as Bottle[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load admin content.');
    }
  }, []);

  useEffect(() => { void loadContent(); }, [loadContent]);
  const resetEvent = () => { setEditingEventId(null); setEventForm(emptyEvent); };
  const resetDistillery = () => { setEditingDistilleryId(null); setDistilleryForm(emptyDistillery); };
  const resetTastingTag = () => { setEditingTastingTagId(null); setTastingTagForm(emptyTastingTag); };
  const resetCatalogBottle = () => { setEditingCatalogBottleId(null); setCatalogDistilleryId(null); setCatalogBottleForm(emptyBottle); };
  const resetTabBottle = () => { setEditingTabBottleId(null); setTabBottleForm(emptyBottle); };

  const saveEvent = async (event: FormEvent) => {
    event.preventDefault();
    const editing = editingEventId !== null;
    try {
      const response = await fetch(editing ? `${API_URL}/api/events/${editingEventId}` : `${API_URL}/api/events`, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', ...telegramAuthHeaders(initDataRaw) }, body: JSON.stringify(eventForm) });
      if (!response.ok) throw new Error(await getError(response));
      resetEvent(); await loadContent(); setMessage(editing ? 'Event updated.' : 'Event created.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save event.'); }
  };
  const saveDistillery = async (event: FormEvent) => {
    event.preventDefault();
    const editing = editingDistilleryId !== null;
    try {
      const response = await fetch(editing ? `${API_URL}/api/distilleries/${editingDistilleryId}` : `${API_URL}/api/distilleries`, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', ...telegramAuthHeaders(initDataRaw) }, body: JSON.stringify(distilleryForm) });
      if (!response.ok) throw new Error(await getError(response));
      resetDistillery(); await loadContent(); setMessage(editing ? 'Distillery updated.' : 'Distillery created.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save distillery.'); }
  };
  const saveTastingTag = async (event: FormEvent) => {
    event.preventDefault();
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
    const form = { name: bottle.name, label: bottle.label, age: bottle.age ?? '', abv: bottle.abv ?? '', cask: bottle.cask ?? '', bottles: bottle.bottles ?? '', price_per_sample: String(bottle.price_per_sample), description: bottle.description, image_url: bottle.image_url ?? '' };
    if (bottle.distillery_id === null) { setTabBottleForm(form); setEditingTabBottleId(bottle.id); } else { setCatalogBottleForm(form); setCatalogDistilleryId(bottle.distillery_id); setEditingCatalogBottleId(bottle.id); setOpenBottleLists((current) => current.includes(bottle.distillery_id!) ? current : [...current, bottle.distillery_id!]); }
  };

  return <div style={pageStyle}>
    <h2 style={{ color: '#f59e0b', marginTop: 0 }}>⚙️ Admin</h2>
    {message && <p style={messageStyle}>{message}</p>}
    <Accordion title="📅 Manage Events">
      <form onSubmit={saveEvent} style={formStyle}>
        <input required placeholder="Title" style={inputStyle} value={eventForm.title} onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })} />
        <input required style={inputStyle} type="datetime-local" value={eventForm.date} onChange={(event) => setEventForm({ ...eventForm, date: event.target.value })} />
        <textarea required placeholder="Description" rows={4} style={{ ...inputStyle, whiteSpace: 'pre-wrap' }} value={eventForm.description} onChange={(event) => setEventForm({ ...eventForm, description: event.target.value })} />
        <input required min="0" placeholder="Price" style={inputStyle} type="number" value={eventForm.price || ''} onChange={(event) => setEventForm({ ...eventForm, price: Number(event.target.value) })} />
        <input min="0" placeholder="Samples Price (EUR)" step="0.1" style={inputStyle} type="number" value={eventForm.samples_price ?? ''} onChange={(event) => setEventForm({ ...eventForm, samples_price: event.target.value === '' ? null : Number(event.target.value) })} />
        <input placeholder="Image URL" style={inputStyle} value={eventForm.image_url ?? ''} onChange={(event) => setEventForm({ ...eventForm, image_url: event.target.value || null })} />
        <label style={labelStyle}><input checked={eventForm.has_samples} type="checkbox" onChange={(event) => setEventForm({ ...eventForm, has_samples: event.target.checked })} /> Samples available</label>
        <div style={buttonRow}><button style={buttonStyle} type="submit">{editingEventId === null ? 'Create Event' : 'Save Changes'}</button>{editingEventId !== null && <button style={secondaryButtonStyle} type="button" onClick={resetEvent}>Cancel</button>}</div>
      </form>
      <div style={listStyle}>{events.map((item) => <div key={item.id} style={rowStyle}><span>{item.title}</span><span style={actionRow}><button style={smallButtonStyle} type="button" onClick={() => { setEditingEventId(item.id); setEventForm({ ...item }); }}>✏️ Edit</button><button style={dangerButtonStyle} type="button" onClick={() => setDeletion({ kind: 'event', item })}>🗑️ Delete</button></span></div>)}</div>
    </Accordion>
    <Accordion title="📁 Manage Distilleries">
      <form onSubmit={saveDistillery} style={formStyle}>
        <input required placeholder="Name" style={inputStyle} value={distilleryForm.name} onChange={(event) => setDistilleryForm({ ...distilleryForm, name: event.target.value })} />
        <input placeholder="Image URL" style={inputStyle} value={distilleryForm.image_url ?? ''} onChange={(event) => setDistilleryForm({ ...distilleryForm, image_url: event.target.value || null })} />
        <textarea placeholder="Description" rows={4} style={{ ...inputStyle, whiteSpace: 'pre-wrap' }} value={distilleryForm.description ?? ''} onChange={(event) => setDistilleryForm({ ...distilleryForm, description: event.target.value || null })} />
        <div style={buttonRow}><button style={buttonStyle} type="submit">{editingDistilleryId === null ? 'Add Distillery' : 'Save Changes'}</button>{editingDistilleryId !== null && <button style={secondaryButtonStyle} type="button" onClick={resetDistillery}>Cancel</button>}</div>
      </form>
      <div style={listStyle}>{distilleries.map((distillery) => {
        const isOpen = openBottleLists.includes(distillery.id);
        const distilleryBottles = bottles.filter((bottle) => bottle.distillery_id === distillery.id);
        const editingHere = catalogDistilleryId === distillery.id;
        return <div key={distillery.id} style={cardStyle}><div style={rowStyle}><strong>{distillery.name}</strong><span style={actionRow}><button style={smallButtonStyle} type="button" onClick={() => { setEditingDistilleryId(distillery.id); setDistilleryForm({ name: distillery.name, image_url: distillery.image_url, description: distillery.description }); }}>✏️ Edit</button><button style={dangerButtonStyle} type="button" onClick={() => setDeletion({ kind: 'distillery', item: distillery })}>🗑️ Delete</button></span></div>
          <button style={spoilerButtonStyle} type="button" onClick={() => setOpenBottleLists((current) => current.includes(distillery.id) ? current.filter((id) => id !== distillery.id) : [...current, distillery.id])}>🥃 {isOpen ? 'Hide Bottles' : 'Show Bottles'}</button>
          {isOpen && <div style={{ marginTop: 10 }}>{editingHere ? <form onSubmit={(event) => void saveBottle(event, catalogBottleForm, distillery.id, editingCatalogBottleId, resetCatalogBottle)}><BottleFields form={catalogBottleForm} setForm={setCatalogBottleForm} includeLabel={false} /><div style={{ ...buttonRow, marginTop: 10 }}><button style={buttonStyle} type="submit">{editingCatalogBottleId === null ? 'Add Bottle' : 'Save Changes'}</button><button style={secondaryButtonStyle} type="button" onClick={resetCatalogBottle}>Cancel</button></div></form> : <button style={smallButtonStyle} type="button" onClick={() => { setCatalogDistilleryId(distillery.id); setCatalogBottleForm({ ...emptyBottle, label: 'bottle' }); }}>Add Bottle</button>}
            <div style={listStyle}>{distilleryBottles.map((bottle) => <div key={bottle.id} style={rowStyle}><span>{bottle.name}</span><span style={actionRow}><button style={smallButtonStyle} type="button" onClick={() => editBottle(bottle)}>✏️ Edit</button><button style={dangerButtonStyle} type="button" onClick={() => setDeletion({ kind: 'bottle', item: bottle })}>🗑️ Remove</button></span></div>)}</div>
          </div>}</div>;
      })}</div>
    </Accordion>
    <Accordion title="🏷️ Manage Tasting Tags">
      <form onSubmit={saveTastingTag} style={formStyle}>
        <label style={fieldGroupStyle}><span style={fieldLabelStyle}>Tag Name</span><input required placeholder="Tag Name" style={inputStyle} value={tastingTagForm.name} onChange={(event) => setTastingTagForm({ ...tastingTagForm, name: event.target.value })} /></label>
        <label style={fieldGroupStyle}><span style={fieldLabelStyle}>Icon URL</span><input required placeholder="Icon URL" style={inputStyle} type="url" value={tastingTagForm.icon_url} onChange={(event) => setTastingTagForm({ ...tastingTagForm, icon_url: event.target.value })} /></label>
        <div style={buttonRow}><button disabled={savingTastingTag} style={buttonStyle} type="submit">{savingTastingTag ? 'Saving…' : editingTastingTagId === null ? 'Add Tag' : 'Save Changes'}</button>{editingTastingTagId !== null && <button disabled={savingTastingTag} style={secondaryButtonStyle} type="button" onClick={resetTastingTag}>Cancel</button>}</div>
      </form>
      <div style={listStyle}>{tastingTags.map((tag) => <div key={tag.id} style={rowStyle}><span style={{ alignItems: 'center', display: 'flex', gap: 8 }}><img alt="" src={tag.icon_url} style={tagIconStyle} onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} />{tag.name}</span><span style={actionRow}><button style={smallButtonStyle} type="button" onClick={() => { setEditingTastingTagId(tag.id); setTastingTagForm({ name: tag.name, icon_url: tag.icon_url }); }}>✏️ Edit</button><button style={dangerButtonStyle} type="button" onClick={() => setDeletion({ kind: 'tag', item: tag })}>🗑️ Delete</button></span></div>)}</div>
    </Accordion>
    <Accordion title="🥃 Manage Bottles & Samples Tab">
      <form onSubmit={(event) => void saveBottle(event, tabBottleForm, null, editingTabBottleId, resetTabBottle)}><BottleFields form={tabBottleForm} setForm={setTabBottleForm} includeLabel /><div style={{ ...buttonRow, marginTop: 10 }}><button style={buttonStyle} type="submit">{editingTabBottleId === null ? 'Add Card' : 'Save Changes'}</button>{editingTabBottleId !== null && <button style={secondaryButtonStyle} type="button" onClick={resetTabBottle}>Cancel</button>}</div></form>
      <div style={listStyle}>{bottles.filter((bottle) => bottle.distillery_id === null).map((bottle) => <div key={bottle.id} style={rowStyle}><span>{bottle.name} <em style={{ color: '#f59e0b' }}>({bottle.label})</em></span><span style={actionRow}><button style={smallButtonStyle} type="button" onClick={() => editBottle(bottle)}>✏️ Edit</button><button style={dangerButtonStyle} type="button" onClick={() => setDeletion({ kind: 'bottle', item: bottle })}>🗑️ Remove</button></span></div>)}</div>
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
const modalOverlayStyle: CSSProperties = { alignItems: 'center', background: 'rgba(0,0,0,.7)', display: 'flex', inset: 0, justifyContent: 'center', padding: 20, position: 'fixed', zIndex: 50 };
const modalStyle: CSSProperties = { background: '#1a202c', border: '1px solid #4a5568', borderRadius: 12, maxWidth: 360, padding: 20, width: '100%' };
