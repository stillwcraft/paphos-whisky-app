import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

const API_URL = 'https://paphos-whisky-api.onrender.com';

type Distillery = {
  id: number;
  name: string;
  image_url: string | null;
  description: string | null;
};

type Bottle = {
  id: number;
  name: string;
  distillery_id: number;
  age: string | null;
  abv: string | null;
  price_per_sample: number;
  description: string;
  image_url: string | null;
  favorites_count: number;
  tried_count: number;
};

type DistilleryForm = {
  name: string;
  image_url: string;
  description: string;
};

type BottleForm = {
  name: string;
  distillery_id: string;
  age: string;
  abv: string;
  price_per_sample: string;
  description: string;
  image_url: string;
  favorites_count: number;
  tried_count: number;
};

const emptyDistilleryForm: DistilleryForm = {
  name: '',
  image_url: '',
  description: '',
};

const emptyBottleForm: BottleForm = {
  name: '',
  distillery_id: '',
  age: '',
  abv: '',
  price_per_sample: '',
  description: '',
  image_url: '',
  favorites_count: 0,
  tried_count: 0,
};

const inputStyle: React.CSSProperties = {
  padding: '10px',
  borderRadius: '8px',
  border: '1px solid #4a5568',
  background: '#2d3748',
  color: '#fff',
  fontSize: '14px',
  width: '100%',
  boxSizing: 'border-box',
};

const buttonStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '8px',
  border: 'none',
  background: '#f59e0b',
  color: '#000',
  fontWeight: 'bold',
  cursor: 'pointer',
  fontSize: '14px',
};

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json();
    if (typeof data === 'object' && data !== null && 'detail' in data) {
      return String(data.detail);
    }
  } catch {
    // A non-JSON response still has a useful status code.
  }

  return `Ошибка сервера: ${response.status}`;
}

