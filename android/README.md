# OmniChain Payments - Android App

Native Android app for interacting with the OmniChain Payments batch USDC transfer Processor contract.

## Features

- **Batch Transfers**: Consolidate multiple token transfers into a single on-chain transaction
- **EIP-2612 Permits**: Off-chain gasless signing using the permit pattern
- **Gas Savings**: 52-78% gas reduction compared to individual `approve` + `transferFrom` calls
- **WalletConnect**: Connect to mobile wallets via WalletConnect V2
- **Transaction History**: Local persistence of all submitted transactions
- **Multi-Network**: Support for Sepolia, localhost, and custom EVM chains

## Architecture

MVVM with Jetpack Compose:

```
app/src/main/java/com/omnichain/payments/
├── ui/
│   ├── theme/          # Compose theme (dark/light)
│   ├── screens/        # Screen composables
│   │   ├── MainScreen.kt
│   │   ├── WalletHeader.kt
│   │   ├── BatchTransferScreen.kt
│   │   ├── TransactionHistoryScreen.kt
│   │   └── SettingsScreen.kt
│   └── MainActivity.kt
├── viewmodel/
│   └── PaymentViewModel.kt
├── model/
│   └── Models.kt
├── data/
│   ├── web3/
│   │   ├── ContractService.kt       # Web3j contract interaction
│   │   └── WalletConnectManager.kt   # Wallet state management
│   ├── local/
│   │   ├── AppDatabase.kt           # Room database
│   │   ├── TransactionDao.kt
│   │   ├── TransactionEntity.kt
│   │   └── DatabaseProvider.kt
│   └── repository/
│       └── TransactionRepository.kt
└── util/
    └── ProcessorUtils.kt            # opHash generation, validation
```

## How It Works

1. **Add Recipients**: Enter wallet addresses and USDC amounts
2. **Sign Permit**: The app generates an EIP-712 typed data permit signature (off-chain, no gas)
3. **Submit**: A single transaction calls `Processor.process()` with the signed operation
4. **On-chain**: The contract verifies the permit, executes all transfers atomically

### Key Technical Detail

The operation hash (`keccak256(abi.encode(opId, commands))`) is used as the EIP-2612 permit's `deadline` parameter. This ensures:
- The permit is ONLY valid for the specific `op_id` and exact set of commands
- Signatures cannot be replayed with different recipients/amounts
- The hash (as a uint256) is always larger than the actual deadline timestamp

## Building

```bash
cd android
./gradlew assembleDebug
```

## Dependencies

- **Jetpack Compose** + Material3 for UI
- **Web3j** for Ethereum blockchain interaction
- **WalletConnect V2** for mobile wallet integration
- **Room** for local transaction persistence
- **Hilt** for dependency injection
- **Kotlin Coroutines** for async operations

## Requirements

- Android SDK 34
- Min SDK 26 (Android 8.0)
- Java 17
