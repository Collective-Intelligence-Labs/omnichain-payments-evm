import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Transfers from './components/Transfers';
import Operations from './components/Operations';
import Contracts from './components/Contracts';
import { useAuth, AuthProvider } from './hooks/useAuth';
import './App.css';

function Sidebar() {
  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">OmniChain</h1>
        <span className="sidebar-subtitle">Admin Panel</span>
      </div>
      <div className="sidebar-nav">
        <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
          </svg>
          Dashboard
        </NavLink>
        <NavLink to="/transfers" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          Transfers
        </NavLink>
        <NavLink to="/operations" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Operations
        </NavLink>
        <NavLink to="/contracts" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0-4h18" />
          </svg>
          Contracts
        </NavLink>
      </div>
    </nav>
  );
}

function Layout() {
  const { token, logout } = useAuth();

  if (!token) {
    return <Login />;
  }

  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        <header className="topbar">
          <span className="topbar-env">{import.meta.env.VITE_API_URL || '/api'}</span>
          <button className="btn btn-outline btn-sm" onClick={logout}>Logout</button>
        </header>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transfers" element={<Transfers />} />
          <Route path="/operations" element={<Operations />} />
          <Route path="/contracts" element={<Contracts />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/admin">
        <Layout />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
