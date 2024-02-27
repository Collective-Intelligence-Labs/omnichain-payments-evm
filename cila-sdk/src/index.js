const { randomBytes } = require('crypto');
const { ethers } = require("ethers");
const { axios } = require("axios");

// Generates a valid random bytes32 value
function getRandomBytes32() {
    return '0x' + randomBytes(32).toString('hex');
}

class CilaSDK {

    routerApi = null;
    processorContractAddress = null;

    domain = null;

    constructor(routerApi, provider = null) {
        this.provider = provider || ethers.getDefaultProvider();
        this.routerApi = routerApi;
        this.initialize();
    }

    async initialize() {
      
        let settings = await axios.get(this.routerApi + "/settings");

        this.processorContractAddress = settings.processorContractAddress;
        // Fetch and store contract details
        this.domain = {
            name: settings.targetContractDomain.name,
            version: settings.targetContractDomain.version,
            chainId: settings.targetContractDomain.chainId,
            verifyingContract: settings.targetContractDomain.verifyingContract,
        };
    }

    async createTransferOperation(sender, commands, deadlineOffset = 3600) {
        const deadline = Math.floor(Date.now() / 1000) + deadlineOffset; // 1 hour from now

        const { opId, opHash } = this.generateOpIdAndHash(commands, deadline);

        // Calculate the total value to be permitted
        const totalValue = commands.reduce((sum, cmd) => sum + cmd.amount, 0);

        // Sign the message with the sender's private key
        const signature = await this.createPermitSignature(sender, sender.address, this.processorContractAddress, totalValue, opHash);
        return {
            deadline: deadline,
            op_id: opId,
            commands: commands,
            signature: signature
        };
    }

    async createPermitSignature(signer, owner, spender, value, deadline) {
        const nonce = await axios.get(this.routerApi + "/nonce/" + owner);

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
        return await axios.post(this.routerApi + "/send-operations", operations);
    }


    async readBalance(address) {
        return await axios.get(this.routerApi + "/balance/" + address)
    }
}

module.exports = CilaSDK;
