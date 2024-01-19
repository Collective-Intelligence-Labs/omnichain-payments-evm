const OwnableERC20Token = artifacts.require("OwnableERC20Token");
const Processor = artifacts.require("Processor");

module.exports = async function(deployer) {

  await deployer.deploy(OwnableERC20Token, "oUSD", "oUSD", 0);
  const tokenInstance = await OwnableERC20Token.deployed();

  // Deploy Processor
  await deployer.deploy(Processor, "0xc4bF5CbDaBE595361438F8c6a187bDc330539c60", tokenInstance.address);
  const processorInstance = await Processor.deployed();

  // Set the owner of the ERC20 token to the Processor's address
  await tokenInstance.transferOwnership(processorInstance.address);
};
