// app.js — builds the Express app (no server start here)
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// middleware
app.use(cors());              // allow frontend (Vercel) to hit backend (EC2)
app.use(express.json());      // parse JSON request bodies

// health check — proves the server is alive
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'chessarena-backend' });
});

// routes go here later (auth, games, history)
// app.use('/api/auth', authRoutes);
// app.use('/api/games', gameRoutes);

export default app;