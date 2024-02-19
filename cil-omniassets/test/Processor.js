const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
require("@nomicfoundation/hardhat-ethers");
const { expect } = require("chai");

const { randomBytes, randomInt } = require('crypto');
const { ethers } = require("hardhat");

// Generates a valid random bytes32 value
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
    const deadline = Math.floor(Date.now() / 1000) + deadlineOffset; // 1 hour from now

    const {opId, opHash} = generateOpIandHash(commands, deadline);

    // Calculate the total value to be permitted
    const totalValue = commands.reduce((sum, cmd) => sum + cmd.amount, 0);

    // Sign the message with the sender's private key
    const signature = await createPermitSignature(sender, sender.address, processor.target, totalValue, opHash);
    return {
        deadline: deadline,
        op_id: opId,
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
  
  
  function createTransferCommand(from, to, amount) {
    return {
      amount: amount,
      from,
      to
    };
  }
  
  
  function calculateOperationHash(commands, opId) {
    const coder = new ethers.AbiCoder();
    // Prepare the commands array in the format expected by the contract
    const formattedCommands = commands.map(cmd => [
        BigInt(cmd.amount), // Assuming amount is already a BigNumber or a similar object
        cmd.from,
        cmd.to
    ]);
  
    // Encode the opId and the commands array
    const encodedData = coder.encode(
        ["uint256", "tuple(uint256, address, address)[]"],
        [opId, formattedCommands]
    );
  
    // Compute the hash
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
    // Get the ContractFactories and Signers here.
    USDTMock = await ethers.getContractFactory("USDTToken");
    Processor = await ethers.getContractFactory("Processor");
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    // Deploy Mock USDT token
    usdt = await USDTMock.deploy();

    await usdt.mint(owner.address, 100000000);
    await usdt.mint(addr1.address, 10000);

    
    // Deploy Processor contract
    processor = await Processor.deploy(usdt.target);
    
  });

  describe("Deployment", function () {
    it("Should set target and permit token", async function () {
      expect(await processor.permitToken()).to.equal(usdt.target);
      expect(await processor.targetToken()).to.equal(usdt.target);
    });

    // Add more tests as needed
  });

  describe("Transactions", function () {
    // Write tests for your transactions

    it("Should transfer USDT tokens using the process method", async function () {
      const command = createTransferCommand(addr1.address, addr2.address, 100);
      const operation = await createTransferOperation(addr1, [command]);
      await processor.process([operation]);
      const calldata = processor.interface.encodeFunctionData("process", [[operation]]);
      expect(await usdt.balanceOf(addr2.address)).to.equal(100);
    });

    it("Should handle multiple commands in a single operation", async function () {
      // Arrange: Setup for multiple commands
      const transferAmount1 = 50;
      const transferAmount2 = 25;
      const addr3 = addrs[0]; // Third address from the signer array
      const commands = [
        createTransferCommand(addr1.address, addr2.address, transferAmount1),
        createTransferCommand(addr1.address, addr3.address, transferAmount2)
      ];
    
      // Act: Create the operation and process it
      const operation = await createTransferOperation(addr1, commands);
      await processor.process([operation]);
    
      // Assert: Validate the final balances
      const balanceAddr2After = await usdt.balanceOf(addr2.address);
      const balanceAddr3After = await usdt.balanceOf(addr3.address);
      expect(balanceAddr2After).to.equal(transferAmount1);
      expect(balanceAddr3After).to.equal(transferAmount2);
    });
    
    it("Should handle multiple operations in a single transaction", async function () {
      // Arrange: Setup for multiple operations
      const transferAmountOp1 = 40;
      const transferAmountOp2 = 10;
      const addr3 = addrs[0]; // An additional address for testing
      const commandOp1 = createTransferCommand(addr1.address, addr2.address, transferAmountOp1);
      const commandOp2 = createTransferCommand(addr2.address, addr3.address, transferAmountOp2);
    
      // Create two separate operations
      const operation1 = await createTransferOperation(addr1, [commandOp1]);
      const operation2 = await createTransferOperation(addr2, [commandOp2]);
    
      // Act: Process both operations in a single transaction
      await processor.process([operation1, operation2]);
    
      // Assert: Validate the final balances for both operations
      const balanceAddr2AfterOp1 = await usdt.balanceOf(addr2.address);
      const balanceAddr3AfterOp2 = await usdt.balanceOf(addr3.address);
      expect(balanceAddr2AfterOp1).to.equal(transferAmountOp1 - transferAmountOp2);
      expect(balanceAddr3AfterOp2).to.equal(transferAmountOp2);
    });
    
    it("Should fail for nonce reuse", async function () {
      const transferAmount = 100;
      const command = createTransferCommand(addr1.address, addr2.address, transferAmount);
      const operation = await createTransferOperation(addr1, [command]);
  
      await processor.process([operation]);
    
      // Trying to process the same operation again
      await expect(processor.process([operation]))
        .to.be.revertedWith("Nonce already used");
    });

    it("Should fail if the sender has insufficient balance", async function () {
      const transferAmount = 100000; // An amount greater than the sender's balance
      const command = createTransferCommand(addr1.address, addr2.address, transferAmount);
      const operation = await createTransferOperation(addr1, [command]);
    
      await expect(processor.process([operation]))
        .to.be.revertedWith("Insufficient balance"); // Replace with the actual error message
    });


    it("Should fail if the deadline is in the past", async function () {
      const transferAmount = 100;
      const command = createTransferCommand(addr1.address, addr2.address, transferAmount);
      // Create an operation with a past deadline
      const operation = await createTransferOperation(addr1, [command], -1000); 
    
      await expect(processor.process([operation]))
        .to.be.revertedWith("Deadline passed"); // Replace with the actual error message
    });
    

    it("Should fail if the signature is invalid", async function () {
      const transferAmount = 100;
      const command = createTransferCommand(addr1.address, addr2.address, transferAmount);
      const operation = await createTransferOperation( addr1, [command]);
      operation.signature = randomBytes(32);
    
      await expect(processor.process([operation]))
        .to.be.revertedWith("Invalid signature"); // Replace with the actual error message
    });
  
  });

  // ... additional tests ...
});