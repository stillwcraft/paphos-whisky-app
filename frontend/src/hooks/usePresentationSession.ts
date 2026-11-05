import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { telegramAuthHeaders } from '@/telegramAuth';
import i18n from '@/i18n';
import { PRESENTATION_API_URL } from '@/components/presentation/presentationApi';
import {
  sessionStateSchema, type PresentationCommand, type PresentationState,
} from '@/types/presentation';

const wireMessageSchema = z.union([
  sessionStateSchema,
  z.object({ type: z.literal('pong') }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);
type Status = 'connecting' | 'connected' | 'reconnecting' | 'offline' | 'error';

export function usePresentationSession(roomId: string, initDataRaw: string | undefined) {
  const [state, setState] = useState<PresentationState | null>(null);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<Status>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const latest = useRef<PresentationState | null>(null);

  useEffect(() => {
    setState(null);
    latest.current = null;
    setIndex(0);
    setError(null);
    setPending(false);
    if (!initDataRaw) {
      setStatus('error');
      setError(i18n.t('presentation.auth_required'));
      return;
    }
    let disposed = false;
    let fatal = false;
    let attempt = 0;
    let generation = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let fallback: AbortController | undefined;
    let lastMessage = Date.now();
    const url = new URL(`${PRESENTATION_API_URL}/api/presentations/rooms/${encodeURIComponent(roomId)}`, window.location.origin);

    const apply = (next: PresentationState, forceJump: boolean) => {
      if (next.room_id !== roomId) throw new Error('Presentation room mismatch');
      if (latest.current && next.revision < latest.current.revision) return;
      const jump = forceJump || !latest.current || next.current_slide_index !== latest.current.current_slide_index;
      latest.current = next;
      setState(next);
      if (jump) setIndex(next.current_slide_index);
    };
    const stopTransport = () => {
      generation += 1;
      clearTimeout(retry);
      clearInterval(heartbeat);
      fallback?.abort();
      socket.current?.close();
      socket.current = null;
    };
    const connect = () => {
      if (disposed || fatal || document.visibilityState !== 'visible') return;
      stopTransport();
      const currentGeneration = generation;
      const isCurrent = () => !disposed && currentGeneration === generation;
      setStatus(attempt ? 'reconnecting' : 'connecting');
      setPending(false);
      fallback = new AbortController();
      // HTTP restores state even while the WebSocket handshake is still in flight.
      void fetch(url, {
        headers: telegramAuthHeaders(initDataRaw), cache: 'no-store', signal: fallback.signal,
      }).then(async response => {
        if (!response.ok) {
          if ([401, 403, 404].includes(response.status) && isCurrent()) {
            fatal = true;
            stopTransport();
            setStatus('error');
          }
          throw new Error(response.status === 401
            ? i18n.t('presentation.auth_expired')
            : i18n.t('presentation.sync_error', { status: response.status }));
        }
        const next = sessionStateSchema.parse(await response.json());
        if (isCurrent()) apply(next, true);
      }).catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        if (!disposed && (isCurrent() || fatal)) {
          setError(cause instanceof Error ? cause.message : i18n.t('presentation.invalid_message'));
        }
      });

      const wsUrl = new URL(url);
      wsUrl.pathname += '/ws';
      wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(wsUrl);
      socket.current = ws;
      let synced = false;
      lastMessage = Date.now();
      ws.onopen = () => {
        if (!isCurrent()) return;
        ws.send(JSON.stringify({ type: 'auth', init_data: initDataRaw }));
      };
      ws.onmessage = event => {
        if (!isCurrent()) return;
        try {
          if (typeof event.data !== 'string') throw new Error('Expected a presentation text frame');
          const message = wireMessageSchema.parse(JSON.parse(event.data));
          lastMessage = Date.now();
          if (message.type === 'state') {
            apply(message, !synced);
            synced = true;
            attempt = 0;
            setStatus('connected');
            setError(null);
            setPending(false);
          } else if (message.type === 'error') {
            setError(message.message);
            setPending(false);
          }
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : i18n.t('presentation.invalid_message'));
          ws.close(1002);
        }
      };
      ws.onerror = () => {
        if (isCurrent()) setError(i18n.t('presentation.reconnecting'));
      };
      ws.onclose = event => {
        if (!isCurrent()) return;
        clearInterval(heartbeat);
        setPending(false);
        if ([4001, 4004, 1008, 1002].includes(event.code)) {
          fatal = true;
          setStatus('error');
          setError(i18n.t(event.code === 4001
            ? 'presentation.auth_expired'
            : event.code === 4004 ? 'presentation.room_closed' : 'presentation.rejected'));
          return;
        }
        setStatus('reconnecting');
        const delay = Math.min(1000 * 2 ** attempt++, 15000) + Math.random() * 500;
        retry = setTimeout(connect, delay);
      };
      heartbeat = setInterval(() => {
        if (!isCurrent()) return;
        if (Date.now() - lastMessage > 45000) {
          setError(i18n.t('presentation.timeout'));
          connect();
        } else if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 20000);
    };
    const visibility = () => {
      if (document.visibilityState === 'visible') {
        connect();
      } else {
        stopTransport();
        setStatus('offline');
        setPending(false);
      }
    };
    const online = () => connect();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('online', online);
    if (document.visibilityState === 'visible') connect();
    else setStatus('offline');
    return () => {
      disposed = true;
      stopTransport();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('online', online);
    };
  }, [roomId, initDataRaw]);

  const send = useCallback((command: PresentationCommand) => {
    if (status !== 'connected' || pending || socket.current?.readyState !== WebSocket.OPEN) {
      setError(i18n.t('presentation.wait'));
      return;
    }
    socket.current.send(JSON.stringify(command));
    setPending(true);
  }, [status, pending]);

  const navigate = useCallback((target: number) => {
    const current = latest.current;
    if (!current || target < 0 || target >= current.slide_count) return;
    if (current.role === 'presenter') {
      send({ type: 'advance', index: target });
    } else if (target <= current.max_unlocked_slide_index) {
      setIndex(target);
    } else {
      setError(i18n.t('presentation.locked'));
    }
  }, [send]);
  const followPresenter = useCallback(() => {
    if (latest.current) setIndex(latest.current.current_slide_index);
  }, []);

  return { state, index, status, error, pending, send, navigate, followPresenter };
}
