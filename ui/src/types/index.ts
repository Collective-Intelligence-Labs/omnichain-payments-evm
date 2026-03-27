export interface AssetTransfer {
  to: string;
  amount: bigint;
}

export interface Operation {
  deadline: number;
  op_id: bigint;
  from: string;
  commands: AssetTransfer[];
  signature: string;
}

export interface TransferInput {
  id: string;
  to: string;
  amount: string;
}

export interface TransactionRecord {
  hash: string;
  opId: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: number;
  transfers: TransferInput[];
}

export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  processorAddress: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
}

export type WalletStatus = 'disconnected' | 'connecting' | 'connected' | 'wrong-network';
