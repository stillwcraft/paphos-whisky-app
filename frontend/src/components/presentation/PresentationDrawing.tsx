import { useCallback, useEffect, useRef, type PointerEvent } from 'react';
import type { AnnotationMessage, DrawingPoint, DrawingStroke } from '@/types/presentation';
import { LASER_LIFETIME, type PresentationAnnotations } from './presentationAnnotations';

const SEND_INTERVAL = 50;
const MAX_BATCH = 100;
const MAX_DRAFT_POINTS = 8192;
const MAX_QUEUED_STROKES = 64;

type Brush = Pick<DrawingStroke, 'mode' | 'color' | 'width'>;
type Draft = DrawingStroke & { updatedAt: number; sent: number };

function paintStroke(ctx: CanvasRenderingContext2D, stroke: DrawingStroke, width: number, height: number, alpha: number) {
  const first = stroke.points[0];
  if (!first) return;
  const lineWidth = stroke.width * Math.min(width, height) / 390;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = ctx.fillStyle = stroke.color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  if (stroke.points.length === 1) {
    ctx.arc(first[0] * width, first[1] * height, lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.moveTo(first[0] * width, first[1] * height);
  for (let i = 1; i < stroke.points.length; i++) {
    const [x, y] = stroke.points[i];
    ctx.lineTo(x * width, y * height);
  }
  ctx.stroke();
}

export function PresentationDrawing({ slideId, annotations, enabled, brush, send }: {
  slideId: string;
  annotations: PresentationAnnotations;
  enabled: boolean;
  brush: Brush;
  send: (command: AnnotationMessage) => boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const active = useRef<{ pointerId: number; draft: Draft; rect: DOMRect } | null>(null);
  const drafts = useRef(new Map<string, Draft>());
  const animation = useRef<number | null>(null);
  const transmission = useRef<number | null>(null);
  const sendRef = useRef(send);
  sendRef.current = send;

  const redraw = useCallback(function redraw() {
    if (animation.current !== null) return;
    animation.current = window.requestAnimationFrame(now => {
      animation.current = null;
      const element = canvas.current;
      const ctx = element?.getContext('2d');
      if (!element || !ctx) return;
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;
      const ratio = window.devicePixelRatio || 1;
      const pixelWidth = Math.round(width * ratio);
      const pixelHeight = Math.round(height * ratio);
      if (element.width !== pixelWidth) element.width = pixelWidth;
      if (element.height !== pixelHeight) element.height = pixelHeight;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = ctx.lineJoin = 'round';

      const { pens, lasers } = annotations.read(slideId, now);
      for (const [id, draft] of drafts.current) {
        const remote = (draft.mode === 'pen' ? pens : lasers)?.get(id);
        if (draft !== active.current?.draft &&
          ((remote && remote.points.length >= draft.points.length)
            || (draft.mode === 'laser' && now - draft.updatedAt >= LASER_LIFETIME))) {
          drafts.current.delete(id);
        }
      }
      for (const pen of pens?.values() ?? []) {
        if (!drafts.current.has(pen.id)) paintStroke(ctx, pen, width, height, 1);
      }
      let fading = false;
      const paintLaser = (stroke: DrawingStroke, updatedAt: number) => {
        const alpha = Math.min(1, Math.max(0, 1 - (now - updatedAt) / LASER_LIFETIME));
        if (alpha > 0) {
          fading = true;
          paintStroke(ctx, stroke, width, height, alpha);
        }
      };
      for (const laser of lasers?.values() ?? []) {
        if (!drafts.current.has(laser.id)) paintLaser(laser, laser.updatedAt);
      }
      for (const draft of drafts.current.values()) {
        if (draft.mode === 'laser') paintLaser(draft, draft.updatedAt);
        else paintStroke(ctx, draft, width, height, 1);
      }
      if (fading) redraw();
    });
  }, [annotations, slideId]);

  const discard = useCallback(() => {
    const pointerId = active.current?.pointerId;
    active.current = null;
    if (pointerId !== undefined && canvas.current?.hasPointerCapture(pointerId)) {
      canvas.current.releasePointerCapture(pointerId);
    }
    if (transmission.current !== null) window.clearTimeout(transmission.current);
    transmission.current = null;
    drafts.current.clear();
    redraw();
  }, [redraw]);

  const scheduleBatch = useCallback(function scheduleBatch() {
    if (transmission.current !== null) return;
    transmission.current = window.setTimeout(() => {
      transmission.current = null;
      const draft = Array.from(drafts.current.values()).find(item => item.sent < item.points.length);
      if (!draft) return;
      const { id, color, width, mode } = draft;
      const points = draft.points.slice(draft.sent, draft.sent + MAX_BATCH);
      if (!sendRef.current({ type: 'draw', slide_id: slideId, stroke: { id, color, width, mode, points } })) {
        discard();
        return;
      }
      draft.sent += points.length;
      if (Array.from(drafts.current.values()).some(item => item.sent < item.points.length)) scheduleBatch();
    }, SEND_INTERVAL);
  }, [discard, slideId]);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const observer = new ResizeObserver(redraw);
    observer.observe(element);
    window.addEventListener('resize', redraw);
    let resolution: MediaQueryList;
    const watchResolution = () => {
      resolution?.removeEventListener('change', watchResolution);
      resolution = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      resolution.addEventListener('change', watchResolution);
      redraw();
    };
    watchResolution();
    const unsubscribe = annotations.subscribe(change => {
      if (change.slideId && change.slideId !== slideId) return;
      if (change.reset) discard();
      else redraw();
    });
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', redraw);
      resolution.removeEventListener('change', watchResolution);
      unsubscribe();
      if (animation.current !== null) window.cancelAnimationFrame(animation.current);
      animation.current = null;
      if (transmission.current !== null) window.clearTimeout(transmission.current);
      transmission.current = null;
    };
  }, [annotations, discard, redraw, slideId]);

  useEffect(() => {
    if (!enabled) active.current = null;
  }, [enabled]);

  const addPoints = (event: PointerEvent<HTMLCanvasElement>) => {
    const pointer = active.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    const { draft, rect } = pointer;
    const samples = event.nativeEvent.getCoalescedEvents?.();
    const normalized = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 10000) / 10000;
    for (const sample of samples?.length ? samples : [event.nativeEvent]) {
      if (draft.points.length >= MAX_DRAFT_POINTS) break;
      const point: DrawingPoint = [
        normalized((sample.clientX - rect.left) / rect.width),
        normalized((sample.clientY - rect.top) / rect.height),
      ];
      const previous = draft.points[draft.points.length - 1];
      if (!previous || Math.hypot(previous[0] - point[0], previous[1] - point[1]) >= 0.002) {
        draft.points.push(point);
        draft.updatedAt = performance.now();
      }
    }
    redraw();
    scheduleBatch();
  };

  const begin = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!enabled || event.button !== 0 || !event.isPrimary || active.current
      || drafts.current.size >= MAX_QUEUED_STROKES) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const draft: Draft = {
      ...brush, id: crypto.randomUUID(), points: [], sent: 0, updatedAt: performance.now(),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    drafts.current.set(draft.id, draft);
    active.current = { pointerId: event.pointerId, draft, rect };
    addPoints(event);
  };

  const stop = (event: PointerEvent<HTMLCanvasElement>) => {
    if (active.current?.pointerId !== event.pointerId) return;
    if (event.type === 'pointerup') addPoints(event);
    active.current = null;
    redraw();
  };

  return <canvas ref={canvas} className="presentation-annotation-canvas" aria-hidden="true"
    data-no-swipe={enabled ? 'true' : undefined}
    onPointerDown={begin} onPointerMove={addPoints} onPointerUp={stop}
    onPointerCancel={stop} onLostPointerCapture={stop} />;
}
