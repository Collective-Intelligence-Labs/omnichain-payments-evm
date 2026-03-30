import React, { useEffect, useState, useCallback } from 'react';
import { useApi } from '../hooks/useApi';

interface Operation {
  _id: string;
  deadline: number;
  op_id: string;
  commands: any[];
  signature: string;
}

export default function Operations() {
  const { request, loading } = useApi();
  const [operations, setOperations] = useState<Operation[]>([]);

  const fetchOperations = useCallback(async () => {
    try {
      const res = await request('/admin/operations');
      setOperations(res.operations || []);
    } catch {
      // error handled by useApi
    }
  }, [request]);

  useEffect(() => {
    fetchOperations();
  }, [fetchOperations]);

  const handleClearAll = async () => {
    if (!confirm('Delete ALL operations? This cannot be undone.')) return;
    try {
      await request('/admin/operations', { method: 'DELETE' });
      fetchOperations();
    } catch {
      // error handled by useApi
    }
  };

  return (
    <div className="page">
      <h2 className="page-title">Operations</h2>

      <div className="card">
        <div className="card-header">
          <h3>All Operations ({operations.length})</h3>
          <div className="actions-bar">
            <button className="btn btn-danger btn-sm" onClick={handleClearAll}>Clear All</button>
            <button className="btn btn-outline btn-sm" onClick={fetchOperations}>Refresh</button>
          </div>
        </div>

        {loading && !operations.length ? (
          <div className="loading"><div className="spinner" /></div>
        ) : !operations.length ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <p>No operations found</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Op ID</th>
                  <th>Commands</th>
                  <th>Deadline</th>
                  <th>Signature</th>
                </tr>
              </thead>
              <tbody>
                {operations.map((op) => (
                  <tr key={op._id}>
                    <td className="address">{op._id.slice(-8)}</td>
                    <td className="address">{op.op_id ? `${op.op_id.slice(0, 10)}...` : '-'}</td>
                    <td>{Array.isArray(op.commands) ? op.commands.length : 0} cmd(s)</td>
                    <td>{op.deadline ? new Date(op.deadline * 1000).toLocaleString() : '-'}</td>
                    <td className="address">{op.signature ? `${op.signature.slice(0, 10)}...` : '-'}</td>
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
