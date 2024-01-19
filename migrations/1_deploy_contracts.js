const OwnableERC20Token = artifacts.require("OwnableERC20Token");
const Processor = artifacts.require("Processor");

module.exports = function(deployer) {
  deployer.deploy(OwnableERC20Token);
  deployer.deploy(Processor);
};
