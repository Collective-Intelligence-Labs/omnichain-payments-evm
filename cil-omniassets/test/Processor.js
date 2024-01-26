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

async function createTransferOperation(sender, commands, opId, deadlineOffset = 1000) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineOffset);
  const cmdTypes = commands.map(() => 1); 

  // Sign the message with the sender's private key
  const signature = await createSignature(sender, deadline, opId, commands, cmdTypes);
  
  return {
    deadline: deadline,
    op_id: opId,
    portal: sender.address,
    commands: commands,
    cmd_types: commands.map(() => 1), // Assuming 1 is the type for a simple transfer
    signatures: [signature] // Mocked or calculated signatures
  };
} 

async function createSignature(sender, deadline, opId, commands, cmdTypes ){
  const packedData = encodeDataForSignature(deadline, opId, sender.address, commands, cmdTypes);
  const dataHash = ethers.keccak256(packedData);

  const signature = await sender.signMessage(dataHash);
  return signature;
}

function createTransferCommand(from, to, amount) {
  return {
    amount: amount,
    from,
    to
  };
}

function encodeDataForSignature(deadline, opId, portal, commands, cmdTypes) {
  // Encoding commands separately
  const coder = new ethers.AbiCoder();

  const encodedCommands = coder.encode(
    ["tuple(uint256 amount, address from, address to)[]"],
    [commands]
  );

  // Concatenating all parts as in Solidity's abi.encodePacked
  const packedData = coder.encode(
    ["uint256", "uint256", "address", "bytes", "uint256[]"],
    [deadline, opId, portal, encodedCommands, cmdTypes]
  );

  return packedData;
}

describe("Processor Contract", function () {
  let USDTMock;
  let OwnableERC20Token;
  let Processor;
  let usdt;
  let ownableToken;
  let processor;
  let owner;
  let addr1;
  let addr2;
  let addrs;

  

  beforeEach(async function () {
    // Get the ContractFactories and Signers here.
    USDTMock = await ethers.getContractFactory("USDTToken");
    OwnableERC20Token = await ethers.getContractFactory("OwnableERC20Token");
    Processor = await ethers.getContractFactory("Processor");
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    // Deploy Mock USDT token
    usdt = await USDTMock.deploy();

    await usdt.mint(owner.address, 100000000);
    await usdt.mint(addr1.address, 10000);

    // Deploy OwnableERC20Token with 0 initial supply
    ownableToken = await OwnableERC20Token.deploy(0);

    await ownableToken.mint(addr1.address, 10000);
    
    // Deploy Processor contract
    processor = await Processor.deploy(usdt.target, ownableToken.target);
    
    ownableToken.transferOwnership(processor.target);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await ownableToken.owner()).to.equal(processor.target);
    });

    // Add more tests as needed
  });

  describe("Transactions", function () {
    // Write tests for your transactions


    it("Should transfer USDT tokens using the process method", async function () {
      const transferAmount = 100;
      const command = createTransferCommand(addr1.address, addr2.address, transferAmount);
      const operation = await createTransferOperation(addr1, [command], 1);
    
      await processor.process([operation]);
    
      const balanceAfter = await ownableToken.balanceOf(addr2.address);
      expect(balanceAfter).to.equal(transferAmount);
    });
    

    it("Should process multiple transfer commands", async function () {
      const transferAmount1 = BigInt(10);
      const transferAmount2 = BigInt(5);
      const balance1 = await ownableToken.balanceOf(addr1.address);
      const balance2 = await ownableToken.balanceOf(addr2.address);
      const command1 = createTransferCommand(addr1.address, addr2.address, transferAmount1);
      const command2 = createTransferCommand(addr2.address, addr1.address, transferAmount2);
    
      const operation = await createTransferOperation(addr1, [command1, command2], 2);
    
      await processor.process([operation]);
      // Assertions
      expect(await ownableToken.balanceOf(addr1.address)).to.equal(balance1 + transferAmount2 - transferAmount1);
      expect(await ownableToken.balanceOf(addr2.address)).to.equal(balance2 + transferAmount1 - transferAmount2);
     
    });
    
    it("Should fail for nonce reuse", async function () {
      const transferAmount = 100;
      const command = createTransferCommand(addr1.address, addr2.address, transferAmount);
      const operation = await createTransferOperation(addr1, [command], 3);
  
      await processor.process([operation]);
    
      // Trying to process the same operation again
      await expect(processor.process([operation]))
        .to.be.revertedWith("Nonce already used");
    });
    
    it("Should fail for zero transfer amount", async function () {
      const transferAmount = BigInt(0);
  
      // Create TransferData and AssetTransfer structures
      const cmd = createTransferCommand(addr1.address, addr2.address, 0);
      const op = await createTransferOperation(addr1, [cmd], 34, 1000);

      await expect(processor.process([op]))
          .to.be.revertedWith("Empty transfer."); // Replace with your actual error message
    });

    it("Should fail if the sender has insufficient balance", async function () {
      const transferAmount = 100000; // An amount greater than the sender's balance
      const command = createTransferCommand(addr1.address, addr2.address, transferAmount);
      const operation = await createTransferOperation(addr1, [command], 4);
    
      await expect(processor.process([operation]))
        .to.be.revertedWith("Not enough funds."); // Replace with the actual error message
    });


    it("Should fail if the deadline is in the past", async function () {
      const transferAmount = 100;
      const command = createTransferCommand(addr1.address, addr2.address, transferAmount);
      // Create an operation with a past deadline
      const operation = await createTransferOperation(addr1, [command], 6, -1000); 
    
      await expect(processor.process([operation]))
        .to.be.revertedWith("Deadline passed"); // Replace with the actual error message
    });
    

    it("Should fail if the signature is invalid", async function () {
      const transferAmount = 100;
      const command = createTransferCommand(addr1.address, addr2.address, transferAmount);
      const operation = await createTransferOperation(addr1, [command], 7);
      operation.signatures = [getRandomBytes32()]; // Replace with an invalid signature
    
      await expect(processor.process([operation]))
        .to.be.revertedWith("Invalid signature"); // Replace with the actual error message
    });
    
    
  
  
  });

  // ... additional tests ...
});