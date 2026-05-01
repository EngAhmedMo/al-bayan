package com.albayan.quran

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class OnTimeChangeReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        
        if (Intent.ACTION_TIME_CHANGED == action || Intent.ACTION_TIMEZONE_CHANGED == action) {
            Log.d("OnTimeChangeReceiver", "⏰ Time/Timezone changed detected ($action). Rescheduling prayers...")
            
            // Trigger rescheduling via NativePrayerScheduler directly
            // We use the existing 'schedulePrayers' method which recalculates everything based on current time
            NativePrayerScheduler.schedulePrayers(context)
            
            // Also notify the JS layer if the app is running (optional but good for UI sync)
            // We can't easily reach JS from here without a running Activity, so we rely on the native scheduler 
            // to update the alarms. The UI will update on next open/resume.
        }
    }
}
