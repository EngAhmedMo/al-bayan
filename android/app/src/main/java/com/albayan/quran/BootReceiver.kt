package com.albayan.quran

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.work.OneTimeWorkRequest
import androidx.work.WorkManager
import androidx.work.ExistingWorkPolicy

/**
 * Boot Receiver to reschedule Adhan alarms after device restart.
 * This receiver is triggered when the device finishes booting.
 * 
 * Note: The actual rescheduling happens in the web layer when the app is opened.
 * This receiver ensures the app is notified about the reboot.
 */
class BootReceiver : BroadcastReceiver() {
    
    companion object {
        private const val TAG = "BootReceiver"
    }
    
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == "android.intent.action.QUICKBOOT_POWERON") {
            Log.d(TAG, "🚀 Device boot completed - Silently restarting sustainability worker")

            try {
                // Enqueue immediate OneTimeWork to reschedule alarms NOW
                val oneTime = OneTimeWorkRequest.Builder(SustainabilityWorker::class.java).build()
                
                WorkManager.getInstance(context).enqueueUniqueWork(
                    "AlBayanBootRecovery",
                    ExistingWorkPolicy.REPLACE,
                    oneTime
                )
                
                Log.d(TAG, "✅ Boot Recovery Worker Enqueued")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to enqueue boot worker", e)
            }
        }
    }
}
