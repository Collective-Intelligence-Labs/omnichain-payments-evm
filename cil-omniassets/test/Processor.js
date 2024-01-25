const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

const { randomBytes } = require('crypto');
const { ethers } = require("hardhat");

// Generates a valid random bytes32 value
function getRandomBytes32() {
  return '0x' + randomBytes(32).toString('hex');
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
    await usdt.mint(addr2.address, 20000);

    // Deploy OwnableERC20Token with 0 initial supply
    ownableToken = await OwnableERC20Token.deploy(0);

    await ownableToken.mint(addr1.address, 10000);
    await ownableToken.mint(addr2.address, 20000);

  

    console.log("USDT: " + usdt.target);
    console.log("OMNI ASSET: " + ownableToken.target);
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
      const transferAmount = BigInt(100);
      user1 = addr1;
      user2 = addr2;
      // User1 approves Processor contract to spend their USDT
      await usdt.connect(user1).approve(processor.target, transferAmount);

      const balance1 = await ownableToken.balanceOf(user1.address);
      const balance2 = await ownableToken.balanceOf(user2.address);
  
      // Create TransferData and AssetTransfer structures
      const transferData = {
     
        deadline: (await ethers.provider.getBlock('latest')).timestamp + 1000,
        op_id: 1,
        portal: user1.address,
        commands: [{
          amount: transferAmount,
          from: user1.address,
          to: user2.address
        }],
        cmd_types: [1], // Assuming 0 is the type for a simple transfer
        signatures: [getRandomBytes32()] // Mocked or calculated signatures
      };
  
      // Call the process method
      await processor.process([transferData]);

      
      // Check balances after transfer
      expect(await ownableToken.balanceOf(user2.address)).to.equal(balance2 + transferAmount);
    });
  });

  // ... additional tests ...
});