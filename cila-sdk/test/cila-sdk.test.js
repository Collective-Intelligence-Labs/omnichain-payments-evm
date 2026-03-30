const { expect } = require("chai");
const { ethers } = require("ethers");
const ProcessorSDK = require("../src/index");

describe("CilaSDK", function () {
    let processorSDK;
    let mockSender;
    let mockProvider;
    let mockProcessorContract;
    let mockUsdtContract;
    
    beforeEach(async function () {
        mockSender = { address: "0xSenderAddress", signTypedData: () => "mockSignature" };
        mockProvider = ethers.getDefaultProvider();
        mockProcessorContract = { targetToken: () => "0xUsdtAddress" };
        mockUsdtContract = { nonces: () => 0, name: () => "MockUSDT" };

        processorSDK = new ProcessorSDK("0xProcessorAddress", mockProvider);
        processorSDK.processorContract = mockProcessorContract;
        processorSDK.usdtContract = mockUsdtContract;
    });

    describe("Initialization", function () {
        it("should correctly initialize", async function () {
            await processorSDK.initialize();
            expect(processorSDK.usdtContract).to.be.an("object");
            expect(processorSDK.domain).to.be.an("object");
        });
    });

    describe("createTransferOperation", function () {
        it("should create a valid transfer operation", async function () {
            const commands = [{ amount: 100, from: "0xFromAddress", to: "0xToAddress" }];
            const operation = await processorSDK.createTransferOperation(mockSender, commands);

            expect(operation).to.have.property("deadline");
            expect(operation).to.have.property("op_id");
            expect(operation).to.have.property("commands").that.is.an("array");
            expect(operation).to.have.property("signature").that.equals("mockSignature");
        });
    });

    describe("createPermitSignature", function () {
        it("should create a permit signature", async function () {
            const signature = await processorSDK.createPermitSignature(mockSender, "0xOwner", "0xSpender", 100, 1234567890);
            expect(signature).to.equal("mockSignature");
        });
    });

    describe("createTransferCommand", function () {
        it("should create a transfer command", function () {
            const command = processorSDK.createTransferCommand("0xFrom", "0xTo", 100);
            expect(command).to.deep.equal({
                amount: 100,
                from: "0xFrom",
                to: "0xTo"
            });
        });
    });

    describe("calculateOperationHash", function () {
        it("should calculate the hash of an operation", function () {
            const commands = [{ amount: 100, from: "0xFrom", to: "0xTo" }];
            const opId = 1;
            const hash = processorSDK.calculateOperationHash(commands, opId);

            expect(hash).to.be.a("string");
        });
    });

    describe("generateOpIdAndHash", function () {
        it("should generate an operation ID and hash", function () {
            const commands = [{ amount: 100, from: "0xFrom", to: "0xTo" }];
            const { opId, opHash } = processorSDK.generateOpIdAndHash(commands, 1234567890);

            expect(opId).to.be.a("bigint");
            expect(opHash).to.be.a("bigint");
        });
    });

    describe("sendOperations", function () {
        it("should send operations", async function () {
            const operations = [{ /* mock operation data */ }];
            const result = await processorSDK.sendOperations(operations);

            // Mock and assert the result
            // For instance, check if the correct method was called on the contract
        });
    });

    describe("sendSingleOperation", function () {
        it("should send a single operation", async function () {
            const operation = { /* mock operation data */ };
            const result = await processorSDK.sendSingleOperation(operation);

            // Mock and assert the result
        });
    });
});
