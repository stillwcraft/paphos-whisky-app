import React, { useState } from 'react';

const API_URL = "https://paphos-whisky-api.onrender.com"; // Замени на свой URL от Render, если он другой

export const AdminTab: React.FC = () => {
  // Состояние для формы события
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventPrice, setEventPrice] = useState('');
  const [eventImg, setEventImg] = useState('');

  // Состояние для формы бутылки
  const [bottleName, setBottleName] = useState('');
  const [bottleDistillery, setBottleDistillery] = useState('');
  const [bottleAge, setBottleAge] = useState('');
  const [bottlePrice, setBottlePrice] = useState('');
  const [bottleDesc, setBottleDesc] = useState('');
  const [bottleImg, setBottleImg] = useState('');

  const [message, setMessage] = useState('');

  // Отправка нового события
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: eventTitle,
          date: eventDate,
          description: eventDesc,
          price: parseFloat(eventPrice),
          image_url: eventImg || null,
        }),
      });

      if (response.ok) {
        setMessage('🎉 Событие успешно создано!');
        setEventTitle('');
        setEventDate('');
        setEventDesc('');
        setEventPrice('');
        setEventImg('');
      } else {
        setMessage('❌ Ошибка при создании события');
      }
    } catch (err) {
      setMessage('❌ Ошибка сети при связи с бэкендом');
    }
  };

  // Отправка новой бутылки
  const handleCreateBottle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/bottles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: bottleName,
          distillery: bottleDistillery,
          age: bottleAge ? parseInt(bottleAge) : null,
          price_per_sample: parseFloat(bottlePrice),
          description: bottleDesc,
          image_url: bottleImg || null,
        }),
      });

      if (response.ok) {
        setMessage('🥃 Бутылка добавлена на витрину!');
        setBottleName('');
        setBottleDistillery('');
        setBottleAge('');
        setBottlePrice('');
        setBottleDesc('');
        setBottleImg('');
      } else {
        setMessage('❌ Ошибка при добавлении бутылки');
      }
    } catch (err) {
      setMessage('❌ Ошибка сети');
    }
  };

  return (
    <div style={{ padding: '16px', color: '#fff', paddingBottom: '80px' }}>
      <h2 style={{ color: '#f59e0b' }}>⚙️ Панель управления Клубом</h2>

      {message && (
        <div style={{ padding: '10px', background: '#2d3748', borderRadius: '8px', marginBottom: '15px', textAlign: 'center' }}>
          {message}
        </div>
      )}

      {/* ФОРМА СОБЫТИЯ */}
      <div style={{ background: '#1a202c', padding: '15px', borderRadius: '12px', marginBottom: '20px' }}>
        <h3>📅 Создать событие (Дегустацию)</h3>
        <form onSubmit={handleCreateEvent} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input type="text" placeholder="Название (например: Вечер Айлы)" value={eventTitle} onChange={e => setEventTitle(e.target.value)} required style={inputStyle} />
          <input type="text" placeholder="Дата (например: 25 Июля, 19:00)" value={eventDate} onChange={e => setEventDate(e.target.value)} required style={inputStyle} />
          <textarea placeholder="Описание дегустации..." value={eventDesc} onChange={e => setEventDesc(e.target.value)} required style={{...inputStyle, height: '80px'}} />
          <input type="number" placeholder="Стоимость участия (EUR)" value={eventPrice} onChange={e => setEventPrice(e.target.value)} required style={inputStyle} />
          <input type="text" placeholder="URL картинки (необязательно)" value={eventImg} onChange={e => setEventImg(e.target.value)} style={inputStyle} />
          <button type="submit" style={buttonStyle}>Опубликовать дегустацию</button>
        </form>
      </div>

      {/* ФОРМА БУТЫЛКИ */}
      <div style={{ background: '#1a202c', padding: '15px', borderRadius: '12px' }}>
        <h3>🥃 Добавить виски на витрину</h3>
        <form onSubmit={handleCreateBottle} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input type="text" placeholder="Название (например: Laphroaig 10)" value={bottleName} onChange={e => setBottleName(e.target.value)} required style={inputStyle} />
          <input type="text" placeholder="Дистиллерия (например: Laphroaig)" value={bottleDistillery} onChange={e => setBottleDistillery(e.target.value)} required style={inputStyle} />
          <input type="number" placeholder="Возраст/Выдержка (лет)" value={bottleAge} onChange={e => setBottleAge(e.target.value)} style={inputStyle} />
          <input type="number" step="0.1" placeholder="Цена за сэмпл 30мл (EUR)" value={bottlePrice} onChange={e => setBottlePrice(e.target.value)} required style={inputStyle} />
          <textarea placeholder="Описание вкуса/аромата..." value={bottleDesc} onChange={e => setBottleDesc(e.target.value)} required style={{...inputStyle, height: '80px'}} />
          <input type="text" placeholder="URL картинки бутылки" value={bottleImg} onChange={e => setBottleImg(e.target.value)} style={inputStyle} />
          <button type="submit" style={buttonStyle}>Выставить бутылку</button>
        </form>
      </div>
    </div>
  );
};

// Простые инлайн-стили
const inputStyle = {
  padding: '10px',
  borderRadius: '8px',
  border: '1px solid #4a5568',
  background: '#2d3748',
  color: '#fff',
  fontSize: '14px',
};

const buttonStyle = {
  padding: '12px',
  borderRadius: '8px',
  border: 'none',
  background: '#f59e0b',
  color: '#000',
  fontWeight: 'bold',
  cursor: 'pointer',
  fontSize: '14px',
};