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

async function createTransferOperation(processorContract, sender,  commands, opId, deadlineOffset = 1000) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineOffset);
  const cmdTypes = commands.map(() => 1); 

  // Sign the message with the sender's private key
  const signature = await createSignature(processorContract.target, sender, deadline, opId, commands, cmdTypes);
  
  return {
    deadline: deadline,
    op_id: opId,
    portal: sender.address,
    commands: commands,
    cmd_types: commands.map(() => 1), // Assuming 1 is the type for a simple transfer
    signatures: [signature] // Mocked or calculated signatures,
  };
} 

async function createSignature(processorAddress, sender, deadline, opId, commands, cmdTypes) {
  // Define the EIP-712 domain
  const domain = {
      name: 'Processor Contract',
      version: '1',
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: processorAddress // Replace with your Processor contract's address
  };

  // Define the EIP-712 types
  const types = {
      Operation: [
          { name: "deadline", type: "uint256" },
          { name: "op_id", type: "uint256" },
          { name: "portal", type: "address" },
          { name: "commands", type: "AssetTransfer[]" },
          { name: "cmd_types", type: "uint256[]" }
      ],
      AssetTransfer: [
          { name: "amount", type: "uint256" },
          { name: "from", type: "address" },
          { name: "to", type: "address" }
      ]
  };

  // Define the values for the types
  const value = {
      deadline: deadline.toString(),
      op_id: opId.toString(),
      portal: sender.address,
      commands: commands,
      cmd_types: cmdTypes.map((type) => type.toString())
  };

  // Sign the typed data
  return await sender.signTypedData(domain, types, value);
}


async function createPermitSignature(signer, tokenContract, owner, spender, value, deadline) {
  const domain = {
      name: await tokenContract.name(),
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: tokenContract.target,
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
      nonce: await tokenContract.nonces(owner),
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
      const operation = await createTransferOperation(processor, addr1, [command], 1);
    
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
    
      const operation = await createTransferOperation(processor, addr1, [command1, command2], 2);
    
      await processor.process([operation]);
      // Assertions
      expect(await ownableToken.balanceOf(addr1.address)).to.equal(balance1 + transferAmount2 - transferAmount1);
      expect(await ownableToken.balanceOf(addr2.address)).to.equal(balance2 + transferAmount1 - transferAmount2);
     
    });
    
    it("Should fail for nonce reuse", async function () {
      const transferAmount = 100;
      const command = createTransferCommand(addr1.address, addr2.address, transferAmount);
      const operation = await createTransferOperation(processor, addr1, [command], 3);
  
      await processor.process([operation]);
    
      // Trying to process the same operation again
      await expect(processor.process([operation]))
        .to.be.revertedWith("Nonce already used");
    });
    
    it("Should fail for zero transfer amount", async function () {
      const transferAmount = BigInt(0);
  
      // Create TransferData and AssetTransfer structures
      const cmd = createTransferCommand(addr1.address, addr2.address, 0);
      const op = await createTransferOperation(processor, addr1, [cmd], 34, 1000);

      await expect(processor.process([op]))
          .to.be.revertedWith("Empty transfer."); // Replace with your actual error message
    });

    it("Should fail if the sender has insufficient balance", async function () {
      const transferAmount = 100000; // An amount greater than the sender's balance
      const command = createTransferCommand(addr1.address, addr2.address, transferAmount);
      const operation = await createTransferOperation(processor, addr1, [command], 4);
    
      await expect(processor.process([operation]))
        .to.be.revertedWith("Not enough funds."); // Replace with the actual error message
    });


    it("Should fail if the deadline is in the past", async function () {
      const transferAmount = 100;
      const command = createTransferCommand(addr1.address, addr2.address, transferAmount);
      // Create an operation with a past deadline
      const operation = await createTransferOperation(processor, addr1, [command], 6, -1000); 
    
      await expect(processor.process([operation]))
        .to.be.revertedWith("Deadline passed"); // Replace with the actual error message
    });
    

    it("Should fail if the signature is invalid", async function () {
      const transferAmount = 100;
      const command = createTransferCommand(addr1.address, addr2.address, transferAmount);
      const operation = await createTransferOperation(processor, addr1, [command], 7);
      operation.signatures = [getRandomBytes32()]; // Replace with an invalid signature
    
      await expect(processor.process([operation]))
        .to.be.revertedWith("Invalid signature"); // Replace with the actual error message
    });

    it("Should deposit tokens using the permit method", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const value = 5;
      // Create the permit signature
      const signature = await createPermitSignature(addr1, usdt, addr1.address, processor.target, value, deadline);

      // Create TransferData for DEPOSIT
      const transferData = {
          deadline: deadline,
          op_id: 3242,
          portal: addr1.address,
          commands: [
            {
              from: addr1.address,
              to: addr2.address,
              amount: value
            }
          ],
          cmd_types: [2], // DEPOSIT
          signatures: [signature], // Include the permit signature
      };

      // Call process
      const receipt = await processor.process([transferData]);

      // Assertions
      // Check that tokens have been transferred and minted correctly
  });
    
    
  
  
  });

  // ... additional tests ...
});