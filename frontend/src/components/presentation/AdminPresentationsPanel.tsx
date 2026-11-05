import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { initData, useSignal } from '@tma.js/sdk-react';
import { useTranslation } from 'react-i18next';
import { localize } from '@/types/presentation';
import { PresentationApi, type PresentationRoomSummary } from './presentationApi';

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const buttonClass = 'rounded-xl border border-[#C5A059]/40 px-3 py-2 text-sm text-[#C5A059] disabled:opacity-40';

export function AdminPresentationsPanel({ onBroadcastStarted }: { onBroadcastStarted: () => void }) {
  const { t, i18n } = useTranslation();
  const raw = useSignal(initData.raw);
  const api = useMemo(() => raw ? new PresentationApi(raw) : null, [raw]);
  const controller = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [rooms, setRooms] = useState<PresentationRoomSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const busy = saving || starting;
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedRoomId, setUploadedRoomId] = useState<string | null>(null);

  const loadRooms = useCallback(async (offset = 0) => {
    const signal = controller.current?.signal;
    if (!api || !signal || signal.aborted) return;
    setLoading(true);
    try {
      const page = await api.rooms(signal, offset);
      if (signal.aborted) return;
      setRooms(previous => offset ? [
        ...previous, ...page.items.filter(item => !previous.some(room => room.room_id === item.room_id)),
      ] : page.items);
      setHasMore(page.has_more);
      setNextOffset(page.offset + page.items.length);
      setError(null);
    } catch (cause) {
      if (!signal.aborted) setError(cause instanceof Error ? cause.message : t('presentation.load_error'));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [api, t]);

  useEffect(() => {
    const abort = new AbortController();
    controller.current = abort;
    setRooms([]);
    setHasMore(false);
    setNextOffset(0);
    setUploadedRoomId(null);
    if (api) void loadRooms();
    else setLoading(false);
    return () => abort.abort();
  }, [api, loadRooms]);

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const signal = controller.current?.signal;
    if (!api || !signal || signal.aborted || !file || busy) return;
    setSaving(true);
    setError(null);
    setUploadedRoomId(null);
    try {
      if (file.size > MAX_FILE_BYTES) throw new Error(t('presentation.file_too_large'));
      let manifest: unknown;
      try {
        manifest = JSON.parse(await file.text());
      } catch (cause) {
        if (!(cause instanceof SyntaxError)) throw cause;
        throw new Error(t('presentation.invalid_file'));
      }
      const created = await api.upload(manifest, signal);
      if (signal.aborted) return;
      setUploadedRoomId(created.room_id);
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
      await loadRooms();
    } catch (cause) {
      if (!signal.aborted) setError(cause instanceof Error ? cause.message : t('presentation.upload_error'));
    } finally {
      if (!signal.aborted) setSaving(false);
    }
  };

  const startBroadcast = async (roomId: string) => {
    const signal = controller.current?.signal;
    if (!api || !signal || signal.aborted || busy || loading) return;
    setStarting(true);
    setError(null);
    try {
      await api.startBroadcast(roomId, signal);
      if (!signal.aborted) onBroadcastStarted();
    } catch (cause) {
      if (!signal.aborted) setError(cause instanceof Error ? cause.message : t('presentation.broadcast_error'));
    } finally {
      if (!signal.aborted) setStarting(false);
    }
  };

  return (
    <section className="mx-auto max-w-xl py-6">
      <h1 className="mb-3 text-2xl font-semibold">{t('presentation.tab')}</h1>
      <p className="mb-5 text-sm text-[#A1A1AA]">{t('presentation.upload_hint')}</p>
      {!api ? <p role="alert">{t('presentation.auth_required')}</p> : (
        <>
          <form onSubmit={event => { void upload(event); }} className="mb-5 space-y-3 rounded-xl border border-[#C5A059]/20 p-4">
            <label className="block text-sm">
              {t('presentation.choose_file')}
              <input ref={fileInput} type="file" accept=".json,application/json"
                disabled={busy || loading} className="mt-2 block w-full text-sm"
                onChange={event => { setFile(event.target.files?.[0] ?? null); setError(null); setUploadedRoomId(null); }} />
            </label>
            <button type="submit" className={buttonClass} disabled={!file || busy || loading}>
              {t(saving ? 'presentation.uploading' : 'presentation.upload')}
            </button>
          </form>
          {uploadedRoomId && <div role="status" className="mb-4 rounded-xl border border-green-400/30 p-3 text-sm">
            <p>{t('presentation.uploaded')}</p>
            <button className={`${buttonClass} mt-2`} disabled={busy || loading}
              onClick={() => { void startBroadcast(uploadedRoomId); }}>{t('presentation.start_broadcast')}</button>
          </div>}
          {error && <p role="alert" className="mb-4 whitespace-pre-wrap rounded-xl border border-red-400/30 p-3 text-sm text-red-300">{error}</p>}
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold">{t('presentation.saved')}</h2>
            <button className={buttonClass} disabled={loading || busy} onClick={() => { void loadRooms(); }}>{t('presentation.refresh')}</button>
          </div>
          {loading && <p role="status">{t('common.loading')}</p>}
          {!loading && !error && !rooms.length && <p className="text-sm text-[#A1A1AA]">{t('presentation.empty')}</p>}
          <div className="space-y-3">
            {rooms.map(room => <article key={room.room_id} className="rounded-xl border border-[#C5A059]/20 p-4">
              <h3 className="font-semibold">{localize(room.title, i18n.language) || room.manifest_id}</h3>
              <p className="mb-3 text-sm text-[#A1A1AA]">{t('presentation.room_progress', {
                current: room.current_slide_index + 1, total: room.slide_count,
              })}</p>
              <button className={buttonClass} disabled={busy || loading}
                onClick={() => { void startBroadcast(room.room_id); }}>{t('presentation.start_broadcast')}</button>
            </article>)}
          </div>
          {hasMore && <button className={`${buttonClass} mt-4`} disabled={loading || busy}
            onClick={() => { void loadRooms(nextOffset); }}>{t('presentation.load_more')}</button>}
        </>
      )}
    </section>
  );
}
