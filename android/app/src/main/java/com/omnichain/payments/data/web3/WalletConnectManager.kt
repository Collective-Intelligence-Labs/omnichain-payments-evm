package com.omnichain.payments.data.web3

import com.omnichain.payments.model.AssetTransfer
import com.omnichain.payments.model.NetworkConfig
import com.omnichain.payments.model.WalletState
import com.omnichain.payments.model.WalletStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.math.BigInteger

class WalletConnectManager(
    private val contractService: ContractService
) {

    private val _walletState = MutableStateFlow(WalletState())
    val walletState: StateFlow<WalletState> = _walletState.asStateFlow()

    private val _isConnecting = MutableStateFlow(false)
    val isConnecting: StateFlow<Boolean> = _isConnecting.asStateFlow()

    private var activeNetworkConfig: NetworkConfig? = null
    private var connectedAddress: String = ""

    val isConnected: Boolean
        get() = _walletState.value.status == WalletStatus.CONNECTED

    fun setNetworkConfig(config: NetworkConfig) {
        activeNetworkConfig = config
        contractService.initialize(config.rpcUrl, config.chainId)
    }

    suspend fun connect(networkConfig: NetworkConfig): WalletState {
        _isConnecting.value = true
        _walletState.value = _walletState.value.copy(status = WalletStatus.CONNECTING)
        try {
            activeNetworkConfig = networkConfig
            val state = contractService.refreshWalletState(connectedAddress, networkConfig)
            _walletState.value = state
            return state
        } catch (e: Exception) {
            _walletState.value = _walletState.value.copy(status = WalletStatus.DISCONNECTED)
            throw e
        } finally {
            _isConnecting.value = false
        }
    }

    suspend fun disconnect() {
        _walletState.value = WalletState()
        connectedAddress = ""
    }

    suspend fun refreshBalances(): WalletState {
        val config = activeNetworkConfig ?: throw IllegalStateException("No network configured")
        if (connectedAddress.isBlank()) throw IllegalStateException("No wallet connected")
        val state = contractService.refreshWalletState(connectedAddress, config)
        _walletState.value = state
        return state
    }

    suspend fun buildAndSendBatchTransfer(
        commands: List<AssetTransfer>,
        signPermit: (ContractService.Eip712PermitData) -> ByteArray
    ): Pair<String, BigInteger> {
        val config = activeNetworkConfig ?: throw IllegalStateException("No network configured")
        val address = connectedAddress.ifBlank { throw IllegalStateException("No wallet connected") }

        return contractService.buildAndSendOperation(
            credentials = null!!,
            networkConfig = config,
            from = address,
            commands = commands,
            signPermit = signPermit
        )
    }

    fun getNetworkConfig(): NetworkConfig? = activeNetworkConfig
}
