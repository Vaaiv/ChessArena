// server.js — entry point, starts the server
import app from './app.js';
import { setupSockets } from './sockets/gameSocket.js';

const PORT = process.env.PORT;

// app.listen returns the server, Socket.io attaches to the same port
const server = app.listen(PORT, () => {
  console.log(`ChessArena backend running on http://localhost:${PORT}`);
});

setupSockets(server);
