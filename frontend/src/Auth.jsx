// Auth.jsx — login / signup form
import { useState } from 'react';
import { request } from './api.js';

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState('login'); // or 'signup'
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try {
      onLogin(await request(`/api/auth/${mode}`, { method: 'POST', body: form }));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="card" onSubmit={submit}>
      <h1>♞ ChessArena</h1>
      {mode === 'signup' && <input name="username" placeholder="Username" value={form.username} onChange={update} />}
      <input name="email" type="email" placeholder="Email" value={form.email} onChange={update} />
      <input name="password" type="password" placeholder="Password" value={form.password} onChange={update} />
      <button>{mode === 'login' ? 'Log in' : 'Sign up'}</button>
      {error && <p className="error">{error}</p>}
      <a onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        {mode === 'login' ? 'No account? Sign up' : 'Have an account? Log in'}
      </a>
    </form>
  );
}
