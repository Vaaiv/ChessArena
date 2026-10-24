// History.jsx — your finished games
import { useEffect, useState } from 'react';
import { request } from './api.js';

export default function History({ token, user, openReplay }) {
  const [games, setGames] = useState(null);

  useEffect(() => {
    request('/api/history', { token }).then((data) => setGames(data.games));
  }, [token]);

  if (!games) return <p className="card">Loading…</p>;

  const outcome = (g) => {
    if (g.result === '1/2-1/2') return 'Draw';
    const iAmWhite = g.white.id === user.id;
    return (g.result === '1-0') === iAmWhite ? 'Won' : 'Lost';
  };

  return (
    <div className="card">
      <h3>Your games</h3>
      {games.length === 0 && <p>No finished games yet.</p>}
      {games.map((g) => (
        <div key={g.id} className="row">
          {outcome(g)} vs {(g.white.id === user.id ? g.black : g.white).username} · {g.reason} · {g.moveCount} moves
          <button onClick={() => openReplay(g.id)}>Replay</button>
        </div>
      ))}
    </div>
  );
}
