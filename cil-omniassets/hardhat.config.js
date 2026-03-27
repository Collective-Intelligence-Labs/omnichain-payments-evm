require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-ethers");

require('dotenv').config();
const { MNEMONIC } = process.env;

const networks = {
  hardhat: {},
};

if (MNEMONIC) {
  networks.sepolia = {
    url: "https://rpc.sepolia.org/",
    accounts: {
      mnemonic: MNEMONIC
    }
  };
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  defaultNetwork: "hardhat",
  networks,
  gasReporter: {
    enabled: true,
  },
};
