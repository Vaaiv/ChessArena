# ChessArena
Multiplayer chess game.

## Status
- [x] **Phase 1** — REST backend: server-held games, move validation, check/checkmate/draw detection
- [ ] **Phase 2** — Real-time multiplayer with Socket.io (rooms, players, turn ownership)
- [ ] **Phase 3** — React frontend
- [ ] **Phase 4** — Persistence, accounts, clocks, deployment

## Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev     # http://localhost:3000
npm test
```

### Structure
```
backend/src/
├── server.js                    # entry point, starts the HTTP server
├── app.js                       # Express app, routes, 404 + error handling
├── routes/games.js              # URL map
├── controllers/gameController.js# request validation, req/res
├── services/gameService.js      # chess.js logic
├── services/gameStore.js        # in-memory game storage
└── utils/httpError.js           # error with HTTP status
```

### API
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/health` | — | `{ status: "ok" }` |
| POST | `/api/games` | — | `201` game state |
| GET | `/api/games/:id` | — | game state |
| POST | `/api/games/:id/move` | `{ from: "e2", to: "e4", promotion?: "q" }` | game state + `lastMove` |

Game state:
```json
{
  "id": "uuid",
  "fen": "...",
  "turn": "w",
  "isCheck": false,
  "isCheckmate": false,
  "isStalemate": false,
  "isDraw": false,
  "isGameOver": false,
  "history": ["e4"],
  "pgn": "1. e4",
  "createdAt": "ISO date"
}
```

Errors return `{ error: "message" }` with `400` (bad input, illegal move, game over) or `404` (unknown game/route).
