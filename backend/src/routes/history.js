// history.js — URL map for finished games (login required)
import express from 'express';
import { myGames, replay } from '../controllers/historyController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', myGames);
router.get('/:id', replay);

export default router;
