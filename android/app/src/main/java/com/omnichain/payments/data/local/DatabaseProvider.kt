package com.omnichain.payments.data.local

import android.content.Context
import androidx.room.Room

object DatabaseProvider {
    private var instance: AppDatabase? = null

    fun getDatabase(context: Context): AppDatabase {
        return instance ?: synchronized(this) {
            Room.databaseBuilder(
                context.applicationContext,
                AppDatabase::class.java,
                "omnichain_payments.db"
            ).build().also { instance = it }
        }
    }
}
