// games.js — URL map for game endpoints
import express from 'express';
import { create, show, makeMove } from '../controllers/gameController.js';

const router = express.Router();

router.post('/', create);
router.get('/:id', show);
router.post('/:id/move', makeMove);

export default router;
