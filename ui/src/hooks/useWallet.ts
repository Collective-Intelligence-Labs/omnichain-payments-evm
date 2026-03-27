import { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserProvider, Contract, formatUnits } from 'ethers';
import { ERC20_ABI } from '../utils/contracts';
import type { WalletStatus } from '../types';

interface WalletState {
  status: WalletStatus;
  address: string | null;
  chainId: number | null;
  balance: string | null;
  tokenBalance: string | null;
  tokenSymbol: string | null;
  tokenDecimals: number;
  provider: BrowserProvider | null;
}

interface UseWalletReturn extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: (chainId: number) => Promise<void>;
  refreshBalances: (tokenAddress?: string) => Promise<void>;
}

export function useWallet(targetChainId?: number): UseWalletReturn {
  const [state, setState] = useState<WalletState>({
    status: 'disconnected',
    address: null,
    chainId: null,
    balance: null,
    tokenBalance: null,
    tokenSymbol: null,
    tokenDecimals: 18,
    provider: null,
  });

  const tokenAddressRef = useRef<string | undefined>();

  const updateState = useCallback((partial: Partial<WalletState>) => {
    setState(prev => ({ ...prev, ...partial }));
  }, []);

  const refreshBalances = useCallback(async (tokenAddress?: string) => {
    if (tokenAddress) tokenAddressRef.current = tokenAddress;
    const addr = tokenAddress || tokenAddressRef.current;
    if (!state.provider || !state.address) return;

    try {
      const ethBalance = await state.provider.getBalance(state.address);
      updateState({ balance: parseFloat(formatUnits(ethBalance, 18)).toFixed(4) });

      if (addr) {
        const tokenContract = new Contract(addr, ERC20_ABI, state.provider);
        const [bal, sym, dec] = await Promise.all([
          tokenContract.balanceOf(state.address),
          tokenContract.symbol().catch(() => 'TOKEN'),
          tokenContract.decimals().catch(() => 18),
        ]);
        updateState({
          tokenBalance: formatUnits(bal, dec),
          tokenSymbol: sym,
          tokenDecimals: dec,
        });
      }
    } catch {
      // ignore balance refresh errors
    }
  }, [state.provider, state.address, updateState]);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    updateState({ status: 'connecting' });

    try {
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      const network = await provider.getNetwork();

      const chainId = Number(network.chainId);
      const wrongNetwork = targetChainId !== undefined && chainId !== targetChainId;

      updateState({
        status: wrongNetwork ? 'wrong-network' : 'connected',
        address: accounts[0],
        chainId,
        provider,
      });

      await refreshBalances();
    } catch {
      updateState({ status: 'disconnected' });
    }
  }, [targetChainId, updateState, refreshBalances]);

  const switchNetwork = useCallback(async (chainId: number) => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        if (chainId === 31337) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x7a69',
              chainName: 'Localhost 8545',
              rpcUrls: ['http://127.0.0.1:8545'],
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            }],
          });
        }
      }
    }
  }, []);

  const disconnect = useCallback(() => {
    updateState({
      status: 'disconnected',
      address: null,
      chainId: null,
      balance: null,
      tokenBalance: null,
      tokenSymbol: null,
      provider: null,
    });
  }, [updateState]);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        updateState({ address: accounts[0] });
        refreshBalances();
      }
    };

    const handleChainChanged = (chainId: string) => {
      const newChainId = parseInt(chainId, 16);
      const wrongNetwork = targetChainId !== undefined && newChainId !== targetChainId;
      updateState({
        chainId: newChainId,
        status: wrongNetwork ? 'wrong-network' : 'connected',
      });
      refreshBalances();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    if (window.ethereum.selectedAddress) {
      connect();
    }

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, [connect, disconnect, refreshBalances, targetChainId]);

  return {
    ...state,
    connect,
    disconnect,
    switchNetwork,
    refreshBalances,
  };
}

declare global {
  interface Window {
    ethereum?: any;
  }
}
