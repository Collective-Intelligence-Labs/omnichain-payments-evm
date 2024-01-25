// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");

async function main() {
  const targetTokenAddress = "0xc4bF5CbDaBE595361438F8c6a187bDc330539c60";
  const initialSupply = 0;

  const OwnableERC20Token = await hre.ethers.getContractFactory("OwnableERC20Token");
  const internalToken = await OwnableERC20Token.deploy(initialSupply);
  await internalToken.waitForDeployment();

  const Processor = await hre.ethers.getContractFactory("Processor");
  const processor = await Processor.deploy(targetTokenAddress, internalToken.address);
  await processor.waitForDeployment();

  console.log(`OwnableERC20Token deployed to: ${internalToken.address}`);
  console.log(`Processor deployed to: ${processor.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
