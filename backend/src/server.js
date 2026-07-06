// server.js — entry point, starts the HTTP server
import http from 'http';
import app from './app.js';

const PORT = process.env.PORT || 3000;

// wrap Express in a raw http server (Socket.io needs this in Phase 2)
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`ChessArena backend running on http://localhost:${PORT}`);
});