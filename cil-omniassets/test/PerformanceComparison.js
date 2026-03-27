const { expect } = require("chai");
const { randomBytes } = require("crypto");
const { ethers } = require("hardhat");

function getRandomBytes32() {
  return "0x" + randomBytes(32).toString("hex");
}

function parseUSDC(amount) {
  return ethers.parseUnits(amount.toString(), 6);
}

describe("Performance Comparison: Omnichain vs Regular USD Transfers", function () {
  let USDCMock;
  let Processor;
  let usdc;
  let processor;
  let owner;
  let sender;
  let spender;
  let allAddrs;

  const BATCH_SIZES = [5, 10, 100, 1000];
  const TRANSFER_AMOUNT = parseUSDC(100);

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

  async function createTransferOperation(commands, deadlineOffset = 3600) {
    const deadline = Math.floor(Date.now() / 1000) + deadlineOffset;
    const { opId, opHash } = generateOpIdAndHash(commands, deadline);
    const totalValue = commands.reduce(
      (sum, cmd) => sum + BigInt(cmd.amount),
      BigInt(0)
    );
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
      owner: sender.address,
      spender: processor.target,
      value: totalValue,
      nonce: await usdc.nonces(sender.address),
      deadline: opHash,
    };
    const signature = await sender.signTypedData(domain, types, values);
    return { deadline, op_id: opId, from: sender.address, commands, signature };
  }

  async function measureGasUsage(txPromise) {
    const tx = await txPromise;
    const receipt = await tx.wait();
    return receipt.gasUsed;
  }

  function getRecipient(index) {
    return allAddrs[(index % (allAddrs.length - 3)) + 3];
  }

  async function measureRegularTransferGas(numTransfers) {
    const approveGas = await measureGasUsage(
      usdc.connect(sender).approve(spender.address, TRANSFER_AMOUNT * BigInt(numTransfers))
    );

    const transferGasList = [];
    for (let i = 0; i < numTransfers; i++) {
      const recipient = getRecipient(i);
      const gas = await measureGasUsage(
        usdc
          .connect(spender)
          .transferFrom(sender.address, recipient.address, TRANSFER_AMOUNT)
      );
      transferGasList.push(gas);
    }

    const totalTransferGas = transferGasList.reduce(
      (sum, g) => sum + BigInt(g),
      BigInt(0)
    );

    return {
      approveGas: BigInt(approveGas),
      totalTransferGas,
      avgTransferGas: totalTransferGas / BigInt(numTransfers),
      totalGas: BigInt(approveGas) + totalTransferGas,
      numApproveTxs: 1,
      numTransferTxs: numTransfers,
      totalTransactions: 1 + numTransfers,
    };
  }

  async function measureOmnichainTransferGas(numTransfers) {
    const commands = [];
    for (let i = 0; i < numTransfers; i++) {
      const recipient = getRecipient(i);
      commands.push(createTransferCommand(recipient.address, TRANSFER_AMOUNT));
    }

    const operation = await createTransferOperation(commands);
    const gas = await measureGasUsage(processor.process([operation]));

    return {
      totalGas: BigInt(gas),
      totalTransactions: 1,
    };
  }

  beforeEach(async function () {
    USDCMock = await ethers.getContractFactory("USDCMock");
    Processor = await ethers.getContractFactory("Processor");
    [owner, sender, spender, ...allAddrs] = await ethers.getSigners();

    usdc = await USDCMock.deploy();
    processor = await Processor.deploy(usdc.target);
  });

  BATCH_SIZES.forEach((batchSize) => {
    describe(`${batchSize} transfer(s)`, function () {
      let regularResult;
      let omnichainResult;

      beforeEach(async function () {
        await usdc.mint(sender.address, TRANSFER_AMOUNT * BigInt(batchSize * 2 + 10));

        regularResult = await measureRegularTransferGas(batchSize);
        omnichainResult = await measureOmnichainTransferGas(batchSize);
      });

      it(`Omnichain (${batchSize} transfer(s)) should use less gas than regular approach`, async function () {
        console.log(`\n  === ${batchSize} USDC Transfer(s) @ $${ethers.formatUnits(TRANSFER_AMOUNT, 6)} each ===`);
        console.log(`  Regular approach (approve + transferFrom):`);
        console.log(`    Approve tx gas:        ${regularResult.approveGas.toString().padStart(10)} gas`);
        console.log(`    Transfer tx(s) gas:     ${regularResult.totalTransferGas.toString().padStart(10)} gas (${regularResult.numTransferTxs} tx(s), avg ${regularResult.avgTransferGas.toString()} gas/tx)`);
        console.log(`    Total gas:              ${regularResult.totalGas.toString().padStart(10)} gas`);
        console.log(`    Total transactions:     ${regularResult.totalTransactions}`);
        console.log(`  Omnichain approach (batch process with off-chain permit):`);
        console.log(`    Batch process gas:      ${omnichainResult.totalGas.toString().padStart(10)} gas (1 tx for ${batchSize} transfer(s))`);
        console.log(`    Total transactions:     ${omnichainResult.totalTransactions}`);
        console.log(`  ---`);
        const gasSaved = regularResult.totalGas - omnichainResult.totalGas;
        const percentSaved = Number((BigInt(gasSaved) * BigInt(10000)) / regularResult.totalGas) / 100;
        const txReduction = regularResult.totalTransactions - omnichainResult.totalTransactions;
        console.log(`    Gas saved:              ${gasSaved.toString().padStart(10)} gas (${percentSaved.toFixed(2)}%)`);
        console.log(`    Transaction reduction:  ${txReduction} fewer on-chain transactions`);
        console.log(`    Gas per transfer:`);
        console.log(`      Regular:   ${regularResult.avgTransferGas.toString()} gas/transfer`);
        console.log(`      Omnichain: ${(omnichainResult.totalGas / BigInt(batchSize)).toString()} gas/transfer`);

        expect(omnichainResult.totalGas).to.be.lessThan(regularResult.totalGas);
      });
    });
  });

  describe("Batch Size Limit", function () {
    this.timeout(300000);

    it("Binary searches for maximum batch size that fits in a single transaction", async function () {
      await usdc.mint(sender.address, parseUSDC(100) * BigInt(100000));

      let low = 1000;
      let high = 5000;
      let lastSuccess = 0;
      let lastSuccessGas = BigInt(0);
      const results = [];

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        try {
          const commands = [];
          for (let i = 0; i < mid; i++) {
            const recipient = getRecipient(i);
            commands.push(createTransferCommand(recipient.address, TRANSFER_AMOUNT));
          }

          const operation = await createTransferOperation(commands);
          const gas = await measureGasUsage(processor.process([operation]));

          lastSuccess = mid;
          lastSuccessGas = BigInt(gas);
          const gasPerTransfer = (BigInt(gas) / BigInt(mid)).toString();
          results.push({ batch: mid, gas: gas.toString(), gasPerTransfer });
          console.log(`  ✓ ${mid} transfers: ${Number(gas).toLocaleString()} gas (${gasPerTransfer} gas/transfer)`);
          low = mid + 1;
        } catch (e) {
          const errMsg = e.message || e.reason || String(e);
          console.log(`  ✗ ${mid} transfers: FAILED — ${errMsg.substring(0, 120)}`);
          high = mid - 1;
        }
      }

      const HARDFORK_GAS_CAP = 16777216;
      const MAINNET_BLOCK_GAS = 30000000;
      const gasPerTransfer = lastSuccess > 0 ? Number(lastSuccessGas / BigInt(lastSuccess)) : 0;
      const theoreticalMainnetMax = Math.floor(MAINNET_BLOCK_GAS / gasPerTransfer);

      console.log("\n  ┌─────────────────────────────────────────────────────────────────┐");
      console.log("  │            BATCH SIZE LIMIT — BINARY SEARCH RESULTS            │");
      console.log("  ├──────────────┬──────────────────┬───────────────────────────────┤");
      console.log("  │  # Transfers │     Total Gas    │     Gas per Transfer          │");
      console.log("  ├──────────────┼──────────────────┼───────────────────────────────┤");
      for (const r of results) {
        console.log(
          `  │  ${String(r.batch).padStart(10)}  │  ${Number(r.gas).toLocaleString().padStart(12)}  │  ${Number(r.gasPerTransfer).toLocaleString().padStart(12)}  │`
        );
      }
      console.log("  ├──────────────┼──────────────────┼───────────────────────────────┤");
      console.log(`  │  MAX: ${String(lastSuccess).padStart(5)} │  ${Number(lastSuccessGas.toString()).toLocaleString().padStart(12)}  │  ${gasPerTransfer.toLocaleString().padStart(12)}  │`);
      console.log("  └──────────────┴──────────────────┴───────────────────────────────┘");
      console.log(`\n  Constraint: Hardhat EVM tx gas cap = 16,777,216 (2^24)`);
      console.log(`  Maximum batch (Hardhat):   ${lastSuccess} transfers in 1 tx`);
      console.log(`  Gas utilization:           ${Number(lastSuccessGas).toLocaleString()} / 16,777,216 (${(Number(lastSuccessGas) / HARDFORK_GAS_CAP * 100).toFixed(1)}%)`);
      console.log(`  Theoretical max (mainnet): ~${theoreticalMainnetMax} transfers (30M block gas limit)`);
      console.log(`  Gas per transfer at max:   ${gasPerTransfer.toLocaleString()} gas\n`);

      expect(lastSuccess).to.be.greaterThan(1000);
    });
  });

  describe("Summary Report", function () {
    it("Prints full comparison summary across all batch sizes", async function () {
      console.log("\n");
      console.log("╔════════════════════════════════════════════════════════════════════════════════╗");
      console.log("║        OMNICHAIN vs REGULAR USD TRANSFER — GAS PERFORMANCE COMPARISON        ║");
      console.log("╠══════════╦══════════════╦════════════════╦════════════════╦═══════════╦═══════╣");
      console.log("║ # Trnsf ║  Regular Gas  ║  Omnichain Gas ║    Gas Saved    ║  Savings  ║  Txns ║");
      console.log("╠══════════╬══════════════╬════════════════╬════════════════╬═══════════╬═══════╣");

      for (const batchSize of BATCH_SIZES) {
        await usdc.mint(sender.address, TRANSFER_AMOUNT * BigInt(batchSize * 2 + 10));

        const regular = await measureRegularTransferGas(batchSize);
        const omnichain = await measureOmnichainTransferGas(batchSize);

        const gasSaved = regular.totalGas - omnichain.totalGas;
        const percentSaved = Number((BigInt(gasSaved) * BigInt(10000)) / regular.totalGas) / 100;
        const txSavings = regular.totalTransactions - omnichain.totalTransactions;

        const fmtNum = (n) => Number(n).toLocaleString().padStart(14);
        console.log(
          `║  ${String(batchSize).padEnd(6)} ║${fmtNum(regular.totalGas)} ║${fmtNum(omnichain.totalGas)} ║${fmtNum(gasSaved)} ║ ${percentSaved.toFixed(1).padStart(5)}%  ║  -${String(txSavings).padStart(2)}  ║`
        );
      }

      console.log("╚══════════╩══════════════╩════════════════╩════════════════╩═══════════╩═══════╝");
      console.log("  Regular:   1 approve tx + N transferFrom txs = N+1 on-chain txs");
      console.log("  Omnichain: 1 process tx with off-chain EIP-2612 permit = 1 on-chain tx");
      console.log("  Gas estimates based on Hardhat local network. Actual mainnet costs may vary.\n");

      expect(true).to.be.true;
    });
  });
});