export const AdminTab: React.FC = () => {
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventPrice, setEventPrice] = useState('');
  const [eventImg, setEventImg] = useState('');
  const [distilleryForm, setDistilleryForm] = useState<DistilleryForm>(emptyDistilleryForm);
  const [bottleForm, setBottleForm] = useState<BottleForm>(emptyBottleForm);
  const [distilleries, setDistilleries] = useState<Distillery[]>([]);
  const [bottles, setBottles] = useState<Bottle[]>([]);
  const [editingDistilleryId, setEditingDistilleryId] = useState<number | null>(null);
  const [editingBottleId, setEditingBottleId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const loadCatalog = useCallback(async () => {
    try {
      const [distilleriesResponse, bottlesResponse] = await Promise.all([
        fetch(`${API_URL}/api/distilleries`),
        fetch(`${API_URL}/api/bottles`),
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
      setMessage(error instanceof Error ? error.message : '❌ Ошибка загрузки каталога');
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const insertMarkdown = (prefix: string, suffix = prefix) => {
    const textarea = descriptionRef.current;
    const start = textarea?.selectionStart ?? distilleryForm.description.length;
    const end = textarea?.selectionEnd ?? start;
    const selectedText = distilleryForm.description.slice(start, end) || 'text';
    const replacement = `${prefix}${selectedText}${suffix}`;
    const description = [
      distilleryForm.description.slice(0, start),
      replacement,
      distilleryForm.description.slice(end),
    ].join('');

    setDistilleryForm({ ...distilleryForm, description });
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    });
  };

  const insertBulletList = () => {
    const textarea = descriptionRef.current;
    const start = textarea?.selectionStart ?? distilleryForm.description.length;
    const end = textarea?.selectionEnd ?? start;
    const selectedText = distilleryForm.description.slice(start, end) || 'item';
    const replacement = selectedText.split('\n').map((line) => `- ${line}`).join('\n');
    const description = [
      distilleryForm.description.slice(0, start),
      replacement,
      distilleryForm.description.slice(end),
    ].join('');

    setDistilleryForm({ ...distilleryForm, description });
  };

  const resetDistilleryForm = () => {
    setEditingDistilleryId(null);
    setDistilleryForm(emptyDistilleryForm);
  };

  const resetBottleForm = () => {
    setEditingBottleId(null);
    setBottleForm(emptyBottleForm);
  };

  const handleCreateEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: eventTitle,
          date: eventDate,
          description: eventDesc,
          price: Number(eventPrice),
          image_url: eventImg || null,
        }),
      });
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      setMessage('🎉 Событие успешно создано!');
      setEventTitle('');
      setEventDate('');
      setEventDesc('');
      setEventPrice('');
      setEventImg('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '❌ Ошибка при создании события');
    }
  };

  const handleDistillerySubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const isEditing = editingDistilleryId !== null;

    try {
      const response = await fetch(
        isEditing
          ? `${API_URL}/api/distilleries/${editingDistilleryId}`
          : `${API_URL}/api/distilleries`,
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...distilleryForm,
            image_url: distilleryForm.image_url || null,
            description: distilleryForm.description || null,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      resetDistilleryForm();
      await loadCatalog();
      setMessage(isEditing ? '✅ Дистиллерия обновлена.' : '✅ Дистиллерия добавлена.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '❌ Ошибка при сохранении дистиллерии');
    }
  };

  const handleBottleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const isEditing = editingBottleId !== null;

    try {
      const response = await fetch(
        isEditing
          ? `${API_URL}/api/bottles/${editingBottleId}`
          : `${API_URL}/api/bottles`,
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...bottleForm,
            distillery_id: Number(bottleForm.distillery_id),
            age: bottleForm.age || null,
            abv: bottleForm.abv || null,
            price_per_sample: Number(bottleForm.price_per_sample),
            image_url: bottleForm.image_url || null,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      resetBottleForm();
      await loadCatalog();
      setMessage(isEditing ? '✅ Бутылка обновлена.' : '🥃 Бутылка добавлена на витрину!');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '❌ Ошибка при сохранении бутылки');
    }
  };

  const startDistilleryEdit = (distillery: Distillery) => {
    setEditingDistilleryId(distillery.id);
    setDistilleryForm({
      name: distillery.name,
      image_url: distillery.image_url ?? '',
      description: distillery.description ?? '',
    });
  };

  const startBottleEdit = (bottle: Bottle) => {
    setEditingBottleId(bottle.id);
    setBottleForm({
      name: bottle.name,
      distillery_id: String(bottle.distillery_id),
      age: bottle.age ?? '',
      abv: bottle.abv ?? '',
      price_per_sample: String(bottle.price_per_sample),
      description: bottle.description,
      image_url: bottle.image_url ?? '',
      favorites_count: bottle.favorites_count,
      tried_count: bottle.tried_count,
    });
  };

  const deleteDistillery = async (distillery: Distillery) => {
    if (!window.confirm(`Удалить ${distillery.name} и все вложенные бутылки?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/distilleries/${distillery.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }
      await loadCatalog();
      setMessage('✅ Дистиллерия удалена.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '❌ Ошибка удаления дистиллерии');
    }
  };

  const deleteBottle = async (bottle: Bottle) => {
    try {
      const response = await fetch(`${API_URL}/api/bottles/${bottle.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }
      await loadCatalog();
      setMessage('✅ Бутылка удалена.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '❌ Ошибка удаления бутылки');
    }
  };

  return (
    <div style={{ padding: '16px', color: '#fff', paddingBottom: '80px' }}>
      <h2 style={{ color: '#f59e0b' }}>⚙️ Admin</h2>

      {message && (
        <div style={{ padding: '10px', background: '#2d3748', borderRadius: '8px', marginBottom: '15px', textAlign: 'center' }}>
          {message}
        </div>
      )}

      <section style={sectionStyle}>
        <h3>📅 Create Event</h3>
        <form onSubmit={handleCreateEvent} style={formStyle}>
          <input type="text" placeholder="Title" value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} required style={inputStyle} />
          <input type="datetime-local" value={eventDate} onChange={(event) => setEventDate(event.target.value)} required style={inputStyle} />
          <textarea placeholder="Event description" value={eventDesc} onChange={(event) => setEventDesc(event.target.value)} required style={{ ...inputStyle, height: '80px' }} />
          <input type="number" placeholder="Price, EUR" value={eventPrice} onChange={(event) => setEventPrice(event.target.value)} required style={inputStyle} />
          <input type="url" placeholder="Image URL (optional)" value={eventImg} onChange={(event) => setEventImg(event.target.value)} style={inputStyle} />
          <button type="submit" style={buttonStyle}>Publish Event</button>
        </form>
      </section>

      <section style={sectionStyle}>
        <h3>{editingDistilleryId === null ? '🏭 Add Distillery' : '✏️ Edit Distillery'}</h3>
        <form onSubmit={handleDistillerySubmit} style={formStyle}>
          <input type="text" placeholder="Name" value={distilleryForm.name} onChange={(event) => setDistilleryForm({ ...distilleryForm, name: event.target.value })} required style={inputStyle} />
          <input type="url" placeholder="Image URL" value={distilleryForm.image_url} onChange={(event) => setDistilleryForm({ ...distilleryForm, image_url: event.target.value })} style={inputStyle} />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={() => insertMarkdown('**')} style={formatButtonStyle}>Bold</button>
            <button type="button" onClick={() => insertMarkdown('*')} style={formatButtonStyle}>Italic</button>
            <button type="button" onClick={insertBulletList} style={formatButtonStyle}>Bullet List</button>
          </div>
          <textarea ref={descriptionRef} placeholder="Description" value={distilleryForm.description} onChange={(event) => setDistilleryForm({ ...distilleryForm, description: event.target.value })} style={{ ...inputStyle, height: '100px' }} />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" style={{ ...buttonStyle, flex: 1 }}>{editingDistilleryId === null ? 'Add Distillery' : 'Save Changes'}</button>
            {editingDistilleryId !== null && <button type="button" onClick={resetDistilleryForm} style={secondaryButtonStyle}>Cancel</button>}
          </div>
        </form>
      </section>

      <section style={sectionStyle}>
        <h3>🏭 Distilleries</h3>
        {distilleries.length === 0 ? <p style={mutedTextStyle}>No distilleries yet.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {distilleries.map((distillery) => {
              const distilleryBottles = bottles.filter((bottle) => bottle.distillery_id === distillery.id);
              return (
                <article key={distillery.id} style={cardStyle}>
                  {distillery.image_url && <img src={distillery.image_url} alt="" style={{ width: '100%', height: '110px', objectFit: 'cover', borderRadius: '8px' }} />}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '10px' }}>
                    <strong>{distillery.name}</strong>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button type="button" onClick={() => startDistilleryEdit(distillery)} style={smallButtonStyle}>✏️ Edit</button>
                      <button type="button" onClick={() => void deleteDistillery(distillery)} style={dangerButtonStyle}>🗑️ Delete</button>
                    </div>
                  </div>
                  {distillery.description && <p style={descriptionStyle}>{distillery.description}</p>}
                  <div style={{ marginTop: '10px', borderTop: '1px solid #4a5568', paddingTop: '8px' }}>
                    {distilleryBottles.length === 0 ? <p style={mutedTextStyle}>No bottles.</p> : distilleryBottles.map((bottle) => (
                      <div key={bottle.id} style={{ borderBottom: '1px solid #4a5568', padding: '10px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                          <strong>{bottle.name}</strong>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button type="button" onClick={() => startBottleEdit(bottle)} style={smallButtonStyle}>✏️ Edit</button>
                            <button type="button" onClick={() => void deleteBottle(bottle)} style={dangerButtonStyle}>❌ Remove bottle</button>
                          </div>
                        </div>
                        <p style={mutedTextStyle}>{bottle.age ?? 'NAS'} · {bottle.abv ?? 'ABV not set'} · €{bottle.price_per_sample}</p>
                        <p style={mutedTextStyle}>⭐ В избранном: {bottle.favorites_count} · 🥃 Пробовали: {bottle.tried_count}</p>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <h3>{editingBottleId === null ? '🥃 Add Bottle' : '✏️ Edit Bottle'}</h3>
        <form onSubmit={handleBottleSubmit} style={formStyle}>
          <select required value={bottleForm.distillery_id} onChange={(event) => setBottleForm({ ...bottleForm, distillery_id: event.target.value })} style={inputStyle}>
            <option value="">Select distillery</option>
            {distilleries.map((distillery) => <option key={distillery.id} value={distillery.id}>{distillery.name}</option>)}
          </select>
          <input type="text" placeholder="Name" value={bottleForm.name} onChange={(event) => setBottleForm({ ...bottleForm, name: event.target.value })} required style={inputStyle} />
          <input type="text" placeholder="Age (e.g. 12 or NAS)" value={bottleForm.age} onChange={(event) => setBottleForm({ ...bottleForm, age: event.target.value })} style={inputStyle} />
          <input type="text" placeholder="ABV (e.g. 46% or 57.1% CS)" value={bottleForm.abv} onChange={(event) => setBottleForm({ ...bottleForm, abv: event.target.value })} style={inputStyle} />
          <input type="number" step="0.1" placeholder="Price per sample" value={bottleForm.price_per_sample} onChange={(event) => setBottleForm({ ...bottleForm, price_per_sample: event.target.value })} required style={inputStyle} />
          <textarea placeholder="Description" value={bottleForm.description} onChange={(event) => setBottleForm({ ...bottleForm, description: event.target.value })} required style={{ ...inputStyle, height: '80px' }} />
          <input type="url" placeholder="Image URL" value={bottleForm.image_url} onChange={(event) => setBottleForm({ ...bottleForm, image_url: event.target.value })} style={inputStyle} />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" disabled={distilleries.length === 0} style={{ ...buttonStyle, flex: 1, opacity: distilleries.length === 0 ? 0.6 : 1 }}>{editingBottleId === null ? 'Add Bottle' : 'Save Changes'}</button>
            {editingBottleId !== null && <button type="button" onClick={resetBottleForm} style={secondaryButtonStyle}>Cancel</button>}
          </div>
        </form>
      </section>
    </div>
  );
};

const sectionStyle: React.CSSProperties = {
  background: '#1a202c',
  padding: '15px',
  borderRadius: '12px',
  marginBottom: '20px',
};

const formStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

const cardStyle: React.CSSProperties = {
  background: '#2d3748',
  padding: '12px',
  borderRadius: '10px',
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #4a5568',
  background: '#2d3748',
  color: '#fff',
  cursor: 'pointer',
};

const formatButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  flex: 1,
  padding: '8px',
};

const smallButtonStyle: React.CSSProperties = {
  padding: '6px 8px',
  borderRadius: '6px',
  border: '1px solid #4a5568',
  background: '#1a202c',
  color: '#f59e0b',
  cursor: 'pointer',
  fontSize: '12px',
};

const dangerButtonStyle: React.CSSProperties = {
  ...smallButtonStyle,
  color: '#fc8181',
};

const mutedTextStyle: React.CSSProperties = {
  color: '#a0aec0',
  fontSize: '13px',
  margin: '6px 0',
};

const descriptionStyle: React.CSSProperties = {
  ...mutedTextStyle,
  whiteSpace: 'pre-wrap',
};
