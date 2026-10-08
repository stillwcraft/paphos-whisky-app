import { useEffect, useState, type ComponentType, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Drink, SocialProfile, Visibility } from './SocialEventCard.tsx';
import { SocialImageCarousel } from './SocialImageCarousel.tsx';
import { MAX_SOURCE_IMAGE_BYTES, SOCIAL_IMAGE_TYPES } from './compressImage.ts';

const inputStyle = 'w-full rounded-xl border border-[#C5A059]/30 bg-[#1A1A1E] px-3 py-2.5 text-[#F4F4F5] outline-none focus:border-[#C5A059]';

type EventDraftBase = {
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  drink: Drink;
  visibility: Visibility;
};

export type RegularEventDraft = EventDraftBase & {
  event_type: 'regular';
  duration: '1h' | '3h' | 'evening';
  start_mode: 'now' | 'in_20m';
  capacity: number | null;
  tagged_friend_ids: number[];
};

export type GlobalEventDraft = EventDraftBase & {
  event_type: 'global';
  image_urls: string[];
  starts_at: string;
  expires_at: string;
};

export type SocialEventDraft = RegularEventDraft | GlobalEventDraft;

function validImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return value.length <= 2048 && !/[\s\\]/.test(value) && !url.host.includes('%')
      && url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function SocialEventForm({
  friends,
  LocationPicker,
  isAdmin,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  friends: SocialProfile[];
  isAdmin: boolean;
  LocationPicker: ComponentType<{
    latitude: number | null;
    longitude: number | null;
    onChange: (latitude: number | null, longitude: number | null) => void;
    expandOnSelect?: boolean;
  }>;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (draft: SocialEventDraft, photo?: File) => void;
}) {
  const { t } = useTranslation();
  const [eventType, setEventType] = useState<'regular' | 'global'>('regular');
  const [title, setTitle] = useState('');
  const [regularDescription, setRegularDescription] = useState('');
  const [globalDescription, setGlobalDescription] = useState('');
  const description = eventType === 'global' ? globalDescription : regularDescription;
  const [photo, setPhoto] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [startsAt, setStartsAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [drink, setDrink] = useState<Drink>('spirits');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [duration, setDuration] = useState<RegularEventDraft['duration']>('1h');
  const [startMode, setStartMode] = useState<RegularEventDraft['start_mode']>('now');
  const [capacity, setCapacity] = useState('');
  const [tagged, setTagged] = useState<number[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const addImage = () => {
    const url = imageUrl.trim();
    if (!validImageUrl(url)) {
      setPhotoError(t('social.global_invalid_image_url'));
      return;
    }
    if (imageUrls.length >= 5) {
      setPhotoError(t('social.global_image_limit'));
      return;
    }
    setImageUrls((current) => [...current, url]);
    setImageUrl('');
    setPhotoError(null);
  };

  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null);
      return;
    }
    const preview = URL.createObjectURL(photo);
    setPhotoPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [photo]);

  const submit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    if (latitude === null || longitude === null || (eventType === 'regular' && !photo)) {
      setPhotoError(t('social.photo_and_place_required'));
      return;
    }
    if (latitude < 34 || latitude > 36 || longitude < 32 || longitude > 35) {
      setPhotoError(t('social.place_outside_cyprus'));
      return;
    }
    setPhotoError(null);
    const base = {
      title: title.trim(),
      description: description.trim(),
      latitude,
      longitude,
      drink,
      visibility,
    };
    if (eventType === 'global') {
      if (!isAdmin) {
        setPhotoError(t('social.global_admin_only'));
        return;
      }
      if (!imageUrls.length) {
        setPhotoError(t('social.global_image_required'));
        return;
      }
      const start = new Date(startsAt).getTime();
      const end = new Date(expiresAt).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end <= Date.now()) {
        setPhotoError(t('social.global_invalid_dates'));
        return;
      }
      onSubmit({ ...base, event_type: 'global', image_urls: imageUrls, starts_at: new Date(start).toISOString(), expires_at: new Date(end).toISOString() });
    } else if (photo) {
      onSubmit({ ...base, event_type: 'regular', duration, start_mode: startMode, capacity: capacity ? Number(capacity) : null, tagged_friend_ids: tagged }, photo);
    }
  };

  return (
    <form onSubmit={submit} className="absolute inset-x-3 bottom-3 top-[calc(1rem+env(safe-area-inset-top))] z-[1100] mx-auto max-w-md space-y-4 overflow-y-auto rounded-2xl border border-[#C5A059]/40 bg-[#141417] p-4 text-sm text-[#F4F4F5] shadow-2xl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => { setEventType('regular'); setPhotoError(null); }} aria-current={eventType === 'regular' ? 'page' : undefined} className={`font-serif text-base ${eventType === 'regular' ? 'text-[#FFE28A]' : 'text-slate-400'}`}>{t('social.create_title')}</button>
          {isAdmin && <button type="button" onClick={() => { setEventType('global'); setPhotoError(null); }} aria-current={eventType === 'global' ? 'page' : undefined} className={`border-b pb-1 text-sm ${eventType === 'global' ? 'border-[#C5A059] text-[#FFE28A]' : 'border-transparent text-slate-400'}`}>{t('social.global_title')}</button>}
        </div>
        <button type="button" onClick={onCancel} aria-label={t('social.close')} className="text-2xl text-[#C5A059]">×</button>
      </div>
      <input required maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} className={inputStyle} placeholder={t(eventType === 'global' ? 'social.global_name' : 'social.place')} aria-label={t(eventType === 'global' ? 'social.global_name' : 'social.place')} />
      {eventType === 'global' ? (
        <div className="space-y-2">
          <label htmlFor="global-image-url" className="block">{t('social.global_image_urls')}</label>
          <div className="flex gap-2">
            <input id="global-image-url" type="url" inputMode="url" maxLength={2048} value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} onKeyDown={(event) => {
              if (event.key === 'Enter') { event.preventDefault(); addImage(); }
            }} className={inputStyle} placeholder="https://example.com/image.jpg" />
            <button type="button" onClick={addImage} disabled={imageUrls.length >= 5} className="shrink-0 rounded-xl border border-[#C5A059]/40 px-3 text-[#C5A059] disabled:opacity-50">{t('social.global_add_image')}</button>
          </div>
          {imageUrls.length > 0 && <SocialImageCarousel images={imageUrls} alt={title} className="aspect-video rounded-xl" />}
          {imageUrls.map((url, index) => (
            <div key={`${index}-${url}`} className="flex items-center justify-between gap-2 text-xs text-slate-300">
              <span className="min-w-0 truncate">{url}</span>
              <button type="button" onClick={() => setImageUrls((current) => current.filter((_, position) => position !== index))} aria-label={t('social.global_remove_image', { number: index + 1 })} className="text-red-400">{t('social.global_remove')}</button>
            </div>
          ))}
          <span className="block text-right text-xs text-slate-400">{imageUrls.length}/5</span>
        </div>
      ) : <label className="block space-y-1">
        <span>{t('social.photo')}</span>
        <input required type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          if (file && (file.size > MAX_SOURCE_IMAGE_BYTES || !SOCIAL_IMAGE_TYPES.includes(file.type))) {
            setPhoto(null);
            setPhotoError(t('social.invalid_photo'));
            event.target.value = '';
          } else {
            setPhoto(file);
            setPhotoError(null);
          }
        }} className={inputStyle} />
      </label>}
      {eventType === 'regular' && photoPreview && <img src={photoPreview} alt="" className="aspect-video w-full rounded-xl object-cover" />}
      <label className="block space-y-1">
        <span>{t(eventType === 'global' ? 'social.global_description' : 'social.description')}</span>
        <textarea required maxLength={eventType === 'global' ? 5000 : 400} rows={eventType === 'global' ? 6 : 3} value={description} onChange={(event) => {
          if (eventType === 'global') setGlobalDescription(event.target.value);
          else setRegularDescription(event.target.value);
        }} className={inputStyle} />
        <span className="block text-right text-xs text-slate-400">{description.length}/{eventType === 'global' ? 5000 : 400}</span>
      </label>
      <LocationPicker latitude={latitude} longitude={longitude} onChange={(lat, lng) => { setLatitude(lat); setLongitude(lng); }} expandOnSelect />
      <label className="block space-y-1">
        <span>{t('social.drink')}</span>
        <select value={drink} onChange={(event) => setDrink(event.target.value as Drink)} className={inputStyle}>
          {(['beer', 'wine', 'spirits', 'cocktails', 'coffee'] as const).map((value) => <option key={value} value={value}>{t(`social.drink_${value}`)}</option>)}
        </select>
      </label>
      <label className="block space-y-1">
        <span>{t('social.visibility')}</span>
        <select value={visibility} onChange={(event) => setVisibility(event.target.value as Visibility)} className={inputStyle}>
          {(['public', 'friends', 'anonymous'] as const).map((value) => <option key={value} value={value}>{t(`social.visibility_${value}`)}</option>)}
        </select>
      </label>
      {eventType === 'regular' && <label className="block space-y-1">
        <span>{t('social.duration')}</span>
        <select value={duration} onChange={(event) => setDuration(event.target.value as RegularEventDraft['duration'])} className={inputStyle}>
          {(['1h', '3h', 'evening'] as const).map((value) => <option key={value} value={value}>{t(`social.duration_${value}`)}</option>)}
        </select>
      </label>}
      {eventType === 'global' ? (
        <>
          <label className="block space-y-1">
            <span>{t('social.start')}</span>
            <input required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className={inputStyle} />
          </label>
          <label className="block space-y-1">
            <span>{t('social.global_end')}</span>
            <input required type="datetime-local" min={startsAt} value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className={inputStyle} />
          </label>
        </>
      ) : <label className="block space-y-1">
        <span>{t('social.start')}</span>
        <select value={startMode} onChange={(event) => setStartMode(event.target.value as RegularEventDraft['start_mode'])} className={inputStyle}>
          <option value="now">{t('social.start_now')}</option>
          <option value="in_20m">{t('social.start_in_20m')}</option>
        </select>
      </label>}
      {eventType === 'regular' && <label className="block space-y-1">
        <span>{t('social.capacity')}</span>
        <input type="number" min={2} max={100} value={capacity} onChange={(event) => setCapacity(event.target.value)} placeholder={t('social.capacity_optional')} className={inputStyle} />
      </label>}
      {eventType === 'regular' && friends.length > 0 && (
        <fieldset className="space-y-2">
          <legend>{t('social.tag_friends')}</legend>
          {friends.map((friend) => (
            <label key={friend.telegram_id} className="flex items-center gap-2">
              <input type="checkbox" checked={tagged.includes(friend.telegram_id)} onChange={(event) => setTagged((current) =>
                event.target.checked ? [...current, friend.telegram_id] : current.filter((id) => id !== friend.telegram_id)
              )} />
              {friend.display_name}
            </label>
          ))}
        </fieldset>
      )}
      {(photoError || error) && <p role="alert" className="text-red-300">{photoError || error}</p>}
      <button type="submit" disabled={busy || (eventType === 'global' && imageUrls.length === 0)} aria-busy={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#C5A059] to-[#8A5A2B] px-4 py-3 font-semibold text-[#141417] disabled:opacity-50">
        {busy && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-[#141417]/30 border-t-[#141417]" />}
        {t(busy ? 'social.creating' : 'social.create')}
      </button>
    </form>
  );
}
