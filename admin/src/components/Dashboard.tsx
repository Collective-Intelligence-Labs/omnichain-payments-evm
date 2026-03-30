import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';

interface Stats {
  pendingTransfers: number;
  totalOperations: number;
  totalAmount: string;
  recentTransfers: any[];
  mongodbStatus: string;
}

export default function Dashboard() {
  const { request, loading, error } = useApi();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    request('/admin/stats').then(setStats).catch(() => {});
  }, [request]);

  if (loading && !stats) {
    return (
      <div className="page">
        <h2 className="page-title">Dashboard</h2>
        <div className="loading"><div className="spinner" /></div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="page">
        <h2 className="page-title">Dashboard</h2>
        <div className="empty-state">
          <p>Error loading stats: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h2 className="page-title">Dashboard</h2>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Pending Transfers</div>
          <div className="stat-value pending">{stats?.pendingTransfers ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Operations</div>
          <div className="stat-value">{stats?.totalOperations ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Recent Total Amount</div>
          <div className="stat-value">{stats?.totalAmount ?? '0'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">MongoDB Status</div>
          <div className={`stat-value ${stats?.mongodbStatus === 'connected' ? 'connected' : 'disconnected'}`}>
            {stats?.mongodbStatus ?? 'unknown'}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Recent Transfers</h3>
        </div>
        {!stats?.recentTransfers || stats.recentTransfers.length === 0 ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <p>No transfers found</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th>Amount</th>
                  <th>Fee</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentTransfers.map((t: any, i: number) => (
                  <tr key={t._id || i}>
                    <td className="address">{t.data?.from ? `${t.data.from.slice(0, 8)}...${t.data.from.slice(-6)}` : '-'}</td>
                    <td className="address">{t.data?.to ? `${t.data.to.slice(0, 8)}...${t.data.to.slice(-6)}` : '-'}</td>
                    <td>{t.data?.amount || '-'}</td>
                    <td>{t.data?.fee || '-'}</td>
                    <td><span className="badge badge-pending">Type {t.data?.cmd_type ?? '-'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
