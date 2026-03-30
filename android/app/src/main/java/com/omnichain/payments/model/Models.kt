package com.omnichain.payments.model

import java.math.BigInteger

data class AssetTransfer(
    val to: String,
    val amount: BigInteger
)

data class Operation(
    val deadline: Long,
    val opId: BigInteger,
    val from: String,
    val commands: List<AssetTransfer>,
    val signature: ByteArray
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is Operation) return false
        return opId == other.opId && from == other.from && deadline == other.deadline
    }

    override fun hashCode(): Int {
        var result = deadline.hashCode()
        result = 31 * result + opId.hashCode()
        result = 31 * result + from.hashCode()
        return result
    }
}

data class TransferInput(
    val id: String,
    val to: String,
    val amount: String
)

data class TransactionRecord(
    val hash: String,
    val opId: String,
    val status: TxStatus,
    val timestamp: Long,
    val transfers: List<TransferInput>
)

enum class TxStatus {
    PENDING, CONFIRMED, FAILED
}

data class NetworkConfig(
    val chainId: Long,
    val name: String,
    val rpcUrl: String,
    val processorAddress: String,
    val tokenAddress: String,
    val tokenSymbol: String,
    val tokenDecimals: Int,
    val blockExplorer: String = ""
)

enum class WalletStatus {
    DISCONNECTED, CONNECTING, CONNECTED, WRONG_NETWORK
}

data class WalletState(
    val status: WalletStatus = WalletStatus.DISCONNECTED,
    val address: String = "",
    val chainId: Long = 0,
    val tokenBalance: BigInteger = BigInteger.ZERO,
    val ethBalance: BigInteger = BigInteger.ZERO,
    val tokenSymbol: String = "USDC",
    val tokenDecimals: Int = 6
)
