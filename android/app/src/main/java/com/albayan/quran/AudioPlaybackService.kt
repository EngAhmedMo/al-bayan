package com.albayan.quran

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.datasource.RawResourceDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.media3.session.CommandButton
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionResult
import com.google.common.util.concurrent.Futures

class AudioPlaybackService : MediaSessionService(), SensorEventListener {

    companion object {
        const val CHANNEL_ID = "audio_playback_channel"
        const val AZHAN_CHANNEL_ID = "azhan_playback_channel"
        const val NOTIFICATION_ID = 1001
        const val AZHAN_NOTIFICATION_ID = 1002
        const val SALAWAT_NOTIFICATION_ID = 1003
        
        const val ACTION_PLAY_AZHAN = "ACTION_PLAY_AZHAN"
        const val ACTION_STOP_AZHAN = "ACTION_STOP_AZHAN"
        const val ACTION_PAUSE_AZHAN = "ACTION_PAUSE_AZHAN"
        const val ACTION_RESUME_AZHAN = "ACTION_RESUME_AZHAN"
        const val ACTION_TOGGLE_MUTE_AZHAN = "ACTION_TOGGLE_MUTE_AZHAN"
        
        const val EXTRA_MUAZZIN_ID = "MUAZZIN_ID"
        const val EXTRA_PRAYER_NAME = "PRAYER_NAME"
        const val EXTRA_PRAYER_TIME = "PRAYER_TIME"
        const val EXTRA_VOLUME = "VOLUME"
        const val EXTRA_SOUND_ID = "SOUND_ID"
        
        const val ACTION_SET_VOLUME = "ACTION_SET_VOLUME"
        const val ACTION_AZHAN_STARTED = "com.albayan.quran.ACTION_AZHAN_STARTED"
        const val ACTION_AZHAN_STATE_CHANGED = "com.albayan.quran.ACTION_AZHAN_STATE_CHANGED"
        const val ACTION_AZHAN_PROGRESS = "com.albayan.quran.ACTION_AZHAN_PROGRESS"
        
        // Global Stop Action (e.g. for Bathroom Mode)
        const val ACTION_STOP = "ACTION_STOP"
        
        // Sleep Timer Actions
        const val ACTION_SET_SLEEP_TIMER = "ACTION_SET_SLEEP_TIMER"
        const val ACTION_CANCEL_SLEEP_TIMER = "ACTION_CANCEL_SLEEP_TIMER"
        const val ACTION_SLEEP_TIMER_FINISHED = "com.albayan.quran.ACTION_SLEEP_TIMER_FINISHED"
    }

    private var player: ExoPlayer? = null
    private var mediaSession: MediaSession? = null
    
    // State
    private var isPlayingAzhan = false
    private var isAzhanPaused = false
    private var isAzhanMuted = false
    private var isCurrentAzhanReal = false // NEW: Track if current playback is a real prayer time
    private var savedAzhanVolume = 1.0f

    // Smart Resume State
    private var savedMediaItem: MediaItem? = null
    private var savedPosition: Long = 0
    private var savedPlayWhenReady: Boolean = false
    
    // Metadata
    private var currentPrayerName: String = "الصلاة"
    private var currentPrayerTime: String = ""
    
    // System Services
    private var wakeLock: PowerManager.WakeLock? = null
    private var audioManager: AudioManager? = null
    private var azhanFocusRequest: AudioFocusRequest? = null
    
    // Progress Updates
    private var progressHandler: android.os.Handler? = null
    private var progressRunnable: Runnable? = null

    // Sensor State
    private var sensorManager: SensorManager? = null
    private var accelerometer: Sensor? = null
    
    // Gesture Logic State
    private val alpha = 0.85f
    private val gravity = FloatArray(3)
    private var faceDownStartTime = 0L
    private var gestureControlsEnabled = true
    private var flipToStopEnabled = true
    private var volumeToStopEnabled = true
    private var volumeObserver: VolumeObserver? = null

    // Audio Fade Logic
    private var fadeHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private var fadeRunnable: Runnable? = null
    private val FADE_IN_DURATION = 3000L // 3 seconds
    private val FADE_OUT_DURATION = 1500L // 1.5 seconds

    // Sleep Timer Logic
    private var sleepTimerHandler: android.os.Handler? = null
    private var sleepTimerRunnable: java.lang.Runnable? = null
    private var sleepTimerEndTime: Long = 0

    private fun fadeInCurrentPlayer(targetVolume: Float) {
        fadeRunnable?.let { fadeHandler.removeCallbacks(it) }
        player?.volume = 0f
        
        val startVolume = 0f
        val steps = 30
        val interval = FADE_IN_DURATION / steps
        val volumeStep = (targetVolume - startVolume) / steps
        
        var currentStep = 0
        fadeRunnable = object : Runnable {
            override fun run() {
                if (player != null && currentStep < steps) {
                    player?.volume = startVolume + (volumeStep * currentStep)
                    currentStep++
                    fadeHandler.postDelayed(this, interval)
                } else if (player != null) {
                    player?.volume = targetVolume
                }
            }
        }
        fadeHandler.post(fadeRunnable!!)
    }


