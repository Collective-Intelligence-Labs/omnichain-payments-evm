const hre = require("hardhat");

async function main() {
  const [deployer, merchant, customer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with account:", deployer.address);

  const USDCMock = await hre.ethers.getContractFactory("USDCMock");
  const usdc = await USDCMock.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();

  const merchantInitialBalance = hre.ethers.parseUnits("10000", 6);
  const customerInitialBalance = hre.ethers.parseUnits("1000", 6);
  await usdc.mint(merchant.address, merchantInitialBalance);
  await usdc.mint(customer.address, customerInitialBalance);

  console.log(`USDC deployed to: ${usdcAddress}`);
  console.log(`Merchant USDC balance: ${hre.ethers.formatUnits(await usdc.balanceOf(merchant.address), 6)}`);
  console.log(`Customer USDC balance: ${hre.ethers.formatUnits(await usdc.balanceOf(customer.address), 6)}`);

  const Processor = await hre.ethers.getContractFactory("Processor");
  const processor = await Processor.deploy(usdcAddress);
  await processor.waitForDeployment();
  const processorAddress = await processor.getAddress();

  console.log(`Processor deployed to: ${processorAddress}`);
  console.log(`Processor target token: ${await processor.targetToken()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
