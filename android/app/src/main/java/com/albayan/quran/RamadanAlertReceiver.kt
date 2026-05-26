package com.albayan.quran

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
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
import androidx.core.app.NotificationCompat

class RamadanAlertReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_RAMADAN_ALERT = "com.albayan.quran.ACTION_RAMADAN_ALERT"
        const val EXTRA_TITLE = "TITLE"
        const val EXTRA_BODY = "BODY"
        const val EXTRA_SOUND = "SOUND"
        const val EXTRA_VOLUME = "VOLUME"

        // Keep active players in memory to prevent Garbage Collection during playback
        private val activePlayers = java.util.Collections.synchronizedList(mutableListOf<MediaPlayer>())
    }

    override fun onReceive(context: Context, intent: Intent) {
        val title = intent.getStringExtra(EXTRA_TITLE) ?: "تنبيه رمضان"
        val body = intent.getStringExtra(EXTRA_BODY) ?: ""
        val sound = intent.getStringExtra(EXTRA_SOUND) ?: "alert_prayer_reminder"
        val volume = intent.getIntExtra(EXTRA_VOLUME, 80)

        android.util.Log.d("RamadanAlert", "🌙 Received Ramadan alert: $title - $body")

        // 🛡️ BATHROOM / PRIVACY MODE CHECK 🛡️
        val prefs = context.getSharedPreferences("AlBayanPrefs", Context.MODE_PRIVATE)
        val privacyEndTime = prefs.getLong("BATHROOM_MODE_END_TIME", 0)
        
        if (System.currentTimeMillis() < privacyEndTime) {
            android.util.Log.d("RamadanAlert", "🛑 BLOCKED: Bathroom/Privacy Mode is active. Skipping Alert.")
            return
        }

        // Post Visual Notification
        postNotification(context, title, body)

        // Wake and Play Sound
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        @Suppress("DEPRECATION")
        val wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "AlBayan:RamadanAlertWakeLock"
        )
        
        try {
            wakeLock.acquire(30 * 1000L) // 30 seconds max
        } catch (e: Exception) {
            android.util.Log.e("RamadanAlert", "Failed to acquire WakeLock: ${e.message}")
        }

        vibrateDevice(context)

        playAlertSound(context, sound, volume) {
            try {
                if (wakeLock.isHeld) {
                    wakeLock.release()
                }
            } catch (e: Exception) {}
        }
    }

    private fun postNotification(context: Context, title: String, body: String) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = "bayan_ramadan_alerts"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "إشعارات رمضان",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "إشعارات السحور والإفطار والعشر الأواخر"
                enableVibration(true)
            }
            notificationManager.createNotificationChannel(channel)
        }

        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            context, 0, launchIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        )

        var iconRes = context.resources.getIdentifier("ic_stat_moon", "drawable", context.packageName)
        if (iconRes == 0) {
            iconRes = context.resources.getIdentifier("ic_launcher", "mipmap", context.packageName)
        }
        if (iconRes == 0) {
            iconRes = context.applicationInfo.icon
        }

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(iconRes)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        notificationManager.notify(System.currentTimeMillis().toInt(), notification)
    }

    private fun vibrateDevice(context: Context) {
        try {
            val vibrationPattern = longArrayOf(0, 300, 100, 300)
            
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
        } catch (e: Exception) {
            android.util.Log.e("RamadanAlert", "Failed to vibrate: ${e.message}")
        }
    }
    
    private fun playAlertSound(context: Context, soundName: String, volume: Int, onComplete: () -> Unit) {
        try {
            val resId = context.resources.getIdentifier(soundName, "raw", context.packageName)
            val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            
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
                    .setOnAudioFocusChangeListener { }
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

            if (resId == 0) {
                val defaultUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                val ringtone = RingtoneManager.getRingtone(context, defaultUri)
                ringtone?.play()
                
                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                   abandonFocus(audioManager, audioFocusRequest)
                   onComplete() 
                }, 2000)
                return
            }
            
            val mediaPlayer = MediaPlayer.create(context, resId)
            if (mediaPlayer == null) {
                abandonFocus(audioManager, audioFocusRequest)
                onComplete()
                return
            }
            activePlayers.add(mediaPlayer)
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                mediaPlayer.setAudioAttributes(audioAttributes)
            }
            
            val volumeFloat = volume.coerceIn(0, 100) / 100f
            mediaPlayer.setVolume(volumeFloat, volumeFloat)
            
            mediaPlayer.setOnCompletionListener { mp ->
                mp.release()
                activePlayers.remove(mp)
                abandonFocus(audioManager, audioFocusRequest)
                onComplete()
            }
            
            mediaPlayer.setOnErrorListener { mp, _, _ ->
                mp.release()
                activePlayers.remove(mp)
                abandonFocus(audioManager, audioFocusRequest)
                onComplete()
                true
            }
            
            mediaPlayer.start()
            
        } catch (e: Exception) {
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
        } catch (e: Exception) {}
    }
}
