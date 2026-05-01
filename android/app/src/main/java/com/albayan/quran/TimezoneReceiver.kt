package com.albayan.quran

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * TimezoneReceiver - Part of Project Eternity
 * Detects timezone changes (e.g., travel) and prompts the user to update prayer times.
 * This is the "Smart Resilience" alternative to risky background location checks.
 */
class TimezoneReceiver : BroadcastReceiver() {

    companion object {
        const val TAG = "TimezoneReceiver"
        const val TIMEZONE_CHANNEL_ID = "bayan_timezone_alerts"
        const val NOTIFICATION_ID = 8888

        fun showTimezonePrompt(context: Context, newZone: String) {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            // Create Channel if highly important
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    TIMEZONE_CHANNEL_ID,
                    "تحديث الموقع والسفر",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "تنبيه عند تغيير المنطقة الزمنية لتحديث الصلاة"
                    enableVibration(true)
                }
                notificationManager.createNotificationChannel(channel)
            }

            // Tap Intent -> Open App
            val tapIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                context, 0, tapIntent, 
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val notification = NotificationCompat.Builder(context, TIMEZONE_CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher) // Ensure this exists
                .setContentTitle("تم تحديث المنطقة الزمنية")
                .setContentText("تم تحديث مواقيت الصلاة تلقائياً لتوافق توقيت $newZone.")
                .setStyle(NotificationCompat.BigTextStyle().bigText("لاحظنا تغييراً في التوقيت إلى $newZone. قمنا بتحديث مواقيت الصلاة وجدول الأذان تلقائياً لضمان الدقة."))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_EVENT)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .build()

            notificationManager.notify(NOTIFICATION_ID, notification)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_TIMEZONE_CHANGED) {
            val pendingResult = goAsync()
            
            try {
                val currentTimezone = java.util.TimeZone.getDefault().id
                Log.d(TAG, "🌍 Timezone changed to: $currentTimezone")

                val prefs = context.getSharedPreferences("AlBayanPersistence", Context.MODE_PRIVATE)
                val storedTimezone = prefs.getString("timezoneId", "")

                // Only alert if we actually have a stored timezone (fresh install case ignored)
                // and it's different (redundant check, but safe)
                if (!storedTimezone.isNullOrEmpty() && storedTimezone != currentTimezone) {
                    Log.w(TAG, "⚠️ Significant displacement detected! Stored: $storedTimezone, New: $currentTimezone")
                    
                    // 1. AUTO-FIX: Update Persistence
                    prefs.edit().putString("timezoneId", currentTimezone).apply()
                    Log.d(TAG, "✅ Updated persistence with new timezone: $currentTimezone")
                    
                    // 2. IMMEDIATE RESCHEDULE
                    // Now that prefs match, the scheduler will proceed instead of aborting
                    NativePrayerScheduler.schedulePrayers(context)
                    
                    // 3. Notify User (Success)
                    showTimezonePrompt(context, currentTimezone)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error handling timezone change", e)
            } finally {
                pendingResult.finish()
            }
        }
    }

    // Removed private method as it is now in companion object
}
