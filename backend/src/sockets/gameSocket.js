// gameSocket.js — real-time game events over Socket.io
import { Server } from 'socket.io';
import * as gameService from '../services/gameService.js';
import { verifyToken, getUserById } from '../services/authService.js';
import { saveFinishedGame } from '../services/historyService.js';

const room = (gameId) => `game:${gameId}`;

// wraps an event handler: replies { ok: true, ...result } or { ok: false, error }
// through the client's acknowledgement callback
const handle = (fn) => async (payload, ack) => {
  if (typeof payload === 'function') [payload, ack] = [{}, payload];
  const reply = typeof ack === 'function' ? ack : () => {};

  try {
    reply({ ok: true, ...(await fn(payload ?? {})) });
  } catch (err) {
    if (!err.status) console.error(err);
    reply({ ok: false, error: err.status ? err.message : 'Internal server error' });
  }
};

export const setupSockets = (server) => {
  const io = new Server(server, { cors: { origin: process.env.CLIENT_URL ?? '*' } });

  // only logged-in users can connect; client sends io(url, { auth: { token } })
  io.use(async (socket, next) => {
    try {
      const user = await getUserById(verifyToken(socket.handshake.auth?.token));
      socket.data.user = { id: user.id, username: user.username };
      next();
    } catch (err) {
      next(new Error(err.status ? err.message : 'Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const { user } = socket.data;

    // send the latest game state to everyone in the room (players + spectators)
    const emitUpdate = (game, extra = {}) => io.to(room(game.id)).emit('game:update', { game, ...extra });

    // after a move/resign/draw: emit, then save the game if that action ended it
    // (players don't wait for the DB)
    const broadcast = (game, extra = {}) => {
      emitUpdate(game, extra);
      if (game.status === 'finished') {
        saveFinishedGame(game).catch((err) => console.error('Failed to save game history', err));
      }
    };

    socket.on('game:create', handle(() => {
      const game = gameService.createGame(user);
      socket.join(room(game.id));
      return { game, color: 'w' };
    }));

    socket.on('game:join', handle(({ gameId }) => {
      const { game, color } = gameService.joinGame(gameId, user);
      socket.join(room(game.id));
      socket.to(room(game.id)).emit('player:joined', { user, color });
      emitUpdate(game);
      return { game, color };
    }));

    socket.on('game:move', handle(({ gameId, from, to, promotion }) => {
      const { game, move } = gameService.applyMove(gameId, user.id, { from, to, promotion });
      broadcast(game, { lastMove: move });
      return { game };
    }));

    socket.on('game:resign', handle(({ gameId }) => {
      const { game } = gameService.resign(gameId, user.id);
      broadcast(game);
      return { game };
    }));

    socket.on('game:offerDraw', handle(({ gameId }) => {
      const { game } = gameService.offerDraw(gameId, user.id);
      broadcast(game);
      return { game };
    }));

    socket.on('game:answerDraw', handle(({ gameId, accept }) => {
      const { game } = gameService.answerDraw(gameId, user.id, accept === true);
      broadcast(game);
      return { game };
    }));

    // tell rooms this user left (they can come back with game:join)
    socket.on('disconnecting', () => {
      for (const r of socket.rooms) {
        if (r.startsWith('game:')) socket.to(r).emit('player:left', { user });
      }
    });
  });

  return io;
};
