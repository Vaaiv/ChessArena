// loadTest.js — plays many games at once and measures move sync latency
// usage: npm run loadtest -- --games 25 --plies 60 --think 100 --url http://localhost:3000
// latency = time from a player sending a move until the opponent receives it
import { parseArgs } from 'node:util';
import { performance } from 'node:perf_hooks';
import { io as connect } from 'socket.io-client';
import { Chess } from 'chess.js';
import prisma from '../src/config/db.js';

const { values: opts } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://localhost:3000' },
    games: { type: 'string', default: '25' },  // games played at the same time
    plies: { type: 'string', default: '60' },  // max half-moves per game, then white resigns
    think: { type: 'string', default: '100' }, // average ms a player waits before moving (±50%)
  },
});
const GAMES = Number(opts.games);
const PLIES = Number(opts.plies);
const THINK_MS = Number(opts.think);
const PASSWORD = 'loadtest123';

const latencies = [];
const errors = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const post = async (path, body) => {
  const res = await fetch(opts.url + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

// log in as loadtest_<n>, signing up first if needed; returns a connected socket
const createPlayer = async (n) => {
  const account = { username: `loadtest_${n}`, email: `loadtest_${n}@example.com`, password: PASSWORD };
  let res = await post('/api/auth/login', account);
  if (res.status === 401) res = await post('/api/auth/signup', account);
  if (!res.body.token) throw new Error(`could not log in loadtest_${n}: ${res.body.error}`);

  const socket = connect(opts.url, { auth: { token: res.body.token }, transports: ['websocket'], forceNew: true });
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  return socket;
};

// resolves with the time the socket sees the game reach `plyCount` moves
const seeMove = (socket, gameId, plyCount) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('game:update', listener);
      reject(new Error('move never arrived (5s timeout)'));
    }, 5000);
    const listener = ({ game }) => {
      if (game.id !== gameId || game.history.length !== plyCount) return;
      clearTimeout(timer);
      socket.off('game:update', listener);
      resolve(performance.now());
    };
    socket.on('game:update', listener);
  });

// random legal game, worked out before the clock starts so the load
// generator does no chess work while measuring
const randomGame = () => {
  const chess = new Chess();
  const moves = [];
  while (moves.length < PLIES && !chess.isGameOver()) {
    const legal = chess.moves({ verbose: true });
    const { from, to, promotion } = legal[Math.floor(Math.random() * legal.length)];
    chess.move({ from, to, promotion });
    moves.push({ from, to, promotion });
  }
  return moves;
};

// real players don't move in lockstep: think time varies ±50%
const thinkTime = () => THINK_MS * (0.5 + Math.random());

const playGame = async (white, black, moves) => {
  const { game } = await white.emitWithAck('game:create');
  await black.emitWithAck('game:join', { gameId: game.id });

  let status = 'active';
  for (const [i, move] of moves.entries()) {
    await sleep(thinkTime());
    const [mover, opponent] = i % 2 === 0 ? [white, black] : [black, white];

    const seen = seeMove(opponent, game.id, i + 1);
    const sentAt = performance.now();
    const ack = await mover.emitWithAck('game:move', { gameId: game.id, ...move });
    if (!ack.ok) throw new Error(`move rejected: ${ack.error}`);

    latencies.push((await seen) - sentAt);
    status = ack.game.status;
  }

  if (status !== 'finished') await white.emitWithAck('game:resign', { gameId: game.id });
};

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

const main = async () => {
  console.log(`Logging in ${GAMES * 2} players at ${opts.url} ...`);
  const sockets = [];
  for (let i = 0; i < GAMES * 2; i += 10) { // batches of 10 to go easy on signup
    const batch = Array.from({ length: Math.min(10, GAMES * 2 - i) }, (_, k) => createPlayer(i + k + 1));
    sockets.push(...(await Promise.all(batch)));
  }

  const scripts = Array.from({ length: GAMES }, randomGame);

  console.log(`Playing ${GAMES} games at the same time (up to ${PLIES} half-moves each, ~${THINK_MS}ms think time) ...`);
  const startedAt = performance.now();
  const results = await Promise.allSettled(
    scripts.map((moves, g) => playGame(sockets[g * 2], sockets[g * 2 + 1], moves)),
  );
  const seconds = (performance.now() - startedAt) / 1000;
  results.filter((r) => r.status === 'rejected').forEach((r) => errors.push(r.reason.message));

  sockets.forEach((s) => s.disconnect());

  const sorted = [...latencies].sort((a, b) => a - b);
  const avg = sorted.reduce((sum, ms) => sum + ms, 0) / sorted.length;
  const fmt = (ms) => `${ms.toFixed(2)} ms`;

  console.log('\n===== Load test results =====');
  console.log(`Concurrent games : ${GAMES} (${GAMES * 2} connected players)`);
  console.log(`Games completed  : ${GAMES - errors.length} / ${GAMES}`);
  console.log(`Moves synced     : ${sorted.length} in ${seconds.toFixed(1)}s (${(sorted.length / seconds).toFixed(1)} moves/s)`);
  console.log(`Latency avg      : ${fmt(avg)}`);
  console.log(`Latency p50      : ${fmt(percentile(sorted, 50))}`);
  console.log(`Latency p95      : ${fmt(percentile(sorted, 95))}`);
  console.log(`Latency p99      : ${fmt(percentile(sorted, 99))}`);
  console.log(`Latency max      : ${fmt(sorted[sorted.length - 1])}`);
  if (errors.length) console.log(`Errors           : ${errors.length}\n  ${[...new Set(errors)].join('\n  ')}`);

  // remove load test users (their saved games go with them)
  const { count } = await prisma.user.deleteMany({ where: { username: { startsWith: 'loadtest_' } } });
  console.log(`\nCleaned up ${count} load test users.`);
  await prisma.$disconnect();
  process.exit(errors.length ? 1 : 0);
};

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
