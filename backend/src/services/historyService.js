// historyService.js — saves finished games (PostgreSQL + replay file on S3) and reads them back
import prisma from '../config/db.js';
import { s3Enabled, uploadReplay, downloadReplay } from './replayStore.js';
import { HttpError } from '../utils/httpError.js';

const players = {
  white: { select: { id: true, username: true } },
  black: { select: { id: true, username: true } },
};

// ['e4', 'e5', 'Nf3'] → '1. e4 e5 2. Nf3'
const toPgn = (moves) =>
  moves.map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${san}` : san)).join(' ');

// game = finished game state from gameService
export const saveFinishedGame = async (game) => {
  const { whiteId, blackId, ...replay } = await prisma.game.create({
    data: {
      id: game.id,
      whiteId: game.white.id,
      blackId: game.black.id,
      result: game.result,
      reason: game.reason,
      moves: game.history,
      pgn: toPgn(game.history),
      startedAt: game.startedAt,
    },
    include: players,
  });

  if (s3Enabled()) await uploadReplay(replay);
};

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

// one game with every move, for replay — from S3 when enabled, else the database
export const getReplay = async (id) => {
  if (s3Enabled()) {
    const replay = await downloadReplay(id);
    if (replay) return replay;
  }

  const game = await prisma.game.findUnique({ where: { id }, include: players });
  if (!game) throw new HttpError(404, 'Game not found in history');

  const { whiteId, blackId, ...replay } = game;
  return replay;
};
