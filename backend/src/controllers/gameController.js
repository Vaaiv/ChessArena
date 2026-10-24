// gameController.js — HTTP req/res for reading games (playing happens over Socket.io)
import { getGame, listOpenGames } from '../services/gameService.js';

// GET /api/games — games waiting for an opponent
export const list = (req, res) => {
  res.json({ games: listOpenGames() });
};

// GET /api/games/:id
export const show = (req, res) => {
  res.json(getGame(req.params.id));
};
