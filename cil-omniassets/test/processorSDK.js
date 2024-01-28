const { randomBytes } = require('crypto');
const { ethers } = require("hardhat");
const ProcessorAbi = require("../artifacts/contracts/Processor.sol/Processor.json").abi 

// Generates a valid random bytes32 value
function getRandomBytes32() {
    return '0x' + randomBytes(32).toString('hex');
  }

class ProcessorSDK {
    constructor(processorAddress, provider) {
        this.provider = provider || ethers.getDefaultProvider();
        this.processorContract = new ethers.Contract(processorAddress, ProcessorAbi, this.provider);
        this.initialize();
    }

    async initialize() {
        const usdtAddress = await this.processorContract.targetToken();
        this.usdtContract = new ethers.Contract(usdtAddress, USDTAbi, this.provider);

        // Fetch and store contract details
        this.domain = {
            name: await this.usdtContract.name(),
            version: "1",
            chainId: (await this.provider.getNetwork()).chainId,
            verifyingContract: usdtAddress,
        };
    }

  async createTransferOperation(sender, commands, deadlineOffset = 3600) {
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
  
  async createPermitSignature(signer, owner, spender, value, deadline) {
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
  
  
  createTransferCommand(from, to, amount) {
    return {
      amount: amount,
      from,
      to
    };
  }
  
  
  calculateOperationHash(commands, opId) {
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
  
  
  generateOpIandHash(commands, deadlineMin)
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

  async sendOperations(operations) {
    const gasEstimate = await this.processorContract.estimateGas.process([operation]);
    return this.processorContract.process(operations, {
        gasLimit: gasEstimate
    });
  }
    async sendSingleOperation(operation)
    {
        return await this.sendOperations([operation]);
    }
}