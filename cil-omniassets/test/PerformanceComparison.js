const { expect } = require("chai");
const { randomBytes } = require("crypto");
const { ethers } = require("hardhat");

function getRandomBytes32() {
  return "0x" + randomBytes(32).toString("hex");
}

function parseUSDC(amount) {
  return ethers.parseUnits(amount.toString(), 6);
}

describe("Performance: Omnichain Batch Transfer vs Regular Transfer", function () {
  let USDCMock;
  let Processor;
  let usdc;
  let processor;
  let owner;
  let sender;
  let addrs;

  function createTransferCommand(to, amount) {
    return { to, amount };
  }

  function calculateOperationHash(commands, opId) {
    const coder = new ethers.AbiCoder();
    const formattedCommands = commands.map((cmd) => [
      cmd.to,
      BigInt(cmd.amount),
    ]);
    const encodedData = coder.encode(
      ["uint256", "tuple(address, uint256)[]"],
      [opId, formattedCommands]
    );
    return ethers.keccak256(encodedData);
  }

  function generateOpIdAndHash(commands, deadlineMin) {
    let opHash = BigInt(0);
    let opId = BigInt(0);
    while (opHash < deadlineMin) {
      opId = BigInt(getRandomBytes32());
      opHash = calculateOperationHash(commands, opId);
    }
    return { opId, opHash };
  }

  async function createPermitSignature(signer, ownerAddr, spender, value, deadline) {
    const domain = {
      name: await usdc.name(),
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: usdc.target,
    };
    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
    const values = {
      owner: ownerAddr,
      spender,
      value,
      nonce: await usdc.nonces(ownerAddr),
      deadline,
    };
    return await signer.signTypedData(domain, types, values);
  }

  async function createTransferOperation(senderSigner, commands, deadlineOffset = 3600) {
    const deadline = Math.floor(Date.now() / 1000) + deadlineOffset;
    const { opId, opHash } = generateOpIdAndHash(commands, deadline);
    const totalValue = commands.reduce(
      (sum, cmd) => sum + BigInt(cmd.amount),
      BigInt(0)
    );
    const signature = await createPermitSignature(
      senderSigner,
      senderSigner.address,
      processor.target,
      totalValue,
      opHash
    );
    return { deadline, op_id: opId, from: senderSigner.address, commands, signature };
  }

  function formatGas(gasUsed) {
    return gasUsed.toLocaleString();
  }

  function printComparisonTable(results) {
    console.log("\n");
    console.log(
      "=".repeat(100)
    );
    console.log(
      "  PERFORMANCE COMPARISON: Omnichain Batch Transfer vs Regular USD Transfer"
    );
    console.log(
      "=".repeat(100)
    );
    console.log(
      "| Transfers | Regular Gas | Omnichain Gas | Gas Saved  | Savings % |"
    );
    console.log(
      "|-----------|-------------|---------------|------------|-----------|"
    );
    for (const r of results) {
      const savings = r.regularGas - r.omnichainGas;
      const pct = ((savings / r.regularGas) * 100).toFixed(1);
      console.log(
        `| ${String(r.transfers).padEnd(9)} | ${formatGas(r.regularGas).padEnd(11)} | ${formatGas(r.omnichainGas).padEnd(13)} | ${formatGas(savings).padEnd(10)} | ${pct.padStart(6)}%   |`
      );
    }
    console.log(
      "=".repeat(100)
    );
    console.log(
      "  Regular: individual transfer() calls, one transaction per transfer"
    );
    console.log(
      "  Omnichain: single process() call with batched EIP-2612 permit transfers"
    );
    console.log(
      "=".repeat(100)
    );
    console.log("\n");
  }

  const TRANSFER_AMOUNT = parseUSDC(100);
  const TRANSFER_COUNTS = [1, 3, 5, 10];

  beforeEach(async function () {
    USDCMock = await ethers.getContractFactory("USDCMock");
    Processor = await ethers.getContractFactory("Processor");
    [owner, sender, ...addrs] = await ethers.getSigners();

    usdc = await USDCMock.deploy();
    const totalNeeded = TRANSFER_AMOUNT * BigInt(TRANSFER_COUNTS[TRANSFER_COUNTS.length - 1]) * BigInt(3);
    await usdc.mint(sender.address, parseUSDC(1000000) + totalNeeded);
    for (const addr of addrs) {
      await usdc.mint(addr.address, parseUSDC(1000));
    }

    processor = await Processor.deploy(usdc.target);
  });

  describe("Gas cost comparison", function () {
    const results = [];

    for (const count of TRANSFER_COUNTS) {
      it(`Compare gas costs for ${count} transfer(s)`, async function () {
        const recipientAddrs = addrs.slice(0, count);
        const totalAmount = TRANSFER_AMOUNT * BigInt(count);

        const omnichainCommands = recipientAddrs.map((r) =>
          createTransferCommand(r.address, TRANSFER_AMOUNT)
        );
        const omnichainOperation = await createTransferOperation(
          sender,
          omnichainCommands
        );

        const omnichainTx = await processor.process([omnichainOperation]);
        const omnichainReceipt = await omnichainTx.wait();
        const omnichainGas = omnichainReceipt.gasUsed;

        const freshSender = addrs[addrs.length - 1];
        await usdc.mint(freshSender.address, totalAmount);

        let regularGas = BigInt(0);
        for (let i = 0; i < count; i++) {
          const transferTx = await usdc
            .connect(freshSender)
            .transfer(recipientAddrs[i].address, TRANSFER_AMOUNT);
          const transferReceipt = await transferTx.wait();
          regularGas += transferReceipt.gasUsed;
        }

        results.push({
          transfers: count,
          regularGas: Number(regularGas),
          omnichainGas: Number(omnichainGas),
        });

        const savings = regularGas - omnichainGas;
        const pct = ((Number(savings) / Number(regularGas)) * 100).toFixed(1);
        console.log(
          `  [${count} transfer(s)] Regular: ${formatGas(Number(regularGas))} gas | Omnichain: ${formatGas(Number(omnichainGas))} gas | Saved: ${formatGas(Number(savings))} gas (${pct}%)`
        );
      });
    }

    after(function () {
      printComparisonTable(results);
    });
  });
});
