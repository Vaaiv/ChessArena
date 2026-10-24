// Replay.jsx — step through a finished game move by move
import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { request } from './api.js';

export default function Replay({ token, gameId }) {
  const [game, setGame] = useState(null);
  const [step, setStep] = useState(0); // how many moves are shown

  useEffect(() => {
    request(`/api/history/${gameId}`, { token }).then((g) => { setGame(g); setStep(g.moves.length); });
  }, [token, gameId]);

  // replay the first `step` moves to get the board position
  const fen = useMemo(() => {
    const chess = new Chess();
    game?.moves.slice(0, step).forEach((m) => chess.move(m));
    return chess.fen();
  }, [game, step]);

  if (!game) return <p className="card">Loading…</p>;
  const last = game.moves.length;

  return (
    <div className="game">
      <div className="board">
        <Chessboard options={{ position: fen, allowDragging: false }} />
      </div>
      <div className="panel">
        <p>♔ {game.white.username} vs ♚ {game.black.username}</p>
        <h3>{game.result} by {game.reason}</h3>
        <div>
          <button onClick={() => setStep(0)}>⏮</button>
          <button onClick={() => setStep(Math.max(0, step - 1))}>◀</button>
          <span> {step} / {last} </span>
          <button onClick={() => setStep(Math.min(last, step + 1))}>▶</button>
          <button onClick={() => setStep(last)}>⏭</button>
        </div>
        <p className="moves">{game.pgn}</p>
      </div>
    </div>
  );
}
