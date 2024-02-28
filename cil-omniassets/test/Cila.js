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

  const { axios } = require ("axios");

  const serverApiUrl = "http://localhost:3000"
   
  
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
      console.log(sender.address);
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
  
      for (let index = 0; index < addrs.length; index++) {
        await usdt.mint(addrs[index].address, 999999999999);
      }
      
      // Deploy Processor contract
      processor = await Processor.deploy(usdt.target);
      
    });
  
  
    describe("Transactions", function () {
      // Write tests for your transactions
  

      it("Should handle 100 operations in a single transaction", async function () {
      
        // Arrange: Setup for 100 operations

        let operations = [];
        for (let i = 0; i < addrs.length; i++) {
          const transferAmount = 1; // Assuming a fixed transfer amount for simplicity
          const sender = addrs[i % addrs.length]
          // Use different or same addresses for sender and recipient based on your scenario
          const command = createTransferCommand(sender.address, addrs[(i + 1) % addrs.length].address, transferAmount);
          const operation = await createTransferOperation(sender, [command]);
          operations.push(operation);
        }
      
        // Act: Process all operations in a single transaction
        // Depending on your implementation, this might involve a loop or a modified contract method
        // that can efficiently handle batch processing
        await processor.process(operations);

       
      });


      it("Should handle N operations in a single transaction", async function () {
        this.timeout(120000); // Extend timeout for the test
        
        const createAndAddOperation = async (acc, sender, recipient, transferAmount, index) => {
          const command = createTransferCommand(sender.address, recipient.address, transferAmount);
          const operation = await createTransferOperation(sender, [command], 3600); // Adjusted to use dynamic deadlineOffset if needed
          acc.push(operation);
          return acc;
        };
      
        // Initialize an empty array and sequentially add operations
        const operations = await addrs.reduce(async (promiseAcc, sender, index) => {
          const acc = await promiseAcc; // Wait for the accumulator to resolve
          const recipient = owner; // Determine recipient
          const transferAmount = 1; // Assuming a fixed transfer amount for simplicity
          return createAndAddOperation(acc, sender, recipient, transferAmount, index);
        }, Promise.resolve([])); // Initial accumulator is a resolved promise with an empty array
      
        // Act: Process all operations in a single transaction
        await processor.process(operations);
      });
      
    });
  
    // ... additional tests ...
  });