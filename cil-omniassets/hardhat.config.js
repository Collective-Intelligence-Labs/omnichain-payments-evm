require("@nomicfoundation/hardhat-toolbox");

require('dotenv').config();
const { MNEMONIC } = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      // Hardhat-specific configurations
    },
    sepolia: {
      url: "https://rpc.sepolia.org/",
      accounts: {
        mnemonic: MNEMONIC
      }
    },
  }
};
