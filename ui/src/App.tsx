import React, { useState, useEffect, useCallback } from 'react';
import { Contract } from 'ethers';
import { useWallet } from './hooks/useWallet';
import { ERC20_ABI } from './utils/contracts';
import Header from './components/Header';
import ContractInfo from './components/ContractInfo';
import BatchTransfer from './components/BatchTransfer';
import TransactionHistory from './components/TransactionHistory';
import HowItWorks from './components/HowItWorks';
import type { TransactionRecord } from './types';
import './App.css';

function App() {
  const [processorAddress, setProcessorAddress] = useState('');
  const [tokenAddress, setTokenAddress] = useState('');
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [initialized, setInitialized] = useState(false);

  const wallet = useWallet();

  useEffect(() => {
    if (initialized) return;
    setInitialized(true);
    const savedProcessor = localStorage.getItem('oc_processor');
    const savedToken = localStorage.getItem('oc_token');
    if (savedProcessor) setProcessorAddress(savedProcessor);
    if (savedToken) setTokenAddress(savedToken);
  }, [initialized]);

  useEffect(() => {
    if (processorAddress) localStorage.setItem('oc_processor', processorAddress);
    if (tokenAddress) localStorage.setItem('oc_token', tokenAddress);
  }, [processorAddress, tokenAddress]);

  useEffect(() => {
    if (wallet.status === 'connected' && tokenAddress && wallet.provider) {
      wallet.refreshBalances(tokenAddress);
    }
  }, [wallet.status, tokenAddress, wallet.provider]);

  const handleProcessorChange = useCallback((addr: string) => {
    setProcessorAddress(addr);
  }, []);

  const handleTokenChange = useCallback((addr: string) => {
    setTokenAddress(addr);
  }, []);

  const handleTxSubmit = useCallback((tx: TransactionRecord) => {
    setTransactions(prev => [...prev, tx]);
  }, []);

  return (
    <div className="app">
      <Header
        connected={wallet.status === 'connected'}
        address={wallet.address}
        connecting={wallet.status === 'connecting'}
        onConnect={wallet.connect}
        onDisconnect={wallet.disconnect}
      />

      {wallet.status === 'wrong-network' && (
        <div className="network-warning">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>Please switch to the correct network in your wallet</span>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => wallet.switchNetwork(31337)}
          >
            Switch Network
          </button>
        </div>
      )}

      <main className="main">
        <div className="grid">
          <div className="grid-left">
            <HowItWorks />
            <TransactionHistory transactions={transactions} />
          </div>
          <div className="grid-right">
            <ContractInfo
              processorAddress={processorAddress}
              tokenAddress={tokenAddress}
              tokenSymbol={wallet.tokenSymbol}
              tokenBalance={wallet.tokenBalance}
              ethBalance={wallet.balance}
              chainId={wallet.chainId}
              onProcessorChange={handleProcessorChange}
              onTokenChange={handleTokenChange}
            />
            {wallet.status === 'connected' ? (
              <BatchTransfer
                address={wallet.address}
                provider={wallet.provider}
                processorAddress={processorAddress}
                tokenAddress={tokenAddress}
                tokenSymbol={wallet.tokenSymbol}
                tokenDecimals={wallet.tokenDecimals}
                onTxSubmit={handleTxSubmit}
              />
            ) : (
              <div className="card connect-prompt">
                <div className="connect-prompt-icon">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="url(#prompt-grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
                    <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
                    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                    <defs>
                      <linearGradient id="prompt-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#6C63FF" />
                        <stop offset="100%" stopColor="#00D9FF" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <h3>Connect Your Wallet</h3>
                <p>Connect your MetaMask wallet to start creating batch token transfers with EIP-2612 permits.</p>
                <button className="btn btn-primary" onClick={wallet.connect}>
                  Connect Wallet
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>OmniChain Payments — Gas-Efficient Batch Token Transfers via EIP-2612 Permits</p>
      </footer>
    </div>
  );
}

export default App;
