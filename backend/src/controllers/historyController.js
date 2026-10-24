// historyController.js — HTTP req/res for finished games
import { listUserGames, getReplay } from '../services/historyService.js';

// GET /api/history — logged-in user's past games
export const myGames = async (req, res) => {
  res.json({ games: await listUserGames(req.userId) });
};

// GET /api/history/:id — one game with all moves, for replay
export const replay = async (req, res) => {
  res.json(await getReplay(req.params.id));
};
