import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SocialImageCarousel } from './SocialImageCarousel.tsx';

export type Drink = 'beer' | 'wine' | 'spirits' | 'cocktails' | 'coffee';
export type Visibility = 'public' | 'friends' | 'anonymous';
export type SocialProfile = {
  telegram_id: number;
  display_name: string;
  age: number | null;
  avatar_url: string | null;
  verified: boolean;
};
export type SocialEvent = {
  id: number;
  event_type: 'regular' | 'global';
  image_urls: string[];
  location: string;
  description: string;
  photo_url: string;
  latitude: number;
  longitude: number;
  drink: Drink;
  visibility: Visibility;
  starts_at: string;
  expires_at: string;
  capacity: number | null;
  owner: SocialProfile | null;
  tagged_friends: SocialProfile[];
  attendees: SocialProfile[];
  attendee_count: number;
  cheers: number;
  cheered: boolean;
  join_status: 'host' | 'pending' | 'accepted' | null;
  is_owner: boolean;
};

const drinkIcons: Record<Drink, string> = {
  beer: '🍺',
  wine: '🍷',
  spirits: '🥃',
  cocktails: '🍸',
  coffee: '☕',
};

function Description({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-wrap break-words text-slate-200">
      {text.split(/(https?:\/\/[^\s<>]+)/g).map((part, index) => {
        if (!/^https?:\/\//.test(part)) return part;
        const url = part.replace(/[.,!?;:)]+$/, '');
        return (
          <span key={index}>
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#C5A059] underline underline-offset-2">{url}</a>
            {part.slice(url.length)}
          </span>
        );
      })}
    </p>
  );
}

