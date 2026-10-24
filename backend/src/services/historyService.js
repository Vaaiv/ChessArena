// historyService.js — saves finished games to PostgreSQL and reads them back
import prisma from '../config/db.js';
import { HttpError } from '../utils/httpError.js';

const players = {
  white: { select: { id: true, username: true } },
  black: { select: { id: true, username: true } },
};

// game = finished game state from gameService
export const saveFinishedGame = (game) =>
  prisma.game.create({
    data: {
      id: game.id,
      whiteId: game.white.id,
      blackId: game.black.id,
      result: game.result,
      reason: game.reason,
      moves: game.history,
      pgn: game.pgn,
      startedAt: game.startedAt,
    },
  });

// the user's games, newest first (without the move list, to keep it small)
export const listUserGames = async (userId, limit = 50) => {
  const games = await prisma.game.findMany({
    where: { OR: [{ whiteId: userId }, { blackId: userId }] },
    orderBy: { endedAt: 'desc' },
    take: limit,
    select: { id: true, result: true, reason: true, startedAt: true, endedAt: true, moves: true, ...players },
  });
  return games.map(({ moves, ...game }) => ({ ...game, moveCount: moves.length }));
};

// one game with every move, for replay
export const getReplay = async (id) => {
  const game = await prisma.game.findUnique({ where: { id }, include: players });
  if (!game) throw new HttpError(404, 'Game not found in history');

  const { whiteId, blackId, ...replay } = game;
  return replay;
};
