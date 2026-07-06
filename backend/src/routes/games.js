// games.js — URL map for game endpoints
import express from 'express';
import { getStartingPosition, makeMove } from '../controllers/gameController.js';

const router = express.Router();

router.get('/start', getStartingPosition);
router.post('/move', makeMove);

export default router;