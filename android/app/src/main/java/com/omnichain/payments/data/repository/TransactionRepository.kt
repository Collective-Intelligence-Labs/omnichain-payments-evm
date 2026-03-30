package com.omnichain.payments.data.repository

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.omnichain.payments.data.local.DatabaseProvider
import com.omnichain.payments.data.local.TransactionEntity
import com.omnichain.payments.model.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.math.BigInteger

class TransactionRepository(context: android.content.Context) {

    private val dao = DatabaseProvider.getDatabase(context).transactionDao()
    private val gson = Gson()

    val allTransactions: Flow<List<TransactionRecord>> = dao.getAllTransactions().map { entities ->
        entities.map { it.toDomain() }
    }

    suspend fun insertTransaction(record: TransactionRecord, chainId: Long) {
        val transfersJson = gson.toJson(record.transfers)
        dao.insertTransaction(
            TransactionEntity(
                hash = record.hash,
                opId = record.opId,
                status = record.status.name,
                timestamp = record.timestamp,
                transfersJson = transfersJson,
                chainId = chainId
            )
        )
    }

    suspend fun updateStatus(hash: String, status: TxStatus) {
        dao.updateStatus(hash, status.name)
    }

    suspend fun deleteTransaction(hash: String) {
        dao.deleteTransaction(hash)
    }

    private fun TransactionEntity.toDomain(): TransactionRecord {
        val type = object : TypeToken<List<TransferInput>>() {}.type
        val transfers: List<TransferInput> = gson.fromJson(transfersJson, type)
        return TransactionRecord(
            hash = hash,
            opId = opId,
            status = TxStatus.valueOf(status),
            timestamp = timestamp,
            transfers = transfers
        )
    }
}