    private inner class VolumeObserver : android.database.ContentObserver(android.os.Handler(android.os.Looper.getMainLooper())) {
        private var initialVolume: Int = -1

        fun register() {
            if (audioManager != null) {
                initialVolume = audioManager!!.getStreamVolume(AudioManager.STREAM_ALARM)
            }
            contentResolver.registerContentObserver(
                android.provider.Settings.System.CONTENT_URI,
                true,
                this
            )
        }

        fun unregister() {
            contentResolver.unregisterContentObserver(this)
        }

        override fun onChange(selfChange: Boolean) {
            super.onChange(selfChange)
            if (!isPlayingAzhan || !volumeToStopEnabled) return
            
            val currentVolume = audioManager?.getStreamVolume(AudioManager.STREAM_ALARM) ?: -1
            if (currentVolume != -1 && initialVolume != -1 && currentVolume != initialVolume) {
                // Volume changed (button pressed), stop azhan
                logToCatalog("🔉 Volume Button Stop Triggered")
                triggerGestureStop("VOLUME_BUTTON")
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        accelerometer = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        
        createNotificationChannel()
        initializePlayer()
        
        // Create MediaSession with ForwardingPlayer to always show skip buttons
        player?.let { actualPlayer ->
            // Use ForwardingPlayer to make skip buttons always visible in notification
            val forwardingPlayer = RadioForwardingPlayer(actualPlayer)
            
            val stopCommand = SessionCommand("STOP_AZHAN", android.os.Bundle.EMPTY)
            val stopButton = CommandButton.Builder()
                .setDisplayName("إيقاف")
                .setSessionCommand(stopCommand)
                .setIconResId(R.drawable.ic_stop)
                .build()

            mediaSession = MediaSession.Builder(this, forwardingPlayer)
                .setCallback(object : MediaSession.Callback {
                    override fun onConnect(
                        session: MediaSession,
                        controller: MediaSession.ControllerInfo
                    ): MediaSession.ConnectionResult {
                        // Enable skip to next/previous commands for media notification
                        val sessionCommands = MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS.buildUpon()
                            .add(androidx.media3.session.SessionCommand("SKIP_TO_NEXT", android.os.Bundle.EMPTY))
                            .add(androidx.media3.session.SessionCommand("SKIP_TO_PREVIOUS", android.os.Bundle.EMPTY))
                            .add(SessionCommand("STOP_AZHAN", android.os.Bundle.EMPTY))
                            .build()
                        
                        val playerCommands = MediaSession.ConnectionResult.DEFAULT_PLAYER_COMMANDS.buildUpon()
                            .add(androidx.media3.common.Player.COMMAND_SEEK_TO_NEXT)
                            .add(androidx.media3.common.Player.COMMAND_SEEK_TO_PREVIOUS)
                            .add(androidx.media3.common.Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)
                            .add(androidx.media3.common.Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)
                            .build()
                        
                        return MediaSession.ConnectionResult.AcceptedResultBuilder(session)
                            .setAvailableSessionCommands(sessionCommands)
                            .setAvailablePlayerCommands(playerCommands)
                            .build()
                    }
                    
                    // Handle seekToNext/seekToPrevious calls from notification
                    @Suppress("DEPRECATION")
                    override fun onPlayerCommandRequest(
                        session: MediaSession,
                        controller: MediaSession.ControllerInfo,
                        playerCommand: Int
                    ): Int {
                        when (playerCommand) {
                            Player.COMMAND_SEEK_TO_NEXT, Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM -> {
                                android.util.Log.d("AudioPlaybackService", "⏭️ Notification: Skip to Next Station")
                                sendBroadcast(Intent("com.albayan.quran.ACTION_NEXT").apply {
                                    setPackage(packageName) // Required for RECEIVER_NOT_EXPORTED
                                })
                                return androidx.media3.session.SessionResult.RESULT_SUCCESS
                            }
                            Player.COMMAND_SEEK_TO_PREVIOUS, Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM -> {
                                android.util.Log.d("AudioPlaybackService", "⏮️ Notification: Skip to Previous Station")
                                sendBroadcast(Intent("com.albayan.quran.ACTION_PREV").apply {
                                    setPackage(packageName) // Required for RECEIVER_NOT_EXPORTED
                                })
                                return androidx.media3.session.SessionResult.RESULT_SUCCESS
                            }
                        }
                        return super.onPlayerCommandRequest(session, controller, playerCommand)
                    }
                    
                    override fun onCustomCommand(
                        session: MediaSession,
                        controller: MediaSession.ControllerInfo,
                        customCommand: androidx.media3.session.SessionCommand,
                        args: android.os.Bundle
                    ): com.google.common.util.concurrent.ListenableFuture<androidx.media3.session.SessionResult> {
                        when (customCommand.customAction) {
                            "SKIP_TO_NEXT" -> {
                                android.util.Log.d("AudioPlaybackService", "⏭️ MediaSession: Skip to Next")
                                sendBroadcast(Intent("com.albayan.quran.ACTION_NEXT").apply {
                                    setPackage(packageName) // Required for RECEIVER_NOT_EXPORTED
                                })
                            }
                            "SKIP_TO_PREVIOUS" -> {
                                android.util.Log.d("AudioPlaybackService", "⏮️ MediaSession: Skip to Previous")
                                sendBroadcast(Intent("com.albayan.quran.ACTION_PREV").apply {
                                    setPackage(packageName) // Required for RECEIVER_NOT_EXPORTED
                                })
                            }
                            "STOP_AZHAN" -> {
                                android.util.Log.d("AudioPlaybackService", "🛑 MediaSession: Stop Action")
                                stopAzhan()
                            }
                        }
                        return com.google.common.util.concurrent.Futures.immediateFuture(
                            androidx.media3.session.SessionResult(androidx.media3.session.SessionResult.RESULT_SUCCESS)
                        )
                    }
                })
                .setCustomLayout(listOf(stopButton))
                .build()
        }
    }
    
    /**
     * ForwardingPlayer that allows native seeking if playlist has items (Gapless),
     * otherwise falls back to broadcasting intents (Legacy/Radio).
     */
    private inner class RadioForwardingPlayer(player: Player) : androidx.media3.common.ForwardingPlayer(player) {
        override fun hasPreviousMediaItem(): Boolean = true
        override fun hasNextMediaItem(): Boolean = true
        
        override fun getAvailableCommands(): Player.Commands {
            return super.getAvailableCommands().buildUpon()
                .add(Player.COMMAND_SEEK_TO_NEXT)
                .add(Player.COMMAND_SEEK_TO_PREVIOUS)
                .add(Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)
                .add(Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)
                .add(Player.COMMAND_CHANGE_MEDIA_ITEMS) // Allow adding items
                .build()
        }
        
        override fun isCommandAvailable(command: Int): Boolean {
            return when (command) {
                Player.COMMAND_SEEK_TO_NEXT,
                Player.COMMAND_SEEK_TO_PREVIOUS,
                Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
                Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM,
                Player.COMMAND_CHANGE_MEDIA_ITEMS -> true
                else -> super.isCommandAvailable(command)
            }
        }
        
        override fun seekToNext() {
            // Gapless Logic: If we have a real next item in the buffer, play it natively!
            if (super.hasNextMediaItem()) {
                android.util.Log.d("AudioPlaybackService", "⏭️ Native seekToNext (Gapless)")
                super.seekToNext()
            } else {
                android.util.Log.d("AudioPlaybackService", "⏭️ Broadcast seekToNext (Legacy)")
                sendBroadcast(Intent("com.albayan.quran.ACTION_NEXT").apply {
                    setPackage(packageName)
                })
            }
        }
        
        override fun seekToPrevious() {
             if (super.hasPreviousMediaItem()) {
                android.util.Log.d("AudioPlaybackService", "⏮️ Native seekToPrevious (Gapless)")
                super.seekToPrevious()
            } else {
                android.util.Log.d("AudioPlaybackService", "⏮️ Broadcast seekToPrevious (Legacy)")
                sendBroadcast(Intent("com.albayan.quran.ACTION_PREV").apply {
                    setPackage(packageName)
                })
            }
        }
        
        override fun seekToNextMediaItem() {
            if (super.hasNextMediaItem()) {
                super.seekToNextMediaItem()
            } else {
                sendBroadcast(Intent("com.albayan.quran.ACTION_NEXT").apply {
                    setPackage(packageName)
                })
            }
        }
        
        override fun seekToPreviousMediaItem() {
            if (super.hasPreviousMediaItem()) {
               super.seekToPreviousMediaItem()
            } else {
                sendBroadcast(Intent("com.albayan.quran.ACTION_PREV").apply {
                    setPackage(packageName)
                })
            }
        }
    }

    // Required by MediaSessionService
    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? {
        return mediaSession
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Must call super for MediaSessionService to handle media buttons
        super.onStartCommand(intent, flags, startId)
        
        // NOTE: onMediaItemTransition listener is registered once in initializePlayer()
        // to avoid duplicate event broadcasts on each onStartCommand call.
        
        when (intent?.action) {
            ACTION_PLAY_AZHAN -> {
                val muazzinId = intent.getStringExtra(EXTRA_MUAZZIN_ID)
                val muazzinName = intent.getStringExtra("MUAZZIN_NAME") ?: ""
                val prayerName = intent.getStringExtra(EXTRA_PRAYER_NAME) ?: "الصلاة"
                val prayerTime = intent.getStringExtra(EXTRA_PRAYER_TIME) ?: ""
                val volume = intent.getIntExtra(EXTRA_VOLUME, 80)
                val azhanUrl = intent.getStringExtra("AZHAN_URL")
                val isReal = intent.getBooleanExtra("IS_REAL_PRAYER_TIME", false)
                
                currentPrayerTime = prayerTime
                isCurrentAzhanReal = isReal
                
                if (muazzinId != null) {
                    // Start foreground immediately
                    startForegroundForAzhan(prayerName, muazzinName)
                    playAzhan(muazzinId, prayerName, muazzinName, volume, azhanUrl)
                }
            }

        // 🛑 GLOBAL STOP (Bathroom Mode) 🛑
        ACTION_STOP -> {
            android.util.Log.d("AudioPlaybackService", "🛑 ACTION_STOP received (Bathroom Mode). Stopping everything.")
            // 1. Prevent Smart Resume from firing
            savedMediaItem = null
            
            // 2. Stop individual components
            stopAzhan()
            
            // 3. Ensure player is stopped forcefully
            player?.stop()
            player?.clearMediaItems()
            
            // 4. Remove notification immediately
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                 stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                 @Suppress("DEPRECATION")
                 stopForeground(true)
            }
        }

        ACTION_SET_SLEEP_TIMER -> {
            val minutes = intent.getIntExtra("MINUTES", 0)
            if (minutes > 0) {
                val prefs = getSharedPreferences("AlBayanPrefs", Context.MODE_PRIVATE)
                sleepTimerEndTime = System.currentTimeMillis() + (minutes * 60 * 1000L)
                prefs.edit().putLong("SLEEP_TIMER_END_TIME", sleepTimerEndTime).apply()
                
                sleepTimerHandler?.removeCallbacksAndMessages(null)
                if (sleepTimerHandler == null) sleepTimerHandler = android.os.Handler(android.os.Looper.getMainLooper())
                
                sleepTimerRunnable = Runnable {
                    onSleepTimerFinished()
                }
                sleepTimerHandler?.postDelayed(sleepTimerRunnable!!, minutes * 60 * 1000L)
                android.util.Log.d("AudioPlaybackService", "💤 Sleep Timer started for $minutes minutes")
            }
        }

        ACTION_CANCEL_SLEEP_TIMER -> {
            sleepTimerHandler?.removeCallbacksAndMessages(null)
            sleepTimerEndTime = 0
            val prefs = getSharedPreferences("AlBayanPrefs", Context.MODE_PRIVATE)
            prefs.edit().remove("SLEEP_TIMER_END_TIME").apply()
            android.util.Log.d("AudioPlaybackService", "💤 Sleep Timer cancelled")
        }

            ACTION_STOP_AZHAN -> {
                stopAzhan()
            }
            ACTION_PAUSE_AZHAN -> {
                if (isPlayingAzhan && !isAzhanPaused) {
                    player?.pause()
                    isAzhanPaused = true
                    broadcastAzhanState()
                }
            }
            ACTION_RESUME_AZHAN -> {
                if (isPlayingAzhan && isAzhanPaused) {
                    player?.play()
                    isAzhanPaused = false
                    fadeInCurrentPlayer(savedAzhanVolume)
                    broadcastAzhanState()
                }
            }
            ACTION_TOGGLE_MUTE_AZHAN -> {
                if (isPlayingAzhan && player != null) {
                    if (isAzhanMuted) {
                        fadeInCurrentPlayer(savedAzhanVolume)
                        isAzhanMuted = false
                    } else {
                        savedAzhanVolume = player?.volume ?: 1.0f
                        player?.volume = 0f
                        isAzhanMuted = true
                    }
                    broadcastAzhanState()
                }
            }
            ACTION_SET_VOLUME -> {
                val volume = intent.getIntExtra(EXTRA_VOLUME, -1)
                if (volume != -1 && isPlayingAzhan && player != null) {
                    val volumeFloat = volume.coerceIn(0, 100) / 100f
                    player?.volume = volumeFloat
                    savedAzhanVolume = volumeFloat
                }
            }
        }
        return START_NOT_STICKY
    }

    private fun startForegroundForAzhan(prayerName: String, muazzinName: String = "") {
        currentPrayerName = prayerName
        
        val stopIntent = Intent(this, AudioPlaybackService::class.java).apply {
            action = ACTION_STOP_AZHAN
        }
        val stopPendingIntent = PendingIntent.getService(
            this, 0, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        val mediaStyle = androidx.media.app.NotificationCompat.MediaStyle()
            .setShowActionsInCompactView(0)
            .setShowCancelButton(true)
            .setCancelButtonIntent(stopPendingIntent)
            
        val builder = NotificationCompat.Builder(this, AZHAN_CHANNEL_ID)
            .setContentTitle("أذان $prayerName")
            .setContentText(if (muazzinName.isNotEmpty()) "المؤذن: $muazzinName" else "حان الآن موعد صلاة $prayerName")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setLargeIcon(android.graphics.BitmapFactory.decodeResource(resources, R.mipmap.ic_launcher))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setOnlyAlertOnce(true)
            .setStyle(mediaStyle)
            .addAction(R.drawable.ic_stop, "إيقاف", stopPendingIntent)

        // Full Screen Intent
        try {
            val fullScreenIntent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra("AZHAN_ACTIVE", true)
                putExtra("PRAYER_NAME", prayerName)
                putExtra("MUAZZIN_NAME", muazzinName)
                putExtra("PRAYER_TIME", currentPrayerTime)
            }
            val fullScreenPendingIntent = PendingIntent.getActivity(
                this, 0, fullScreenIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            builder.setFullScreenIntent(fullScreenPendingIntent, true)
        } catch (e: Exception) {}

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(AZHAN_NOTIFICATION_ID, builder.build(), android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
            } else {
                startForeground(AZHAN_NOTIFICATION_ID, builder.build())
            }
            logToCatalog("✅ Foreground Service Started")
        } catch (e: Exception) {
            logToCatalog("⚠️ Primary startForeground Failed: ${e.message}")
            try {
                startForeground(AZHAN_NOTIFICATION_ID, builder.build())
                logToCatalog("✅ Foreground Service Started (Fallback)")
            } catch (e2: Exception) {
               logToCatalog("❌ Foreground Service FAILED Completely: ${e2.message}")
            }
        }
    }

    private val BUNDLED_MUAZZINS = listOf(
        "egy_abdulbasit", "egy_refat", "egy_minshawi", "egy_husary", "egy_mustafa",
        "egy_ali_mahmoud", "egy_toubar", "egy_fashni", "egy_naqshbandi", "egy_bahtimi",
        "other_rabeh", "egy_ibrahim_gabr", "ksa_suraihi"
    )

    // ============================================================================
    // AZHAN CATALOG (DEBUG LOGGING)
    // ============================================================================
    
    private fun logToCatalog(message: String) {
        try {
            val file = java.io.File(getExternalFilesDir(null), "azhan_debug_log.txt")
            val timestamp = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.US).format(java.util.Date())
            val logEntry = "[$timestamp] $message\n"
            
            // 2-Day Retention Policy: Read, Prune, Append
            val maxRetentionMillis = 2 * 24 * 60 * 60 * 1000L // 2 days
            val now = System.currentTimeMillis()
            
            val newContent = StringBuilder()
            
            // If file exists, read and filter old lines
            if (file.exists()) {
                file.forEachLine { line ->
                    // Extract timestamp [yyyy-MM-dd HH:mm:ss]
                    if (line.length > 21 && line.startsWith("[")) {
                        try {
                            val timeStr = line.substring(1, 20)
                            val entryTime = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.US).parse(timeStr)?.time
                            if (entryTime != null && (now - entryTime) < maxRetentionMillis) {
                                newContent.append(line).append("\n")
                            }
                        } catch (e: Exception) {
                            // Keep malformed lines just in case, or discard. Keeping for safety.
                            newContent.append(line).append("\n")
                        }
                    }
                }
            }
            
            // Append new entry
            newContent.append(logEntry)
            
            // Write back to file (truncate and write)
            file.writeText(newContent.toString())
            
        } catch (e: Exception) {
            android.util.Log.e("AudioPlaybackService", "Failed to write to catalog: ${e.message}")
        }
    }

    private fun playAzhan(muazzinId: String, prayerName: String, muazzinName: String = "", volume: Int = 80, azhanUrl: String? = null) {
        val player = player ?: return
        
        // ══════════════════════════════════════════════════════════════════════════
        // 🔍 DIAGNOSTICS: INTENT & REQUEST ANALYSIS
        // ══════════════════════════════════════════════════════════════════════════
        logToCatalog("╔════════════════════════════════════════════════════════════════════╗")
        logToCatalog("║ 🚀 STARTING AZHAN PLAYBACK                                         ║")
        logToCatalog("╠════════════════════════════════════════════════════════════════════╣")
        logToCatalog("║ PRAYER       : $prayerName")
        logToCatalog("║ REQUESTED ID : '$muazzinId'")
        logToCatalog("║ MUAZZIN NAME : '$muazzinName'")
        logToCatalog("║ VOLUME       : $volume%")
        logToCatalog("║ URL (Intent) : ${azhanUrl ?: "NULL"}")
        logToCatalog("║ REAL TIME    : $isCurrentAzhanReal")
        logToCatalog("╚════════════════════════════════════════════════════════════════════╝")
        
        // ══════════════════════════════════════════════════════════════════════════
        // 1. CLEAN & PREPARE ID
        // ══════════════════════════════════════════════════════════════════════════
        var targetMuazzinId = muazzinId
            .replace(".mp3", "")
            .replace("-", "_")
            .trim()
            
        // ══════════════════════════════════════════════════════════════════════════
        // 1.5 HANDLE NATIVE RANDOM
        // ══════════════════════════════════════════════════════════════════════════
        if (targetMuazzinId.equals("random", ignoreCase = true)) {
            val resolved = resolveRandomMuazzin()
            logToCatalog("🎲 RANDOM DETECTED. Resolution -> '$resolved'")
            targetMuazzinId = resolved
        }
        
        logToCatalog("🎯 FINAL TARGET ID: '$targetMuazzinId'") // The ID we will actually look for

        acquireWakeLock()
        requestAudioFocusForAzhan()
        isPlayingAzhan = true
        
        // Read gesture setting and register sensors
        val prefs = getSharedPreferences("AlBayanPrefs", Context.MODE_PRIVATE)
        gestureControlsEnabled = prefs.getBoolean("azhan_gesture_stop_enabled", true)
        flipToStopEnabled = prefs.getBoolean("azhan_gesture_flip_enabled", true)
        volumeToStopEnabled = prefs.getBoolean("azhan_gesture_volume_enabled", true)
        
        if (gestureControlsEnabled) {
            sensorManager?.let { sm ->
                if (flipToStopEnabled) {
                    accelerometer?.let { sm.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL) }
                }
            }
            if (volumeToStopEnabled) {
                if (volumeObserver == null) {
                    volumeObserver = VolumeObserver()
                }
                volumeObserver?.register()
            }
        }

        val alarmAttributes = AudioAttributes.Builder()
            .setUsage(C.USAGE_ALARM)
            .setContentType(C.AUDIO_CONTENT_TYPE_SPEECH)
            .build()
        // FIXED: Disable Audio Focus handling in ExoPlayer for USAGE_ALARM to prevent crash
        // "Automatic handling of audio focus is only available for USAGE_MEDIA and USAGE_GAME"
        player.setAudioAttributes(alarmAttributes, false)

        var mediaItem: MediaItem? = null
        // var usedFallback = false // Removed unused variable
        var actualMuazzinUsed = targetMuazzinId
        var resolutionMethod = "NONE"

        // ══════════════════════════════════════════════════════════════════════════
        // 2. RESOURCE LOOKUP (Priority 1)
        // ══════════════════════════════════════════════════════════════════════════
        val resId = resources.getIdentifier(targetMuazzinId, "raw", packageName)
        
        if (resId != 0) {
            logToCatalog("✅ FOUND IN RES/RAW: ID=$resId")
            val uri = RawResourceDataSource.buildRawResourceUri(resId)
            mediaItem = MediaItem.fromUri(uri)
            resolutionMethod = "BUNDLED_RESOURCE"
        } else {
            logToCatalog("⚠️ NOT in res/raw. Checking storage...")
            
            // ══════════════════════════════════════════════════════════════════════════
            // 3. STORAGE CHECK (Priority 2)
            // ══════════════════════════════════════════════════════════════════════════
            val customFile = getCustomAzhanFile(targetMuazzinId)
            
            // Debug the file check
            if (customFile != null) {
                logToCatalog("📂 Checking File: ${customFile.absolutePath}")
                logToCatalog("   - Exists: ${customFile.exists()}")
                logToCatalog("   - CanRead: ${customFile.canRead()}")
                logToCatalog("   - Size: ${customFile.length()} bytes")
            } else {
                logToCatalog("📂 Custom file object was NULL for '$targetMuazzinId'")
            }

            if (customFile != null && customFile.exists() && customFile.canRead() && customFile.length() > 0) {
                 mediaItem = MediaItem.fromUri(android.net.Uri.fromFile(customFile))
                 resolutionMethod = "CUSTOM_FILE"
                 logToCatalog("✅ FOUND CUSTOM FILE")
            } else {
                 logToCatalog("⚠️ Custom file rejected or not found.")
                 
                 // ══════════════════════════════════════════════════════════════════════════
                 // 4. URL CHECK (Priority 3)
                 // ══════════════════════════════════════════════════════════════════════════
                 if (azhanUrl != null && (azhanUrl.startsWith("file://") || azhanUrl.startsWith("http://localhost/_capacitor_file_"))) {
                     logToCatalog("🌐 Checking URL: $azhanUrl")
                     try {
                         var finalUrl = azhanUrl
                         if (azhanUrl.startsWith("http://localhost/_capacitor_file_")) {
                            finalUrl = azhanUrl.replace("http://localhost/_capacitor_file_", "file://")
                         }
                         if (azhanUrl.startsWith("https://localhost/_capacitor_file_")) {
                            finalUrl = azhanUrl.replace("https://localhost/_capacitor_file_", "file://")
                         }
                         
                         val uriObj = java.net.URI.create(finalUrl)
                         val file = java.io.File(uriObj.path)
                         
                         logToCatalog("   - Converted Path: ${file.absolutePath}")
                         logToCatalog("   - Exists: ${file.exists()}")
                         
                         if (file.exists()) {
                             mediaItem = MediaItem.fromUri(android.net.Uri.parse(finalUrl))
                             resolutionMethod = "URL_FILE"
                             logToCatalog("✅ FOUND VIA URL")
                         } else {
                             logToCatalog("❌ URL FILE MISSING")
                         }
                     } catch (e: Exception) {
                         logToCatalog("❌ URL PARSE ERROR: ${e.message}")
                     }
                 } else {
                     logToCatalog("❌ No valid URL provided.")
                 }
            }
        }
        
        // ══════════════════════════════════════════════════════════════════════════
        // 5. ERROR HANDLING (NO FALLBACK)
        // ══════════════════════════════════════════════════════════════════════════
        if (mediaItem == null) {
            logToCatalog("🚨 ALL CHECKS FAILED for '$targetMuazzinId'. NO FALLBACK - SHOWING ERROR.")
            android.util.Log.e("AudioPlaybackService", "❌ Cannot play azhan: '$targetMuazzinId' - file not found")
            
            // Show toast on main thread
            android.os.Handler(android.os.Looper.getMainLooper()).post {
                android.widget.Toast.makeText(
                    this,
                    "⚠️ ملف الأذان غير موجود: $muazzinName",
                    android.widget.Toast.LENGTH_LONG
                ).show()
            }
            
            // Cleanup
            wakeLock?.let { if (it.isHeld) it.release() }
            wakeLock = null
            isPlayingAzhan = false
            stopSelf()
            return
        }
        
        logToCatalog("✨ RESOLUTION SUCCESS via $resolutionMethod")




        var volumeFloat = volume.coerceIn(0, 100) / 100f
        // FIXED: Allow low volumes - minimum 3% instead of forcing 100%
        if (volumeFloat < 0.03f && volumeFloat > 0f) volumeFloat = 0.03f
        
        try {
            player.setMediaItem(mediaItem)
            player.prepare()
            fadeInCurrentPlayer(volumeFloat)
            savedAzhanVolume = volumeFloat
            player.play()
            
            logToCatalog("▶️ PLAYBACK STARTING (Focus Handled: ${player.audioAttributes.contentType})")

            val startIntent = Intent(ACTION_AZHAN_STARTED).apply {
                putExtra("PRAYER_NAME", prayerName)
                putExtra("MUAZZIN_ID", targetMuazzinId)
                putExtra("ACTUAL_MUAZZIN_USED", actualMuazzinUsed)
                putExtra("USED_FALLBACK", false) // No more fallback
                putExtra("IS_PREVIEW", prayerName.contains("معاينة") || prayerName.startsWith("أذان "))
                putExtra("IS_REAL", isCurrentAzhanReal)
                setPackage(packageName)
            }
            sendBroadcast(startIntent)
            
            startProgressUpdates()
            
            android.util.Log.d("AudioPlaybackService", "🎵 Azhan playback STARTED successfully!")
        } catch (e: Exception) {
            android.util.Log.e("AudioPlaybackService", "❌ Playback FAILED: ${e.message}", e)
            logToCatalog("❌ PLAYBACK EXCEPTION: ${e.message}")
            stopAzhan()
        }
    }

    /**
     * Resolves a 'random' request to a concrete ID from available sources.
     * Pool always has at least 13 items (BUNDLED_MUAZZINS) so cannot be empty.
     */
    private fun resolveRandomMuazzin(): String {
        val pool = BUNDLED_MUAZZINS.toMutableList()
        
        // Add Custom Files to Pool
        try {
             val azhanDir = java.io.File(filesDir, "azhan")
             if (azhanDir.exists() && azhanDir.isDirectory) {
                 val files = azhanDir.listFiles()
                 files?.forEach { file ->
                     if (file.name.endsWith(".mp3")) {
                         val id = file.name.replace(".mp3", "")
                         pool.add(id)
                     }
                 }
             }
        } catch (e: Exception) {
            android.util.Log.e("AudioPlaybackService", "Error scanning custom files for random pool", e)
        }
        
        // Pool is never empty since BUNDLED_MUAZZINS always has 13 items
        // Using first bundled as ultimate safety net (this line should never execute)
        return if (pool.isNotEmpty()) pool.random() else BUNDLED_MUAZZINS.first()
    }

    /**
     * Utility to get a Custom Azhan file object if it exists.
     */
    private fun getCustomAzhanFile(muazzinId: String): java.io.File? {
        try {
            val azhanDir = java.io.File(filesDir, "azhan")
            val file = java.io.File(azhanDir, "$muazzinId.mp3")
            if (file.exists()) return file
        } catch (e: Exception) { 
            /* Ignore */ 
        }
        return null
    }



    private fun stopAzhan() {
        stopProgressUpdates()
        player?.stop()
        
        sensorManager?.unregisterListener(this)
        volumeObserver?.unregister()
        // Reset gesture state for next azhan
        gravity[0] = 0f; gravity[1] = 0f; gravity[2] = 0f
        faceDownStartTime = 0L
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            azhanFocusRequest?.let { audioManager?.abandonAudioFocusRequest(it) }
        } else {
            @Suppress("DEPRECATION")
            audioManager?.abandonAudioFocus(null)
        }
        azhanFocusRequest = null
        
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
        
        isPlayingAzhan = false
        isAzhanPaused = false
        isAzhanMuted = false
        currentPrayerTime = ""
        
        // --- AUDIO ROUTING FIX ---
        // Restore media attributes so next time media plays, it plays over the correct channel
        val mediaAttributes = androidx.media3.common.AudioAttributes.Builder()
            .setUsage(androidx.media3.common.C.USAGE_MEDIA)
            .setContentType(androidx.media3.common.C.AUDIO_CONTENT_TYPE_MUSIC)
            .build()
        player?.setAudioAttributes(mediaAttributes, true) // Turn auto audio focus back ON
        // -------------------------
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
             stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
             @Suppress("DEPRECATION")
             stopForeground(true)
        }
        
        val finishIntent = Intent("com.albayan.quran.ACTION_AZHAN_FINISHED")
        finishIntent.setPackage(packageName)
        sendBroadcast(finishIntent)
    }



    private val audioFocusChangeListener = AudioManager.OnAudioFocusChangeListener { focusChange ->
        when (focusChange) {
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                // Call incoming or similar: Pause
                if (isPlayingAzhan && player?.isPlaying == true) {
                    player?.pause()
                    logToCatalog("⏸️ AudioFocus Transient Loss: Paused Azhan")
                }
            }
            AudioManager.AUDIOFOCUS_LOSS -> {
                // Permanent loss: Stop
                if (isPlayingAzhan) {
                    logToCatalog("🛑 AudioFocus Loss: Stopping Azhan")
                    stopAzhan()
                }
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
                // Notification/Navigation: Duck volume (Azhan is IMPORTANT, maybe don't duck? Or duck slightly?)
                // Standard Azhan behavior: usually we want it to be heard. 
                // But if user is on a call, it might be TRANSIENT (above).
                // If it's just a notification sound, we might duck.
                player?.volume = (savedAzhanVolume * 0.5f)
                logToCatalog("🔉 AudioFocus Ducking")
            }
            AudioManager.AUDIOFOCUS_GAIN -> {
                // Resume
                if (isPlayingAzhan && player?.isPlaying == false) {
                    player?.volume = savedAzhanVolume
                    player?.play()
                    logToCatalog("▶️ AudioFocus Gained: Resuming Azhan")
                } else if (isPlayingAzhan) {
                    // Restore volume if ducked
                    player?.volume = savedAzhanVolume
                }
            }
        }
    }

    private fun requestAudioFocusForAzhan() {
        val am = audioManager ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                .setAudioAttributes(
                    android.media.AudioAttributes.Builder()
                        .setUsage(android.media.AudioAttributes.USAGE_ALARM)
                        .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                )
                .setAcceptsDelayedFocusGain(true) // Wait for call to end then resume? YES.
                .setOnAudioFocusChangeListener(audioFocusChangeListener)
                .build()
            azhanFocusRequest = focusRequest
            val res = am.requestAudioFocus(focusRequest)
            logToCatalog("🔊 AudioFocus Request (Oreo+): $res")
        } else {
            @Suppress("DEPRECATION")
            val res = am.requestAudioFocus(audioFocusChangeListener, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
            logToCatalog("🔊 AudioFocus Request (Legacy): $res")
        }
    }

    private fun acquireWakeLock() {
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "AlBayan:AzhanWakeLock")
            wakeLock?.acquire(10 * 60 * 1000L)
        } catch (e: Exception) {}
    }

    private fun broadCastProgress() {
         val currentPlayer = player ?: return
        if (!isPlayingAzhan) return
        val position = currentPlayer.currentPosition
        val duration = currentPlayer.duration
        if (duration <= 0) return
        val progressPercent = ((position.toFloat() / duration.toFloat()) * 100).toInt()
        val progressIntent = Intent(ACTION_AZHAN_PROGRESS).apply {
            putExtra("progress", progressPercent)
            putExtra("position", position)
            putExtra("duration", duration)
            setPackage(packageName)
        }
        sendBroadcast(progressIntent)
    }

    private fun broadcastAzhanState() {
        val stateIntent = Intent(ACTION_AZHAN_STATE_CHANGED).apply {
            putExtra("isPlaying", !isAzhanPaused)
            putExtra("isMuted", isAzhanMuted)
            setPackage(packageName)
        }
        sendBroadcast(stateIntent)
    }

    private fun startProgressUpdates() {
        progressHandler = android.os.Handler(android.os.Looper.getMainLooper())
        progressRunnable = object : Runnable {
            override fun run() {
                if (isPlayingAzhan && !isAzhanPaused) {
                    broadCastProgress()
                    progressHandler?.postDelayed(this, 1000)
                }
            }
        }
        progressHandler?.post(progressRunnable!!)
    }

    private fun stopProgressUpdates() {
        progressRunnable?.let { progressHandler?.removeCallbacks(it) }
        progressHandler = null
        progressRunnable = null
    }

    // ============================================================================
    // GESTURE CONTROLS (Flip & Proximity)
    // ============================================================================
    
    override fun onSensorChanged(event: SensorEvent?) {
        if (!isPlayingAzhan || !gestureControlsEnabled) return
        if (event == null) return
        
        when (event.sensor.type) {
            Sensor.TYPE_ACCELEROMETER -> {
                if (!flipToStopEnabled) return
                // Low-Pass Filter to isolate gravity and ignore sudden movements
                gravity[0] = alpha * gravity[0] + (1 - alpha) * event.values[0]
                gravity[1] = alpha * gravity[1] + (1 - alpha) * event.values[1]
                gravity[2] = alpha * gravity[2] + (1 - alpha) * event.values[2]
                
                if (gravity[2] < -7.0f) {
                    if (faceDownStartTime == 0L) faceDownStartTime = System.currentTimeMillis()
                    else if (System.currentTimeMillis() - faceDownStartTime >= 500) {
                        triggerGestureStop("FLIP")
                    }
                } else {
                    faceDownStartTime = 0L
                }
            }
        }
    }
    
    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
    
    private fun triggerGestureStop(source: String) {
        if (!isPlayingAzhan) return
        
        // GUARD: Immediately prevent re-entry during fade out
        // Unregister sensors FIRST to stop further callbacks
        sensorManager?.unregisterListener(this)
        volumeObserver?.unregister()
        
        // Haptic Feedback (200ms pulse)
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibratorManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
        
        if (vibrator.hasVibrator()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createOneShot(200, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(200)
            }
        }
        
        logToCatalog("🤚 Gesture Stop: $source")
        stopAzhan()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val azhanChannel = NotificationChannel(
                AZHAN_CHANNEL_ID,
                "الأذان",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "تنبيهات الأذان"
                setSound(null, null)
                setShowBadge(true)
                setBypassDnd(true)
                lightColor = android.graphics.Color.GREEN
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 200, 500)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(azhanChannel)
            
            // Create separate channel for Salawat (Low Importance)
            val salawatChannel = NotificationChannel(
                "salawat_playback_channel",
                "الصلاة على النبي",
                NotificationManager.IMPORTANCE_LOW 
            ).apply {
                description = "تنبيهات الصلاة على النبي"
                setSound(null, null) // We play sound manually via ExoPlayer
                setShowBadge(false)
            }
            manager.createNotificationChannel(salawatChannel)
        }
    }

    private fun initializePlayer() {
        // CRITICAL: Use DefaultDataSource.Factory (not just HTTP) to support ALL source types:
        // - Raw resources (android.resource://) for bundled Azhan
        // - Local files (file://) for downloaded Azhan
        // - HTTP streams with cross-protocol redirects for radio
        
        val httpDataSourceFactory = androidx.media3.datasource.DefaultHttpDataSource.Factory()
            .setAllowCrossProtocolRedirects(true) // Required for radiojar.com
            .setUserAgent("AlBayan/2.0 (Android ${Build.VERSION.RELEASE}; Quran App)")
            .setConnectTimeoutMs(30000)
            .setReadTimeoutMs(30000)
        
        // DefaultDataSource.Factory wraps the HTTP factory and adds support for:
        // - Raw resources, assets, content:// URIs, file:// URIs
        val dataSourceFactory = androidx.media3.datasource.DefaultDataSource.Factory(this, httpDataSourceFactory)
        
        val mediaSourceFactory = DefaultMediaSourceFactory(dataSourceFactory)
        
        val mediaAttributes = androidx.media3.common.AudioAttributes.Builder()
            .setUsage(androidx.media3.common.C.USAGE_MEDIA)
            .setContentType(androidx.media3.common.C.AUDIO_CONTENT_TYPE_MUSIC)
            .build()
        
        player = ExoPlayer.Builder(this)
            .setMediaSourceFactory(mediaSourceFactory)
            .setAudioAttributes(mediaAttributes, true)
            .build().apply {
            addListener(object : Player.Listener {
                override fun onPlaybackStateChanged(playbackState: Int) {
                    if (playbackState == Player.STATE_ENDED) {
                        logToCatalog("⏹️ Playback Ended (STATE_ENDED)")
                        if (isPlayingAzhan) stopAzhan()
                    }
                }
                
                // REMOVED: Duplicate onMediaItemTransition listener
                // This was causing double event emission - MediaBridge.kt already handles this
                // via its own MediaController listener (setupController)

                override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                    val errorMsg = "ExoPlayer Error: ${error.errorCodeName} - ${error.message}"
                    android.util.Log.e("AudioPlaybackService", errorMsg, error)
                    logToCatalog(errorMsg)
                    
                    if (isPlayingAzhan) {
                        logToCatalog("❌ Azhan Stopped due to Player Error")
                        stopAzhan()
                    }
                }
            })
        }
    }

    private fun onSleepTimerFinished() {
        android.util.Log.d("AudioPlaybackService", "💤 Sleep Timer Finished! Stopping audio...")
        
        // 1. Clear Smart Resume states so nothing resumes!
        savedMediaItem = null
        savedPosition = 0
        sleepTimerEndTime = 0
        
        val prefs = getSharedPreferences("AlBayanPrefs", Context.MODE_PRIVATE)
        prefs.edit().remove("SLEEP_TIMER_END_TIME").apply()
        
        // 2. Stop actual playback ONLY if it's not Azhan
        if (!isPlayingAzhan) {
            player?.stop()
        }
        
        // 3. Notify JS layer to update UI
        val intent = Intent(ACTION_SLEEP_TIMER_FINISHED)
        intent.setPackage(packageName)
        sendBroadcast(intent)
    }

    override fun onDestroy() {
        mediaSession?.run {
            player.release()
            release()
            mediaSession = null
        }
        // player?.release() // Removed redundant release, done inside mediaSession?.run or here if session is null
        if (mediaSession == null) {
            player?.release()
        }
        player = null
        super.onDestroy()
    }
}
