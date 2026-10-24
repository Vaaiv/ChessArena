// Lobby.jsx — create a game, join an open one, or join/watch by ID
import { useEffect, useState } from 'react';
import { request } from './api.js';

export default function Lobby({ socket, openGame }) {
  const [games, setGames] = useState([]);
  const [gameId, setGameId] = useState('');
  const [error, setError] = useState('');

  // refresh the open games list every 3 seconds
  useEffect(() => {
    const load = () => request('/api/games').then((data) => setGames(data.games));
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, []);

  const create = async () => {
    const res = await socket.emitWithAck('game:create');
    res.ok ? openGame(res.game.id) : setError(res.error);
  };

  return (
    <div className="card">
      <button onClick={create}>Create game</button>
      {error && <p className="error">{error}</p>}

      <h3>Open games</h3>
      {games.length === 0 && <p>No open games — create one!</p>}
      {games.map((g) => (
        <div key={g.id} className="row">
          {g.white.username} is waiting
          <button onClick={() => openGame(g.id)}>Join</button>
        </div>
      ))}

      <h3>Join or watch by game ID</h3>
      <form className="row" onSubmit={(e) => { e.preventDefault(); if (gameId.trim()) openGame(gameId.trim()); }}>
        <input placeholder="Game ID" value={gameId} onChange={(e) => setGameId(e.target.value)} />
        <button>Go</button>
      </form>
    </div>
  );
}
