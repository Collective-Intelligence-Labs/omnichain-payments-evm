package com.omnichain.payments.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.omnichain.payments.viewmodel.PaymentViewModel
import com.omnichain.payments.viewmodel.UiEvent
import kotlinx.coroutines.flow.collectLatest

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(viewModel: PaymentViewModel) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(Unit) {
        viewModel.uiEvent.collectLatest { event ->
            when (event) {
                is UiEvent.ShowError -> snackbarHostState.showSnackbar(event.message)
                is UiEvent.ShowSuccess -> snackbarHostState.showSnackbar(event.message)
                else -> {}
            }
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text("OmniChain Payments") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        },
        bottomBar = {
            NavigationBar {
                TabItem(0, "Transfer", Icons.Default.Send, selectedTab) { selectedTab = it }
                TabItem(1, "History", Icons.Default.History, selectedTab) { selectedTab = it }
                TabItem(2, "Settings", Icons.Default.Settings, selectedTab) { selectedTab = it }
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            WalletHeader(viewModel)
            when (selectedTab) {
                0 -> BatchTransferScreen(viewModel)
                1 -> TransactionHistoryScreen(viewModel)
                2 -> SettingsScreen(viewModel)
            }
        }
    }
}

@Composable
private fun RowScope.TabItem(
    index: Int,
    label: String,
    icon: ImageVector,
    selectedTab: Int,
    onSelect: (Int) -> Unit
) {
    NavigationBarItem(
        icon = { Icon(icon, contentDescription = label) },
        label = { Text(label) },
        selected = selectedTab == index,
        onClick = { onSelect(index) },
        colors = NavigationBarItemDefaults.colors(
            selectedIconColor = MaterialTheme.colorScheme.primary,
            selectedTextColor = MaterialTheme.colorScheme.primary,
            unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
            unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
            indicatorColor = MaterialTheme.colorScheme.primaryContainer
        )
    )
}
