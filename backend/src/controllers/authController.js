// authController.js — HTTP req/res for auth, delegates to service
import * as authService from '../services/authService.js';
import { HttpError } from '../utils/httpError.js';

const USERNAME = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

// POST /api/auth/signup
// body: { username, email, password }
export const signup = async (req, res) => {
  const { username, email, password } = req.body ?? {};

  if (!USERNAME.test(username)) {
    throw new HttpError(400, 'username must be 3-20 letters, numbers or _');
  }
  if (!EMAIL.test(email)) {
    throw new HttpError(400, 'email is not valid');
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    throw new HttpError(400, `password must be at least ${MIN_PASSWORD} characters`);
  }

  const result = await authService.signup({ username, email: email.toLowerCase(), password });
  res.status(201).json(result);
};

// POST /api/auth/login
// body: { email, password }
export const login = async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    throw new HttpError(400, 'email and password are required');
  }

  res.json(await authService.login({ email: email.toLowerCase(), password }));
};

// GET /api/auth/me  (needs requireAuth)
export const me = async (req, res) => {
  res.json({ user: await authService.getUserById(req.userId) });
};
