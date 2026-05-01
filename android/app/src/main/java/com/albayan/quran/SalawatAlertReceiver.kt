package com.albayan.quran

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/**
 * SalawatAlertReceiver - Plays Salawat (blessings upon the Prophet ﷺ) reminder
 * 
 * Similar to popular apps like Muslim Pro's Dhikr Reminder feature.
 * Plays offline audio files bundled with the app.
 */
class SalawatAlertReceiver : BroadcastReceiver() {
    
    companion object {
        const val ACTION_SALAWAT_ALERT = "com.albayan.quran.ACTION_SALAWAT_ALERT"
        const val EXTRA_SOUND_ID = "SOUND_ID" // salawat_one, salawat_two, salawat_three
        const val EXTRA_SOUND_ENABLED = "SOUND_ENABLED"
        const val EXTRA_VOLUME = "VOLUME"
        const val EXTRA_SHOULD_RESUME = "SHOULD_RESUME"
    }
    
    override fun onReceive(context: Context, intent: Intent) {
        android.util.Log.d("SalawatAlert", "🤲 Received Salawat reminder broadcast! Action: ${intent.action}")

        // 🛡️ BATHROOM / PRIVACY MODE CHECK 🛡️
        val prefs = context.getSharedPreferences("AlBayanPrefs", Context.MODE_PRIVATE)
        val privacyEndTime = prefs.getLong("BATHROOM_MODE_END_TIME", 0)
        
        if (System.currentTimeMillis() < privacyEndTime) {
            android.util.Log.d("SalawatAlert", "🛑 BLOCKED: Bathroom/Privacy Mode is active. Skipping Salawat.")
            return
        }

        
        val soundId = intent.getStringExtra(EXTRA_SOUND_ID) ?: "salawat_one"
        val soundEnabled = intent.getBooleanExtra(EXTRA_SOUND_ENABLED, true)
        val volume = intent.getIntExtra(EXTRA_VOLUME, 80)
        val shouldResume = intent.getBooleanExtra(EXTRA_SHOULD_RESUME, false)
        
        if (!soundEnabled) {
             android.util.Log.d("SalawatAlert", "🔇 Sound disabled, skipping playback.")
             return
        }

        // Delegate to AudioPlaybackService for robust audio focus handling
        val serviceIntent = Intent(context, AudioPlaybackService::class.java).apply {
            action = AudioPlaybackService.ACTION_PLAY_SALAWAT
            putExtra(AudioPlaybackService.EXTRA_SOUND_ID, soundId)
            putExtra(AudioPlaybackService.EXTRA_VOLUME, volume)
            putExtra(AudioPlaybackService.EXTRA_SHOULD_RESUME, shouldResume)
        }
        
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
            android.util.Log.d("SalawatAlert", "🚀 Started AudioPlaybackService for Salawat")
        } catch (e: Exception) {
             android.util.Log.e("SalawatAlert", "Failed to start service: ${e.message}")
        }
    }
}
