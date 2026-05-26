package com.albayan.quran

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import androidx.core.app.NotificationCompat

/**
 * SalawatAlertReceiver - Plays Salawat (blessings upon the Prophet ﷺ) reminder
 *
 * Modified to be fully self-contained (Native Audio + Visual)
 * Avoids Android 12+ Foreground Service Background Start Restrictions
 */
class SalawatAlertReceiver : BroadcastReceiver() {
    
    companion object {
        const val ACTION_SALAWAT_ALERT = "com.albayan.quran.ACTION_SALAWAT_ALERT"
        const val EXTRA_SOUND_ID = "SOUND_ID" // salawat_one, salawat_two, salawat_three
        const val EXTRA_SOUND_ENABLED = "SOUND_ENABLED"
        const val EXTRA_VOLUME = "VOLUME"
        const val EXTRA_SHOULD_RESUME = "SHOULD_RESUME"
        
        // Broadcast actions for JS Layer to pause/resume Quran
        const val ACTION_SALAWAT_STARTED = "com.albayan.quran.ACTION_SALAWAT_STARTED"
        const val ACTION_SALAWAT_FINISHED = "com.albayan.quran.ACTION_SALAWAT_FINISHED"

        // Keep active players in memory to prevent Garbage Collection during playback
        private val activePlayers = java.util.Collections.synchronizedList(mutableListOf<MediaPlayer>())
    }
    
    override fun onReceive(context: Context, intent: Intent) {
        val pendingResult = goAsync() // Keeps CPU awake for the duration of the audio
        
        android.util.Log.d("SalawatAlert", "🤲 Received Salawat reminder broadcast! Action: ${intent.action}")

        // 🛡️ BATHROOM / PRIVACY MODE CHECK 🛡️
        val prefs = context.getSharedPreferences("AlBayanPrefs", Context.MODE_PRIVATE)
        val privacyEndTime = prefs.getLong("BATHROOM_MODE_END_TIME", 0)
        
        if (System.currentTimeMillis() < privacyEndTime) {
            android.util.Log.d("SalawatAlert", "🛑 BLOCKED: Bathroom/Privacy Mode is active. Skipping Salawat.")
            pendingResult.finish()
            return
        }

        val soundId = intent.getStringExtra(EXTRA_SOUND_ID) ?: "salawat_one"
        val soundEnabled = intent.getBooleanExtra(EXTRA_SOUND_ENABLED, true)
        val volume = intent.getIntExtra(EXTRA_VOLUME, 80)
        
        // 1. Show Native Visual Notification (Guarantees Sync)
        showVisualNotification(context)

        if (!soundEnabled) {
             android.util.Log.d("SalawatAlert", "🔇 Sound disabled, skipping playback.")
             pendingResult.finish()
             return
        }

        // 2. Resolve Sound File
        var targetSoundId = soundId
        if (targetSoundId == "random") {
            val availableSounds = listOf("salawat_one", "salawat_two", "salawat_three", "salawat_four", "salawat_five")
            val lastPlayed = prefs.getString("last_salawat_sound", "")
            val candidates = if (availableSounds.size > 1 && lastPlayed != null) {
                availableSounds.filter { it != lastPlayed }
            } else {
                availableSounds
            }
            targetSoundId = candidates.random()
            prefs.edit().putString("last_salawat_sound", targetSoundId).apply()
        }

        var resId = context.resources.getIdentifier(targetSoundId, "raw", context.packageName)
        if (resId == 0) {
            resId = context.resources.getIdentifier("salawat_one", "raw", context.packageName)
        }
        if (resId == 0) {
            pendingResult.finish()
            return
        }

        // 3. Play Audio and Manage Focus
        try {
            val mediaPlayer = MediaPlayer.create(context, resId)
            if (mediaPlayer == null) {
                pendingResult.finish()
                return
            }
            activePlayers.add(mediaPlayer)

            val volumeFloat = volume.coerceIn(0, 100) / 100f
            mediaPlayer.setVolume(volumeFloat, volumeFloat)
            
            val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            var focusRequest: AudioFocusRequest? = null
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build()
                    )
                    .build()
                audioManager.requestAudioFocus(focusRequest)
            } else {
                @Suppress("DEPRECATION")
                audioManager.requestAudioFocus(null, AudioManager.STREAM_NOTIFICATION, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
            }

            // Notify JS Layer to Pause Quran (if playing)
            val startIntent = Intent(ACTION_SALAWAT_STARTED).apply {
                setPackage(context.packageName)
            }
            context.sendBroadcast(startIntent)
            
            // VISUAL FEEDBACK: Show a Toast (on Main Thread) in the lower half
            android.os.Handler(android.os.Looper.getMainLooper()).post {
                val toast = android.widget.Toast.makeText(context, "اللهم صلِّ وسلم على نبينا محمد", android.widget.Toast.LENGTH_SHORT)
                toast.show()
                
                // Optional: Cancel toast exactly when audio finishes, though LENGTH_SHORT (2s) is usually perfect.
                mediaPlayer.setOnCompletionListener { mp ->
                    // Release Audio Focus
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && focusRequest != null) {
                        audioManager.abandonAudioFocusRequest(focusRequest)
                    } else {
                        @Suppress("DEPRECATION")
                        audioManager.abandonAudioFocus(null)
                    }
                    
                    toast.cancel() // Cancel exactly when audio finishes
                    mp.release()
                    activePlayers.remove(mp)
                    
                    // Notify JS Layer to Resume Quran
                    val finishIntent = Intent(ACTION_SALAWAT_FINISHED).apply {
                        setPackage(context.packageName)
                    }
                    context.sendBroadcast(finishIntent)
                    
                    pendingResult.finish() // Let the system sleep
                }

                mediaPlayer.setOnErrorListener { mp, what, extra ->
                    android.util.Log.e("SalawatAlert", "MediaPlayer error: what=$what, extra=$extra")
                    // Release Audio Focus
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && focusRequest != null) {
                        audioManager.abandonAudioFocusRequest(focusRequest)
                    } else {
                        @Suppress("DEPRECATION")
                        audioManager.abandonAudioFocus(null)
                    }
                    
                    toast.cancel()
                    mp.release()
                    activePlayers.remove(mp)
                    
                    // Notify JS Layer to Resume Quran
                    val finishIntent = Intent(ACTION_SALAWAT_FINISHED).apply {
                        setPackage(context.packageName)
                    }
                    context.sendBroadcast(finishIntent)
                    
                    pendingResult.finish()
                    true
                }
            }
            
            mediaPlayer.start()
            
        } catch (e: Exception) {
            android.util.Log.e("SalawatAlert", "Failed to play Salawat directly: ${e.message}")
            pendingResult.finish()
        }
    }

    private fun showVisualNotification(context: Context) {
        try {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            
            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            val pendingIntent = PendingIntent.getActivity(
                context, 0, launchIntent, 
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val notification = NotificationCompat.Builder(context, "bayan_salawat")
                .setContentTitle("🤲 صلّ على النبي ﷺ")
                .setContentText("اللهم صلِّ وسلم على نبينا محمد")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setPriority(NotificationCompat.PRIORITY_HIGH) // Shows Heads-up popup
                .setCategory(NotificationCompat.CATEGORY_EVENT)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .build()
                
            val notificationId = (System.currentTimeMillis() % 100000).toInt() + 800000
            notificationManager.notify(notificationId, notification)
            
        } catch (e: Exception) {
            android.util.Log.e("SalawatAlert", "Failed to show visual notification: ${e.message}")
        }
    }
}
