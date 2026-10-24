// auth.test.js — auth API tests against the real DB (test users are deleted after)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import prisma from '../src/config/db.js';

let server;
let base;

const tag = Date.now().toString(36);
const alice = { username: `test_${tag}`, email: `test_${tag}@example.com`, password: 'secret123' };

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://localhost:${server.address().port}`;
});

after(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: `test_${tag}` } } });
  await prisma.$disconnect();
  server.close();
});

const api = async (method, path, body, token) => {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

test('signup creates a user and returns a token', async () => {
  const { status, body } = await api('POST', '/api/auth/signup', alice);
  assert.equal(status, 201);
  assert.equal(body.user.username, alice.username);
  assert.equal(body.user.passwordHash, undefined);
  assert.ok(body.token);
});

test('password is stored hashed, not plain', async () => {
  const user = await prisma.user.findUnique({ where: { email: alice.email } });
  assert.notEqual(user.passwordHash, alice.password);
});

test('signup with taken email or username returns 409', async () => {
  const sameEmail = await api('POST', '/api/auth/signup', { ...alice, username: `other_${tag}` });
  assert.equal(sameEmail.status, 409);
  assert.equal(sameEmail.body.error, 'Email is already taken');

  const sameName = await api('POST', '/api/auth/signup', { ...alice, email: `test_${tag}_2@example.com` });
  assert.equal(sameName.status, 409);
  assert.equal(sameName.body.error, 'Username is already taken');
});

test('signup with bad input returns 400', async () => {
  const cases = [
    { ...alice, username: 'ab' },
    { ...alice, email: 'not-an-email' },
    { ...alice, password: 'short' },
    {},
  ];
  for (const body of cases) {
    const { status } = await api('POST', '/api/auth/signup', body);
    assert.equal(status, 400, JSON.stringify(body));
  }
});

test('login with correct password returns a token', async () => {
  const { status, body } = await api('POST', '/api/auth/login', { email: alice.email, password: alice.password });
  assert.equal(status, 200);
  assert.equal(body.user.email, alice.email);
  assert.ok(body.token);
});

test('login with wrong password or unknown email returns 401', async () => {
  const wrongPass = await api('POST', '/api/auth/login', { email: alice.email, password: 'wrongpass' });
  assert.equal(wrongPass.status, 401);

  const unknown = await api('POST', '/api/auth/login', { email: `nobody_${tag}@example.com`, password: 'whatever1' });
  assert.equal(unknown.status, 401);
  assert.equal(unknown.body.error, wrongPass.body.error);
});

test('GET /me returns the logged-in user', async () => {
  const { body: { token } } = await api('POST', '/api/auth/login', { email: alice.email, password: alice.password });
  const { status, body } = await api('GET', '/api/auth/me', undefined, token);
  assert.equal(status, 200);
  assert.equal(body.user.username, alice.username);
});

test('GET /me without or with a bad token returns 401', async () => {
  const none = await api('GET', '/api/auth/me');
  assert.equal(none.status, 401);

  const bad = await api('GET', '/api/auth/me', undefined, 'not.a.real.token');
  assert.equal(bad.status, 401);
});
