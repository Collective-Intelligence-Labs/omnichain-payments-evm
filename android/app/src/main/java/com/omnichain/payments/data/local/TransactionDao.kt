package com.omnichain.payments.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface TransactionDao {
    @Query("SELECT * FROM transactions ORDER BY timestamp DESC")
    fun getAllTransactions(): Flow<List<TransactionEntity>>

    @Query("SELECT * FROM transactions WHERE hash = :hash")
    suspend fun getTransaction(hash: String): TransactionEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTransaction(transaction: TransactionEntity)

    @Query("UPDATE transactions SET status = :status WHERE hash = :hash")
    suspend fun updateStatus(hash: String, status: String)

    @Query("DELETE FROM transactions WHERE hash = :hash")
    suspend fun deleteTransaction(hash: String)
}
