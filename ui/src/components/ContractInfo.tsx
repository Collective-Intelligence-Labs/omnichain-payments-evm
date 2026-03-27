import React from 'react';
import { shortenAddress } from '../utils/processor';

interface ContractInfoProps {
  processorAddress: string;
  tokenAddress: string;
  tokenSymbol: string | null;
  tokenBalance: string | null;
  ethBalance: string | null;
  chainId: number | null;
  onProcessorChange: (addr: string) => void;
  onTokenChange: (addr: string) => void;
}

const ContractInfo: React.FC<ContractInfoProps> = ({
  processorAddress,
  tokenAddress,
  tokenSymbol,
  tokenBalance,
  ethBalance,
  chainId,
  onProcessorChange,
  onTokenChange,
}) => {
  const chainNames: Record<number, string> = {
    31337: 'Localhost',
    11155111: 'Sepolia',
    1: 'Ethereum',
  };

  return (
    <div className="card info-card">
      <h2 className="card-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        Network & Contracts
      </h2>
      <div className="info-grid">
        <div className="info-item">
          <span className="info-label">Network</span>
          <span className="info-value">
            <span className={`network-dot ${chainId ? 'active' : ''}`} />
            {chainId ? chainNames[chainId] || `Chain ${chainId}` : 'Not connected'}
          </span>
        </div>
        <div className="info-item">
          <span className="info-label">ETH Balance</span>
          <span className="info-value">{ethBalance ? `${ethBalance} ETH` : '--'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Token Balance</span>
          <span className="info-value">{tokenBalance ? `${tokenBalance} ${tokenSymbol || 'TOKEN'}` : '--'}</span>
        </div>
      </div>
      <div className="contract-inputs">
        <div className="input-group">
          <label className="input-label">Processor Address</label>
          <input
            className="input"
            type="text"
            placeholder="0x..."
            value={processorAddress}
            onChange={e => onProcessorChange(e.target.value)}
          />
        </div>
        <div className="input-group">
          <label className="input-label">Token Address</label>
          <input
            className="input"
            type="text"
            placeholder="0x..."
            value={tokenAddress}
            onChange={e => onTokenChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

export default ContractInfo;
