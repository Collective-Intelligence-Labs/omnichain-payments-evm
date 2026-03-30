import React, { useEffect, useState, useCallback } from 'react';
import { useApi } from '../hooks/useApi';

interface Transfer {
  _id: string;
  data: {
    cmd_id: number;
    cmd_type: number;
    amount: string;
    from: string;
    to: string;
    fee: string;
    deadline: number;
  };
  created_at?: string;
}

interface PaginatedResponse {
  transfers: Transfer[];
  total: number;
  page: number;
  totalPages: number;
}

export default function Transfers() {
  const { request, loading } = useApi();
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [page, setPage] = useState(1);

  const fetchTransfers = useCallback(async () => {
    try {
      const res = await request(`/admin/transfers?page=${page}&limit=20`);
      setData(res);
    } catch {
      // error handled by useApi
    }
  }, [request, page]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this transfer?')) return;
    try {
      await request(`/admin/transfers/${id}`, { method: 'DELETE' });
      fetchTransfers();
    } catch {
      // error handled by useApi
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Delete ALL pending transfers? This cannot be undone.')) return;
    try {
      await request('/admin/transfers', { method: 'DELETE' });
      fetchTransfers();
    } catch {
      // error handled by useApi
    }
  };

  const truncate = (addr: string) => addr ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : '-';

  return (
    <div className="page">
      <h2 className="page-title">Transfers</h2>

      <div className="card">
        <div className="card-header">
          <h3>Pending Transfers ({data?.total ?? 0})</h3>
          <div className="actions-bar">
            <button className="btn btn-danger btn-sm" onClick={handleClearAll}>Clear All</button>
            <button className="btn btn-outline btn-sm" onClick={fetchTransfers}>Refresh</button>
          </div>
        </div>

        {loading && !data ? (
          <div className="loading"><div className="spinner" /></div>
        ) : !data?.transfers?.length ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <p>No pending transfers</p>
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Amount</th>
                    <th>Fee</th>
                    <th>Type</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transfers.map((t) => (
                    <tr key={t._id}>
                      <td className="address">{t._id.slice(-8)}</td>
                      <td className="address">{truncate(t.data?.from)}</td>
                      <td className="address">{truncate(t.data?.to)}</td>
                      <td>{t.data?.amount || '-'}</td>
                      <td>{t.data?.fee || '-'}</td>
                      <td><span className="badge badge-pending">Type {t.data?.cmd_type ?? '-'}</span></td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t._id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.totalPages > 1 && (
              <div className="pagination">
                <button
                  className="btn btn-outline btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </button>
                <span style={{ color: '#64748b', fontSize: 13 }}>
                  Page {data.page} of {data.totalPages}
                </span>
                <button
                  className="btn btn-outline btn-sm"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
