package com.omnichain.payments.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.omnichain.payments.data.repository.TransactionRepository
import com.omnichain.payments.data.web3.ContractService
import com.omnichain.payments.data.web3.WalletConnectManager
import com.omnichain.payments.ui.screens.*
import com.omnichain.payments.ui.theme.OmniChainTheme
import com.omnichain.payments.viewmodel.PaymentViewModel
import com.omnichain.payments.viewmodel.UiEvent

class MainActivity : ComponentActivity() {

    private lateinit var contractService: ContractService
    private lateinit var walletManager: WalletConnectManager
    private lateinit var transactionRepository: TransactionRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        contractService = ContractService()
        walletManager = WalletConnectManager(contractService)
        transactionRepository = TransactionRepository(applicationContext)

        setContent {
            OmniChainTheme {
                val viewModel: PaymentViewModel = viewModel(
                    factory = PaymentViewModel.factory(contractService, walletManager, transactionRepository)
                )

                LaunchedEffect(Unit) {
                    viewModel.uiEvent.collect { event ->
                        when (event) {
                            is UiEvent.NavigateToExplorer -> {
                                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(event.url)))
                            }
                            is UiEvent.ShowError -> {
                                // Handled in UI via snackbar
                            }
                            is UiEvent.ShowSuccess -> {
                                // Handled in UI via snackbar
                            }
                        }
                    }
                }

                MainScreen(viewModel)
            }
        }
    }
}
