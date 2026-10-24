// Game.jsx — live board: play as white/black, or watch as a spectator
import { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';

const COLOR = { w: 'White', b: 'Black' };

const statusText = (game) => {
  if (game.status === 'waiting') return 'Waiting for an opponent — share the game ID below';
  if (game.status === 'finished') {
    const winner = { '1-0': 'White wins', '0-1': 'Black wins' }[game.result] ?? 'Draw';
    return `${winner} by ${game.reason}`;
  }
  return `${COLOR[game.turn]} to move${game.isCheck ? ' — check!' : ''}`;
};

export default function Game({ socket, gameId }) {
  const [game, setGame] = useState(null);
  const [color, setColor] = useState(null); // 'w' | 'b' | null = spectator
  const [fen, setFen] = useState(null);     // board position (updates instantly on our own move)
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const show = (g) => { setGame(g); setFen(g.fen); };

    // join now, and again after a reconnect (the server forgets rooms on disconnect)
    const join = () => socket.emitWithAck('game:join', { gameId }).then((res) => {
      if (!res.ok) return setNotice(res.error);
      show(res.game);
      setColor(res.color);
    });
    const onUpdate = ({ game: g }) => g.id === gameId && show(g);
    const onJoined = (e) => e.gameId === gameId && setNotice(`${e.user.username} joined`);
    const onLeft = (e) => e.gameId === gameId && setNotice(`${e.user.username} disconnected`);

    join();
    socket.on('connect', join);
    socket.on('game:update', onUpdate);
    socket.on('player:joined', onJoined);
    socket.on('player:left', onLeft);
    return () => {
      socket.off('connect', join);
      socket.off('game:update', onUpdate);
      socket.off('player:joined', onJoined);
      socket.off('player:left', onLeft);
    };
  }, [socket, gameId]);

  if (!game) return <p className="card">{notice || 'Joining…'}</p>;

  const myTurn = game.status === 'active' && game.turn === color;
  const send = (event, data = {}) => socket.emitWithAck(event, { gameId, ...data }).then((res) => {
    if (!res.ok) { setFen(game.fen); setNotice(res.error); }
  });

  const onPieceDrop = ({ sourceSquare, targetSquare }) => {
    if (!myTurn || !targetSquare) return false;
    const chess = new Chess(game.fen);
    let move;
    try {
      move = chess.move({ from: sourceSquare, to: targetSquare, promotion: 'q' }); // always promote to queen
    } catch {
      return false; // illegal: piece snaps back
    }
    setFen(chess.fen());
    send('game:move', { from: move.from, to: move.to, promotion: move.promotion });
    return true;
  };

  const opponentOfferedDraw = game.drawOfferBy && game.drawOfferBy !== color;

  return (
    <div className="game">
      <div className="board">
        <Chessboard options={{
          position: fen,
          boardOrientation: color === 'b' ? 'black' : 'white',
          allowDragging: myTurn,
          onPieceDrop,
        }} />
      </div>

      <div className="panel">
        <p>♔ {game.white.username} vs ♚ {game.black?.username ?? '…'}</p>
        <p>{color ? `You play ${COLOR[color]}` : 'You are watching'}</p>
        <h3>{statusText(game)}</h3>
        {notice && <p className="error">{notice}</p>}

        {color && game.status === 'active' && (
          <div>
            <button onClick={() => send('game:resign')}>Resign</button>
            {opponentOfferedDraw ? (
              <>
                <button onClick={() => send('game:answerDraw', { accept: true })}>Accept draw</button>
                <button onClick={() => send('game:answerDraw', { accept: false })}>Decline</button>
              </>
            ) : (
              <button disabled={game.drawOfferBy === color} onClick={() => send('game:offerDraw')}>
                {game.drawOfferBy === color ? 'Draw offered' : 'Offer draw'}
              </button>
            )}
          </div>
        )}

        <p className="moves">{game.history.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${m}` : m)).join(' ')}</p>
        <p>Game ID: <code>{game.id}</code></p>
      </div>
    </div>
  );
}