function Avatar({ profile, size = 'h-8 w-8' }: { profile: SocialProfile; size?: string }) {
  return profile.avatar_url ? (
    <img src={profile.avatar_url} alt={profile.display_name} className={`${size} rounded-full border border-[#C5A059]/40 object-cover`} />
  ) : (
    <span aria-label={profile.display_name} className={`${size} flex items-center justify-center rounded-full border border-[#C5A059]/40 bg-[#29272B] text-sm text-[#C5A059]`}>
      {profile.display_name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function SocialEventCard({
  event,
  busy,
  onClose,
  onCheer,
  onJoin,
  onShare,
  onChat,
  onReport,
  onBlock,
}: {
  event: SocialEvent;
  busy: boolean;
  onClose: () => void;
  onCheer: () => void;
  onJoin: () => void;
  onShare: () => void;
  onChat: () => void;
  onReport: (reason: 'spam' | 'inappropriate' | 'false_location') => void;
  onBlock: () => void;
}) {
  const { t, i18n } = useTranslation();
  const isGlobal = event.event_type === 'global';
  const [now, setNow] = useState(Date.now());
  const [showReport, setShowReport] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  useEffect(() => {
    if (isGlobal) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [isGlobal]);
  const remaining = Math.max(0, Math.ceil((new Date(event.expires_at).getTime() - now) / 1000));
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  const remainingText = hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
  const arrivalMinutes = Math.ceil((new Date(event.starts_at).getTime() - now) / 60_000);
  const name = event.owner?.display_name ?? t('social.anonymous');
  const participants = event.attendees.filter((person) => person.telegram_id !== event.owner?.telegram_id);
  const full = event.capacity !== null && event.attendee_count >= event.capacity;
  const durationSeconds = Math.round((new Date(event.expires_at).getTime() - new Date(event.starts_at).getTime()) / 1000);
  const duration = durationSeconds === 3600 ? '1h' : durationSeconds === 10800 ? '3h' : 'evening';

  return (
    <article className="pointer-events-auto flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-[#C5A059]/40 bg-[#141417] text-[#F4F4F5] shadow-2xl">
      <header className="flex shrink-0 items-center gap-2 border-b border-[#C5A059]/20 p-4">
        {!isGlobal && <span className="text-2xl" aria-hidden="true">{drinkIcons[event.drink]}</span>}
        <h2 className="min-w-0 flex-1 truncate font-serif text-lg text-[#FFE28A]">{event.location}</h2>
        {!isGlobal && <span className="shrink-0 text-xs text-[#C5A059]" aria-label={t('social.expires_in', { time: remainingText })}>
          ⏳ {remainingText}
        </span>}
        <button type="button" onClick={onClose} className="ml-1 text-xl text-slate-300" aria-label={t('social.close')}>×</button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {isGlobal && event.image_urls.length > 0
          ? <SocialImageCarousel images={event.image_urls} alt={event.location} className="aspect-[3/4] max-h-[60dvh]" />
          : <img src={event.photo_url} alt={event.location} className="aspect-[3/4] max-h-[60dvh] w-full object-cover" />}
        <div className="space-y-3 p-4 text-sm">
          <div className="flex items-center gap-2">
            {event.owner ? <Avatar profile={event.owner} /> : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#29272B]">👤</span>
            )}
            <span className="font-medium">{name}</span>
            {event.owner?.verified && (
              <span className="text-xs text-[#C5A059]">✓ {t('social.verified')}</span>
            )}
            {!isGlobal && <span className="ml-auto text-xs text-slate-400">
              {arrivalMinutes > 0
                ? t('social.arriving_in', { count: arrivalMinutes })
                : t('social.already_here')}
            </span>}
          </div>
          {isGlobal && (
            <p className="text-xs text-slate-300">
              {t('social.start')}: {new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.starts_at))}<br />
              {t('social.global_end')}: {new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.expires_at))}
            </p>
          )}
          {isGlobal ? <Description text={event.description} /> : <p className="whitespace-pre-wrap break-words text-slate-200">{event.description}</p>}
          {!isGlobal && <p className="text-xs text-slate-400">{t('social.duration')}: {t(`social.duration_${duration}`)}</p>}
          <p className="text-xs text-slate-400">{t(`social.visibility_${event.visibility}`)}</p>
          {!isGlobal && event.tagged_friends.length > 0 && (
            <p className="text-slate-300">{t('social.drinking_with')}: {event.tagged_friends.map((friend) => friend.display_name).join(', ')}</p>
          )}
          {!isGlobal && <div className="flex items-center gap-2 text-slate-300">
            <span>{t('social.joined', { count: Math.max(0, event.attendee_count - 1) })}</span>
            {participants.slice(0, 4).map((person) => <Avatar key={person.telegram_id} profile={person} size="h-7 w-7" />)}
            {event.capacity !== null && <span className="ml-auto text-xs">{event.attendee_count}/{event.capacity}</span>}
          </div>}
        </div>
      </div>
      <footer className="max-h-[50%] shrink-0 space-y-2 overflow-y-auto border-t border-[#C5A059]/20 bg-[#141417] p-3 text-sm">
        {!isGlobal && showReport && (
          <div className="flex flex-wrap gap-2 rounded-lg border border-red-400/30 p-2 text-xs">
            {(['spam', 'inappropriate', 'false_location'] as const).map((reason) => (
              <button key={reason} type="button" disabled={busy} onClick={() => { onReport(reason); setShowReport(false); }} className="rounded-md border border-red-400/40 px-2 py-1 text-red-300">
                {t(`social.report_${reason}`)}
              </button>
            ))}
          </div>
        )}
        {!isGlobal && showBlock && (
          <div className="flex items-center justify-between gap-2 text-xs text-red-300">
            {t('social.confirm_block')}
            <button type="button" disabled={busy} onClick={onBlock} className="rounded-md border border-red-400/40 px-2 py-1">{t('social.confirm')}</button>
            <button type="button" onClick={() => setShowBlock(false)}>{t('common.cancel')}</button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {!isGlobal && !event.is_owner && (
            <>
              <button type="button" disabled={busy || remaining === 0} onClick={onCheer} className="rounded-xl border border-[#C5A059]/40 p-2 text-[#C5A059] disabled:opacity-50">
                🥂 {t('social.cheer')} ({event.cheers}){event.cheered ? ' ✓' : ''}
              </button>
              <button type="button" disabled={busy || remaining === 0 || full || event.join_status !== null} onClick={onJoin} className="rounded-xl bg-gradient-to-r from-[#C5A059] to-[#8A5A2B] p-2 font-semibold text-[#141417] disabled:opacity-50">
                🚗 {event.join_status !== null ? t(`social.join_${event.join_status}`) : full ? t('social.full') : t('social.going')}
              </button>
            </>
          )}
          <button type="button" onClick={onChat} disabled={!isGlobal && !event.is_owner && event.join_status !== 'accepted'} title={!isGlobal && !event.is_owner && event.join_status !== 'accepted' ? t('social.chat_join_first') : undefined} className="rounded-xl border border-[#C5A059]/40 p-2 text-[#C5A059] disabled:opacity-50">💬 {t('social.chat')}</button>
          <button type="button" onClick={onShare} className="rounded-xl border border-[#C5A059]/40 p-2 text-[#C5A059]">🔗 {t('social.share')}</button>
        </div>
        {!isGlobal && !event.is_owner && (
          <div className="flex justify-end gap-4 pt-1 text-xs text-red-400/70">
            <button type="button" onClick={() => { setShowReport(!showReport); setShowBlock(false); }}>⚑ {t('social.report')}</button>
            <button type="button" onClick={() => { setShowBlock(!showBlock); setShowReport(false); }}>{t('social.block')}</button>
          </div>
        )}
      </footer>
    </article>
  );
}
