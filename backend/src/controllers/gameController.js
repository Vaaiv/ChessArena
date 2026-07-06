// gameController.js — HTTP req/res, delegates to service
import { applyMove, startingFen } from '../services/gameService.js';

// GET /api/games/start
export const getStartingPosition = (req, res) => {
  res.json({ fen: startingFen() });
};

// POST /api/games/move
// body: { fen: "...", move: { from: "e2", to: "e4" } }
export const makeMove = (req, res) => {
  const { fen, move } = req.body;

  if (!fen || !move) {
    return res.status(400).json({ error: 'fen and move are required' });
  }

  try {
    const state = applyMove(fen, move);
    res.json(state);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};