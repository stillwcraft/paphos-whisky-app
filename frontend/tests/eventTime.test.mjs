import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const server = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)),
  server: { middlewareMode: true, hmr: { server: createHttpServer() } },
  appType: 'custom',
});
after(() => server.close());
const { getTimelineTargetIndex } = await server.ssrLoadModule('/src/helpers/eventTime.ts');
const events = [
  { date: '2026-10-16T19:00' },
  { date: '2026-10-30T19:00' },
  { date: '2026-11-13T19:00' },
  { date: '2026-11-27T19:00' },
  { date: '2026-12-04T19:00+02:00' },
];

test('the opening animation lands on the first upcoming event', () => {
  assert.equal(getTimelineTargetIndex(events, Date.parse('2026-11-18T15:00Z')), 3);
});

test('an ongoing event remains the target until its two-hour window ends', () => {
  assert.equal(getTimelineTargetIndex(events, Date.parse('2026-11-27T20:59Z')), 3);
  assert.equal(getTimelineTargetIndex(events, Date.parse('2026-11-27T21:00Z')), 4);
});

test('a past-only timeline lands on the latest event', () => {
  assert.equal(getTimelineTargetIndex(events, Date.parse('2027-01-01T00:00Z')), 4);
});
