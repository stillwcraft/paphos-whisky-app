import { useEffect, useMemo, useRef, useState } from 'react';
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { telegramAuthHeaders } from '@/telegramAuth.ts';
import { localizedApiUrl } from '@/localization.ts';

const API_URL = 'https://paphos-whisky-api.onrender.com';
const CARD_WIDTH = 360;
const CARD_HEIGHT = 520;
const NODE_SPACING = 120;
const CENTER_X = CARD_WIDTH / 2;

type EventNode = {
  id: string;
  type: 'event';
  title: string;
  date: string;
  image_url: string | null;
  status: 'attended' | 'missed' | 'upcoming';
  bottles_count: number;
};

type MilestoneNode = {
  id: string;
  type: 'milestone';
  tried_bottles_count: number;
};

type TrailNode = EventNode | MilestoneNode;

type WhiskyTrailData = {
  status: 'success' | 'empty';
  focused_node_id: string | null;
  message?: string | null;
  nodes: TrailNode[];
};

type EventDetail = {
  id: number;
  title: string;
  date: string;
  description: string;
  image_url: string | null;
  price: number;
  bottles: Array<{
    id: number;
    name: string;
    image_url: string | null;
  }>;
};

function formatEventDate(date: string, language: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.valueOf())) {
    return date;
  }

  return new Intl.DateTimeFormat(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function eventIdFromNodeId(nodeId: string) {
  const eventId = Number(nodeId.replace('event_', ''));
  return Number.isSafeInteger(eventId) ? eventId : null;
}

function TrailModal({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/75 p-3 backdrop-blur-sm sm:items-center" role="presentation" onClick={onClose}>
      <section aria-label={title} aria-modal="true" className="mx-auto max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-[#C5A059]/30 bg-[#16161A] p-5 shadow-2xl shadow-black/50" role="dialog" onClick={(event) => event.stopPropagation()}>
        <button aria-label="Close" className="float-right flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg text-white" onClick={onClose} type="button">×</button>
        {children}
      </section>
    </div>
  );
}

function EventModal({
  detail,
  isRegistering,
  onClose,
  onRegister,
}: {
  detail: EventDetail;
  isRegistering: boolean;
  onClose: () => void;
  onRegister: () => void;
}) {
  return (
    <TrailModal onClose={onClose} title={detail.title}>
      {detail.image_url && <img alt="" className="mb-5 h-44 w-full rounded-2xl object-cover" src={detail.image_url} />}
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C5A059]">{formatEventDate(detail.date, 'ru-RU')}</p>
      <h2 className="mt-2 text-2xl font-semibold text-white">{detail.title}</h2>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-300">{detail.description}</p>
      <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-sm">
        <span className="text-slate-400">{detail.bottles.length} бутылок</span>
        <span className="font-semibold text-[#C5A059]">€{detail.price}</span>
      </div>
      <button className="mt-5 w-full rounded-xl bg-[#C5A059] px-4 py-3 text-sm font-bold text-[#17120B] transition-colors hover:bg-[#dfbd76] disabled:cursor-wait disabled:opacity-70" disabled={isRegistering} onClick={onRegister} type="button">
        {isRegistering ? 'Регистрация…' : 'Забронировать место'}
      </button>
    </TrailModal>
  );
}

