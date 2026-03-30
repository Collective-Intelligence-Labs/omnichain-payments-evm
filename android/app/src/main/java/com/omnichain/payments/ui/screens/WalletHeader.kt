package com.omnichain.payments.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.LinkOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.omnichain.payments.model.WalletStatus
import com.omnichain.payments.util.shortenAddress
import com.omnichain.payments.viewmodel.PaymentViewModel
import java.math.BigDecimal
import java.math.BigInteger

@Composable
fun WalletHeader(viewModel: PaymentViewModel) {
    val walletState by viewModel.walletState.collectAsState()

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            when (walletState.status) {
                WalletStatus.DISCONNECTED -> {
                    Icon(
                        Icons.Default.AccountBalanceWallet,
                        contentDescription = null,
                        modifier = Modifier.size(40.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "No wallet connected",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Button(onClick = { viewModel.connectWallet() }) {
                        Icon(Icons.Default.Link, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Connect Wallet")
                    }
                }
                WalletStatus.CONNECTING -> {
                    CircularProgressIndicator(
                        modifier = Modifier.size(32.dp),
                        color = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Connecting...", style = MaterialTheme.typography.bodyMedium)
                }
                WalletStatus.CONNECTED -> {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(
                            Icons.Default.AccountBalanceWallet,
                            contentDescription = null,
                            modifier = Modifier.size(24.dp),
                            tint = MaterialTheme.colorScheme.secondary
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            shortenAddress(walletState.address),
                            fontFamily = FontFamily.Monospace,
                            fontSize = 14.sp,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Spacer(modifier = Modifier.weight(1f))
                        FilledTonalButton(
                            onClick = { viewModel.disconnectWallet() },
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)
                        ) {
                            Icon(Icons.Default.LinkOff, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Disconnect")
                        }
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        BalanceChip(
                            label = "Token",
                            amount = formatTokenBalance(walletState.tokenBalance, walletState.tokenDecimals),
                            symbol = walletState.tokenSymbol
                        )
                        BalanceChip(
                            label = "ETH",
                            amount = formatEthBalance(walletState.ethBalance),
                            symbol = "ETH"
                        )
                    }
                }
                WalletStatus.WRONG_NETWORK -> {
                    Text(
                        "Wrong network",
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
        }
    }
}

@Composable
private fun BalanceChip(label: String, amount: String, symbol: String) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surfaceVariant
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                "$amount $symbol",
                fontFamily = FontFamily.Monospace,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface
            )
        }
    }
}

private fun formatTokenBalance(balance: BigInteger, decimals: Int): String {
    if (balance == BigInteger.ZERO) return "0.00"
    val divisor = BigDecimal.TEN.pow(decimals)
    return BigDecimal(balance).divide(divisor).toPlainString().let {
        if (it.length > 8) it.substring(0, 8) else it
    }
}

private fun formatEthBalance(balance: BigInteger): String {
    val ethValue = BigDecimal(balance).divide(BigDecimal("1000000000000000000"))
    return ethValue.toPlainString().let {
        if (it.length > 6) it.substring(0, 6) else it
    }
}
