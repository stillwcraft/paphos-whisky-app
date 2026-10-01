import { useEffect, useState, type ComponentType, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Drink, SocialProfile, Visibility } from './SocialEventCard.tsx';
import { MAX_SOURCE_IMAGE_BYTES, SOCIAL_IMAGE_TYPES } from './compressImage.ts';

const inputStyle = 'w-full rounded-xl border border-[#C5A059]/30 bg-[#1A1A1E] px-3 py-2.5 text-[#F4F4F5] outline-none focus:border-[#C5A059]';

export type SocialEventDraft = {
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  drink: Drink;
  visibility: Visibility;
  duration: '1h' | '3h' | 'evening';
  start_mode: 'now' | 'in_20m';
  capacity: number | null;
  tagged_friend_ids: number[];
};

export function SocialEventForm({
  friends,
  LocationPicker,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  friends: SocialProfile[];
  LocationPicker: ComponentType<{
    latitude: number | null;
    longitude: number | null;
    onChange: (latitude: number | null, longitude: number | null) => void;
  }>;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (draft: SocialEventDraft, photo: File) => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [drink, setDrink] = useState<Drink>('spirits');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [duration, setDuration] = useState<SocialEventDraft['duration']>('1h');
  const [startMode, setStartMode] = useState<SocialEventDraft['start_mode']>('now');
  const [capacity, setCapacity] = useState('');
  const [tagged, setTagged] = useState<number[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);

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
    if (!photo || latitude === null || longitude === null) {
      setPhotoError(t('social.photo_and_place_required'));
      return;
    }
    if (latitude < 34 || latitude > 36 || longitude < 32 || longitude > 35) {
      setPhotoError(t('social.place_outside_cyprus'));
      return;
    }
    setPhotoError(null);
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      latitude,
      longitude,
      drink,
      visibility,
      duration,
      start_mode: startMode,
      capacity: capacity ? Number(capacity) : null,
      tagged_friend_ids: tagged,
    }, photo);
  };

  return (
    <form onSubmit={submit} className="absolute inset-x-3 bottom-3 top-[calc(1rem+env(safe-area-inset-top))] z-[1100] mx-auto max-w-md space-y-4 overflow-y-auto rounded-2xl border border-[#C5A059]/40 bg-[#141417] p-4 text-sm text-[#F4F4F5] shadow-2xl">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-[#FFE28A]">{t('social.create_title')}</h2>
        <button type="button" onClick={onCancel} aria-label={t('social.close')} className="text-2xl text-[#C5A059]">×</button>
      </div>
      <input required maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} className={inputStyle} placeholder={t('social.place')} aria-label={t('social.place')} />
      <label className="block space-y-1">
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
      </label>
      {photoPreview && <img src={photoPreview} alt="" className="aspect-video w-full rounded-xl object-cover" />}
      <label className="block space-y-1">
        <span>{t('social.description')}</span>
        <textarea required maxLength={400} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className={inputStyle} />
        <span className="block text-right text-xs text-slate-400">{description.length}/400</span>
      </label>
      <LocationPicker latitude={latitude} longitude={longitude} onChange={(lat, lng) => { setLatitude(lat); setLongitude(lng); }} />
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
      <label className="block space-y-1">
        <span>{t('social.duration')}</span>
        <select value={duration} onChange={(event) => setDuration(event.target.value as SocialEventDraft['duration'])} className={inputStyle}>
          {(['1h', '3h', 'evening'] as const).map((value) => <option key={value} value={value}>{t(`social.duration_${value}`)}</option>)}
        </select>
      </label>
      <label className="block space-y-1">
        <span>{t('social.start')}</span>
        <select value={startMode} onChange={(event) => setStartMode(event.target.value as SocialEventDraft['start_mode'])} className={inputStyle}>
          <option value="now">{t('social.start_now')}</option>
          <option value="in_20m">{t('social.start_in_20m')}</option>
        </select>
      </label>
      <label className="block space-y-1">
        <span>{t('social.capacity')}</span>
        <input type="number" min={2} max={100} value={capacity} onChange={(event) => setCapacity(event.target.value)} placeholder={t('social.capacity_optional')} className={inputStyle} />
      </label>
      {friends.length > 0 && (
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
      <button type="submit" disabled={busy} className="w-full rounded-xl bg-gradient-to-r from-[#C5A059] to-[#8A5A2B] px-4 py-3 font-semibold text-[#141417] disabled:opacity-50">
        {t('social.create')}
      </button>
    </form>
  );
}
