// gameService.js — all chess.js logic lives here
import { Chess } from 'chess.js';

// validate + apply a move on a given board position
// fen = current board state, move = { from, to, promotion? }
export const applyMove = (fen, move) => {
  const chess = new Chess(fen);   // load board from FEN string

  const result = chess.move(move); // chess.js validates + applies

  if (!result) {
    throw new Error('Illegal move');
  }

  return {
    fen: chess.fen(),
    turn: chess.turn(),             // 'w' or 'b'
    isCheck: chess.isCheck(),
    isCheckmate: chess.isCheckmate(),
    isStalemate: chess.isStalemate(),
    isDraw: chess.isDraw(),
    isGameOver: chess.isGameOver(),
    lastMove: result,
  };
};

// standard starting position
export const startingFen = () => new Chess().fen();