// auth.js — middleware that only lets logged-in users through
import { verifyToken } from '../services/authService.js';
import { HttpError } from '../utils/httpError.js';

// expects header: Authorization: Bearer <token>
export const requireAuth = (req, res, next) => {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new HttpError(401, 'Login required');
  }

  req.userId = verifyToken(token);
  next();
};
