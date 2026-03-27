import React from 'react';

interface HeaderProps {
  connected: boolean;
  address: string | null;
  connecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

const Header: React.FC<HeaderProps> = ({ connected, address, connecting, onConnect, onDisconnect }) => {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="logo">
          <div className="logo-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="8" r="4" fill="url(#grad1)" />
              <circle cx="8" cy="20" r="4" fill="url(#grad1)" />
              <circle cx="24" cy="20" r="4" fill="url(#grad1)" />
              <line x1="16" y1="12" x2="8" y2="16" stroke="url(#grad1)" strokeWidth="1.5" />
              <line x1="16" y1="12" x2="24" y2="16" stroke="url(#grad1)" strokeWidth="1.5" />
              <line x1="8" y1="24" x2="24" y2="24" stroke="url(#grad1)" strokeWidth="1.5" />
              <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6C63FF" />
                  <stop offset="100%" stopColor="#00D9FF" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <h1 className="logo-title">OmniChain Payments</h1>
            <p className="logo-subtitle">Gas-Efficient Batch Token Transfers</p>
          </div>
        </div>

        <div className="header-actions">
          {connected ? (
            <div className="wallet-info">
              <div className="wallet-balance-dot" />
              <span className="wallet-address">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
              <button className="btn btn-sm btn-outline" onClick={onDisconnect}>
                Disconnect
              </button>
            </div>
          ) : (
            <button
              className="btn btn-primary"
              onClick={onConnect}
              disabled={connecting}
            >
              {connecting ? (
                <>
                  <span className="spinner" /> Connecting...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
                    <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
                    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                  </svg>
                  Connect Wallet
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
