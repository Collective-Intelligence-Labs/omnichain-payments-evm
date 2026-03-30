package com.omnichain.payments.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.omnichain.payments.data.local.TransactionEntity
import com.omnichain.payments.data.repository.TransactionRepository
import com.omnichain.payments.data.web3.ContractService
import com.omnichain.payments.data.web3.WalletConnectManager
import com.omnichain.payments.model.*
import com.omnichain.payments.util.isValidEthereumAddress
import com.omnichain.payments.util.shortenAddress
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.math.BigInteger
import java.util.UUID

sealed class UiEvent {
    data class ShowError(val message: String) : UiEvent()
    data class ShowSuccess(val message: String) : UiEvent()
    data class NavigateToExplorer(val url: String) : UiEvent()
}

data class BatchTransferUiState(
    val recipientInputs: List<TransferInput> = listOf(TransferInput(UUID.randomUUID().toString(), "", "")),
    val isSubmitting: Boolean = false,
    val errorMessage: String? = null,
    val totalAmount: BigInteger = BigInteger.ZERO
)

class PaymentViewModel(
    private val contractService: ContractService,
    private val walletManager: WalletConnectManager,
    private val transactionRepository: TransactionRepository
) : ViewModel() {

    private val _uiEvent = MutableSharedFlow<UiEvent>()
    val uiEvent: SharedFlow<UiEvent> = _uiEvent.asSharedFlow()

    val walletState: StateFlow<WalletState> = walletManager.walletState

    val transactions: StateFlow<List<TransactionRecord>> = transactionRepository.allTransactions
        .stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    private val _transferState = MutableStateFlow(BatchTransferUiState())
    val transferState: StateFlow<BatchTransferUiState> = _transferState.asStateFlow()

    private val _networkConfig = MutableStateFlow<NetworkConfig?>(
        NetworkConfig(
            chainId = 11155111,
            name = "Sepolia",
            rpcUrl = "https://rpc.sepolia.org/",
            processorAddress = "",
            tokenAddress = "",
            tokenSymbol = "USDC",
            tokenDecimals = 6,
            blockExplorer = "https://sepolia.etherscan.io"
        )
    )

    val networkConfig: StateFlow<NetworkConfig?> = _networkConfig.asStateFlow()

    fun setNetworkConfig(config: NetworkConfig) {
        _networkConfig.value = config
        walletManager.setNetworkConfig(config)
    }

    fun connectWallet() {
        viewModelScope.launch {
            val config = _networkConfig.value ?: return@launch
            if (config.processorAddress.isBlank() || config.tokenAddress.isBlank()) {
                _uiEvent.emit(UiEvent.ShowError("Configure processor and token addresses first"))
                return@launch
            }
            try {
                walletManager.connect(config)
            } catch (e: Exception) {
                _uiEvent.emit(UiEvent.ShowError("Failed to connect: ${e.message}"))
            }
        }
    }

    fun disconnectWallet() {
        viewModelScope.launch {
            walletManager.disconnect()
        }
    }

    fun refreshBalances() {
        viewModelScope.launch {
            try {
                walletManager.refreshBalances()
            } catch (_: Exception) { }
        }
    }

    fun addRecipient() {
        _transferState.value = _transferState.value.copy(
            recipientInputs = _transferState.value.recipientInputs +
                TransferInput(UUID.randomUUID().toString(), "", "")
        )
    }

    fun removeRecipient(id: String) {
        if (_transferState.value.recipientInputs.size <= 1) return
        _transferState.value = _transferState.value.copy(
            recipientInputs = _transferState.value.recipientInputs.filter { it.id != id }
        )
    }

    fun updateRecipientAddress(id: String, address: String) {
        _transferState.value = _transferState.value.copy(
            recipientInputs = _transferState.value.recipientInputs.map {
                if (it.id == id) it.copy(to = address) else it
            },
            errorMessage = null
        )
    }

    fun updateRecipientAmount(id: String, amount: String) {
        _transferState.value = _transferState.value.copy(
            recipientInputs = _transferState.value.recipientInputs.map {
                if (it.id == id) it.copy(amount = amount) else it
            },
            errorMessage = null
        )
    }

    fun validateAndSubmit() {
        val state = _transferState.value
        if (state.isSubmitting) return

        val errors = mutableListOf<String>()
        val commands = mutableListOf<AssetTransfer>()
        val config = _networkConfig.value

        val decimals = config?.tokenDecimals ?: 6
        val multiplier = BigInteger.TEN.pow(decimals)

        for (input in state.recipientInputs) {
            if (!isValidEthereumAddress(input.to)) {
                errors.add("Invalid address: ${shortenAddress(input.to.ifBlank { "empty" })}")
                continue
            }
            val amountDecimal = input.amount.toBigDecimalOrNull()
            if (amountDecimal == null || amountDecimal <= java.math.BigDecimal.ZERO) {
                errors.add("Invalid amount for ${shortenAddress(input.to)}")
                continue
            }
            commands.add(
                AssetTransfer(
                    to = input.to.lowercase(),
                    amount = amountDecimal.multiply(java.math.BigDecimal(multiplier)).toBigInteger()
                )
            )
        }

        if (errors.isNotEmpty()) {
            _transferState.value = state.copy(errorMessage = errors.joinToString("\n"))
            return
        }

        if (commands.isEmpty()) {
            _transferState.value = state.copy(errorMessage = "Add at least one valid transfer")
            return
        }

        val totalValue = commands.fold(BigInteger.ZERO) { acc, cmd -> acc + cmd.amount }
        if (totalValue > walletState.value.tokenBalance) {
            _transferState.value = state.copy(errorMessage = "Insufficient balance")
            return
        }

        _transferState.value = state.copy(isSubmitting = true)

        viewModelScope.launch {
            try {
                val (txHash, opId) = walletManager.buildAndSendBatchTransfer(commands) { permitData ->
                    contractService.createEip712PermitSignature(
                        credentials = null!!,
                        tokenName = permitData.tokenName,
                        tokenAddress = permitData.tokenAddress,
                        chainId = permitData.chainId,
                        owner = permitData.owner,
                        spender = permitData.spender,
                        value = permitData.value,
                        nonce = permitData.nonce,
                        deadline = permitData.deadline
                    )
                }

                val record = TransactionRecord(
                    hash = txHash,
                    opId = opId.toString(16),
                    status = TxStatus.PENDING,
                    timestamp = System.currentTimeMillis(),
                    transfers = state.recipientInputs
                )
                transactionRepository.insertTransaction(record, config?.chainId ?: 0)

                _transferState.value = BatchTransferUiState()
                _uiEvent.emit(UiEvent.ShowSuccess("Transaction submitted: ${txHash.take(10)}..."))

                val explorer = config?.blockExplorer
                if (!explorer.isNullOrBlank()) {
                    _uiEvent.emit(UiEvent.NavigateToExplorer("$explorer/tx/$txHash"))
                }
            } catch (e: Exception) {
                _transferState.value = _transferState.value.copy(
                    isSubmitting = false,
                    errorMessage = "Transaction failed: ${e.message}"
                )
                _uiEvent.emit(UiEvent.ShowError(e.message ?: "Unknown error"))
            }
        }
    }

    fun clearError() {
        _transferState.value = _transferState.value.copy(errorMessage = null)
    }

    fun updateProcessorAddress(address: String) {
        val current = _networkConfig.value ?: return
        _networkConfig.value = current.copy(processorAddress = address)
    }

    fun updateTokenAddress(address: String) {
        val current = _networkConfig.value ?: return
        _networkConfig.value = current.copy(tokenAddress = address)
    }

    fun deleteTransaction(hash: String) {
        viewModelScope.launch {
            transactionRepository.deleteTransaction(hash)
        }
    }

    companion object {
        fun factory(
            contractService: ContractService,
            walletManager: WalletConnectManager,
            transactionRepository: TransactionRepository
        ): ViewModelProvider.Factory = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                return PaymentViewModel(contractService, walletManager, transactionRepository) as T
            }
        }
    }
}
