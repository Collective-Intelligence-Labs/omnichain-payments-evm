import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/admin/health`, {
        headers: {
          'Authorization': `Bearer ${secret}`,
        },
      });
      if (res.ok) {
        login(secret);
      } else {
        setError('Invalid admin secret');
      }
    } catch {
      setError('Cannot connect to server');
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>OmniChain Admin</h1>
        <p>Enter the admin secret to access the dashboard</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Admin Secret</label>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Enter admin secret"
              autoFocus
            />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
