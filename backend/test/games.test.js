// games.test.js — REST API tests (run with: npm test)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { createGame } from '../src/services/gameService.js';

let server;
let base;

before(async () => {
  server = app.listen(0); // random free port
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://localhost:${server.address().port}`;
});

after(() => server.close());

const get = async (path) => {
  const res = await fetch(base + path);
  return { status: res.status, body: await res.json() };
};

test('GET /health', async () => {
  const { status, body } = await get('/health');
  assert.equal(status, 200);
  assert.equal(body.status, 'ok');
});

test('GET /api/games lists games waiting for an opponent', async () => {
  const game = createGame({ id: 'u1', username: 'alice' });
  const { status, body } = await get('/api/games');
  assert.equal(status, 200);
  assert.ok(body.games.some((g) => g.id === game.id));
});

test('GET /api/games/:id returns the game', async () => {
  const game = createGame({ id: 'u1', username: 'alice' });
  const { status, body } = await get(`/api/games/${game.id}`);
  assert.equal(status, 200);
  assert.equal(body.white.username, 'alice');
  assert.equal(body.status, 'waiting');
});

test('unknown game returns 404', async () => {
  const { status, body } = await get('/api/games/does-not-exist');
  assert.equal(status, 404);
  assert.equal(body.error, 'Game not found');
});

test('unknown route returns 404', async () => {
  const { status } = await get('/nope');
  assert.equal(status, 404);
});
