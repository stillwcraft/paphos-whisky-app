import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { SocialProfile } from './SocialEventCard.tsx';
import { MAX_SOURCE_IMAGE_BYTES, SOCIAL_IMAGE_TYPES } from './compressImage.ts';

type FriendRequest = { id: number; sender: SocialProfile };
type TagRequest = { id: number; location: string };
type ChatMessage = { id: number; sender: SocialProfile | null; body: string; created_at: string; is_mine: boolean };
type JoinRequest = { id: number; user: SocialProfile };
type Report = {
  id: number;
  event_id: number;
  reporter_id: number;
  category: string;
  created_at: string;
  owner_id: number | null;
  location: string | null;
  description: string | null;
  photo_url: string | null;
  status: 'open' | 'resolved';
  hidden: boolean;
};

const inputStyle = 'w-full rounded-xl border border-[#C5A059]/30 bg-[#1A1A1E] p-2.5 text-white outline-none focus:border-[#C5A059]';
const actionStyle = 'rounded-xl border border-[#C5A059]/40 px-3 py-2 text-[#C5A059] disabled:opacity-50';

export function SocialAgeGate({
  busy,
  error,
  onConfirm,
}: {
  busy: boolean;
  error: string | null;
  onConfirm: (age: number) => void;
}) {
  const { t } = useTranslation();
  const [age, setAge] = useState('');

  return (
    <form onSubmit={(event) => { event.preventDefault(); onConfirm(Number(age)); }}
      className="absolute inset-x-3 top-[calc(1rem+env(safe-area-inset-top))] z-[1100] mx-auto max-w-md space-y-4 rounded-2xl border border-[#C5A059]/40 bg-[#141417] p-5 text-sm text-white shadow-2xl">
      <h2 className="font-serif text-xl text-[#FFE28A]">{t('social.age_gate_title')}</h2>
      <p className="text-slate-300">{t('social.age_gate_description')}</p>
      <label className="block space-y-1">
        <span>{t('social.age')}</span>
        <input type="number" required min={18} max={120} value={age} onChange={(event) => setAge(event.target.value)} className={inputStyle} />
      </label>
      {error && <p role="alert" className="text-red-300">{error}</p>}
      <button type="submit" disabled={busy} className={actionStyle}>{t('social.confirm_age')}</button>
    </form>
  );
}

