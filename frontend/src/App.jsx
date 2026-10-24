// App.jsx — login state, live connection, and which page is showing
import { useEffect, useState } from 'react';
import { request, connectSocket } from './api.js';
import Auth from './Auth.jsx';
import Lobby from './Lobby.jsx';
import Game from './Game.jsx';
import History from './History.jsx';
import Replay from './Replay.jsx';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const [page, setPage] = useState({ name: 'lobby' }); // lobby | game | history | replay

  const login = ({ token, user }) => {
    localStorage.setItem('token', token);
    setToken(token);
    setUser(user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  // check the saved token, then open the live connection
  useEffect(() => {
    if (!token) return;
    request('/api/auth/me', { token }).then((data) => setUser(data.user)).catch(logout);
    const s = connectSocket(token);
    setSocket(s);
    return () => s.disconnect();
  }, [token]);

  if (!token) return <Auth onLogin={login} />;
  if (!user || !socket) return <p className="card">Loading…</p>;

  return (
    <div className="app">
      <header>
        <b onClick={() => setPage({ name: 'lobby' })}>♞ ChessArena</b>
        <span>
          {user.username}
          <button onClick={() => setPage({ name: 'history' })}>History</button>
          <button onClick={logout}>Logout</button>
        </span>
      </header>

      {page.name === 'lobby' && <Lobby socket={socket} openGame={(id) => setPage({ name: 'game', id })} />}
      {page.name === 'game' && <Game socket={socket} gameId={page.id} />}
      {page.name === 'history' && <History token={token} user={user} openReplay={(id) => setPage({ name: 'replay', id })} />}
      {page.name === 'replay' && <Replay token={token} gameId={page.id} />}
    </div>
  );
}
