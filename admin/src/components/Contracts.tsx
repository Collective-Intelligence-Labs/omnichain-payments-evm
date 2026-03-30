import React, { useEffect, useState, useCallback } from 'react';
import { useApi } from '../hooks/useApi';

interface Contract {
  id: string;
  name: string;
  address: string;
  network: string;
  tokenAddress: string | null;
  tokenName?: string;
  deployedBy?: string;
  addedAt?: string;
  deployedAt?: string;
}

interface ContractsResponse {
  contracts: Contract[];
  defaultContract: string | null;
}

export default function Contracts() {
  const { request, loading, error } = useApi();
  const [data, setData] = useState<ContractsResponse | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDeployForm, setShowDeployForm] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{ message: string; contract?: Contract; tokenAddress?: string; transactionHash?: string } | null>(null);

  const [addForm, setAddForm] = useState({ name: '', address: '', network: 'sepolia', tokenAddress: '' });
  const [deployForm, setDeployForm] = useState({ network: 'sepolia', tokenAddress: '' });

  const fetchContracts = useCallback(async () => {
    try {
      const res = await request('/admin/contracts');
      setData(res);
    } catch {}
  }, [request]);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  const handleSetDefault = async (id: string) => {
    try {
      await request(`/admin/contracts/${id}/default`, { method: 'PUT' });
      fetchContracts();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this contract?')) return;
    try {
      await request(`/admin/contracts/${id}`, { method: 'DELETE' });
      fetchContracts();
    } catch {}
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await request('/admin/contracts', {
        method: 'POST',
        body: JSON.stringify({
          name: addForm.name,
          address: addForm.address,
          network: addForm.network,
          tokenAddress: addForm.tokenAddress || undefined,
        }),
      });
      setAddForm({ name: '', address: '', network: 'sepolia', tokenAddress: '' });
      setShowAddForm(false);
      fetchContracts();
    } catch {}
  };

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeploying(true);
    setDeployResult(null);
    try {
      const res = await request('/admin/contracts/deploy', {
        method: 'POST',
        body: JSON.stringify({
          network: deployForm.network,
          tokenAddress: deployForm.tokenAddress || undefined,
        }),
      });
      setDeployResult(res);
      setShowDeployForm(false);
      setDeployForm({ network: 'sepolia', tokenAddress: '' });
      fetchContracts();
    } catch {} finally {
      setDeploying(false);
    }
  };

  const truncate = (addr: string) => addr ? `${addr.slice(0, 10)}...${addr.slice(-8)}` : '-';

  return (
    <div className="page">
      <h2 className="page-title">Contracts</h2>

      {deployResult && (
        <div className="deploy-result">
          <strong>{deployResult.message}</strong>
          {deployResult.contract && (
            <div className="deploy-details">
              <div><span className="deploy-label">Name:</span> {deployResult.contract.name}</div>
              <div><span className="deploy-label">Address:</span> <span className="address">{deployResult.contract.address}</span></div>
              {deployResult.tokenAddress && (
                <div><span className="deploy-label">Token:</span> <span className="address">{deployResult.tokenAddress}</span></div>
              )}
              {deployResult.transactionHash && (
                <div><span className="deploy-label">Tx:</span> <span className="address">{deployResult.transactionHash}</span></div>
              )}
            </div>
          )}
          <button className="btn btn-outline btn-sm" onClick={() => setDeployResult(null)} style={{ marginTop: 8 }}>Dismiss</button>
        </div>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3>Deployed Contracts ({data?.contracts?.length ?? 0})</h3>
          <div className="actions-bar">
            <button className="btn btn-primary btn-sm" onClick={() => setShowDeployForm(!showDeployForm)}>
              Deploy New
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => setShowAddForm(!showAddForm)}>
              Add Existing
            </button>
            <button className="btn btn-outline btn-sm" onClick={fetchContracts}>Refresh</button>
          </div>
        </div>

        {showDeployForm && (
          <form className="inline-form" onSubmit={handleDeploy}>
            <div className="form-row">
              <div className="form-group">
                <label>Network</label>
                <select value={deployForm.network} onChange={(e) => setDeployForm(f => ({ ...f, network: e.target.value }))}>
                  <option value="sepolia">Sepolia</option>
                  <option value="mainnet">Mainnet</option>
                  <option value="localhost">Localhost</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 2 }}>
                <label>Token Address (optional — deploys USDCMock if empty)</label>
                <input
                  type="text"
                  placeholder="0x... or leave empty to deploy USDCMock"
                  value={deployForm.tokenAddress}
                  onChange={(e) => setDeployForm(f => ({ ...f, tokenAddress: e.target.value }))}
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary btn-sm" disabled={deploying}>
                  {deploying ? 'Deploying...' : 'Deploy'}
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowDeployForm(false)}>Cancel</button>
              </div>
            </div>
          </form>
        )}

        {showAddForm && (
          <form className="inline-form" onSubmit={handleAdd}>
            <div className="form-row">
              <div className="form-group">
                <label>Name</label>
                <input type="text" placeholder="e.g. Processor Sepolia" value={addForm.name} onChange={(e) => setAddForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="form-group" style={{ flex: 2 }}>
                <label>Contract Address</label>
                <input type="text" placeholder="0x..." value={addForm.address} onChange={(e) => setAddForm(f => ({ ...f, address: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Network</label>
                <select value={addForm.network} onChange={(e) => setAddForm(f => ({ ...f, network: e.target.value }))}>
                  <option value="sepolia">Sepolia</option>
                  <option value="mainnet">Mainnet</option>
                  <option value="localhost">Localhost</option>
                </select>
              </div>
              <div className="form-group">
                <label>Token Address</label>
                <input type="text" placeholder="0x... (optional)" value={addForm.tokenAddress} onChange={(e) => setAddForm(f => ({ ...f, tokenAddress: e.target.value }))} />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary btn-sm">Add</button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowAddForm(false)}>Cancel</button>
              </div>
            </div>
          </form>
        )}

        {loading && !data ? (
          <div className="loading"><div className="spinner" /></div>
        ) : !data?.contracts?.length ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0-4h18" />
            </svg>
            <p>No contracts configured</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Network</th>
                  <th>Contract Address</th>
                  <th>Token Address</th>
                  <th>Default</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.contracts.map((c) => (
                  <tr key={c.id} className={c.id === data.defaultContract ? 'row-default' : ''}>
                    <td>
                      <strong>{c.name}</strong>
                      {c.deployedAt && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{new Date(c.deployedAt).toLocaleString()}</div>}
                    </td>
                    <td><span className="badge badge-ok">{c.network}</span></td>
                    <td className="address">{truncate(c.address)}</td>
                    <td className="address">{c.tokenAddress ? truncate(c.tokenAddress) : '-'}</td>
                    <td>
                      {c.id === data.defaultContract ? (
                        <span className="badge badge-pending">Active</span>
                      ) : (
                        <button className="btn btn-outline btn-sm" onClick={() => handleSetDefault(c.id)}>Set Default</button>
                      )}
                    </td>
                    <td>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>Delete</button>
                    </td>
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
