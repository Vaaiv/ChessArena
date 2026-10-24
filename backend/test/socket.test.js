// socket.test.js — real-time play between real users (test users are deleted after)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { io as connect } from 'socket.io-client';
import app from '../src/app.js';
import prisma from '../src/config/db.js';
import { setupSockets } from '../src/sockets/gameSocket.js';
import { signup } from '../src/services/authService.js';

let server;
let io;
let base;
const tag = `sock_${Date.now().toString(36)}`;
const sockets = {}; // alice + bob play, carol spectates
const tokens = {};

const open = (token) => connect(base, { auth: { token }, transports: ['websocket'], forceNew: true });

// resolves with the next event that matches
const next = (socket, event, match = () => true) =>
  new Promise((resolve) => {
    const listener = (data) => {
      if (!match(data)) return;
      socket.off(event, listener);
      resolve(data);
    };
    socket.on(event, listener);
  });

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  io = setupSockets(server);
  base = `http://localhost:${server.address().port}`;

  for (const name of ['alice', 'bob', 'carol']) {
    const { token } = await signup({ username: `${tag}_${name}`, email: `${tag}_${name}@example.com`, password: 'secret123' });
    tokens[name] = token;
    sockets[name] = open(token);
    await next(sockets[name], 'connect');
  }
});

after(async () => {
  Object.values(sockets).forEach((s) => s.disconnect());
  io.close();
  await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
  await prisma.$disconnect();
});

// alice creates, bob joins → active game id
const startGame = async () => {
  const created = await sockets.alice.emitWithAck('game:create');
  await sockets.bob.emitWithAck('game:join', { gameId: created.game.id });
  return created.game.id;
};

test('connecting without a valid token is refused', async () => {
  const socket = open('bad.token');
  const err = await next(socket, 'connect_error');
  assert.equal(err.message, 'Invalid or expired token');
  socket.close();
});

test('create → join: creator is white, joiner is black, creator is told', async () => {
  const created = await sockets.alice.emitWithAck('game:create');
  assert.equal(created.ok, true);
  assert.equal(created.color, 'w');
  assert.equal(created.game.status, 'waiting');

  const aliceSeesJoin = next(sockets.alice, 'game:update', (d) => d.game.id === created.game.id);
  const joined = await sockets.bob.emitWithAck('game:join', { gameId: created.game.id });
  assert.equal(joined.color, 'b');

  const update = await aliceSeesJoin;
  assert.equal(update.game.status, 'active');
  assert.equal(update.game.black.username, `${tag}_bob`);
});

test('third user joins as spectator and receives moves live', async () => {
  const gameId = await startGame();
  const spectate = await sockets.carol.emitWithAck('game:join', { gameId });
  assert.equal(spectate.color, null);

  const carolSees = next(sockets.carol, 'game:update', (d) => d.game.id === gameId && d.lastMove);
  const bobSees = next(sockets.bob, 'game:update', (d) => d.game.id === gameId && d.lastMove);
  const moved = await sockets.alice.emitWithAck('game:move', { gameId, from: 'e2', to: 'e4' });
  assert.equal(moved.ok, true);

  assert.equal((await carolSees).lastMove.san, 'e4');
  assert.equal((await bobSees).game.turn, 'b');

  const spectatorMove = await sockets.carol.emitWithAck('game:move', { gameId, from: 'e7', to: 'e5' });
  assert.deepEqual(spectatorMove, { ok: false, error: 'You are not a player in this game' });
});

test('wrong turn and illegal moves come back as errors', async () => {
  const gameId = await startGame();
  assert.deepEqual(
    await sockets.bob.emitWithAck('game:move', { gameId, from: 'e7', to: 'e5' }),
    { ok: false, error: 'Not your turn' },
  );
  assert.deepEqual(
    await sockets.alice.emitWithAck('game:move', { gameId, from: 'e2', to: 'e5' }),
    { ok: false, error: 'Illegal move: e2 to e5' },
  );
});

test("fool's mate over sockets ends the game for both players", async () => {
  const gameId = await startGame();
  const aliceSeesEnd = next(sockets.alice, 'game:update', (d) => d.game.id === gameId && d.game.status === 'finished');

  for (const [player, from, to] of [['alice', 'f2', 'f3'], ['bob', 'e7', 'e5'], ['alice', 'g2', 'g4'], ['bob', 'd8', 'h4']]) {
    const res = await sockets[player].emitWithAck('game:move', { gameId, from, to });
    assert.equal(res.ok, true, res.error);
  }

  const { game } = await aliceSeesEnd;
  assert.equal(game.result, '0-1');
  assert.equal(game.reason, 'checkmate');
});

test('resign and draw agreement', async () => {
  const resignId = await startGame();
  const resigned = await sockets.bob.emitWithAck('game:resign', { gameId: resignId });
  assert.equal(resigned.game.result, '1-0');

  const drawId = await startGame();
  const bobSeesOffer = next(sockets.bob, 'game:update', (d) => d.game.id === drawId && d.game.drawOfferBy === 'w');
  await sockets.alice.emitWithAck('game:offerDraw', { gameId: drawId });
  await bobSeesOffer;
  const drawn = await sockets.bob.emitWithAck('game:answerDraw', { gameId: drawId, accept: true });
  assert.equal(drawn.game.result, '1/2-1/2');
});

const getJson = async (path, token) => {
  const res = await fetch(base + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { status: res.status, body: await res.json() };
};

// history is saved in the background, so poll briefly until it shows up
const waitForHistory = async (token, gameId) => {
  for (let i = 0; i < 50; i++) {
    const { body } = await getJson('/api/history', token);
    const game = body.games?.find((g) => g.id === gameId);
    if (game) return game;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('game never appeared in history');
};

test('finished games are saved to history and can be replayed', async () => {
  const gameId = await startGame();
  for (const [player, from, to] of [['alice', 'f2', 'f3'], ['bob', 'e7', 'e5'], ['alice', 'g2', 'g4'], ['bob', 'd8', 'h4']]) {
    await sockets[player].emitWithAck('game:move', { gameId, from, to });
  }

  const summary = await waitForHistory(tokens.alice, gameId);
  assert.equal(summary.result, '0-1');
  assert.equal(summary.reason, 'checkmate');
  assert.equal(summary.moveCount, 4);
  assert.equal(summary.white.username, `${tag}_alice`);

  // it's in bob's history too, but not carol's
  assert.ok(await waitForHistory(tokens.bob, gameId));
  const carols = await getJson('/api/history', tokens.carol);
  assert.ok(!carols.body.games.some((g) => g.id === gameId));

  const { status, body: replay } = await getJson(`/api/history/${gameId}`, tokens.carol);
  assert.equal(status, 200);
  assert.deepEqual(replay.moves, ['f3', 'e5', 'g4', 'Qh4#']);
  assert.equal(replay.black.username, `${tag}_bob`);
  assert.equal(replay.whiteId, undefined);
});

test('history needs login and unknown replays return 404', async () => {
  assert.equal((await getJson('/api/history')).status, 401);
  assert.equal((await getJson('/api/history/nope', tokens.alice)).status, 404);
});

test('opponent is told when a player disconnects', async () => {
  const created = await sockets.alice.emitWithAck('game:create');
  const { token } = await signup({ username: `${tag}_dave`, email: `${tag}_dave@example.com`, password: 'secret123' });
  const dave = open(token);
  await next(dave, 'connect');
  await dave.emitWithAck('game:join', { gameId: created.game.id });

  const aliceSeesLeave = next(sockets.alice, 'player:left');
  dave.disconnect();
  assert.equal((await aliceSeesLeave).user.username, `${tag}_dave`);
});
