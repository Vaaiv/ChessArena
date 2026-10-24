# ChessArena
Real-time multiplayer chess: Node.js, Express, Socket.io, PostgreSQL (Supabase + Prisma), chess.js.

## Status
- [x] REST backend: server-held games, move validation, check/checkmate/draw detection
- [x] Auth: signup/login with bcrypt + JWT, users in PostgreSQL
- [x] Real-time multiplayer with Socket.io: rooms, white/black players, turns, spectators, resign, draws
- [x] Game history in PostgreSQL: finished games (players, result, moves) are saved for history and replay; live games leave memory 1 minute after they end
- [x] Load test (concurrent games, latency) — see below
- [x] React frontend (minimal): login, lobby, live board, spectating, history, replay
- [ ] Deployment (Vercel, AWS EC2, S3)

## Backend

```bash
cd backend
cp .env.example .env   # fill in DATABASE_URL, DIRECT_URL, JWT_SECRET
npm install            # also generates the Prisma client
npx prisma migrate deploy
npm run dev            # http://localhost:3000
npm test
```

### Structure
```
backend/
├── prisma/schema.prisma           # database tables (User, Game)
├── prisma.config.ts               # Prisma CLI settings (uses DIRECT_URL)
└── src/
    ├── server.js                  # entry point: starts Express + Socket.io
    ├── app.js                     # Express app, routes, 404 + error handling
    ├── config/db.js               # shared Prisma client (uses DATABASE_URL)
    ├── routes/                    # URL maps (auth, games)
    ├── controllers/               # request validation, req/res
    ├── middleware/auth.js         # requireAuth (JWT check)
    ├── services/authService.js    # passwords, tokens, users
    ├── services/gameService.js    # chess.js + game rules
    ├── services/gameStore.js      # in-memory live games
    ├── services/historyService.js # finished games in PostgreSQL
    ├── sockets/gameSocket.js      # real-time events
    └── utils/httpError.js         # error with HTTP status
```

## Frontend

```bash
cd frontend
cp .env.example .env   # VITE_API_URL = backend address
npm install
npm run dev            # http://localhost:5173
```

React + Vite, `react-chessboard` for the board, `socket.io-client` for live play. Pages (switched by state in `App.jsx`): login/signup, lobby, game (players + spectators), history, replay. Pawns always promote to a queen.

## Backend details

### Load test
`scripts/loadTest.js` logs in 2 players per game, plays random legal games concurrently over Socket.io and measures **move sync latency**: the time from a player sending a move until the opponent receives it.

```bash
npm run dev                                   # terminal 1
npm run loadtest -- --games 50 --plies 60     # terminal 2 (add --url to test a deployed server)
```

Local results (server and clients on one Windows laptop, so no internet latency included):

| Concurrent games | Players | Moves | p50 | p95 | p99 | max |
|---|---|---|---|---|---|---|
| 25 | 50 | 1,500 | 2.2 ms | 5.3 ms | 7.6 ms | 17.4 ms |
| 50 | 100 | 3,000 | 2.6 ms | 7.9 ms | 12.2 ms | 16.4 ms |

Fix found by profiling: `chess.history()` / `chess.pgn()` replay the whole game on each call (~6 ms each at 60 moves), so the server keeps its own move list instead — server time per move dropped from ~12 ms to ~0.35 ms.

### REST API
| Method | Path | Body / headers | Response |
|---|---|---|---|
| GET | `/health` | — | `{ status: "ok" }` |
| POST | `/api/auth/signup` | `{ username, email, password }` | `201 { user, token }` |
| POST | `/api/auth/login` | `{ email, password }` | `{ user, token }` |
| GET | `/api/auth/me` | header `Authorization: Bearer <token>` | `{ user }` |
| GET | `/api/games` | — | `{ games }` waiting for an opponent |
| GET | `/api/games/:id` | — | game state |
| GET | `/api/history` | header `Authorization: Bearer <token>` | `{ games }` your finished games, newest first |
| GET | `/api/history/:id` | header `Authorization: Bearer <token>` | one finished game with `moves` for replay |

Errors return `{ error: "message" }` with `400`, `401`, `403`, `404` or `409`.

### Socket.io
Connect with the login token: `io(url, { auth: { token } })`.

Client → server events reply through an acknowledgement callback with `{ ok: true, ... }` or `{ ok: false, error }`:

| Event | Payload | Reply |
|---|---|---|
| `game:create` | — | `{ game, color: "w" }` |
| `game:join` | `{ gameId }` | `{ game, color }` — `"b"` for the first joiner, `null` for spectators; players rejoining keep their color |
| `game:move` | `{ gameId, from, to, promotion? }` | `{ game }` |
| `game:resign` | `{ gameId }` | `{ game }` |
| `game:offerDraw` | `{ gameId }` | `{ game }` |
| `game:answerDraw` | `{ gameId, accept }` | `{ game }` |

Server → client events (sent to everyone in the game room):

| Event | Payload |
|---|---|
| `game:update` | `{ game, lastMove? }` after every join, move, resign or draw change |
| `player:joined` | `{ user, color }` |
| `player:left` | `{ user }` |

Game state:
```json
{
  "id": "uuid",
  "status": "waiting | active | finished",
  "white": { "id": "...", "username": "alice" },
  "black": { "id": "...", "username": "bob" },
  "result": "1-0 | 0-1 | 1/2-1/2 | null",
  "reason": "checkmate | resignation | agreement | stalemate | ...",
  "drawOfferBy": "w | b | null",
  "fen": "...",
  "turn": "w",
  "isCheck": false,
  "history": ["e4"],
  "pgn": "1. e4",
  "createdAt": "ISO date"
}
```
