require('dotenv').config();

const { ethers, Wallet } = require("ethers");

const contractABI = require('./Processor.json'); // Load your contract ABI
const contractAddress = '0x7F3776104f6aD3EF1D8DC211b3B03FD6B55d03AD'; // Your contract's address

// Replace with your Ethereum node URL and mnemonic
const mnemonic = "avoid nephew task cereal pelican bird dry tilt right false peanut cage"; //process.env["MNEMONIC"];

const rpcProvider = new ethers.JsonRpcProvider('https://rpc.sepolia.org/');
const wallet = Wallet.fromPhrase(mnemonic, rpcProvider);

const callData = [{
  _id: {
    $oid: "65ac2bdebc973bec5b4ce477"
  },
  encodedData: "0x000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000041887d93a38f0c8e0b815159804cfc95cfc9e5ff9d6e3fed125119451ba46055ac2e7f01b76181e787987e86b27f3420df94d48eda2d86989609e8f2e3f089dfe11b0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e06af9b4d6312431cde9ac6f3dba77f297e2210dc24eaeb5fddf2016227f16f20300000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000003782dace9d9000000000000000000000000000008aeab625b8c29a087158fb44215a6852277ab35b0000000000000000000000008aeab625b8c29a087158fb44215a6852277ab35b000000000000000000000000000000000000000000000000002386f26fc100000000000000000000000000000000000000000000000000000000000065ac3c43",
  __v: 0
}];

async function sendToBlockchain(transferDataList) {
  try {
    const contract = new ethers.Contract(contractAddress, contractABI, rpcProvider);
    const fromAddress = wallet.address; // Using the first account based on the mnemonic

    // Serialize the transfer data
    const serializedData = transferDataList.map(doc => doc.encodedData);

    // create tx
    const tx = {
      signer: wallet,
      transaction: await contract.processCmds.populateTransaction({jsonList: serializedData})
    }

    console.log(tx.transaction);
    return;

    const gas = await contract.processCmds.estimateGas(serializedData);
    const gasCost = rpcProvider.gasCostParameters;


    
    const result = await tx.send({ from: fromAddress, gas, gasPrice });
    console.log('Transaction result:', result);
  } catch (error) {
    console.error('Failed to send to blockchain:', error);
  }
}

sendToBlockchain(callData);

module.exports = { sendToBlockchain };
