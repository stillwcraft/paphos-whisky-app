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
const { LASER_LIFETIME, PresentationAnnotations } = await server.ssrLoadModule(
  '/src/components/presentation/presentationAnnotations.ts',
);
const { annotationMessageSchema } = await server.ssrLoadModule('/src/types/presentation.ts');

const pen = { id: 'pen', mode: 'pen', color: '#C5A059', width: 4, points: [[0.2, 0.3]] };
const draw = (slide_id, stroke) => ({ type: 'draw', slide_id, stroke });

test('delta batches append, snapshots replace pen marks, and clear is scoped to the slide', () => {
  const annotations = new PresentationAnnotations();
  annotations.snapshot({ first: [pen], second: [pen] });
  annotations.apply(draw('first', { ...pen, points: [[0.5, 0.6]] }));
  assert.deepEqual(annotations.read('first', 0).pens.get('pen').points, [[0.2, 0.3], [0.5, 0.6]]);
  annotations.apply({ type: 'draw_clear', slide_id: 'first' });
  assert.equal(annotations.read('first', 0).pens, undefined);
  assert.deepEqual(annotations.read('second', 0).pens.get('pen'), pen);
  annotations.snapshot({}, true);
  assert.equal(annotations.read('second', 0).pens, undefined);
});

test('laser marks expire without removing pen marks', () => {
  const annotations = new PresentationAnnotations();
  annotations.apply(draw('first', pen));
  annotations.apply(draw('first', { ...pen, id: 'laser', mode: 'laser' }));
  const now = performance.now();
  assert.ok(annotations.read('first', now).lasers.has('laser'));
  const expired = annotations.read('first', now + LASER_LIFETIME);
  assert.equal(expired.lasers, undefined);
  assert.ok(expired.pens.has('pen'));
});

test('wire schema accepts normalized batches and rejects invalid points', () => {
  assert.ok(annotationMessageSchema.safeParse(draw('first', pen)).success);
  assert.equal(annotationMessageSchema.safeParse(draw('first', { ...pen, points: [[1.1, 0]] })).success, false);
  assert.equal(annotationMessageSchema.safeParse(draw('first', { ...pen, points: Array(101).fill([0, 0]) })).success, false);
});
