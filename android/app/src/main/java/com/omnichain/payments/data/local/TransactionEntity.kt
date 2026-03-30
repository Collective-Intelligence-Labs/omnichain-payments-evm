package com.omnichain.payments.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "transactions")
data class TransactionEntity(
    @PrimaryKey val hash: String,
    val opId: String,
    val status: String,
    val timestamp: Long,
    val transfersJson: String,
    val chainId: Long
)
