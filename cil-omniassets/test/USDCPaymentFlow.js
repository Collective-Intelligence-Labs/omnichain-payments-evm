const { expect } = require("chai");
const { randomBytes } = require('crypto');
const { ethers } = require("hardhat");

function getRandomBytes32() {
  return '0x' + randomBytes(32).toString('hex');
}

function parseUSDC(amount) {
  return ethers.parseUnits(amount.toString(), 6);
}

function formatUSDC(amount) {
  return ethers.formatUnits(amount, 6);
}

describe("USDC Payment Flow", function () {
  let USDCMock;
  let Processor;
  let usdc;
  let processor;
  let owner;
  let merchant;
  let customer1;
  let customer2;
  let customer3;
  let addrs;

  function createTransferCommand(from, to, amount) {
    return { amount, from, to };
  }

  function calculateOperationHash(commands, opId) {
    const coder = new ethers.AbiCoder();
    const formattedCommands = commands.map(cmd => [BigInt(cmd.amount), cmd.from, cmd.to]);
    const encodedData = coder.encode(
      ["uint256", "tuple(uint256, address, address)[]"],
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

  async function createPermitSignature(signer, owner, spender, value, deadline) {
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
      owner,
      spender,
      value,
      nonce: await usdc.nonces(owner),
      deadline,
    };
    return await signer.signTypedData(domain, types, values);
  }

  async function createTransferOperation(sender, commands, deadlineOffset = 3600) {
    const deadline = Math.floor(Date.now() / 1000) + deadlineOffset;
    const { opId, opHash } = generateOpIdAndHash(commands, deadline);
    const totalValue = commands.reduce((sum, cmd) => sum + BigInt(cmd.amount), BigInt(0));
    const signature = await createPermitSignature(sender, sender.address, processor.target, totalValue, opHash);
    return { deadline, op_id: opId, commands, signature };
  }

  beforeEach(async function () {
    USDCMock = await ethers.getContractFactory("USDCMock");
    Processor = await ethers.getContractFactory("Processor");
    [owner, merchant, customer1, customer2, customer3, ...addrs] = await ethers.getSigners();

    usdc = await USDCMock.deploy();

    await usdc.mint(owner.address, parseUSDC(1000000));
    await usdc.mint(merchant.address, parseUSDC(50000));
    await usdc.mint(customer1.address, parseUSDC(1000));
    await usdc.mint(customer2.address, parseUSDC(2500));
    await usdc.mint(customer3.address, parseUSDC(500));

    processor = await Processor.deploy(usdc.target);
  });

  describe("Token Setup", function () {
    it("Should deploy USDC with correct properties", async function () {
      expect(await usdc.name()).to.equal("USD Coin");
      expect(await usdc.symbol()).to.equal("USDC");
      expect(await usdc.decimals()).to.equal(6);
    });

    it("Should set correct initial balances", async function () {
      expect(await usdc.balanceOf(owner.address)).to.equal(parseUSDC(1000000));
      expect(await usdc.balanceOf(merchant.address)).to.equal(parseUSDC(50000));
      expect(await usdc.balanceOf(customer1.address)).to.equal(parseUSDC(1000));
      expect(await usdc.balanceOf(customer2.address)).to.equal(parseUSDC(2500));
      expect(await usdc.balanceOf(customer3.address)).to.equal(parseUSDC(500));
    });

    it("Should configure processor with USDC token", async function () {
      expect(await processor.targetToken()).to.equal(usdc.target);
      expect(await processor.permitToken()).to.equal(usdc.target);
    });
  });

  describe("E2E Payment Flow: Customer pays Merchant", function () {
    it("Customer pays merchant $50 USDC for goods", async function () {
      const command = createTransferCommand(customer1.address, merchant.address, parseUSDC(50));
      const operation = await createTransferOperation(customer1, [command]);

      await expect(processor.process([operation]))
        .to.emit(processor, "OperationProcessed")
        .withArgs(operation.op_id);

      expect(await usdc.balanceOf(customer1.address)).to.equal(parseUSDC(950));
      expect(await usdc.balanceOf(merchant.address)).to.equal(parseUSDC(50050));
    });

    it("Customer pays merchant for multiple items in one batch", async function () {
      const commands = [
        createTransferCommand(customer1.address, merchant.address, parseUSDC(25)),
        createTransferCommand(customer1.address, merchant.address, parseUSDC(10)),
        createTransferCommand(customer1.address, merchant.address, parseUSDC(5)),
      ];
      const operation = await createTransferOperation(customer1, commands);

      await processor.process([operation]);

      expect(await usdc.balanceOf(customer1.address)).to.equal(parseUSDC(960));
      expect(await usdc.balanceOf(merchant.address)).to.equal(parseUSDC(50040));
    });
  });

  describe("E2E Payment Flow: Split payments", function () {
    it("Customer splits payment to merchant and a service provider", async function () {
      const serviceProvider = addrs[0];
      const commands = [
        createTransferCommand(customer2.address, merchant.address, parseUSDC(100)),
        createTransferCommand(customer2.address, serviceProvider.address, parseUSDC(50)),
      ];
      const operation = await createTransferOperation(customer2, commands);

      await processor.process([operation]);

      expect(await usdc.balanceOf(customer2.address)).to.equal(parseUSDC(2350));
      expect(await usdc.balanceOf(merchant.address)).to.equal(parseUSDC(50100));
      expect(await usdc.balanceOf(serviceProvider.address)).to.equal(parseUSDC(50));
    });

    it("Multiple customers pay the same merchant in one transaction", async function () {
      const op1Command = createTransferCommand(customer1.address, merchant.address, parseUSDC(100));
      const op1 = await createTransferOperation(customer1, [op1Command]);

      const op2Command = createTransferCommand(customer2.address, merchant.address, parseUSDC(200));
      const op2 = await createTransferOperation(customer2, [op2Command]);

      const op3Command = createTransferCommand(customer3.address, merchant.address, parseUSDC(50));
      const op3 = await createTransferOperation(customer3, [op3Command]);

      await processor.process([op1, op2, op3]);

      expect(await usdc.balanceOf(customer1.address)).to.equal(parseUSDC(900));
      expect(await usdc.balanceOf(customer2.address)).to.equal(parseUSDC(2300));
      expect(await usdc.balanceOf(customer3.address)).to.equal(parseUSDC(450));
      expect(await usdc.balanceOf(merchant.address)).to.equal(parseUSDC(50350));
    });
  });

  describe("E2E Payment Flow: Multi-step marketplace scenario", function () {
    it("Marketplace flow: buyer pays seller, marketplace takes fee", async function () {
      const marketplace = owner;
      const seller = addrs[0];
      await usdc.mint(seller.address, parseUSDC(100));

      const buyer = customer1;
      const itemPrice = parseUSDC(100);
      const marketplaceFee = parseUSDC(5);

      await usdc.mint(buyer.address, parseUSDC(500));

      const sellerPayout = itemPrice - marketplaceFee;

      const commands = [
        createTransferCommand(buyer.address, seller.address, sellerPayout),
        createTransferCommand(buyer.address, marketplace.address, marketplaceFee),
      ];
      const operation = await createTransferOperation(buyer, commands);

      await processor.process([operation]);

      expect(await usdc.balanceOf(buyer.address)).to.equal(parseUSDC(1400));
      expect(await usdc.balanceOf(seller.address)).to.equal(parseUSDC(195));
      expect(await usdc.balanceOf(marketplace.address)).to.equal(parseUSDC(1000005));
    });

    it("Payroll flow: employer pays multiple employees in batch", async function () {
      const employer = merchant;
      const employees = [customer1, customer2, customer3, addrs[0], addrs[1]];

      const salaries = [parseUSDC(3000), parseUSDC(4500), parseUSDC(2000), parseUSDC(5000), parseUSDC(3500)];
      const totalPayroll = salaries.reduce((sum, s) => sum + s, BigInt(0));

      await usdc.mint(employer.address, totalPayroll + parseUSDC(50000));

      const commands = employees.map((emp, i) =>
        createTransferCommand(employer.address, emp.address, salaries[i])
      );

      const operation = await createTransferOperation(employer, commands);
      await processor.process([operation]);

      const expectedBalances = [parseUSDC(4000), parseUSDC(7000), parseUSDC(2500), parseUSDC(5000), parseUSDC(3500)];
      for (let i = 0; i < employees.length; i++) {
        expect(await usdc.balanceOf(employees[i].address)).to.equal(expectedBalances[i]);
      }
    });
  });

  describe("Replay protection and security", function () {
    it("Should prevent replay of the same operation", async function () {
      const command = createTransferCommand(customer1.address, merchant.address, parseUSDC(10));
      const operation = await createTransferOperation(customer1, [command]);

      await processor.process([operation]);

      await expect(processor.process([operation]))
        .to.be.revertedWith("Nonce already used");

      expect(await usdc.balanceOf(customer1.address)).to.equal(parseUSDC(990));
      expect(await usdc.balanceOf(merchant.address)).to.equal(parseUSDC(50010));
    });

    it("Should prevent tampered amounts", async function () {
      const command = createTransferCommand(customer1.address, merchant.address, parseUSDC(10));
      const operation = await createTransferOperation(customer1, [command]);

      operation.commands[0].amount = parseUSDC(1000);

      await expect(processor.process([operation]))
        .to.be.reverted;
    });

    it("Should prevent tampered recipient", async function () {
      const attacker = addrs[0];
      const command = createTransferCommand(customer1.address, merchant.address, parseUSDC(10));
      const operation = await createTransferOperation(customer1, [command]);

      operation.commands[0].to = attacker.address;

      await expect(processor.process([operation]))
        .to.be.reverted;
    });

    it("Should fail if sender has insufficient USDC balance", async function () {
      const command = createTransferCommand(customer3.address, merchant.address, parseUSDC(1000));
      const operation = await createTransferOperation(customer3, [command]);

      await expect(processor.process([operation]))
        .to.be.revertedWith("Insufficient balance");
    });

    it("Should fail with expired deadline", async function () {
      const command = createTransferCommand(customer1.address, merchant.address, parseUSDC(10));
      const operation = await createTransferOperation(customer1, [command], -3600);

      await expect(processor.process([operation]))
        .to.be.revertedWith("Deadline passed");
    });

    it("Should fail with forged signature", async function () {
      const command = createTransferCommand(customer1.address, merchant.address, parseUSDC(10));
      const operation = await createTransferOperation(customer1, [command]);

      operation.signature = randomBytes(65);

      await expect(processor.process([operation]))
        .to.be.reverted;
    });
  });

  describe("Operation hash computation", function () {
    it("Should compute the same hash on-chain and off-chain", async function () {
      const commands = [
        createTransferCommand(customer1.address, merchant.address, parseUSDC(100)),
        createTransferCommand(customer1.address, addrs[0].address, parseUSDC(50)),
      ];
      const { opId } = generateOpIdAndHash(commands, Math.floor(Date.now() / 1000) + 3600);
      const offChainHash = calculateOperationHash(commands, opId);
      const onChainHash = await processor.calculateOperationHash(commands, opId);

      expect(offChainHash).to.equal(onChainHash);
    });

    it("Different op IDs produce different hashes", async function () {
      const commands = [
        createTransferCommand(customer1.address, merchant.address, parseUSDC(100)),
      ];

      const hash1 = calculateOperationHash(commands, BigInt(1));
      const hash2 = calculateOperationHash(commands, BigInt(2));

      expect(hash1).to.not.equal(hash2);
    });
  });

  describe("Events", function () {
    it("Should emit CommandProcessed for each transfer", async function () {
      const commands = [
        createTransferCommand(customer1.address, merchant.address, parseUSDC(100)),
        createTransferCommand(customer1.address, addrs[0].address, parseUSDC(50)),
      ];
      const operation = await createTransferOperation(customer1, commands);

      const tx = await processor.process([operation]);
      const receipt = await tx.wait();

      const commandProcessedEvents = receipt.logs
        .map(log => {
          try { return processor.interface.parseLog(log); } catch { return null; }
        })
        .filter(e => e && e.name === "CommandProcessed");

      expect(commandProcessedEvents).to.have.length(2);
      expect(commandProcessedEvents[0].args.from).to.equal(customer1.address);
      expect(commandProcessedEvents[0].args.to).to.equal(merchant.address);
      expect(commandProcessedEvents[0].args.amount).to.equal(parseUSDC(100));
      expect(commandProcessedEvents[1].args.from).to.equal(customer1.address);
      expect(commandProcessedEvents[1].args.to).to.equal(addrs[0].address);
      expect(commandProcessedEvents[1].args.amount).to.equal(parseUSDC(50));
    });

    it("Should emit OperationProcessed with correct op_id", async function () {
      const command = createTransferCommand(customer1.address, merchant.address, parseUSDC(10));
      const operation = await createTransferOperation(customer1, [command]);

      await expect(processor.process([operation]))
        .to.emit(processor, "OperationProcessed")
        .withArgs(operation.op_id);
    });
  });
});
