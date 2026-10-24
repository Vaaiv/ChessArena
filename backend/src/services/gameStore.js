// gameStore.js — in-memory storage for games (swap for a DB in Phase 4)
const games = new Map();

export const saveGame = (game) => games.set(game.id, game);

export const findGame = (id) => games.get(id);

export const clearGames = () => games.clear();
