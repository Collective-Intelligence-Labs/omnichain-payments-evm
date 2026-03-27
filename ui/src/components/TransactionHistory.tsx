import React from 'react';
import { shortenAddress } from '../utils/processor';
import type { TransactionRecord } from '../types';

interface TransactionHistoryProps {
  transactions: TransactionRecord[];
}

const TransactionHistory: React.FC<TransactionHistoryProps> = ({ transactions }) => {
  if (transactions.length === 0) {
    return (
      <div className="card history-card">
        <h2 className="card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Transaction History
        </h2>
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3">
            <rect x="2" y="3" width="20" height="18" rx="2" />
            <line x1="8" y1="10" x2="16" y2="10" />
            <line x1="8" y1="14" x2="12" y2="14" />
          </svg>
          <p>No transactions yet</p>
          <p className="text-muted">Your batch transfers will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card history-card">
      <h2 className="card-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        Transaction History
        <span className="badge">{transactions.length}</span>
      </h2>
      <div className="tx-list">
        {[...transactions].reverse().map(tx => (
          <div key={tx.hash} className="tx-item">
            <div className="tx-header">
              <span className={`tx-status ${tx.status}`}>{tx.status}</span>
              <span className="tx-time">
                {new Date(tx.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="tx-hash">
              {shortenAddress(tx.hash)}
            </div>
            <div className="tx-details">
              {tx.transfers.map((t, i) => (
                <div key={i} className="tx-detail-row">
                  <span>{shortenAddress(t.to)}</span>
                  <span className="tx-amount">{t.amount}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TransactionHistory;
