# Omnichain Payments (EVM)

Gas-efficient batch USDC transfer processor for EVM chains. Uses EIP-2612 permits to consolidate N transfers into a single on-chain transaction, reducing gas costs by 52-78% and eliminating individual approve+transferFrom flows.

## Architecture

```
User signs off-chain EIP-2612 permit
        │
        ▼
  Processor.process(ops)          ← single on-chain tx
        │
        ├── verify permit signature
        ├── execute batch transfers
        └── mark nonce as used
```

**Key idea**: Instead of N+1 on-chain transactions (1 approve + N `transferFrom` calls), the user signs a permit off-chain and a single `process()` call executes all transfers atomically.

### Contracts

| Contract | Description |
|---|---|
| `Processor` | Batch transfer processor with permit-based authorization |
| `USDCMock` | Mock USDC (6 decimals) with EIP-2612 permit support |
| `USDTToken` | Mock USDT with EIP-2612 permit support |
| `OwnableERC20Token` | Owner-restricted ERC20 (OMNI token) |

## Setup

```shell
# Smart contracts
cd cil-omniassets
npm install

# Create .env with your mnemonic
echo "MNEMONIC='your mnemonic'" > .env

# Compile
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to Sepolia
npx hardhat run scripts/deploy.js --network sepolia

# Run performance benchmarks
REPORT_GAS=true npx hardhat test test/PerformanceComparison.js
```

## Performance Benchmarks

Benchmarks measured on Hardhat local EVM (Solidity 0.8.20, optimizer enabled, 200 runs). Each transfer is $100 USDC.

### Omnichain vs Regular Transfers

| # Transfers | Regular Gas | Omnichain Gas | Gas Saved | Savings | Fewer Txs |
|---:|---:|---:|---:|:---:|:---:|
| 5 | 329,779 | 158,616 | 171,163 | 51.9% | 5 |
| 10 | 532,524 | 209,665 | 322,859 | 60.6% | 10 |
| 100 | 4,164,774 | 1,023,856 | 3,140,918 | 75.4% | 100 |
| 1,000 | 40,589,694 | 9,036,372 | 31,553,322 | 77.7% | 1,000 |

- **Regular**: 1 approve tx + N `transferFrom` txs = N+1 on-chain transactions
- **Omnichain**: 1 `process()` tx with off-chain EIP-2612 permit = 1 on-chain transaction

### Gas Per Transfer

| # Transfers | Regular (gas/transfer) | Omnichain (gas/transfer) |
|---:|---:|---:|
| 5 | 56,686 | 31,723 |
| 10 | 57,167 | 22,676 |
| 100 | 42,894 | 10,409 |
| 1,000 | 40,782 | 9,053 |

### Batch Size Limits

| Metric | Value |
|---|---|
| Max batch (Hardhat) | 1,855 transfers |
| Gas per transfer at max | ~9,031 gas |
| Gas utilization at max | 99.9% of 16.7M tx gas cap |
| Theoretical max (mainnet) | ~3,321 transfers (30M block gas limit) |

### Contract Deployment

| Contract | Deployment Gas |
|---|---:|
| Processor | 653,234 |
| USDCMock | 1,082,923 |

## How It Works

1. Off-chain: User signs an EIP-2612 permit for the total batch amount
2. Off-chain: User builds an `Operation` struct with all transfer commands
3. On-chain: `process()` verifies the permit, executes all transfers, and marks the nonce

The nonce (`op_id`) prevents replay attacks. The deadline ensures operations expire.

## UI

React-based frontend for interacting with the processor contracts.

```shell
cd ui
npm install
npm run dev        # development server
npm run build      # production build
npm run test:e2e   # Playwright E2E tests
```

## Server

Express.js backend server for the processor.

```shell
cd omniassets-server
npm install
npm start
```

## Vue UI

Vue.js frontend for interacting with the processor contracts.

```shell
cd omniassets-ui
npm install
npm run serve
```

## Docker Deployment

### Quick Start

```shell
# Copy environment file and configure
cp .env.example .env
# Edit .env with your MNEMONIC and ADMIN_SECRET

# Build and start all services
docker compose up -d --build

# View logs
docker compose logs -f
```

### Services

| Service | Port | Description |
|---|---|---|
| `app` | 80 | nginx serving all frontends + API proxy |
| `server` | 3000 | Express.js backend (internal) |
| `mongodb` | 27017 | MongoDB database (internal) |

### URLs

| Path | Description |
|---|---|
| `http://localhost/` | React UI (redirects to /omnichain-payments-evm/) |
| `http://localhost/vue/` | Vue UI |
| `http://localhost/admin/` | Admin Panel |

### Admin Panel

The admin panel at `/admin/` provides:
- **Dashboard** - System stats, pending transfers, MongoDB status
- **Transfers** - View and manage pending transfers with pagination
- **Operations** - View and clear operation history

Authenticate with the `ADMIN_SECRET` defined in your `.env` file.

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `MONGODB_URI` | MongoDB connection string | `mongodb://mongodb:27017/omniassets` |
| `PORT` | Server port | `3000` |
| `MNEMONIC` | Wallet mnemonic for blockchain transactions | - |
| `ADMIN_SECRET` | Admin panel authentication secret | `admin-secret-change-me` |

### Stopping

```shell
docker compose down        # Stop containers
docker compose down -v     # Stop containers and remove volumes
```

## License

MIT
