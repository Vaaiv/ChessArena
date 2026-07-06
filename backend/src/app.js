// app.js — builds the Express app (no server start here)
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import gameRoutes from './routes/games.js';   // ← NEW

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'chessarena-backend' });
});

app.use('/api/games', gameRoutes);            // ← NEW

export default app;