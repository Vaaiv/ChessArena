// gameStore.js — in-memory storage for live games
const games = new Map();

export const saveGame = (game) => games.set(game.id, game);

export const findGame = (id) => games.get(id);

export const listGames = () => [...games.values()];

export const clearGames = () => games.clear();
