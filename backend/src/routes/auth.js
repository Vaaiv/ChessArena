// auth.js — URL map for auth endpoints
import express from 'express';
import { signup, login, me } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', requireAuth, me);

export default router;