export function SocialProfilePanel({
  profile,
  tagRequests,
  telegramAvatarUrl,
  busy,
  error,
  notice,
  onSave,
  onRemoveAvatar,
  onAcceptTag,
  onDeclineTag,
}: {
  profile: SocialProfile;
  tagRequests: TagRequest[];
  telegramAvatarUrl?: string;
  busy: boolean;
  error: string | null;
  notice: string | null;
  onSave: (name: string, avatar: File | null) => void;
  onRemoveAvatar: () => void;
  onAcceptTag: (eventId: number) => void;
  onDeclineTag: (eventId: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const [name, setName] = useState(profile.display_name);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  useEffect(() => {
    setName(profile.display_name);
    setAvatar(null);
  }, [profile]);
  useEffect(() => {
    if (!avatar) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(avatar);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [avatar]);

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave(name.trim(), avatar);
  };
  const currentLanguage = (i18n.resolvedLanguage ?? i18n.language).split(/[-_]/, 1)[0];
  const nextLanguage = currentLanguage === 'en' ? 'uk' : currentLanguage === 'uk' ? 'ru' : 'en';
  const avatarUrl = previewUrl ?? (profile.avatar_hidden ? null : profile.avatar_url ?? telegramAvatarUrl);
  const visibleAvatarUrl = avatarUrl === failedAvatarUrl ? null : avatarUrl;

  return (
    <section className="h-[calc(100dvh-9rem-env(safe-area-inset-top))] min-h-[24rem] w-full overflow-y-auto rounded-2xl border border-[#C5A059]/40 bg-[#141417] p-4 text-sm text-white shadow-2xl">
      <header className="relative mb-5 flex min-h-10 items-center justify-center">
        <h2 className="font-serif text-xl text-[#FFE28A]">{t('social.profile')}</h2>
        <button
          type="button"
          aria-label={t('social.switch_language', { language: nextLanguage.toUpperCase() })}
          onClick={() => {
            localStorage.setItem('app_lang', nextLanguage);
            void i18n.changeLanguage(nextLanguage);
          }}
          className="absolute right-0 rounded-lg border border-[#C5A059]/40 px-2.5 py-1.5 font-semibold tracking-wider text-[#C5A059]"
        >{currentLanguage.toUpperCase()}</button>
      </header>
      <form onSubmit={save} className="space-y-3">
        <div className="flex flex-col items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label={t('social.avatar')}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              if (file && (file.size > MAX_SOURCE_IMAGE_BYTES || !SOCIAL_IMAGE_TYPES.includes(file.type))) {
                setAvatar(null);
                setAvatarError(t('social.invalid_photo'));
                event.target.value = '';
              } else {
                setAvatar(file);
                setAvatarError(null);
              }
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            aria-label={t('social.change_avatar')}
            className="relative h-28 w-28 rounded-full border-2 border-[#C5A059]/50 bg-[#29272B] text-[#C5A059] disabled:opacity-50"
          >
            {visibleAvatarUrl
              ? <img src={visibleAvatarUrl} alt="" onError={() => setFailedAvatarUrl(visibleAvatarUrl)} className="h-full w-full rounded-full object-cover" />
              : <span aria-hidden="true" className="flex h-full w-full items-center justify-center">
                <svg className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <circle cx="12" cy="8" r="4" />
                  <path strokeLinecap="round" d="M4 21a8 8 0 0 1 16 0" />
                </svg>
              </span>}
            <span aria-hidden="true" className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border border-[#C5A059]/50 bg-[#1A1A1E]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h3l2-2h6l2 2h3v12H4V7Z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            </span>
          </button>
          {(avatar || avatarUrl) && (
            <button type="button" disabled={busy} onClick={() => {
              setAvatar(null);
              if (fileRef.current) fileRef.current.value = '';
              onRemoveAvatar();
            }} className="text-xs text-red-400/80 disabled:opacity-50">{t('social.remove_avatar')}</button>
          )}
        </div>
        <label className="block space-y-1"><span>{t('social.name')}</span>
          <input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className={inputStyle} />
        </label>
        {profile.verified && <p className="text-[#C5A059]">✓ {t('social.verified')}</p>}
        <button type="submit" disabled={busy} className={actionStyle}>{t('social.save_profile')}</button>
      </form>
      {tagRequests.length > 0 && (
        <section className="mt-5 space-y-2 border-t border-[#C5A059]/20 pt-4">
          <h3 className="font-serif text-[#FFE28A]">{t('social.tag_requests')}</h3>
          {tagRequests.map((request) => (
            <div key={request.id} className="flex items-center justify-between gap-2 rounded-lg bg-[#1A1A1E] p-2">
              <span>{request.location}</span>
              <button type="button" disabled={busy} onClick={() => onAcceptTag(request.id)} className={actionStyle}>{t('social.accept')}</button>
              <button type="button" disabled={busy} onClick={() => onDeclineTag(request.id)} className="text-red-400">{t('social.decline')}</button>
            </div>
          ))}
        </section>
      )}
      {notice && <p role="status" className="mt-4 text-[#FFE28A]">{notice}</p>}
      {(avatarError || error) && <p role="alert" className="text-red-300">{avatarError || error}</p>}
    </section>
  );
}

export function SocialChatPanel({
  messages,
  requests,
  isOwner,
  busy,
  error,
  onSend,
  onAccept,
  onClose,
}: {
  messages: ChatMessage[];
  requests: JoinRequest[];
  isOwner: boolean;
  busy: boolean;
  error: string | null;
  onSend: (text: string) => Promise<boolean>;
  onAccept: (id: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!text.trim()) return;
    void onSend(text.trim()).then((sent) => {
      if (sent) setText('');
    });
  };

  return (
    <section className="absolute inset-x-3 bottom-3 top-[calc(1rem+env(safe-area-inset-top))] z-[1100] mx-auto flex max-w-md flex-col rounded-2xl border border-[#C5A059]/40 bg-[#141417] p-4 text-sm text-white shadow-2xl">
      <header className="flex items-center justify-between pb-3">
        <h2 className="font-serif text-xl text-[#FFE28A]">{t('social.chat')}</h2>
        <button type="button" onClick={onClose} aria-label={t('social.close')} className="text-2xl text-[#C5A059]">×</button>
      </header>
      {isOwner && requests.length > 0 && (
        <div className="space-y-2 border-y border-[#C5A059]/20 py-2">
          <h3>{t('social.requests')}</h3>
          {requests.map((request) => (
            <div key={request.id} className="flex items-center justify-between gap-2">
              <span>{request.user.display_name}</span>
              <button type="button" disabled={busy} onClick={() => onAccept(request.id)} className={actionStyle}>{t('social.accept')}</button>
            </div>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-3" aria-live="polite">
        {messages.map((message) => (
          <div key={message.id} className="rounded-lg bg-[#1A1A1E] p-2">
            <span className="text-xs text-[#C5A059]">{message.sender?.display_name ?? t('social.anonymous')}</span>
            <p className="whitespace-pre-wrap break-words">{message.body}</p>
          </div>
        ))}
      </div>
      {error && <p role="alert" className="pb-2 text-red-300">{error}</p>}
      <form onSubmit={submit} className="flex gap-2">
        <input value={text} maxLength={1000} onChange={(event) => setText(event.target.value)} placeholder={t('social.chat_placeholder')} className={inputStyle} />
        <button type="submit" disabled={busy || !text.trim()} className={actionStyle}>{t('social.send')}</button>
      </form>
    </section>
  );
}

export function SocialReportsPanel({
  reports,
  busy,
  error,
  onVerify,
  onHide,
  onResolve,
  onClose,
}: {
  reports: Report[];
  busy: boolean;
  error: string | null;
  onVerify: (telegramId: number) => void;
  onHide: (eventId: number) => void;
  onResolve: (reportId: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [userId, setUserId] = useState('');
  return (
    <aside className="absolute inset-x-3 bottom-3 top-[calc(1rem+env(safe-area-inset-top))] z-[1100] mx-auto max-w-md space-y-4 overflow-y-auto rounded-2xl border border-[#C5A059]/40 bg-[#141417] p-4 text-sm text-white shadow-2xl">
      <header className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-[#FFE28A]">{t('social.admin_reports')}</h2>
        <button type="button" onClick={onClose} aria-label={t('social.close')} className="text-2xl text-[#C5A059]">×</button>
      </header>
      {reports.map((report) => (
        <div key={report.id} className="space-y-2 rounded-lg bg-[#1A1A1E] p-3">
          <p>#{report.event_id} · {report.location} · {t(`social.report_${report.category}`)} · ID {report.reporter_id}</p>
          {report.description && <p className="text-slate-300">{report.description}</p>}
          {report.photo_url && <img src={report.photo_url} alt="" className="aspect-video w-full rounded-lg object-cover" />}
          <div className="flex gap-2">
            {!report.hidden && <button type="button" disabled={busy} onClick={() => onHide(report.event_id)} className={actionStyle}>{t('social.admin_hide_event')}</button>}
            {report.status === 'open' && <button type="button" disabled={busy} onClick={() => onResolve(report.id)} className={actionStyle}>{t('social.admin_resolve_report')}</button>}
          </div>
        </div>
      ))}
      <div className="flex gap-2 border-t border-[#C5A059]/20 pt-3">
        <input type="number" min={1} value={userId} onChange={(event) => setUserId(event.target.value)} placeholder={t('social.friend_id')} aria-label={t('social.friend_id')} className={inputStyle} />
        <button type="button" disabled={busy || !userId} onClick={() => onVerify(Number(userId))} className={actionStyle}>{t('social.admin_verify')}</button>
      </div>
      {error && <p role="alert" className="text-red-300">{error}</p>}
    </aside>
  );
}

export type { FriendRequest, TagRequest, ChatMessage, JoinRequest, Report };
