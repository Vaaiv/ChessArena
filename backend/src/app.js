// app.js — builds the Express app (no server start here)
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import gameRoutes from './routes/games.js';
import authRoutes from './routes/auth.js';

dotenv.config();

const app = express();
 
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'chessarena-backend' });
});

app.use('/api/auth', authRoutes);
app.use('/api/games', gameRoutes);

// unknown routes
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// errors thrown anywhere above land here
app.use((err, req, res, next) => {
  const status = err.status ?? 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message });
});

export default app;
