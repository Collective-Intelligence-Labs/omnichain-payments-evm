package com.omnichain.payments.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.omnichain.payments.model.WalletStatus
import com.omnichain.payments.viewmodel.PaymentViewModel
import kotlinx.coroutines.flow.collectLatest

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BatchTransferScreen(viewModel: PaymentViewModel) {
    val transferState by viewModel.transferState.collectAsState()
    val walletState by viewModel.walletState.collectAsState()
    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(scrollState)
    ) {
        Text(
            "Batch Transfer",
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface
        )

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            "Consolidate multiple transfers into a single on-chain transaction using EIP-2612 permits.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(16.dp))

        transferState.recipientInputs.forEach { input ->
            TransferRow(
                address = input.to,
                amount = input.amount,
                onAddressChange = { viewModel.updateRecipientAddress(input.id, it) },
                onAmountChange = { viewModel.updateRecipientAmount(input.id, it) },
                onRemove = { viewModel.removeRecipient(input.id) },
                canRemove = transferState.recipientInputs.size > 1
            )
            Spacer(modifier = Modifier.height(8.dp))
        }

        OutlinedButton(
            onClick = { viewModel.addRecipient() },
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text("Add Recipient")
        }

        Spacer(modifier = Modifier.height(16.dp))

        if (transferState.recipientInputs.size > 1) {
            val gasPercent = calculateGasSavings(transferState.recipientInputs.size)
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.secondaryContainer
                ),
                shape = RoundedCornerShape(8.dp)
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.Send,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSecondaryContainer,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        "${transferState.recipientInputs.size} transfers -> 1 tx (save ~$gasPercent% gas)",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
        }

        transferState.errorMessage?.let { error ->
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.errorContainer
                ),
                shape = RoundedCornerShape(8.dp)
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.Close,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.error,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        error,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onErrorContainer
                    )
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
        }

        Button(
            onClick = { viewModel.validateAndSubmit() },
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp),
            enabled = walletState.status == WalletStatus.CONNECTED && !transferState.isSubmitting,
            shape = RoundedCornerShape(12.dp)
        ) {
            if (transferState.isSubmitting) {
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                    strokeWidth = 2.dp
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("Processing...")
            } else {
                Icon(Icons.Default.Send, contentDescription = null, modifier = Modifier.size(20.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Submit Batch Transfer")
            }
        }

        if (walletState.status != WalletStatus.CONNECTED) {
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                "Connect your wallet to submit transfers",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.align(Alignment.CenterHorizontally)
            )
        }

        Spacer(modifier = Modifier.height(32.dp))

        HowItWorksSection()
    }
}

@Composable
private fun TransferRow(
    address: String,
    amount: String,
    onAddressChange: (String) -> Unit,
    onAmountChange: (String) -> Unit,
    onRemove: () -> Unit,
    canRemove: Boolean
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "Recipient",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.weight(1f))
                if (canRemove) {
                    IconButton(onClick = onRemove, modifier = Modifier.size(32.dp)) {
                        Icon(
                            Icons.Default.Delete,
                            contentDescription = "Remove",
                            modifier = Modifier.size(18.dp),
                            tint = MaterialTheme.colorScheme.error
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(4.dp))
            OutlinedTextField(
                value = address,
                onValueChange = onAddressChange,
                placeholder = { Text("0x...") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
                shape = RoundedCornerShape(8.dp),
                textStyle = MaterialTheme.typography.bodySmall
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                "Amount",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(4.dp))
            OutlinedTextField(
                value = amount,
                onValueChange = onAmountChange,
                placeholder = { Text("0.00") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                shape = RoundedCornerShape(8.dp),
                textStyle = MaterialTheme.typography.bodySmall
            )
        }
    }
}

@Composable
private fun HowItWorksSection() {
    Text(
        "How It Works",
        style = MaterialTheme.typography.titleMedium,
        color = MaterialTheme.colorScheme.onSurface
    )
    Spacer(modifier = Modifier.height(12.dp))
    StepCard(
        step = "1",
        title = "Add Recipients",
        description = "Enter wallet addresses and amounts for batch transfer"
    )
    Spacer(modifier = Modifier.height(8.dp))
    StepCard(
        step = "2",
        title = "Sign Permit (Off-chain)",
        description = "Sign an EIP-2612 permit with your wallet - no gas required"
    )
    Spacer(modifier = Modifier.height(8.dp))
    StepCard(
        step = "3",
        title = "Submit (On-chain)",
        description = "A single transaction processes all transfers atomically"
    )
    Spacer(modifier = Modifier.height(8.dp))
    StepCard(
        step = "4",
        title = "Save Gas",
        description = "Reduce gas costs by 52-78% compared to individual transfers"
    )
}

@Composable
private fun StepCard(step: String, title: String, description: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Row(modifier = Modifier.padding(12.dp)) {
            Surface(
                shape = RoundedCornerShape(50),
                color = MaterialTheme.colorScheme.primary
            ) {
                Text(
                    step,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                    style = MaterialTheme.typography.labelMedium
                )
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text(title, style = MaterialTheme.typography.bodyMedium)
                Text(
                    description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

private fun calculateGasSavings(transferCount: Int): Int {
    return if (transferCount <= 1) 0 else {
        val individualGas = transferCount * 65000
        val batchGas = 45000 + transferCount * 8000
        ((1.0 - batchGas.toDouble() / individualGas) * 100).toInt()
    }
}
