const {
    time,
    loadFixture,
  } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
  const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
  require("@nomicfoundation/hardhat-ethers");
  const { expect } = require("chai");
  
  const { randomBytes, randomInt } = require('crypto');
  const { ethers } = require("hardhat");
  
  function getRandomBytes32() {
    return '0x' + randomBytes(32).toString('hex');
  }
  
  describe("Processor Contract", function () {
    let USDTMock;
    let Processor;
    let usdt;
    let processor;
    let owner;
    let addr1;
    let addr2;
    let addrs;
  
    async function createTransferOperation(sender, commands, deadlineOffset = 3600) {
      const deadline = Math.floor(Date.now() / 1000) + deadlineOffset;
      const {opId, opHash} = generateOpIandHash(commands, deadline);
      const totalValue = commands.reduce((sum, cmd) => sum + cmd.amount, 0);
      const signature = await createPermitSignature(sender, sender.address, processor.target, totalValue, opHash);
      return {
          deadline: deadline,
          op_id: opId,
          from: sender.address,
          commands: commands,
          signature: signature 
      };
  }
    
    async function createPermitSignature(signer, owner, spender, value, deadline) {
      const domain = {
          name: await usdt.name(),
          version: "1",
          chainId: (await ethers.provider.getNetwork()).chainId,
          verifyingContract: usdt.target,
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
          nonce: await usdt.nonces(owner),
          deadline,
      };
    
      return await signer.signTypedData(domain, types, values);
    }
    
    
    function createTransferCommand(to, amount) {
      return { to, amount };
    }
    
    
    function calculateOperationHash(commands, opId) {
      const coder = new ethers.AbiCoder();
      const formattedCommands = commands.map(cmd => [
          cmd.to,
          BigInt(cmd.amount),
      ]);
      const encodedData = coder.encode(
          ["uint256", "tuple(address, uint256)[]"],
          [opId, formattedCommands]
      );
      return ethers.keccak256(encodedData);
    }
  
    
    function generateOpIandHash(commands, deadlineMin)
    {
      let opHash = BigInt(0);
      let opId = BigInt(0);
      while (opHash < deadlineMin)
      {
         opId = BigInt(getRandomBytes32());
         opHash = calculateOperationHash(commands, opId);
      }
      return {opId, opHash};
    }
  
    beforeEach(async function () {
      USDTMock = await ethers.getContractFactory("USDTToken");
      Processor = await ethers.getContractFactory("Processor");
      [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
  
      usdt = await USDTMock.deploy();
      await usdt.mint(owner.address, 100000000);
      await usdt.mint(addr1.address, 10000);
      for (let index = 0; index < addrs.length; index++) {
        await usdt.mint(addrs[index].address, 999999999999);
      }
      processor = await Processor.deploy(usdt.target);
    });
  
    describe("Transactions", function () {

      it("Should handle 100 operations in a single transaction", async function () {
        let operations = [];
        for (let i = 0; i < addrs.length; i++) {
          const transferAmount = 1;
          const sender = addrs[i % addrs.length];
          const command = createTransferCommand(addrs[(i + 1) % addrs.length].address, transferAmount);
          const operation = await createTransferOperation(sender, [command]);
          operations.push(operation);
        }
        await processor.process(operations);
      });

      it("Should handle N operations in a single transaction", async function () {
        this.timeout(120000);
        const createAndAddOperation = async (acc, sender, recipient, transferAmount, index) => {
          const command = createTransferCommand(recipient.address, transferAmount);
          const operation = await createTransferOperation(sender, [command], 3600);
          acc.push(operation);
          return acc;
        };
        const operations = await addrs.reduce(async (promiseAcc, sender, index) => {
          const acc = await promiseAcc;
          const recipient = owner;
          const transferAmount = 1;
          return createAndAddOperation(acc, sender, recipient, transferAmount, index);
        }, Promise.resolve([]));
        await processor.process(operations);
      });
    });
  });
