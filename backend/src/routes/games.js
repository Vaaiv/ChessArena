// games.js — URL map for game endpoints
import express from 'express';
import { list, show } from '../controllers/gameController.js';

const router = express.Router();

router.get('/', list);
router.get('/:id', show);

export default router;
