// games.test.js — API tests (run with: npm test)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

let server;
let base;

before(async () => {
  server = app.listen(0); // random free port
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://localhost:${server.address().port}`;
});

after(() => server.close());

const api = async (method, path, body) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

const newGame = async () => (await api('POST', '/api/games')).body;

const play = async (id, moves) => {
  let res;
  for (const [from, to] of moves) {
    res = await api('POST', `/api/games/${id}/move`, { from, to });
    assert.equal(res.status, 200, `${from}-${to} failed: ${res.body.error}`);
  }
  return res;
};

test('GET /health', async () => {
  const { status, body } = await api('GET', '/health');
  assert.equal(status, 200);
  assert.equal(body.status, 'ok');
});

test('create a game at the starting position', async () => {
  const { status, body } = await api('POST', '/api/games');
  assert.equal(status, 201);
  assert.ok(body.id);
  assert.equal(body.fen, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  assert.equal(body.turn, 'w');
  assert.deepEqual(body.history, []);
});

test('fetch a game by id', async () => {
  const game = await newGame();
  const { status, body } = await api('GET', `/api/games/${game.id}`);
  assert.equal(status, 200);
  assert.equal(body.id, game.id);
});

test('unknown game returns 404', async () => {
  const { status, body } = await api('GET', '/api/games/does-not-exist');
  assert.equal(status, 404);
  assert.equal(body.error, 'Game not found');
});

test('legal move updates the server-held board', async () => {
  const game = await newGame();
  const { body } = await play(game.id, [['e2', 'e4']]);
  assert.equal(body.turn, 'b');
  assert.deepEqual(body.history, ['e4']);
  assert.equal(body.lastMove.san, 'e4');

  const fetched = await api('GET', `/api/games/${game.id}`);
  assert.equal(fetched.body.fen, body.fen);
});

test('illegal move returns 400 and leaves board unchanged', async () => {
  const game = await newGame();
  const { status, body } = await api('POST', `/api/games/${game.id}/move`, { from: 'e2', to: 'e5' });
  assert.equal(status, 400);
  assert.equal(body.error, 'Illegal move: e2 to e5');

  const fetched = await api('GET', `/api/games/${game.id}`);
  assert.equal(fetched.body.fen, game.fen);
});

test('moving out of turn is rejected', async () => {
  const game = await newGame();
  const { status } = await api('POST', `/api/games/${game.id}/move`, { from: 'e7', to: 'e5' });
  assert.equal(status, 400);
});

test('bad move input returns 400', async () => {
  const game = await newGame();
  const cases = [{}, { from: 'z9', to: 'e4' }, { from: 'e2', to: 'e4', promotion: 'k' }];
  for (const move of cases) {
    const { status } = await api('POST', `/api/games/${game.id}/move`, move);
    assert.equal(status, 400, JSON.stringify(move));
  }
});

test("fool's mate ends the game and blocks further moves", async () => {
  const game = await newGame();
  const { body } = await play(game.id, [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']]);
  assert.equal(body.isCheckmate, true);
  assert.equal(body.isGameOver, true);

  const after = await api('POST', `/api/games/${game.id}/move`, { from: 'a2', to: 'a3' });
  assert.equal(after.status, 400);
  assert.equal(after.body.error, 'Game is already over');
});

test('pawn promotion', async () => {
  const game = await newGame();
  await play(game.id, [['h2', 'h4'], ['g7', 'g5'], ['h4', 'g5'], ['h7', 'h6'], ['g5', 'h6'], ['a7', 'a6'], ['h6', 'h7'], ['a6', 'a5']]);
  const { status, body } = await api('POST', `/api/games/${game.id}/move`, { from: 'h7', to: 'g8', promotion: 'q' });
  assert.equal(status, 200);
  assert.equal(body.lastMove.promotion, 'q');
});

test('unknown route returns 404', async () => {
  const { status } = await api('GET', '/nope');
  assert.equal(status, 404);
});
