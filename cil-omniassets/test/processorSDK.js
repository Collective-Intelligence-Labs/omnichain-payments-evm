const { randomBytes } = require('crypto');
const { ethers } = require("ethers");
const ProcessorAbi = require("../artifacts/contracts/Processor.sol/Processor.json").abi;
const USDTAbi = require("../artifacts/contracts/USDTToken.sol/USDTToken.json").abi; // Adjust the path as necessary

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

        const { opId, opHash } = this.generateOpIdAndHash(commands, deadline);

        // Calculate the total value to be permitted
        const totalValue = commands.reduce((sum, cmd) => sum + cmd.amount, 0);

        // Sign the message with the sender's private key
        const signature = await this.createPermitSignature(sender, sender.address, this.processorContract.target, totalValue, opHash);
        return {
            deadline: deadline,
            op_id: opId,
            commands: commands,
            signature: signature
        };
    }

    async createPermitSignature(signer, owner, spender, value, deadline) {
        const nonce = await this.usdtContract.nonces(owner);

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
            nonce,
            deadline,
        };

        return await signer.signTypedData(this.domain, types, values);
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
        const formattedCommands = commands.map(cmd => [cmd.amount, cmd.from, cmd.to]);
        const encodedData = coder.encode(["uint256", "tuple(uint256, address, address)[]"], [opId, formattedCommands]);
        return ethers.keccak256(encodedData);
    }

    generateOpIdAndHash(commands, deadlineMin) {
        let opHash = BigInt(0);
        let opId = BigInt(0);
        while (opHash < deadlineMin) {
            opId = BigInt(getRandomBytes32());
            opHash = this.calculateOperationHash(commands, opId);
        }
        return { opId, opHash };
    }

    async sendOperations(operations) {
        const signer = this.provider.getSigner();
        const processorWithSigner = this.processorContract.connect(signer);
        return processorWithSigner.process(operations);
    }

    async sendSingleOperation(operation) {
        return this.sendOperations([operation]);
    }
}

module.exports = ProcessorSDK;
