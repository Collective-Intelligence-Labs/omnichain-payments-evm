import { AbiCoder, keccak256, BrowserProvider, Contract, randomBytes } from 'ethers';
import { PROCESSOR_ABI, ERC20_ABI } from './contracts';
import type { AssetTransfer, Operation } from '../types';

const coder = new AbiCoder();

function getRandomBytes32(): bigint {
  return BigInt('0x' + randomBytes(32).slice(2));
}

export function calculateOperationHash(commands: AssetTransfer[], opId: bigint): string {
  const formattedCommands = commands.map(cmd => [cmd.to, cmd.amount]);
  const encodedData = coder.encode(
    ['uint256', 'tuple(address, uint256)[]'],
    [opId, formattedCommands]
  );
  return keccak256(encodedData);
}

export function generateOpIdAndHash(commands: AssetTransfer[], deadlineMin: number): { opId: bigint; opHash: bigint } {
  let opHash = BigInt(0);
  let opId = BigInt(0);
  let attempts = 0;
  while (opHash < BigInt(deadlineMin) && attempts < 100) {
    opId = getRandomBytes32();
    opHash = BigInt(calculateOperationHash(commands, opId));
    attempts++;
  }
  if (opHash < BigInt(deadlineMin)) {
    throw new Error('Failed to generate valid op_id after 100 attempts');
  }
  return { opId, opHash };
}

export async function createPermitSignature(
  signer: any,
  owner: string,
  spender: string,
  value: bigint,
  deadline: bigint,
  tokenContract: Contract
): Promise<string> {
  const domain = {
    name: await tokenContract.name(),
    version: '1',
    chainId: (await signer.provider?.getNetwork())?.chainId,
    verifyingContract: await tokenContract.getAddress(),
  };

  const nonce = await tokenContract.nonces(owner);

  const types = {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  };

  const values = {
    owner,
    spender,
    value,
    nonce,
    deadline: Number(deadline),
  };

  return await signer.signTypedData(domain, types, values);
}

export async function buildAndSendOperation(
  signer: any,
  processorAddress: string,
  tokenAddress: string,
  from: string,
  commands: AssetTransfer[]
): Promise<{ txHash: string; opId: bigint }> {
  const provider = signer.provider;
  const processorContract = new Contract(processorAddress, PROCESSOR_ABI, signer);
  const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);

  const deadlineOffset = 3600;
  const deadline = Math.floor(Date.now() / 1000) + deadlineOffset;

  const { opId, opHash } = generateOpIdAndHash(commands, deadline);

  const totalValue = commands.reduce((sum, cmd) => sum + cmd.amount, BigInt(0));

  const signature = await createPermitSignature(
    signer,
    from,
    await processorContract.getAddress(),
    totalValue,
    opHash,
    tokenContract
  );

  const operation: Operation = {
    deadline,
    op_id: opId,
    from,
    commands,
    signature,
  };

  const tx = await processorContract.process([operation]);
  const receipt = await tx.wait();

  return {
    txHash: receipt.hash,
    opId,
  };
}

export function shortenAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
