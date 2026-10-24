// gameService.js — chess.js logic + game rules (players, turns, results)
import { randomUUID } from 'crypto';
import { Chess } from 'chess.js';
import { saveGame, findGame, listGames } from './gameStore.js';
import { HttpError } from '../utils/httpError.js';

const SQUARE = /^[a-h][1-8]$/;
const PROMOTIONS = ['q', 'r', 'b', 'n'];

// turn a stored game into the JSON clients see
const toState = (game) => ({
  id: game.id,
  status: game.status,            // 'waiting' | 'active' | 'finished'
  white: game.white,              // { id, username }
  black: game.black,              // { id, username } | null until someone joins
  result: game.result,            // '1-0' | '0-1' | '1/2-1/2' | null
  reason: game.reason,            // 'checkmate' | 'resignation' | 'agreement' | ...
  drawOfferBy: game.drawOfferBy,  // 'w' | 'b' | null
  fen: game.chess.fen(),
  turn: game.chess.turn(),        // 'w' or 'b'
  isCheck: game.chess.isCheck(),
  history: game.chess.history(),  // SAN moves, e.g. ['e4', 'e5']
  pgn: game.chess.pgn(),
  createdAt: game.createdAt,
});

const getOrThrow = (id) => {
  const game = findGame(id);
  if (!game) throw new HttpError(404, 'Game not found');
  return game;
};

// 'w', 'b', or null if the user is not playing this game
const colorOf = (game, userId) => {
  if (game.white?.id === userId) return 'w';
  if (game.black?.id === userId) return 'b';
  return null;
};

const opponent = (color) => (color === 'w' ? 'b' : 'w');

const requirePlayer = (game, userId) => {
  const color = colorOf(game, userId);
  if (!color) throw new HttpError(403, 'You are not a player in this game');
  return color;
};

const requireActive = (game) => {
  if (game.status === 'waiting') throw new HttpError(400, 'Waiting for an opponent');
  if (game.status === 'finished') throw new HttpError(400, 'Game is already over');
};

const finish = (game, result, reason) => {
  game.status = 'finished';
  game.result = result;
  game.reason = reason;
  game.drawOfferBy = null;
};

// after a move, end the game if the board says so
const checkBoardResult = (game) => {
  const { chess } = game;
  if (chess.isCheckmate()) return finish(game, chess.turn() === 'w' ? '0-1' : '1-0', 'checkmate');
  if (chess.isStalemate()) return finish(game, '1/2-1/2', 'stalemate');
  if (chess.isInsufficientMaterial()) return finish(game, '1/2-1/2', 'insufficient material');
  if (chess.isThreefoldRepetition()) return finish(game, '1/2-1/2', 'threefold repetition');
  if (chess.isDrawByFiftyMoves()) return finish(game, '1/2-1/2', 'fifty-move rule');
};

// user = { id, username }; the creator plays white
export const createGame = (user) => {
  const game = {
    id: randomUUID(),
    chess: new Chess(),
    white: user,
    black: null,
    status: 'waiting',
    result: null,
    reason: null,
    drawOfferBy: null,
    createdAt: new Date().toISOString(),
  };
  saveGame(game);
  return toState(game);
};

// first other user becomes black; players rejoining keep their color; everyone else spectates
export const joinGame = (id, user) => {
  const game = getOrThrow(id);
  let color = colorOf(game, user.id);

  if (!color && game.status === 'waiting') {
    game.black = user;
    game.status = 'active';
    color = 'b';
  }

  return { game: toState(game), color }; // color null = spectator
};

export const getGame = (id) => toState(getOrThrow(id));

// games waiting for an opponent (the lobby)
export const listOpenGames = () =>
  listGames().filter((game) => game.status === 'waiting').map(toState);

// move = { from, to, promotion? }
export const applyMove = (id, userId, { from, to, promotion }) => {
  if (!SQUARE.test(from) || !SQUARE.test(to)) {
    throw new HttpError(400, 'from and to must be squares like "e2"');
  }
  if (promotion !== undefined && !PROMOTIONS.includes(promotion)) {
    throw new HttpError(400, 'promotion must be one of q, r, b, n');
  }

  const game = getOrThrow(id);
  const color = requirePlayer(game, userId);
  requireActive(game);
  if (game.chess.turn() !== color) throw new HttpError(400, 'Not your turn');

  let move;
  try {
    move = game.chess.move({ from, to, promotion }); // chess.js throws on illegal moves
  } catch {
    throw new HttpError(400, `Illegal move: ${from} to ${to}`);
  }

  game.drawOfferBy = null; // moving declines any pending draw offer
  checkBoardResult(game);

  return { game: toState(game), move };
};

export const resign = (id, userId) => {
  const game = getOrThrow(id);
  const color = requirePlayer(game, userId);
  requireActive(game);

  finish(game, color === 'w' ? '0-1' : '1-0', 'resignation');
  return { game: toState(game) };
};

export const offerDraw = (id, userId) => {
  const game = getOrThrow(id);
  const color = requirePlayer(game, userId);
  requireActive(game);

  game.drawOfferBy = color;
  return { game: toState(game) };
};

// accept = true to accept, false to decline the opponent's offer
export const answerDraw = (id, userId, accept) => {
  const game = getOrThrow(id);
  const color = requirePlayer(game, userId);
  requireActive(game);
  if (game.drawOfferBy !== opponent(color)) throw new HttpError(400, 'No draw offer to answer');

  if (accept) finish(game, '1/2-1/2', 'agreement');
  else game.drawOfferBy = null;
  return { game: toState(game) };
};
