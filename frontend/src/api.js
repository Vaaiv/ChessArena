// api.js — talks to the backend (REST + Socket.io)
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const request = async (path, { method = 'GET', body, token } = {}) => {
  const res = await fetch(API_URL + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
};

export const connectSocket = (token) => io(API_URL, { auth: { token } });
