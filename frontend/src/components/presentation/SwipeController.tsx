import { useRef, type ReactNode, type TouchEvent } from 'react';

interface Props {
  children: ReactNode;
  onHorizontal?: (direction: -1 | 1) => void;
  onVertical?: (direction: -1 | 1) => void;
  className?: string;
}

export function SwipeController({ children, onHorizontal, onVertical, className = '' }: Props) {
  const start = useRef<{ x: number; y: number; time: number } | null>(null);
  const begin = (event: TouchEvent<HTMLDivElement>) => {
    start.current = null;
    const target = event.target;
    if (event.touches.length !== 1 || (target instanceof Element
      && target.closest('button, input, textarea, select, a, video, iframe, [data-no-swipe]'))) {
      start.current = null;
      return;
    }
    const touch = event.touches[0];
    // Native iOS edge navigation cannot reliably be cancelled by a web page.
    if (touch.clientX < 24 || touch.clientX > window.innerWidth - 24) return;
    start.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  };
  const end = (event: TouchEvent<HTMLDivElement>) => {
    const origin = start.current;
    start.current = null;
    if (!origin || !event.changedTouches[0] || Date.now() - origin.time > 1000) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - origin.x;
    const dy = touch.clientY - origin.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4 && onHorizontal) {
      event.stopPropagation();
      onHorizontal(dx < 0 ? 1 : -1);
    } else if (Math.abs(dy) > 48 && Math.abs(dy) > Math.abs(dx) * 1.4 && onVertical) {
      event.stopPropagation();
      onVertical(dy < 0 ? 1 : -1);
    }
  };
  return (
    <div className={`presentation-swipe ${onVertical ? 'presentation-swipe--gallery' : ''} ${className}`}
      onTouchStart={begin} onTouchEnd={end}
      onTouchMove={event => { if (event.touches.length !== 1) start.current = null; }}
      onTouchCancel={() => { start.current = null; }}>
      {children}
    </div>
  );
}
