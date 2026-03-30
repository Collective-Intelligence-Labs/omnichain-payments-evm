package com.omnichain.payments.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.HourglassTop
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.omnichain.payments.model.TxStatus
import com.omnichain.payments.util.shortenAddress
import com.omnichain.payments.viewmodel.PaymentViewModel
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun TransactionHistoryScreen(viewModel: PaymentViewModel) {
    val transactions by viewModel.transactions.collectAsState()

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text(
            "Transaction History",
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface
        )

        Spacer(modifier = Modifier.height(16.dp))

        if (transactions.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.Default.HourglassTop,
                        contentDescription = null,
                        modifier = Modifier.size(48.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "No transactions yet",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(transactions, key = { it.hash }) { tx ->
                    TransactionCard(tx)
                }
            }
        }
    }
}

@Composable
private fun TransactionCard(tx: com.omnichain.payments.model.TransactionRecord) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                StatusIcon(tx.status)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    when (tx.status) {
                        TxStatus.PENDING -> "Pending"
                        TxStatus.CONFIRMED -> "Confirmed"
                        TxStatus.FAILED -> "Failed"
                    },
                    style = MaterialTheme.typography.labelMedium,
                    color = when (tx.status) {
                        TxStatus.PENDING -> MaterialTheme.colorScheme.tertiary
                        TxStatus.CONFIRMED -> MaterialTheme.colorScheme.primary
                        TxStatus.FAILED -> MaterialTheme.colorScheme.error
                    }
                )
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    formatDate(tx.timestamp),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                "Op: ${tx.opId}",
                fontFamily = FontFamily.Monospace,
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                shortenAddress(tx.hash),
                fontFamily = FontFamily.Monospace,
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(8.dp))

            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                "${tx.transfers.size} transfer${if (tx.transfers.size != 1) "s" else ""}",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary
            )

            tx.transfers.take(3).forEach { transfer ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 2.dp)
                ) {
                    Text(
                        "-> ${shortenAddress(transfer.to)}",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        "${transfer.amount}",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }
            }

            if (tx.transfers.size > 3) {
                Text(
                    "+${tx.transfers.size - 3} more...",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun StatusIcon(status: TxStatus) {
    when (status) {
        TxStatus.PENDING -> Icon(
            Icons.Default.HourglassTop,
            contentDescription = "Pending",
            tint = MaterialTheme.colorScheme.tertiary,
            modifier = Modifier.size(20.dp)
        )
        TxStatus.CONFIRMED -> Icon(
            Icons.Default.CheckCircle,
            contentDescription = "Confirmed",
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(20.dp)
        )
        TxStatus.FAILED -> Icon(
            Icons.Default.Error,
            contentDescription = "Failed",
            tint = MaterialTheme.colorScheme.error,
            modifier = Modifier.size(20.dp)
        )
    }
}

private fun formatDate(timestamp: Long): String {
    val sdf = SimpleDateFormat("MMM dd, HH:mm", Locale.getDefault())
    return sdf.format(Date(timestamp))
}
