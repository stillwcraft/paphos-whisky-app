import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const server = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)),
  server: { middlewareMode: true },
  appType: 'custom',
});
after(() => server.close());
const { MINI_APP_URL, parseMiniAppStartParam, parseMiniAppLink } = await server.ssrLoadModule('/src/miniAppDeepLinks.ts');

test('own-app links reuse every supported launch destination', () => {
  for (const id of [40, 39, 33]) {
    assert.deepEqual(parseMiniAppLink(`${MINI_APP_URL}?startapp=bottle_${id}`), {
      internal: true, destination: { kind: 'entity', entity: 'bottle', id },
    });
  }
  for (const entity of ['event', 'bottle', 'distillery', 'social_event']) {
    assert.deepEqual(parseMiniAppStartParam(`${entity}_42`), { kind: 'entity', entity, id: 42 });
  }
  for (const tab of ['events', 'articles', 'map', 'cyprus-map', 'distilleries', 'bottles', 'profile', 'presentations']) {
    assert.deepEqual(parseMiniAppStartParam(tab), { kind: 'tab', tab });
  }
  const roomId = 'a'.repeat(32);
  assert.deepEqual(parseMiniAppStartParam(`presentation_${roomId}`), { kind: 'presentation', roomId });
});

test('recognizes own main-app links, encoded parameters, and app home', () => {
  for (const link of [
    'https://t.me/CyprusWhiskyClubBot?startapp=bottle_40',
    `${MINI_APP_URL}/?startapp=bottle_40`,
    `${MINI_APP_URL}?startapp=bottle%5F40`,
    'https://t.me/cypruswhiskyclubbot/NoMoreDram?startapp=bottle_40',
  ]) {
    assert.deepEqual(parseMiniAppLink(link), {
      internal: true, destination: { kind: 'entity', entity: 'bottle', id: 40 },
    });
  }
  assert.deepEqual(parseMiniAppLink(MINI_APP_URL), { internal: true, destination: { kind: 'tab', tab: 'events' } });
});

test('unsupported and unsafe own-app parameters stay internal but cannot navigate', () => {
  for (const parameter of [
    'bottle_0', 'bottle_-1', 'bottle_1.2', 'bottle_9007199254740992',
    'bottle_40_extra', 'unknown', 'admin', 'presentation_short',
  ]) {
    assert.equal(parseMiniAppStartParam(parameter), null);
    assert.deepEqual(parseMiniAppLink(`${MINI_APP_URL}?startapp=${parameter}`), {
      internal: true, destination: null,
    });
  }
  assert.deepEqual(parseMiniAppLink(`${MINI_APP_URL}?startapp=bottle_40&startapp=bottle_39`), {
    internal: true, destination: null,
  });
});

test('other Telegram links and lookalike app URLs are not internalized', () => {
  for (const link of [
    'https://t.me/OtherBot/NoMoreDram?startapp=bottle_40',
    'https://t.me/CyprusWhiskyClubBot/AnotherApp?startapp=bottle_40',
    'https://t.me/CyprusWhiskyClubBot',
    `${MINI_APP_URL}/extra?startapp=bottle_40`,
    'https://t.me.evil.example/CyprusWhiskyClubBot/NoMoreDram?startapp=bottle_40',
    'https://t.me:444/CyprusWhiskyClubBot/NoMoreDram?startapp=bottle_40',
    'https://user@t.me/CyprusWhiskyClubBot/NoMoreDram?startapp=bottle_40',
    'http://t.me/CyprusWhiskyClubBot/NoMoreDram?startapp=bottle_40',
  ]) {
    assert.deepEqual(parseMiniAppLink(link), { internal: false, destination: null });
  }
});
