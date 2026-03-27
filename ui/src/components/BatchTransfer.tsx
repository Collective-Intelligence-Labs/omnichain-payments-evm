import React, { useState, useCallback } from 'react';
import { Contract, parseUnits } from 'ethers';
import { buildAndSendOperation } from '../utils/processor';
import { PROCESSOR_ABI, ERC20_ABI } from '../utils/contracts';
import type { TransferInput, TransactionRecord } from '../types';

interface BatchTransferProps {
  address: string | null;
  provider: any;
  processorAddress: string;
  tokenAddress: string;
  tokenSymbol: string | null;
  tokenDecimals: number;
  onTxSubmit: (tx: TransactionRecord) => void;
}

const BatchTransfer: React.FC<BatchTransferProps> = ({
  address,
  provider,
  processorAddress,
  tokenAddress,
  tokenSymbol,
  tokenDecimals,
  onTxSubmit,
}) => {
  const [transfers, setTransfers] = useState<TransferInput[]>([
    { id: crypto.randomUUID(), to: '', amount: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successTx, setSuccessTx] = useState<string | null>(null);

  const addTransfer = useCallback(() => {
    setTransfers(prev => [...prev, { id: crypto.randomUUID(), to: '', amount: '' }]);
  }, []);

  const removeTransfer = useCallback((id: string) => {
    setTransfers(prev => prev.length > 1 ? prev.filter(t => t.id !== id) : prev);
  }, []);

  const updateTransfer = useCallback((id: string, field: keyof TransferInput, value: string) => {
    setTransfers(prev => prev.map(t => (t.id === id ? { ...t, [field]: value } : t)));
  }, []);

  const totalAmount = transfers.reduce((sum, t) => {
    const n = parseFloat(t.amount);
    return isNaN(n) ? sum : sum + n;
  }, 0);

  const handleSubmit = async () => {
    if (!address || !provider || !processorAddress || !tokenAddress) {
      setError('Please connect wallet and configure contracts');
      return;
    }

    const validTransfers = transfers.filter(t => t.to && t.amount);
    if (validTransfers.length === 0) {
      setError('Add at least one transfer');
      return;
    }

    for (const t of validTransfers) {
      if (!/^0x[a-fA-F0-9]{40}$/.test(t.to)) {
        setError(`Invalid address: ${t.to}`);
        return;
      }
      if (isNaN(parseFloat(t.amount)) || parseFloat(t.amount) <= 0) {
        setError(`Invalid amount for ${t.to}`);
        return;
      }
    }

    setError(null);
    setSuccessTx(null);
    setSubmitting(true);

    try {
      const signer = await provider.getSigner();
      const commands = validTransfers.map(t => ({
        to: t.to,
        amount: parseUnits(t.amount, tokenDecimals),
      }));

      const result = await buildAndSendOperation(signer, processorAddress, tokenAddress, address, commands);

      setSuccessTx(result.txHash);
      onTxSubmit({
        hash: result.txHash,
        opId: result.opId.toString(),
        status: 'confirmed',
        timestamp: Date.now(),
        transfers: validTransfers,
      });

      setTransfers([{ id: crypto.randomUUID(), to: '', amount: '' }]);
    } catch (err: any) {
      const msg = err?.reason || err?.message || 'Transaction failed';
      setError(msg.length > 120 ? msg.slice(0, 120) + '...' : msg);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = address && processorAddress && tokenAddress &&
    transfers.some(t => t.to && t.amount && !isNaN(parseFloat(t.amount)) && parseFloat(t.amount) > 0);

  return (
    <div className="card transfer-card">
      <h2 className="card-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
        Batch Transfer
        <span className="badge">{transfers.length}</span>
      </h2>
      <p className="card-desc">
        Create gas-efficient batch transfers using EIP-2612 permits. No separate approval transaction needed.
      </p>

      <div className="transfer-list">
        {transfers.map((t, idx) => (
          <div key={t.id} className="transfer-row">
            <div className="transfer-row-header">
              <span className="transfer-index">#{idx + 1}</span>
              {transfers.length > 1 && (
                <button className="btn-icon btn-remove" onClick={() => removeTransfer(t.id)} title="Remove">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
            <div className="transfer-row-fields">
              <div className="input-group flex-1">
                <label className="input-label">Recipient</label>
                <input
                  className="input"
                  type="text"
                  placeholder="0x..."
                  value={t.to}
                  onChange={e => updateTransfer(t.id, 'to', e.target.value)}
                />
              </div>
              <div className="input-group input-amount">
                <label className="input-label">Amount</label>
                <input
                  className="input"
                  type="number"
                  placeholder="0.00"
                  step="any"
                  min="0"
                  value={t.amount}
                  onChange={e => updateTransfer(t.id, 'amount', e.target.value)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="btn btn-outline btn-add" onClick={addTransfer}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add Transfer
      </button>

      <div className="transfer-summary">
        <div className="summary-row">
          <span>Transfers</span>
          <span className="summary-value">{transfers.filter(t => t.to && t.amount).length}</span>
        </div>
        <div className="summary-row">
          <span>Total Amount</span>
          <span className="summary-value highlight">
            {totalAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {tokenSymbol || 'TOKEN'}
          </span>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {error}
        </div>
      )}

      {successTx && (
        <div className="alert alert-success">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          Transaction submitted! Hash: {successTx.slice(0, 10)}...{successTx.slice(-8)}
        </div>
      )}

      <button
        className="btn btn-primary btn-submit"
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
      >
        {submitting ? (
          <>
            <span className="spinner" /> Processing...
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="13 17 18 12 13 7" />
              <polyline points="6 17 11 12 6 7" />
            </svg>
            Submit Batch Transfer
          </>
        )}
      </button>
    </div>
  );
};

export default BatchTransfer;
