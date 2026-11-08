import { z } from 'zod';

const telegramUrl = z.url().refine(value => {
  const url = new URL(value);
  return url.protocol === 'https:' && url.hostname === 't.me' && !url.port && !url.username && !url.password;
});

export const htmlBridgeMessageSchema = z.discriminatedUnion('action', [
  z.object({ type: z.literal('presentation-html'), action: z.literal('telegram-link'), url: telegramUrl }).strict(),
  z.object({ type: z.literal('presentation-html'), action: z.literal('swipe'), direction: z.union([z.literal(-1), z.literal(1)]) }).strict(),
]);

export function htmlBridgeScript(parentOrigin: string) {
  return `(() => {
    const send = message => parent.postMessage({ type: 'presentation-html', ...message }, ${JSON.stringify(parentOrigin)});
    let start = null;
    let suppressClickUntil = 0;
    document.addEventListener('touchstart', event => {
      start = null;
      suppressClickUntil = 0;
      if (event.touches.length !== 1 || event.target.closest('button, input, textarea, select, video[controls], [data-no-swipe]')) return;
      const touch = event.touches[0];
      if (touch.clientX < 24 || touch.clientX > innerWidth - 24) return;
      start = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    }, { passive: true });
    document.addEventListener('touchmove', event => {
      if (event.touches.length !== 1) start = null;
    }, { passive: true });
    document.addEventListener('touchcancel', () => { start = null; }, { passive: true });
    document.addEventListener('touchend', event => {
      const origin = start;
      start = null;
      if (!origin || !event.changedTouches[0]) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - origin.x;
      const dy = touch.clientY - origin.y;
      if (Math.abs(dx) > 12 || Math.abs(dy) > 12) suppressClickUntil = Date.now() + 500;
      if (Date.now() - origin.time <= 1000 && Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        send({ action: 'swipe', direction: dx < 0 ? 1 : -1 });
      }
    }, { passive: true });
    document.addEventListener('click', event => {
      if (event.detail > 0 && Date.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      const anchor = event.target.closest('a[href]');
      if (!anchor) return;
      const url = new URL(anchor.href);
      if (url.protocol !== 'https:' || url.hostname !== 't.me' || url.port || url.username || url.password) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      send({ action: 'telegram-link', url: url.href });
    }, true);
  })();`;
}
