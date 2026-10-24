// gameController.js — HTTP req/res, delegates to service
import { createGame, getGame, applyMove } from '../services/gameService.js';
import { HttpError } from '../utils/httpError.js';

const SQUARE = /^[a-h][1-8]$/;
const PROMOTIONS = ['q', 'r', 'b', 'n'];

// POST /api/games
export const create = (req, res) => {
  res.status(201).json(createGame());
};

// GET /api/games/:id
export const show = (req, res) => {
  res.json(getGame(req.params.id));
};

// POST /api/games/:id/move
// body: { from: "e2", to: "e4", promotion?: "q" }
export const makeMove = (req, res) => {
  const { from, to, promotion } = req.body ?? {};

  if (!SQUARE.test(from) || !SQUARE.test(to)) {
    throw new HttpError(400, 'from and to must be squares like "e2"');
  }
  if (promotion !== undefined && !PROMOTIONS.includes(promotion)) {
    throw new HttpError(400, 'promotion must be one of q, r, b, n');
  }

  res.json(applyMove(req.params.id, { from, to, promotion }));
};
