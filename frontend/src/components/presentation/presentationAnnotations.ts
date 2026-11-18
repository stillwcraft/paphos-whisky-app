import type { AnnotationMessage, DrawingStroke, PresentationState } from '@/types/presentation';

export const LASER_LIFETIME = 1500;
const MAX_LASER_POINTS = 8192;
type TimedStroke = DrawingStroke & { updatedAt: number };
type DrawingChange = { slideId?: string; reset?: boolean };

export class PresentationAnnotations {
  private pens = new Map<string, Map<string, DrawingStroke>>();
  private lasers = new Map<string, Map<string, TimedStroke>>();
  private listeners = new Set<(change: DrawingChange) => void>();

  subscribe(listener: (change: DrawingChange) => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify(change: DrawingChange) {
    this.listeners.forEach(listener => listener(change));
  }

  snapshot(strokes: PresentationState['strokes'], reset = false) {
    this.pens = new Map(Object.entries(strokes).map(([id, pens]) =>
      [id, new Map(pens.map(stroke => [stroke.id, stroke]))]));
    if (reset) this.lasers.clear();
    this.notify({ reset });
  }

  clearPreview(slideId?: string) {
    this.notify({ slideId, reset: true });
  }

  apply(message: AnnotationMessage) {
    const slideId = message.slide_id;
    if (message.type === 'draw_clear') {
      this.pens.delete(slideId);
      this.lasers.delete(slideId);
      this.notify({ slideId, reset: true });
      return;
    }

    const { stroke } = message;
    const now = performance.now();
    if (stroke.mode === 'laser') {
      this.pruneLasers(now);
      const byId = this.lasers.get(slideId) ?? new Map<string, TimedStroke>();
      const previous = byId.get(stroke.id);
      const points = previous ? previous.points.concat(stroke.points).slice(-MAX_LASER_POINTS) : stroke.points;
      byId.set(stroke.id, { ...stroke, points, updatedAt: now });
      this.lasers.set(slideId, byId);
    } else {
      const byId = this.pens.get(slideId) ?? new Map<string, DrawingStroke>();
      const previous = byId.get(stroke.id);
      if (previous) previous.points = previous.points.concat(stroke.points);
      else byId.set(stroke.id, { ...stroke });
      this.pens.set(slideId, byId);
    }
    this.notify({ slideId });
  }

  private pruneLasers(now: number) {
    for (const [slideId, strokes] of this.lasers) {
      for (const [id, stroke] of strokes) {
        if (now - stroke.updatedAt >= LASER_LIFETIME) strokes.delete(id);
      }
      if (!strokes.size) this.lasers.delete(slideId);
    }
  }

  read(slideId: string, now: number) {
    this.pruneLasers(now);
    return { pens: this.pens.get(slideId), lasers: this.lasers.get(slideId) };
  }
}
