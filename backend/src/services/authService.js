// authService.js — signup/login logic: password hashing, tokens, DB access
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';
import { HttpError } from '../utils/httpError.js';

const TOKEN_EXPIRES_IN = '7d';

// never send passwordHash to the client
const toPublicUser = ({ id, username, email, createdAt }) => ({ id, username, email, createdAt });

const signToken = (user) =>
  jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });

export const signup = async ({ username, email, password }) => {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  });
  if (existing) {
    const field = existing.email === email ? 'Email' : 'Username';
    throw new HttpError(409, `${field} is already taken`);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { username, email, passwordHash } });

  return { user: toPublicUser(user), token: signToken(user) };
};

export const login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({ where: { email } });

  // same message for both cases, so attackers can't tell which emails exist
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, 'Invalid email or password');
  }

  return { user: toPublicUser(user), token: signToken(user) };
};

export const getUserById = async (id) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new HttpError(404, 'User not found');
  return toPublicUser(user);
};

// returns the user id inside the token, or throws if invalid/expired
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET).sub;
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }
};
