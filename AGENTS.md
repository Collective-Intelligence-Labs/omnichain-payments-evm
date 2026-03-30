# Omnichain Payments EVM - Agent Instructions

## Project Overview

Omnichain Payments EVM is a gas-efficient batch USDC transfer processor for EVM chains. It uses EIP-2612 permits to consolidate N separate token transfers into a single on-chain transaction, reducing gas costs by 52-78%.

## Architecture

- **Monorepo** with independent sub-projects (no monorepo tool like Lerna/Nx)
- **Smart Contracts**: Solidity 0.8.24, Hardhat (not Foundry), EVM target: cancun
- **React UI**: React 18, Vite, TypeScript, ethers.js v6
- **Vue UI**: Vue 3, Vue CLI (legacy, `omniassets-ui/`)
- **Admin Panel**: React 18, Vite (`admin/`)
- **Backend Server**: Express.js, MongoDB/Mongoose (`omniassets-server/`)
- **CILA SDK**: Node.js SDK (`cila-sdk/`) — experimental
- **Android App**: Kotlin/Java, Gradle (`android/`)

## Key Directories

```
cil-omniassets/          # Smart contracts (Hardhat project)
  contracts/             # Solidity source files
  scripts/deploy.js      # Deployment script
  test/                  # Mocha/Chai test files
  libs/                  # ProcessorSDK and CilaSDK
ui/                      # React frontend
admin/                   # Admin panel
omniassets-ui/           # Vue.js frontend (legacy)
omniassets-server/       # Express backend
cila-sdk/                # CILA SDK (experimental)
android/                 # Android mobile app
```

## Build & Test Commands

### Smart Contracts (`cil-omniassets/`)

```bash
npm install                    # Install dependencies
npx hardhat compile            # Compile contracts
npx hardhat test               # Run all tests
npx hardhat test test/Processor.js              # Run specific test
npx hardhat coverage           # Code coverage
REPORT_GAS=true npx hardhat test                # Run with gas reporter
npx hardhat run scripts/deploy.js --network sepolia  # Deploy to Sepolia
npx hardhat node               # Local Hardhat node
```

### React UI (`ui/`)

```bash
npm install
npm run dev          # Dev server
npm run build        # Production build
npm run test:e2e     # Playwright E2E tests
```

### Vue UI (`omniassets-ui/`)

```bash
npm install
npm run serve        # Dev server
npm run build        # Production build
npm run lint         # ESLint
```

### Backend Server (`omniassets-server/`)

```bash
npm install
npm run dev          # Dev with nodemon
npm start            # Production start
```

### Admin Panel (`admin/`)

```bash
npm install
npm run dev
npm run build
```

### CILA SDK (`cila-sdk/`)

```bash
npm install
npm test
```

### Android (`android/`)

```bash
./gradlew assembleDebug
./gradlew test
```

### Docker

```bash
docker compose up -d --build
docker compose down
```

## Code Conventions

- **Solidity**: Pragma `^0.8.24`, OpenZeppelin v5, optimizer 200 runs
- **React/Vue**: TypeScript where applicable, functional components
- **No top-level package.json**: Each sub-project is independent
- **No Solhint**: No Solidity linting configured
- **Testing**: Mocha + Chai for contracts (via Hardhat), Playwright for React E2E
- **Web3**: ethers.js v6 exclusively (watch for v5 API usage in older files like `cila-sdk/`)

## Key Contracts

- **Processor.sol** — Core batch transfer processor. Takes `Operation[]` with EIP-2612 permits, executes all transfers atomically.
- **USDCMock.sol** — Mock USDC (6 decimals) with EIP-2612 permit.
- **USDTToken.sol** — Mock USDT (18 decimals) with EIP-2612 permit.
- **OwnableERC20Token.sol** — Owner-restricted ERC20 (OMNI token).
- **OperationProcessor.sol** — Experimental low-level byte parser (CILA protocol, not yet fully implemented).

## Environment Variables

Copy `.env.example` to `.env`. Key variables:
- `MNEMONIC` — Wallet mnemonic for deployments and server transactions
- `MONGODB_URI` — MongoDB connection string (default: `mongodb://localhost:27017/omniassets`)
- `PORT` — Express server port (default: `3000`)
- `ADMIN_SECRET` — Bearer token for admin API authentication

## CI/CD

GitHub Actions workflows in `.github/workflows/`:
- `test-ui.yml` — Build/test React UI, Vue UI, server, E2E on push/PR
- `deploy-ui.yml` — Deploy React UI to GitHub Pages
- `deploy-netlify.yml` — Deploy React UI to Netlify
- `test-android.yml` — Android build and unit tests
- `release-android.yml` — Build release APK on tag push (`v*`)

## Important Notes

- The `OperationProcessor.sol` and CILA SDK are experimental/early-stage — do not assume they are production-ready.
- `cila-sdk/` uses ethers v5 API — incompatible with ethers v6 used elsewhere.
- Two ProcessorSDK implementations exist: `cil-omniassets/libs/processorSDK.js` (hardcoded USDT ABI) and `cil-omniassets/test/processorSDK.js` (flexible, takes ABI as parameter).
- Server (`omniassets-server/sender.js`) has a hardcoded Sepolia contract address — update when deploying to new networks.
- The `Process` namespace is used in contract ADRs for operation processing terminology.
