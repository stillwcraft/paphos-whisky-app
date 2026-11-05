import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initData, useSignal } from '@tma.js/sdk-react';
import { useTranslation } from 'react-i18next';
import type { PresentationRoute } from '@/types/presentation';
import { PresentationApi } from './presentationApi';
import { PresentationScreen } from './PresentationScreen';

export function PresentationBroadcastTab({ isAdmin, onClose, onRoute, onManage }: {
  isAdmin: boolean; onClose: () => void; onRoute: (route: PresentationRoute) => void; onManage: () => void;
}) {
  const { t } = useTranslation();
  const raw = useSignal(initData.raw);
  const api = useMemo(() => raw ? new PresentationApi(raw) : null, [raw]);
  const [broadcast, setBroadcast] = useState<{ room_id: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const action = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    setBroadcast(null);
    setError(null);
    const poll = async () => {
      if (!api || controller.signal.aborted || inFlight || document.visibilityState !== 'visible') return;
      clearTimeout(timer);
      inFlight = true;
      try {
        const current = await api.broadcast(controller.signal);
        if (!controller.signal.aborted) {
          setBroadcast(current);
          setError(null);
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t('presentation.broadcast_error'));
      } finally {
        inFlight = false;
        if (!controller.signal.aborted) timer = setTimeout(() => { void poll(); }, 5000);
      }
    };
    const resume = () => { void poll(); };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', resume);
    };
  }, [api, refresh, t]);

  useEffect(() => () => { action.current?.abort(); }, []);

  const broadcastEnded = useCallback(() => {
    setBroadcast(null);
    setRefresh(previous => previous + 1);
  }, []);

  const stop = async () => {
    if (!api || !broadcast?.room_id || !isAdmin || stopping) return;
    const controller = new AbortController();
    action.current = controller;
    setStopping(true);
    setActionError(null);
    try {
      await api.stopBroadcast(broadcast.room_id, controller.signal);
      if (!controller.signal.aborted) broadcastEnded();
    } catch (cause) {
      if (!controller.signal.aborted) setActionError(cause instanceof Error ? cause.message : t('presentation.broadcast_error'));
    } finally {
      if (!controller.signal.aborted) setStopping(false);
    }
  };

  if (broadcast?.room_id) return <PresentationScreen key={broadcast.room_id} roomId={broadcast.room_id}
    onClose={onClose} onRoute={onRoute} broadcastOnly onBroadcastEnded={broadcastEnded}
    onStopBroadcast={isAdmin ? () => { void stop(); } : undefined}
    stoppingBroadcast={stopping} broadcastError={actionError || error} />;

  return <section className="mx-auto max-w-xl space-y-4 py-6">
    <h1 className="text-2xl font-semibold">{t('presentation.tab')}</h1>
    {!api ? <p role="alert">{t('presentation.auth_required')}</p>
      : error ? <p role="alert">{error}</p>
        : !broadcast ? <p role="status">{t('common.loading')}</p>
          : <p role="status">{t('presentation.no_broadcast')}</p>}
    {actionError && <p role="alert">{actionError}</p>}
    {isAdmin && <button className="rounded-xl border border-[#C5A059]/40 px-3 py-2 text-[#C5A059]"
      onClick={onManage}>{t('presentation.manage')}</button>}
    <button className="rounded-xl border border-[#C5A059]/40 px-3 py-2 text-[#C5A059]"
      onClick={() => setRefresh(previous => previous + 1)}>{t('presentation.refresh')}</button>
  </section>;
}