function RecapModal({
  detail,
  onClose,
}: {
  detail: EventDetail;
  onClose: () => void;
}) {
  return (
    <TrailModal onClose={onClose} title={`${detail.title} — recap`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Пропущенное событие</p>
      <h2 className="mt-2 text-2xl font-semibold text-white">{detail.title}</h2>
      <p className="mt-2 text-sm text-slate-400">{formatEventDate(detail.date, 'ru-RU')}</p>
      <h3 className="mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-[#C5A059]">Дегустировали</h3>
      <ul className="mt-3 space-y-2">
        {detail.bottles.map((bottle) => (
          <li key={bottle.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-sm text-slate-200">
            {bottle.image_url ? <img alt="" className="h-10 w-10 rounded-lg object-cover" src={bottle.image_url} /> : <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#C5A059]/15 text-[#C5A059]">🥃</span>}
            {bottle.name}
          </li>
        ))}
      </ul>
      {detail.bottles.length === 0 && <p className="mt-3 text-sm text-slate-400">Список релизов пока недоступен.</p>}
    </TrailModal>
  );
}

export function WhiskyTrail({
  language,
  telegramId,
  initDataRaw,
  username,
  firstName,
}: {
  language: string;
  telegramId?: number;
  initDataRaw: string | undefined;
  username?: string;
  firstName?: string;
}) {
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
  const [trail, setTrail] = useState<WhiskyTrailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<EventNode | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<EventDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!telegramId) {
      setTrail({ status: 'empty', focused_node_id: null, message: 'Начало пути', nodes: [] });
      return;
    }

    const controller = new AbortController();
    const loadTrail = async () => {
      try {
        const response = await fetch(localizedApiUrl(
          `${API_URL}/api/profile/whisky-trail?telegram_id=${encodeURIComponent(telegramId)}`,
          language,
        ), {
          headers: telegramAuthHeaders(initDataRaw),
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Не удалось загрузить тропу: ${response.status}`);
        }
        setTrail(await response.json() as WhiskyTrailData);
        setError(null);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить тропу.');
        }
      }
    };
    void loadTrail();
    return () => controller.abort();
  }, [initDataRaw, language, telegramId]);

  const points = useMemo(() => trail?.nodes.map((node, index) => ({
    x: node.type === 'milestone' ? CENTER_X : CENTER_X + (index % 2 === 0 ? 60 : -60),
    y: index * NODE_SPACING,
  })) ?? [], [trail?.nodes]);
  const canvasHeight = Math.max(1, Math.max(0, points.length - 1) * NODE_SPACING);
  const focusedPoint = useMemo(() => {
    const index = trail?.nodes.findIndex((node) => node.id === trail.focused_node_id) ?? -1;
    return index >= 0 ? points[index] : undefined;
  }, [points, trail?.focused_node_id, trail?.nodes]);
  const path = useMemo(() => points.reduce((result, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const middleY = (previous.y + point.y) / 2;
    return `${result} C ${previous.x} ${middleY}, ${point.x} ${middleY}, ${point.x} ${point.y}`;
  }, ''), [points]);

  useEffect(() => {
    if (!focusedPoint || !transformRef.current) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      transformRef.current?.setTransform(
        CARD_WIDTH / 2 - focusedPoint.x,
        CARD_HEIGHT / 2 - focusedPoint.y,
        1,
        0,
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusedPoint]);

  const openNode = async (node: EventNode) => {
    const eventId = eventIdFromNodeId(node.id);
    if (eventId === null) return;
    setSelectedNode(node);
    setSelectedDetail(null);
    setFeedback(null);
    setIsLoadingDetail(true);
    try {
      const response = await fetch(localizedApiUrl(`${API_URL}/api/events/${eventId}`, language), {
        headers: telegramAuthHeaders(initDataRaw),
      });
      if (!response.ok) throw new Error(`Не удалось загрузить событие: ${response.status}`);
      setSelectedDetail(await response.json() as EventDetail);
    } catch (loadError) {
      setFeedback(loadError instanceof Error ? loadError.message : 'Не удалось загрузить событие.');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const closeModal = () => {
    setSelectedNode(null);
    setSelectedDetail(null);
    setFeedback(null);
  };

  const registerForEvent = async () => {
    const eventId = selectedDetail?.id;
    if (!eventId || !telegramId) return;
    setIsRegistering(true);
    setFeedback(null);
    try {
      const response = await fetch(`${API_URL}/api/events/${eventId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...telegramAuthHeaders(initDataRaw) },
        body: JSON.stringify({
          telegram_id: telegramId,
          username: username ?? null,
          first_name: firstName ?? null,
          registered: true,
        }),
      });
      if (!response.ok) throw new Error(`Не удалось зарегистрироваться: ${response.status}`);
      setFeedback('Место забронировано.');
    } catch (registrationError) {
      setFeedback(registrationError instanceof Error ? registrationError.message : 'Не удалось зарегистрироваться.');
    } finally {
      setIsRegistering(false);
    }
  };

  if (error) {
    return <p className="text-center text-sm text-red-300">{error}</p>;
  }

  if (!trail || trail.status === 'empty') {
    return (
      <article className="flex h-[520px] w-full max-w-sm items-center justify-center rounded-2xl border border-[#C5A059]/30 bg-[#141417] p-8 text-center shadow-2xl">
        <div className="flex h-32 w-32 flex-col items-center justify-center rounded-[2rem] border border-[#C5A059]/60 bg-[#C5A059]/10 text-[#C5A059] shadow-[0_0_32px_rgba(197,160,89,0.2)]">
          <span className="text-4xl">♜</span>
          <span className="mt-2 text-sm font-semibold">{trail?.message ?? 'Начало пути'}</span>
        </div>
      </article>
    );
  }

  return (
    <>
      <article className="relative h-[520px] w-full max-w-sm overflow-hidden rounded-2xl border border-[#C5A059]/30 bg-[#141417] shadow-2xl">
        <TransformWrapper ref={transformRef} centerOnInit={false} initialScale={1} limitToBounds maxScale={1.8} minScale={0.6} panning={{ excluded: ['button'] }} wheel={{ step: 0.15 }}>
          <TransformComponent wrapperClass="!h-full !w-full" contentClass="!h-auto !w-auto">
            <div className="relative" style={{ height: canvasHeight, width: CARD_WIDTH }}>
              <svg aria-hidden="true" className="absolute inset-0 overflow-visible" height={canvasHeight} width={CARD_WIDTH}>
                <defs>
                  <linearGradient id="copperGradient" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stopColor="#75451f" />
                    <stop offset="50%" stopColor="#e2b66c" />
                    <stop offset="100%" stopColor="#8f5728" />
                  </linearGradient>
                </defs>
                {path && <path d={path} fill="none" filter="drop-shadow(0 0 8px rgba(197, 160, 89, 0.6))" stroke="url(#copperGradient)" strokeWidth="4" />}
              </svg>
              {trail.nodes.map((node, index) => {
                const point = points[index];
                if (node.type === 'milestone') {
                  return (
                    <div key={node.id} className="absolute z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-2xl border border-[#C5A059] bg-[#1b1815] text-[#C5A059] shadow-[0_0_20px_rgba(197,160,89,0.35)]" style={{ left: point.x, top: point.y }}>
                      <span aria-hidden="true" className="text-lg">◒</span>
                      <span className="text-xs font-bold">{node.tried_bottles_count}</span>
                    </div>
                  );
                }

                const isMissed = node.status === 'missed';
                const isUpcoming = node.status === 'upcoming';
                const labelOnLeft = point.x > CENTER_X;
                return (
                  <div key={node.id} className="absolute z-10" style={{ left: point.x, top: point.y }}>
                    <button aria-label={node.title} className="group absolute -translate-x-1/2 -translate-y-1/2" onClick={() => void openNode(node)} type="button">
                      {isUpcoming && <span className="absolute inset-0 rounded-full border-2 border-[#C5A059] animate-ping" />}
                      <span className={`relative flex h-12 w-12 overflow-hidden rounded-full border-2 bg-[#2a251f] ${isMissed ? 'border-slate-500 opacity-40 grayscale' : 'border-[#C5A059] shadow-[0_0_16px_rgba(197,160,89,0.7)]'}`}>
                        {node.image_url ? <img alt="" className="h-full w-full object-cover" src={node.image_url} /> : <span className="m-auto text-lg text-[#C5A059]">🥃</span>}
                      </span>
                    </button>
                    <div className={`pointer-events-none absolute top-1/2 w-36 -translate-y-1/2 ${labelOnLeft ? 'right-9 text-right' : 'left-9 text-left'}`}>
                      <p className={`text-sm font-semibold leading-tight ${isMissed ? 'text-slate-500' : 'text-white'}`}>{node.title}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{formatEventDate(node.date, language)}</p>
                      {isMissed ? <span className="mt-1 inline-block rounded-full bg-slate-500/20 px-2 py-0.5 text-[10px] text-slate-400">Пропущено</span> : isUpcoming ? <span className="mt-1 inline-block rounded-full bg-[#C5A059]/20 px-2 py-0.5 text-[10px] text-[#e4c47f]">Забронировать место</span> : <span className="mt-1 inline-block rounded-full bg-[#C5A059]/15 px-2 py-0.5 text-[10px] text-[#C5A059]">Был · {node.bottles_count}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </TransformComponent>
        </TransformWrapper>
      </article>

      {selectedNode && (
        isLoadingDetail ? (
          <TrailModal onClose={closeModal} title={selectedNode.title}><p className="text-sm text-slate-300">Загрузка события…</p></TrailModal>
        ) : feedback && !selectedDetail ? (
          <TrailModal onClose={closeModal} title={selectedNode.title}><p className="text-sm text-red-300">{feedback}</p></TrailModal>
        ) : selectedDetail && selectedNode.status === 'missed' ? (
          <RecapModal detail={selectedDetail} onClose={closeModal} />
        ) : selectedDetail ? (
          <EventModal detail={selectedDetail} isRegistering={isRegistering} onClose={closeModal} onRegister={() => void registerForEvent()} />
        ) : null
      )}
      {feedback && selectedDetail && <p className="fixed inset-x-4 bottom-6 z-[60] mx-auto max-w-sm rounded-xl bg-[#1b1815] p-3 text-center text-sm text-[#e4c47f] shadow-xl">{feedback}</p>}
    </>
  );
}
