// gameService.test.js — game rules, no network or DB needed
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as games from '../src/services/gameService.js';

const alice = { id: 'u-alice', username: 'alice' };
const bob = { id: 'u-bob', username: 'bob' };
const carol = { id: 'u-carol', username: 'carol' };

// new game with alice (white) vs bob (black)
const newActiveGame = () => {
  const { id } = games.createGame(alice);
  games.joinGame(id, bob);
  return id;
};

const play = (id, moves) => {
  let result;
  for (const [player, from, to, promotion] of moves) {
    result = games.applyMove(id, player.id, { from, to, promotion });
  }
  return result;
};

test('creator is white and the game waits for an opponent', () => {
  const game = games.createGame(alice);
  assert.equal(game.status, 'waiting');
  assert.deepEqual(game.white, alice);
  assert.equal(game.black, null);
});

test('second user becomes black, later users spectate, players rejoin with their color', () => {
  const { id } = games.createGame(alice);

  const bobJoin = games.joinGame(id, bob);
  assert.equal(bobJoin.color, 'b');
  assert.equal(bobJoin.game.status, 'active');

  assert.equal(games.joinGame(id, carol).color, null);
  assert.equal(games.joinGame(id, alice).color, 'w');
  assert.equal(games.joinGame(id, bob).color, 'b');
});

test('waiting games show in the lobby until someone joins', () => {
  const { id } = games.createGame(alice);
  assert.ok(games.listOpenGames().some((g) => g.id === id));

  games.joinGame(id, bob);
  assert.ok(!games.listOpenGames().some((g) => g.id === id));
});

test('cannot move before an opponent joins', () => {
  const { id } = games.createGame(alice);
  assert.throws(() => games.applyMove(id, alice.id, { from: 'e2', to: 'e4' }), /Waiting for an opponent/);
});

test('players can only move on their own turn, spectators never', () => {
  const id = newActiveGame();
  assert.throws(() => games.applyMove(id, bob.id, { from: 'e7', to: 'e5' }), /Not your turn/);
  assert.throws(() => games.applyMove(id, carol.id, { from: 'e2', to: 'e4' }), /not a player/);

  const { game, move } = games.applyMove(id, alice.id, { from: 'e2', to: 'e4' });
  assert.equal(move.san, 'e4');
  assert.equal(game.turn, 'b');
});

test('illegal and malformed moves are rejected', () => {
  const id = newActiveGame();
  assert.throws(() => games.applyMove(id, alice.id, { from: 'e2', to: 'e5' }), /Illegal move/);
  assert.throws(() => games.applyMove(id, alice.id, { from: 'z9', to: 'e4' }), /squares/);
  assert.throws(() => games.applyMove(id, alice.id, { from: 'e2', to: 'e4', promotion: 'k' }), /promotion/);
});

test("fool's mate: black wins by checkmate and the game is over", () => {
  const id = newActiveGame();
  const { game } = play(id, [
    [alice, 'f2', 'f3'], [bob, 'e7', 'e5'], [alice, 'g2', 'g4'], [bob, 'd8', 'h4'],
  ]);
  assert.equal(game.status, 'finished');
  assert.equal(game.result, '0-1');
  assert.equal(game.reason, 'checkmate');
  assert.throws(() => games.applyMove(id, alice.id, { from: 'a2', to: 'a3' }), /already over/);
});

test('pawn promotion', () => {
  const id = newActiveGame();
  const { move } = play(id, [
    [alice, 'h2', 'h4'], [bob, 'g7', 'g5'], [alice, 'h4', 'g5'], [bob, 'h7', 'h6'],
    [alice, 'g5', 'h6'], [bob, 'a7', 'a6'], [alice, 'h6', 'h7'], [bob, 'a6', 'a5'],
    [alice, 'h7', 'g8', 'q'],
  ]);
  assert.equal(move.promotion, 'q');
});

test('resigning gives the win to the opponent', () => {
  const id = newActiveGame();
  const { game } = games.resign(id, alice.id);
  assert.equal(game.result, '0-1');
  assert.equal(game.reason, 'resignation');
});

test('draw offers: decline, accept, and moving cancels an offer', () => {
  const id = newActiveGame();

  assert.throws(() => games.answerDraw(id, bob.id, true), /No draw offer/);

  games.offerDraw(id, alice.id);
  assert.throws(() => games.answerDraw(id, alice.id, true), /No draw offer/); // can't accept your own
  assert.equal(games.answerDraw(id, bob.id, false).game.drawOfferBy, null);

  games.offerDraw(id, alice.id);
  assert.equal(games.applyMove(id, alice.id, { from: 'e2', to: 'e4' }).game.drawOfferBy, null);

  games.offerDraw(id, bob.id);
  const { game } = games.answerDraw(id, alice.id, true);
  assert.equal(game.result, '1/2-1/2');
  assert.equal(game.reason, 'agreement');
});

test('finished games are deleted after the grace period', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const id = newActiveGame();
  games.resign(id, alice.id);

  t.mock.timers.tick(games.FINISHED_GAME_TTL_MS - 1);
  assert.equal(games.getGame(id).status, 'finished');

  t.mock.timers.tick(1);
  assert.throws(() => games.getGame(id), (err) => err.status === 404);
});

test('unknown game id throws 404', () => {
  assert.throws(() => games.getGame('nope'), (err) => err.status === 404);
});
