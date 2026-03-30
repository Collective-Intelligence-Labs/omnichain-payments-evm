const fs = require('fs');
const path = require('path');

const artifactsDir = path.join(__dirname, 'artifacts');

if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}

const contractsDir = path.join(__dirname, '..', 'cil-omniassets', 'artifacts', 'contracts');

if (!fs.existsSync(contractsDir)) {
  console.error('Contract artifacts not found. Run "npx hardhat compile" in cil-omniassets/ first.');
  process.exit(1);
}

const processorSource = path.join(contractsDir, 'Processor.sol', 'Processor.json');
const usdcSource = path.join(contractsDir, 'USDCMock.sol', 'USDCMock.json');

if (!fs.existsSync(processorSource)) {
  console.error('Processor.json artifact not found. Run "npx hardhat compile" in cil-omniassets/ first.');
  process.exit(1);
}

const processorArtifact = JSON.parse(fs.readFileSync(processorSource, 'utf8'));
fs.writeFileSync(
  path.join(artifactsDir, 'Processor.json'),
  JSON.stringify({ abi: processorArtifact.abi, bytecode: processorArtifact.bytecode }, null, 2)
);
console.log('Copied Processor artifact');

if (fs.existsSync(usdcSource)) {
  const usdcArtifact = JSON.parse(fs.readFileSync(usdcSource, 'utf8'));
  fs.writeFileSync(
    path.join(artifactsDir, 'USDCMock.json'),
    JSON.stringify({ abi: usdcArtifact.abi, bytecode: usdcArtifact.bytecode }, null, 2)
  );
  console.log('Copied USDCMock artifact');
} else {
  console.warn('USDCMock.json artifact not found — deploy without token will not work');
}

console.log('Done. Artifacts saved to omniassets-server/artifacts/');
