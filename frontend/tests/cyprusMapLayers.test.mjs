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
const {
  APARTMENT_LAYER_ENABLED, APARTMENTS_CYPRUS_MAP_LAYER, CYPRUS_MAP_LAYERS,
  DEFAULT_CYPRUS_MAP_LAYER, USER_MEETUPS_CYPRUS_MAP_LAYER, socialEventMapLayer,
} = await server.ssrLoadModule('/src/components/cyprusMapLayers.ts');

test('global events remain first and user meetups are the second selectable layer', () => {
  assert.equal(APARTMENT_LAYER_ENABLED, false);
  assert.deepEqual(CYPRUS_MAP_LAYERS.map(layer => layer.id), ['global-events', 'user-meetups']);
  assert.equal(CYPRUS_MAP_LAYERS[0], DEFAULT_CYPRUS_MAP_LAYER);
  assert.equal(DEFAULT_CYPRUS_MAP_LAYER.showGlobalRange, true);
  assert.equal(USER_MEETUPS_CYPRUS_MAP_LAYER.showGlobalRange, false);
  assert.equal(DEFAULT_CYPRUS_MAP_LAYER.includesCatalogEvent({ id: 1 }), true);
  assert.equal(USER_MEETUPS_CYPRUS_MAP_LAYER.includesCatalogEvent({ id: 1 }), false);
});

test('global and regular markers are separated without overlap', () => {
  const events = [
    { id: 1, event_type: 'global', map_layer: 'events' },
    { id: 2, event_type: 'regular', map_layer: 'events' },
    { id: 3, event_type: 'global' },
    { id: 4, event_type: 'regular' },
    { id: 5, event_type: 'global', map_layer: 'apartments' },
    { id: 6, event_type: 'regular', map_layer: 'apartments' },
  ];
  assert.deepEqual(events.filter(DEFAULT_CYPRUS_MAP_LAYER.includesSocialEvent).map(event => event.id), [1, 3]);
  assert.deepEqual(events.filter(USER_MEETUPS_CYPRUS_MAP_LAYER.includesSocialEvent).map(event => event.id), [2, 4]);
  assert.deepEqual(events.filter(APARTMENTS_CYPRUS_MAP_LAYER.includesSocialEvent).map(event => event.id), [5]);
  for (const event of events) {
    assert.equal(
      DEFAULT_CYPRUS_MAP_LAYER.includesSocialEvent(event)
        && USER_MEETUPS_CYPRUS_MAP_LAYER.includesSocialEvent(event),
      false,
    );
  }
});

test('links, updates, and creation drafts select the matching event layer', () => {
  for (const event of [
    { event_type: 'regular', map_layer: 'events' },
    { event_type: 'regular' },
  ]) {
    assert.equal(socialEventMapLayer(event), USER_MEETUPS_CYPRUS_MAP_LAYER);
  }
  for (const event of [
    { event_type: 'global', map_layer: 'events' },
    { event_type: 'global' },
  ]) {
    assert.equal(socialEventMapLayer(event), DEFAULT_CYPRUS_MAP_LAYER);
  }
  assert.equal(socialEventMapLayer({ event_type: 'global', map_layer: 'apartments' }), DEFAULT_CYPRUS_MAP_LAYER);
});
