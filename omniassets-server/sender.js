require('dotenv').config();
const contractABI = require('./Processor.json'); // Load your contract ABI
const contractAddress = '0x30d634235B5b3d07Faef206Ac23Db82340C5B412'; // Your contract's address

const { ethers, Wallet } = require("ethers");

// Replace with your Ethereum node URL and mnemonic
const mnemonic = process.env["MNEMONIC"];


const rpcProvider = new ethers.JsonRpcProvider('https://rpc.sepolia.org/');
const wallet = Wallet.fromPhrase(mnemonic, rpcProvider);


async function sendToBlockchain(transferDataList) {
  try {
    const contract = new ethers.Contract(contractAddress, contractABI, rpcProvider);
    const fromAddress = wallet.address; // Using the first account based on the mnemonic

    // Serialize the transfer data
    const serializedData = transferDataList.map(doc => doc.encodedData);


    // ABI encode the array if necessary 
    
    let encodedData = ethers.utils.defaultAbiCoder.encode(["bytes[]"], [serializedData]);
    console.log(encodedData);


    // create tx
    const tx = {
      signer: wallet,
      transaction: await contract.processCmds.populateTransaction({jsonList: serializedData})
    }

    const gas = await contract.processCmds.estimateGas(serializedData);
    const gasCost = rpcProvider.gasCostParameters;


    
    const result = await tx.send({ from: fromAddress, gas, gasCost });
    console.log('Transaction result:', result);
    return true;
  } catch (error) {
    console.error('Failed to send to blockchain:', error);
    return false;
  }
}

module.exports = { sendToBlockchain };
