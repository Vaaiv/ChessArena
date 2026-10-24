// server.js — entry point, starts the server
import app from './app.js';

const PORT = process.env.PORT;

// app.listen returns the server (Socket.io will attach to it in Phase 2)
const server = app.listen(PORT, () => {
  console.log(`ChessArena backend running on http://localhost:${PORT}`);
});
