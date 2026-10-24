// gameService.js — all chess.js logic lives here
import { randomUUID } from 'crypto';
import { Chess } from 'chess.js';
import { saveGame, findGame } from './gameStore.js';
import { HttpError } from '../utils/httpError.js';

// turn a stored game into the JSON the client sees
const toState = ({ id, chess, createdAt }) => ({
  id,
  fen: chess.fen(),
  turn: chess.turn(),             // 'w' or 'b'
  isCheck: chess.isCheck(),
  isCheckmate: chess.isCheckmate(),
  isStalemate: chess.isStalemate(),
  isDraw: chess.isDraw(),
  isGameOver: chess.isGameOver(),
  history: chess.history(),       // SAN moves, e.g. ['e4', 'e5']
  pgn: chess.pgn(),
  createdAt,
});

const getOrThrow = (id) => {
  const game = findGame(id);
  if (!game) throw new HttpError(404, 'Game not found');
  return game;
};

// new game from the standard starting position
export const createGame = () => {
  const game = { id: randomUUID(), chess: new Chess(), createdAt: new Date().toISOString() };
  saveGame(game);
  return toState(game);
};

export const getGame = (id) => toState(getOrThrow(id));

// validate + apply a move on the server-held board
// move = { from, to, promotion? }
export const applyMove = (id, { from, to, promotion }) => {
  const game = getOrThrow(id);

  if (game.chess.isGameOver()) {
    throw new HttpError(400, 'Game is already over');
  }

  let result;
  try {
    result = game.chess.move({ from, to, promotion }); // chess.js throws on illegal moves
  } catch {
    throw new HttpError(400, `Illegal move: ${from} to ${to}`);
  }

  return { ...toState(game), lastMove: result };
};
