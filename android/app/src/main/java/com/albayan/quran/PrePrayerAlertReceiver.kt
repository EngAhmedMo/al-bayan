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
 * PrePrayerAlertReceiver - Plays a short audio alert before prayer time
 * 
 * Similar to popular apps like Muslim Pro and Athan, this provides an audio reminder
 * before the actual Azhan. Uses ALARM stream for maximum reliability.
 */
class PrePrayerAlertReceiver : BroadcastReceiver() {
    
    companion object {
        const val ACTION_PRE_PRAYER_ALERT = "com.albayan.quran.ACTION_PRE_PRAYER_ALERT"
        const val EXTRA_ALERT_SOUND = "ALERT_SOUND" // alert_approaching or alert_prayer_reminder
        const val EXTRA_PRAYER_NAME = "PRAYER_NAME"
        const val EXTRA_VOLUME = "VOLUME"
    }
    
    override fun onReceive(context: Context, intent: Intent) {
        android.util.Log.d("PrePrayerAlert", "🔔 Received pre-prayer alert broadcast! Action: ${intent.action}")

        // 🛡️ BATHROOM / PRIVACY MODE CHECK 🛡️
        val prefs = context.getSharedPreferences("AlBayanPrefs", Context.MODE_PRIVATE)
        val privacyEndTime = prefs.getLong("BATHROOM_MODE_END_TIME", 0)
        
        if (System.currentTimeMillis() < privacyEndTime) {
            android.util.Log.d("PrePrayerAlert", "🛑 BLOCKED: Bathroom/Privacy Mode is active. Skipping Alert.")
            return
        }

        
        val alertSound = intent.getStringExtra(EXTRA_ALERT_SOUND) ?: "alert_approaching"
        val prayerName = intent.getStringExtra(EXTRA_PRAYER_NAME) ?: "الصلاة"
        val volume = intent.getIntExtra(EXTRA_VOLUME, 80)
        
        android.util.Log.d("PrePrayerAlert", "📢 Playing alert: $alertSound for $prayerName at volume $volume")

        // Acquire WakeLock briefly for playback
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        @Suppress("DEPRECATION")
        val wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "AlBayan:PrePrayerAlertWakeLock"
        )
        
        try {
            wakeLock.acquire(30 * 1000L) // 30 seconds max
            android.util.Log.d("PrePrayerAlert", "✅ WakeLock acquired")
        } catch (e: Exception) {
            android.util.Log.e("PrePrayerAlert", "❌ Failed to acquire WakeLock: ${e.message}")
        }

        // Vibrate first for tactile feedback
        vibrateDevice(context)

        // Play alert sound
        playAlertSound(context, alertSound, volume) {
            // Release WakeLock after playback completes
            try {
                if (wakeLock.isHeld) {
                    wakeLock.release()
                    android.util.Log.d("PrePrayerAlert", "WakeLock released")
                }
            } catch (e: Exception) {
                android.util.Log.w("PrePrayerAlert", "Error releasing WakeLock: ${e.message}")
            }
        }
    }
    
    private fun vibrateDevice(context: Context) {
        try {
            val vibrationPattern = longArrayOf(0, 300, 100, 300) // Pattern: wait, vibrate, wait, vibrate
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                val vibrator = vibratorManager.defaultVibrator
                vibrator.vibrate(VibrationEffect.createWaveform(vibrationPattern, -1))
            } else {
                @Suppress("DEPRECATION")
                val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(vibrationPattern, -1))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(vibrationPattern, -1)
                }
            }
            android.util.Log.d("PrePrayerAlert", "📳 Vibrated device")
        } catch (e: Exception) {
            android.util.Log.e("PrePrayerAlert", "Failed to vibrate: ${e.message}")
        }
    }
    
    private fun playAlertSound(context: Context, soundName: String, volume: Int, onComplete: () -> Unit) {
        try {
            // Get resource ID for the sound
            val resId = context.resources.getIdentifier(soundName, "raw", context.packageName)
            val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            
            // 1. Request Audio Focus (Transient) to pause other apps (like Quran/Music)
            // We use GAIN_TRANSIENT so others pause and can resume later
            val focusResult: Int
            val audioAttributes = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            } else {
                null
            }

            var audioFocusRequest: Any? = null

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                audioFocusRequest = android.media.AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                    .setAudioAttributes(audioAttributes!!)
                    .setAcceptsDelayedFocusGain(false)
                    .setOnAudioFocusChangeListener { /* No-op: we hold focus briefly */ }
                    .build()
                focusResult = audioManager.requestAudioFocus(audioFocusRequest as android.media.AudioFocusRequest)
            } else {
                @Suppress("DEPRECATION")
                focusResult = audioManager.requestAudioFocus(
                    null,
                    AudioManager.STREAM_ALARM,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT
                )
            }

            if (focusResult != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                android.util.Log.w("PrePrayerAlert", "⚠️ Audio focus request denied/delayed, playing anyway but might overlap")
            } else {
                android.util.Log.d("PrePrayerAlert", "✅ Audio focus GRANTED (Transient)")
            }

            if (resId == 0) {
                android.util.Log.w("PrePrayerAlert", "Sound not found: $soundName, using default notification")
                val defaultUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                val ringtone = RingtoneManager.getRingtone(context, defaultUri)
                ringtone?.play()
                
                // Abandon focus after short delay for Ringtone
                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                   abandonFocus(audioManager, audioFocusRequest)
                   onComplete() 
                }, 2000)
                return
            }
            
            val mediaPlayer = MediaPlayer.create(context, resId)
            
            if (mediaPlayer == null) {
                android.util.Log.e("PrePrayerAlert", "Failed to create MediaPlayer for $soundName")
                abandonFocus(audioManager, audioFocusRequest)
                onComplete()
                return
            }
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                mediaPlayer.setAudioAttributes(audioAttributes)
            }
            
            // Set volume (0-100 -> 0.0-1.0)
            val volumeFloat = volume.coerceIn(0, 100) / 100f
            mediaPlayer.setVolume(volumeFloat, volumeFloat)
            
            mediaPlayer.setOnCompletionListener { mp ->
                android.util.Log.d("PrePrayerAlert", "✅ Alert sound completed")
                mp.release()
                // 2. Abandon Audio Focus so other apps resume
                abandonFocus(audioManager, audioFocusRequest)
                onComplete()
            }
            
            mediaPlayer.setOnErrorListener { mp, what, extra ->
                android.util.Log.e("PrePrayerAlert", "MediaPlayer error: what=$what, extra=$extra")
                mp.release()
                abandonFocus(audioManager, audioFocusRequest)
                onComplete()
                true
            }
            
            mediaPlayer.start()
            android.util.Log.d("PrePrayerAlert", "🔊 Started playing: $soundName")
            
        } catch (e: Exception) {
            android.util.Log.e("PrePrayerAlert", "Error playing alert: ${e.message}", e)
            onComplete()
        }
    }

    private fun abandonFocus(audioManager: AudioManager, focusRequest: Any?) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && focusRequest != null) {
                audioManager.abandonAudioFocusRequest(focusRequest as android.media.AudioFocusRequest)
            } else {
                @Suppress("DEPRECATION")
                audioManager.abandonAudioFocus(null)
            }
            android.util.Log.d("PrePrayerAlert", "🔇 Audio focus abandoned (Resume others)")
        } catch (e: Exception) {
            android.util.Log.w("PrePrayerAlert", "Error abandoning focus: ${e.message}")
        }
    }
}
