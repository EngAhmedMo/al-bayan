package com.albayan.quran

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import android.app.AlarmManager
import android.app.PendingIntent
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.common.MimeTypes
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.common.util.concurrent.ListenableFuture
import com.google.common.util.concurrent.MoreExecutors
import android.Manifest
import android.os.Build
import com.getcapacitor.PermissionState
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import androidx.work.WorkManager
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.OneTimeWorkRequest
import androidx.work.ExistingWorkPolicy

import java.io.File
import androidx.core.content.FileProvider
import android.util.Log
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@CapacitorPlugin(
    name = "MediaBridge",
    permissions = [
        Permission(
            alias = "notifications",
            strings = [Manifest.permission.POST_NOTIFICATIONS]
        )
    ]
)
class MediaBridge : Plugin() {

    companion object {
        // SharedPreferences key for storing scheduled alarm IDs
        private const val PREFS_NAME = "AlBayanAlarmPrefs"
        private const val KEY_AZHAN_IDS = "scheduled_azhan_ids"
        private const val KEY_PRE_PRAYER_IDS = "scheduled_pre_prayer_ids"
        private const val KEY_SALAWAT_IDS = "scheduled_salawat_ids"
    }

    private var controllerFuture: ListenableFuture<MediaController>? = null
    private val controller: MediaController?
        get() = if (controllerFuture?.isDone == true) controllerFuture?.get() else null
    
    // Tracking current Azhan status for polling
    private var isAzhanPlaying = false
    private var isLastAzhanReal = false

    // ============================================================================
    // ALARM ID TRACKING - Prevents 500 alarm limit overflow
    // ============================================================================

    private fun getAlarmPrefs(): android.content.SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    private fun saveAlarmIds(key: String, ids: List<Int>) {
        val idsString = ids.joinToString(",")
        getAlarmPrefs().edit().putString(key, idsString).apply()
        android.util.Log.d("MediaBridge", "💾 Saved ${ids.size} alarm IDs for $key")
    }

    private fun loadAlarmIds(key: String): List<Int> {
        val idsString = getAlarmPrefs().getString(key, "") ?: ""
        if (idsString.isEmpty()) return emptyList()
        return idsString.split(",").mapNotNull { it.toIntOrNull() }
    }

    private fun clearAlarmIds(key: String) {
        getAlarmPrefs().edit().remove(key).apply()
    }

    /**
     * Cancel alarms by ID list for a specific receiver class
     */
    private fun cancelAlarmsByIds(ids: List<Int>, receiverClass: Class<*>, action: String): Int {
        if (ids.isEmpty()) return 0
        
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_CANCEL_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_CANCEL_CURRENT
        }
        
        var cancelledCount = 0
        for (id in ids) {
            try {
                val intent = Intent(context, receiverClass).apply {
                    this.action = action
                }
                val pendingIntent = PendingIntent.getBroadcast(context, id, intent, flags)
                alarmManager.cancel(pendingIntent)
                // CRITICAL FIX: Explicitly cancel the PendingIntent to clear cached extras
                pendingIntent.cancel()
                cancelledCount++
            } catch (e: Exception) {
                android.util.Log.w("MediaBridge", "Failed to cancel alarm $id: ${e.message}")
            }
        }
        android.util.Log.d("MediaBridge", "🗑️ Cancelled $cancelledCount/${ids.size} alarms for ${receiverClass.simpleName} (PendingIntents cleared)")
        return cancelledCount
    }

    private val receiver = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                "com.albayan.quran.ACTION_NEXT" -> {
                    val ret = JSObject()
                    ret.put("action", "next")
                    notifyListeners("controlNotification", ret)
                }
                "com.albayan.quran.ACTION_PREV" -> {
                    val ret = JSObject()
                    ret.put("action", "prev")
                    notifyListeners("controlNotification", ret)
                }
                "com.albayan.quran.ACTION_AZHAN_DISMISSED", "com.albayan.quran.ACTION_AZHAN_FINISHED" -> {
                     isAzhanPlaying = false
                     notifyListeners("azhanDismissed", JSObject())
                }
                "com.albayan.quran.ACTION_AZHAN_STARTED" -> {
                    val ret = JSObject()
                    val prayerName = intent.getStringExtra("PRAYER_NAME")
                    val isPreview = intent.getBooleanExtra("IS_PREVIEW", false)
                    val isReal = intent.getBooleanExtra("IS_REAL", false)
                    
                    isAzhanPlaying = true
                    isLastAzhanReal = isReal

                    ret.put("prayerName", prayerName)
                    ret.put("muazzinId", intent.getStringExtra("MUAZZIN_ID"))
                    ret.put("isPreview", isPreview)
                    ret.put("isReal", isReal)
                    notifyListeners("azhanStarted", ret)
                }
                "com.albayan.quran.ACTION_AZHAN_PROGRESS" -> {
                    val ret = JSObject()
                    ret.put("progress", intent.getIntExtra("progress", 0))
                    ret.put("position", intent.getLongExtra("position", 0))
                    ret.put("duration", intent.getLongExtra("duration", 0))
                    notifyListeners("azhanProgress", ret)
                }
                "com.albayan.quran.ACTION_AZHAN_STATE_CHANGED" -> {
                    val ret = JSObject()
                    ret.put("isPlaying", intent.getBooleanExtra("isPlaying", true))
                    ret.put("isMuted", intent.getBooleanExtra("isMuted", false))
                    notifyListeners("azhanStateChanged", ret)
                }
                // SALAWAT EVENTS: For Quran pause/resume
                "com.albayan.quran.ACTION_SALAWAT_STARTED" -> {
                    android.util.Log.d("MediaBridge", "🤲 Salawat Started - notifying JS")
                    notifyListeners("salawatStarted", JSObject())
                }
                "com.albayan.quran.ACTION_SALAWAT_FINISHED" -> {
                    android.util.Log.d("MediaBridge", "🤲 Salawat Finished - notifying JS")
                    notifyListeners("salawatFinished", JSObject())
                }
                // NOTE: ACTION_MEDIA_TRANSITION broadcast removed from AudioPlaybackService
                // Gapless transitions are now handled via MediaController listener in setupController()
            }
        }
    }

    // Bathroom/Privacy Mode
    @PluginMethod
    fun setBathroomMode(call: PluginCall) {
        val durationMinutes = call.getInt("duration", 0) ?: 0
        try {
            val prefs = context.getSharedPreferences("AlBayanPrefs", Context.MODE_PRIVATE)
            val editor = prefs.edit()
            
            if (durationMinutes > 0) {
                // Activate
                val endTime = System.currentTimeMillis() + (durationMinutes * 60 * 1000L)
                editor.putLong("BATHROOM_MODE_END_TIME", endTime)
                editor.apply()
                
                // STOP CURRENT PLAYBACK IF RUNNING
                val stopIntent = Intent(context, AudioPlaybackService::class.java)
                stopIntent.action = "ACTION_STOP"
                context.startService(stopIntent)
                
                Log.d("MediaBridge", "🚽 Bathroom Mode ACTIVATED for $durationMinutes mins (until $endTime). Audio stopped.")
            } else {
                // Deactivate
                editor.remove("BATHROOM_MODE_END_TIME")
                editor.apply()
                Log.d("MediaBridge", "🚽 Bathroom Mode DEACTIVATED")
            }
            call.resolve()
        } catch (e: Exception) {
            call.reject("ERROR", e.message)
        }
    }

    @PluginMethod
    fun getBathroomModeStatus(call: PluginCall) {
        try {
            val prefs = context.getSharedPreferences("AlBayanPrefs", Context.MODE_PRIVATE)
            val endTime = prefs.getLong("BATHROOM_MODE_END_TIME", 0)
            val now = System.currentTimeMillis()
            
            val ret = JSObject()
            if (endTime > now) {
                // Active
                val remainingSeconds = (endTime - now) / 1000
                ret.put("isActive", true)
                ret.put("endTime", endTime.toDouble())
                ret.put("remainingSeconds", remainingSeconds.toDouble())
            } else {
                // Inactive
                ret.put("isActive", false)
            }
            call.resolve(ret)
        } catch (e: Exception) {
             call.reject("ERROR", e.message)
        }
    }

    override fun load() {
        super.load()
        
        val filter = android.content.IntentFilter().apply {
            addAction("com.albayan.quran.ACTION_NEXT")
            addAction("com.albayan.quran.ACTION_PREV")
            addAction("com.albayan.quran.ACTION_AZHAN_DISMISSED")
            addAction("com.albayan.quran.ACTION_AZHAN_FINISHED")
            addAction("com.albayan.quran.ACTION_AZHAN_STARTED")
            addAction("com.albayan.quran.ACTION_AZHAN_PROGRESS")
            addAction("com.albayan.quran.ACTION_AZHAN_STATE_CHANGED")
            // Salawat events for Quran pause/resume
            addAction("com.albayan.quran.ACTION_SALAWAT_STARTED")
            addAction("com.albayan.quran.ACTION_SALAWAT_FINISHED")
            // NOTE: ACTION_MEDIA_TRANSITION removed - now handled via MediaController listener
        }
        // FIXED: Use RECEIVER_NOT_EXPORTED for security (prevents broadcast spoofing)
        // Our broadcasts are internal only (from AudioPlaybackService with setPackage)
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Context.RECEIVER_NOT_EXPORTED
        } else {
            0
        }
        context.registerReceiver(receiver, filter, flags)

        // MediaController will automatically connect to and start the MediaSessionService
        val sessionToken = SessionToken(context, ComponentName(context, AudioPlaybackService::class.java))
        controllerFuture = MediaController.Builder(context, sessionToken).buildAsync()
        controllerFuture?.addListener({
            android.util.Log.d("MediaBridge", "MediaController connected successfully")
            setupController()
        }, MoreExecutors.directExecutor())
    }



    private fun setupController() {
        try {
            val controller = controllerFuture?.get() ?: return
            controller.addListener(object : Player.Listener {
                override fun onIsPlayingChanged(isPlaying: Boolean) {
                    val ret = JSObject()
                    ret.put("isPlaying", isPlaying)
                    notifyListeners("onIsPlayingChanged", ret)
                }

                override fun onPlaybackStateChanged(playbackState: Int) {
                    val ret = JSObject()
                    ret.put("state", playbackState)
                    notifyListeners("onPlaybackStateChanged", ret)
                }
                
                // GAPLESS: Detect automatic media item transitions via MediaController
                // This is a redundant listener (also in AudioPlaybackService) for reliability
                override fun onMediaItemTransition(mediaItem: androidx.media3.common.MediaItem?, reason: Int) {
                    if (mediaItem != null && reason == Player.MEDIA_ITEM_TRANSITION_REASON_AUTO) {
                        android.util.Log.d("MediaBridge", "🔗 Controller Transition: ${mediaItem.mediaMetadata.title}")
                        
                        val ret = JSObject()
                        ret.put("mediaId", mediaItem.mediaId)
                        ret.put("title", mediaItem.mediaMetadata.title?.toString() ?: "")
                        ret.put("subtitle", mediaItem.mediaMetadata.artist?.toString() ?: "")
                        ret.put("duration", controller.duration)
                        notifyListeners("mediaItemTransition", ret)
                    }
                }
            })
        } catch (e: Exception) {
            android.util.Log.e("MediaBridge", "Failed to setup controller: ${e.message}", e)
        }
    }

    @PluginMethod
    fun play(call: PluginCall) {
        val url = call.getString("url")
        val title = call.getString("title") ?: "البيان"
        val subtitle = call.getString("subtitle") ?: ""
        val artworkUrl = call.getString("artworkUrl")
        val mediaId = call.getString("mediaId") ?: url // Use URL as fallback ID

        if (url == null) {
            call.reject("URL is required")
            return
        }

        // Wait for controller to be ready
        val future = controllerFuture
        if (future == null) {
            call.reject("MediaController not initialized")
            return
        }

        future.addListener({
            try {
                val controller = future.get()
                if (controller == null) {
                    call.reject("Controller is null")
                    return@addListener
                }

                android.util.Log.d("MediaBridge", "▶️ play called. ID: $mediaId, Title: $title")

                var finalUrl = url
                if (url.startsWith("http://localhost/_capacitor_file_")) {
                    finalUrl = url.replace("http://localhost/_capacitor_file_", "file://")
                } else if (url.startsWith("https://localhost/_capacitor_file_")) {
                    finalUrl = url.replace("https://localhost/_capacitor_file_", "file://")
                }
                
                // CRITICAL FIX: Handle android.resource:// URLs for bundled audio (Salawat, pre-prayer alerts)
                if (url.startsWith("android.resource://")) {
                    val parts = url.substringAfterLast("/raw/")
                    val resourceName = parts.replace(".mp3", "").replace("-", "_").trim()
                    val resId = context.resources.getIdentifier(resourceName, "raw", context.packageName)
                    
                    if (resId != 0) {
                        finalUrl = androidx.media3.datasource.RawResourceDataSource.buildRawResourceUri(resId).toString()
                    } else {
                        call.reject("Resource not found: $resourceName")
                        return@addListener
                    }
                }

                val mediaMetadata = MediaMetadata.Builder()
                    .setTitle(title)
                    .setDisplayTitle(title)
                    .setArtist(subtitle)
                    .setArtworkUri(if (artworkUrl != null) Uri.parse(artworkUrl) else null)
                    .build()

                val mimeType = if (finalUrl.contains(".m3u8")) MimeTypes.APPLICATION_M3U8 else null

                val mediaItem = MediaItem.Builder()
                    .setMediaId(mediaId ?: finalUrl) // Track ID for Gapless
                    .setUri(finalUrl)
                    .setMimeType(mimeType)
                    .setMediaMetadata(mediaMetadata)
                    .build()

                executeOnMainThread {
                    controller.setMediaItem(mediaItem)
                    controller.prepare()
                    controller.play()
                    call.resolve()
                }
            } catch (e: Exception) {
                android.util.Log.e("MediaBridge", "Play failed: ${e.message}", e)
                call.reject("Play failed: ${e.message}")
            }
        }, MoreExecutors.directExecutor())
    }

    @PluginMethod
    fun queueNext(call: PluginCall) {
        val url = call.getString("url")
        val title = call.getString("title") ?: "البيان"
        val subtitle = call.getString("subtitle") ?: ""
        val artworkUrl = call.getString("artworkUrl")
        val mediaId = call.getString("mediaId") ?: url

        if (url == null) {
            call.reject("URL is required")
            return
        }

        val future = controllerFuture
        if (future == null) { call.reject("MediaController not initialized"); return }

        future.addListener({
            try {
                val controller = future.get()
                if (controller == null) { call.reject("Controller is null"); return@addListener }

                android.util.Log.d("MediaBridge", "➕ queueNext called. ID: $mediaId")

                var finalUrl = url
                if (url.startsWith("http://localhost/_capacitor_file_")) {
                    finalUrl = url.replace("http://localhost/_capacitor_file_", "file://")
                } else if (url.startsWith("https://localhost/_capacitor_file_")) {
                    finalUrl = url.replace("https://localhost/_capacitor_file_", "file://")
                }
                
                val mediaMetadata = MediaMetadata.Builder()
                    .setTitle(title)
                    .setDisplayTitle(title)
                    .setArtist(subtitle)
                    .setArtworkUri(if (artworkUrl != null) Uri.parse(artworkUrl) else null)
                    .build()

                val mediaItem = MediaItem.Builder()
                    .setMediaId(mediaId ?: finalUrl)
                    .setUri(finalUrl)
                    .setMediaMetadata(mediaMetadata)
                    .build()

                executeOnMainThread {
                    controller.addMediaItem(mediaItem)
                    call.resolve()
                }
            } catch (e: Exception) {
                android.util.Log.e("MediaBridge", "Queue failed: ${e.message}", e)
                call.reject("Queue failed: ${e.message}")
            }
        }, MoreExecutors.directExecutor())
    }

    @PluginMethod
    fun getCurrentAzhanState(call: PluginCall) {
        val ret = JSObject()
        ret.put("isPlayingAzhan", isAzhanPlaying)
        ret.put("isReal", isLastAzhanReal)
        call.resolve(ret)
    }

    @PluginMethod
    fun playAzhan(call: PluginCall) {
        val muazzinId = call.getString("muazzinId") ?: return call.reject("muazzinId is required")
        val prayerName = call.getString("prayerName") ?: "الصلاة"
        val muazzinName = call.getString("muazzinName") ?: ""
        val azhanUrl = call.getString("azhanUrl") // NEW: Support for custom audio URL
        
        android.util.Log.d("MediaBridge", "▶️ playAzhan called: muazzin=$muazzinId, prayer=$prayerName, url=$azhanUrl")

        // Start the AudioPlaybackService with Azhan action
        val serviceIntent = Intent(context, AudioPlaybackService::class.java).apply {
            action = "ACTION_PLAY_AZHAN"
            putExtra("MUAZZIN_ID", muazzinId)
            putExtra("PRAYER_NAME", prayerName)
            putExtra("MUAZZIN_NAME", muazzinName)
            if (azhanUrl != null) putExtra("AZHAN_URL", azhanUrl)
        }
        
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
            call.resolve()
        } catch (e: Exception) {
            android.util.Log.e("MediaBridge", "PlayAzhan failed: ${e.message}", e)
            call.reject("PlayAzhan failed: ${e.message}")
        }
    }


    @PluginMethod
    fun pause(call: PluginCall) {
        executeOnMainThread {
            controller?.pause()
            call.resolve()
        }
    }

    @PluginMethod
    fun resume(call: PluginCall) {
        executeOnMainThread {
            controller?.play()
            call.resolve()
        }
    }

    @PluginMethod
    fun toggle(call: PluginCall) {
        executeOnMainThread {
            val c = controller
            if (c != null) {
                if (c.isPlaying) {
                    c.pause()
                } else {
                    c.play()
                }
            }
            call.resolve()
        }
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        executeOnMainThread {
            controller?.stop()
            call.resolve()
        }
    }

    @PluginMethod
    fun requestBatteryOptimizationBypass(call: PluginCall) {
        val packageName = context.packageName
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        if (!pm.isIgnoringBatteryOptimizations(packageName)) {
            try {
                // Try direct request dialog (works on most phones)
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:$packageName")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
                call.resolve()
            } catch (e: Exception) {
                // Fallback to battery optimization settings list
                try {
                    val settingsIntent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(settingsIntent)
                    call.resolve()
                } catch (e2: Exception) {
                    call.reject("Failed to open battery settings: ${e2.message}")
                }
            }
        } else {
            call.resolve(JSObject().apply { put("alreadyIgnored", true) })
        }
    }

    @PluginMethod
    fun checkBatteryOptimization(call: PluginCall) {
        val packageName = context.packageName
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val isIgnored = pm.isIgnoringBatteryOptimizations(packageName)
        call.resolve(JSObject().apply { put("isIgnored", isIgnored) })
    }

    @PluginMethod
    fun checkResourceExists(call: PluginCall) {
        val muazzinId = call.getString("muazzinId")
        if (muazzinId == null) {
            call.reject("muazzinId is required")
            return
        }

        val cleanMuazzinId = muazzinId.replace(".mp3", "").replace("-", "_").trim()
        val resId = context.resources.getIdentifier(cleanMuazzinId, "raw", context.packageName)
        
        call.resolve(JSObject().apply {
            put("exists", resId != 0)
            put("cleanId", cleanMuazzinId)
            put("resId", resId)
        })
    }

    @PluginMethod
    fun clearLogs(call: PluginCall) {
        try {
            val file = java.io.File(context.getExternalFilesDir(null), "azhan_debug_log.txt")
            if (file.exists()) {
                file.delete()
                android.util.Log.d("MediaBridge", "🗑️ Logs cleared successfully")
            }
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to clear logs: ${e.message}")
        }
    }

    // ============================================================================
    // RADIO STATION NAVIGATION - For notification skip controls
    // ============================================================================
    
    data class RadioStationInfo(val id: String, val name: String, val urls: List<String>)
    
    private var radioStationsList: List<RadioStationInfo> = emptyList()
    private var currentStationIndex: Int = 0
    
    @PluginMethod
    fun setRadioStationsList(call: PluginCall) {
        val stationsArray = call.getArray("stations")
        val currentIndex = call.getInt("currentIndex") ?: 0
        
        if (stationsArray == null) {
            call.reject("stations array is required")
            return
        }
        
        val stations = mutableListOf<RadioStationInfo>()
        for (i in 0 until stationsArray.length()) {
            val station = stationsArray.getJSONObject(i)
            val id = station.getString("id")
            val name = station.getString("name")
            val urlsArray = station.getJSONArray("urls")
            val urls = mutableListOf<String>()
            for (j in 0 until urlsArray.length()) {
                urls.add(urlsArray.getString(j))
            }
            stations.add(RadioStationInfo(id, name, urls))
        }
        
        radioStationsList = stations
        currentStationIndex = currentIndex.coerceIn(0, stations.size - 1)
        
        android.util.Log.d("MediaBridge", "📻 Radio stations set: ${stations.size} stations, current index: $currentStationIndex")
        call.resolve()
    }
    
    @PluginMethod
    fun skipToNextStation(call: PluginCall) {
        if (radioStationsList.isEmpty()) {
            call.resolve() // Return null if no stations
            return
        }
        
        currentStationIndex = (currentStationIndex + 1) % radioStationsList.size
        val station = radioStationsList[currentStationIndex]
        
        android.util.Log.d("MediaBridge", "⏭️ Skipping to next station: ${station.name} (index: $currentStationIndex)")
        
        // Notify TypeScript to play the new station
        val ret = JSObject()
        ret.put("stationId", station.id)
        ret.put("stationName", station.name)
        ret.put("stationIndex", currentStationIndex)
        notifyListeners("controlNotification", JSObject().apply {
            put("action", "next")
            put("stationId", station.id)
            put("stationIndex", currentStationIndex)
        })
        
        call.resolve(ret)
    }
    
    @PluginMethod
    fun skipToPreviousStation(call: PluginCall) {
        if (radioStationsList.isEmpty()) {
            call.resolve() // Return null if no stations
            return
        }
        
        currentStationIndex = if (currentStationIndex == 0) radioStationsList.size - 1 else currentStationIndex - 1
        val station = radioStationsList[currentStationIndex]
        
        android.util.Log.d("MediaBridge", "⏮️ Skipping to previous station: ${station.name} (index: $currentStationIndex)")
        
        // Notify TypeScript to play the new station
        val ret = JSObject()
        ret.put("stationId", station.id)
        ret.put("stationName", station.name)
        ret.put("stationIndex", currentStationIndex)
        notifyListeners("controlNotification", JSObject().apply {
            put("action", "prev")
            put("stationId", station.id)
            put("stationIndex", currentStationIndex)
        })
        
        call.resolve(ret)
    }

    @PluginMethod
    fun requestNotificationsPermission(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (getPermissionState("notifications") != PermissionState.GRANTED) {
                requestPermissionForAlias("notifications", call, "permissionsCallback")
            } else {
                call.resolve()
            }
        } else {
            call.resolve()
        }
    }

    @PermissionCallback
    private fun permissionsCallback(call: PluginCall) {
        if (getPermissionState("notifications") == PermissionState.GRANTED) {
            call.resolve()
        } else {
            call.reject("Notification permission denied")
        }
    }

    // ============================================================================
    // CRITICAL: CANCEL ALL NATIVE ALARMS - Prevents 500 Alarm Limit Overflow
    // ============================================================================

    /**
     * Cancel ALL native alarms (Azhan, Pre-Prayer, Salawat) before re-scheduling.
     * This MUST be called before any batch scheduling to prevent accumulation.
     */
    @PluginMethod
    fun cancelAllNativeAlarms(call: PluginCall) {
        android.util.Log.d("MediaBridge", "🧹 cancelAllNativeAlarms called - clearing all scheduled alarms")
        
        var totalCancelled = 0
        
        // 1. Cancel Azhan alarms
        val azhanIds = loadAlarmIds(KEY_AZHAN_IDS)
        if (azhanIds.isNotEmpty()) {
            totalCancelled += cancelAlarmsByIds(azhanIds, AzhanReceiver::class.java, "ACTION_PLAY_AZHAN")
            clearAlarmIds(KEY_AZHAN_IDS)
        }
        
        // 2. Cancel Pre-Prayer alarms
        val prePrayerIds = loadAlarmIds(KEY_PRE_PRAYER_IDS)
        if (prePrayerIds.isNotEmpty()) {
            totalCancelled += cancelAlarmsByIds(prePrayerIds, PrePrayerAlertReceiver::class.java, PrePrayerAlertReceiver.ACTION_PRE_PRAYER_ALERT)
            clearAlarmIds(KEY_PRE_PRAYER_IDS)
        }
        
        // 3. Cancel Salawat alarms
        val salawatIds = loadAlarmIds(KEY_SALAWAT_IDS)
        if (salawatIds.isNotEmpty()) {
            totalCancelled += cancelAlarmsByIds(salawatIds, SalawatAlertReceiver::class.java, SalawatAlertReceiver.ACTION_SALAWAT_ALERT)
            clearAlarmIds(KEY_SALAWAT_IDS)
        }
        
        android.util.Log.d("MediaBridge", "✅ Total cancelled: $totalCancelled alarms (Azhan: ${azhanIds.size}, PrePrayer: ${prePrayerIds.size}, Salawat: ${salawatIds.size})")
        
        call.resolve(JSObject().apply {
            put("cancelled", totalCancelled)
            put("azhan", azhanIds.size)
            put("prePrayer", prePrayerIds.size)
            put("salawat", salawatIds.size)
        })
    }

    /**
     * Cancel ONLY Azhan alarms.
     * Use this when rescheduling just the prayers.
     */
    @PluginMethod
    fun cancelAllScheduledAzhan(call: PluginCall) {
        android.util.Log.d("MediaBridge", "🧹 cancelAllScheduledAzhan called")
        val azhanIds = loadAlarmIds(KEY_AZHAN_IDS)
        if (azhanIds.isNotEmpty()) {
            cancelAlarmsByIds(azhanIds, AzhanReceiver::class.java, "ACTION_PLAY_AZHAN")
            clearAlarmIds(KEY_AZHAN_IDS)
        }
        call.resolve()
    }

    // ============================================================================
    // SUSTAINABILITY DATA SYNC - For Native Scheduler (Project Eternity)
    // ============================================================================

    @PluginMethod
    fun savePersistenceData(call: PluginCall) {
        val lat = call.getDouble("lat")
        val lng = call.getDouble("lng")
        val method = call.getString("method")
        val madhab = call.getString("madhab")
        val highLatitudeRule = call.getString("highLatitudeRule")
        val adjustmentsJson = call.getString("adjustmentsJson")
        
        // NEW: Azhan Preferences for Native Scheduler
        val muazzinId = call.getString("muazzinId")
        val perPrayerSettingsJson = call.getString("perPrayerSettingsJson")
        val isPerPrayerEnabled = call.getBoolean("isPerPrayerEnabled")
        // NEW: Salawat Persistence for Native Scheduler (Phase 2)
        val salawatSettingsJson = call.getString("salawatSettingsJson")
        
        // NEW: Pre-Prayer Persistence for Native Scheduler (Phase 3 Gap Fix)
        val prePrayerSettingsJson = call.getString("prePrayerSettingsJson")
        
        // NEW: Ramadan Persistence for Native Scheduler
        val ramadanSettingsJson = call.getString("ramadanSettingsJson")
        
        // NEW: Hijri Auto-Sync Persistence for Native Widget
        val hijriAutoSyncEnabled = call.getBoolean("hijriAutoSyncEnabled") ?: false
        val hijriManualOverride = call.getBoolean("hijriManualOverride") ?: false
        // hijriEffectiveAdjustment: القيمة الفعلية (manual أو auto) التي يحسبها TypeScript
        val hijriEffectiveAdjustment = call.getInt("hijriEffectiveAdjustment") ?: 0

        if (lat == null || lng == null) {
            call.reject("Location required")
            return
        }

        val prefs = context.getSharedPreferences("AlBayanPersistence", Context.MODE_PRIVATE)
        prefs.edit().apply {
            putFloat("lat", lat.toFloat())
            putFloat("lng", lng.toFloat())
            putString("method", method ?: "egyptian")
            putString("madhab", madhab ?: "shafi")
            putString("highLatitudeRule", highLatitudeRule ?: "middle_of_night")
            putString("adjustmentsJson", adjustmentsJson ?: "{}")
            
            // Save Hijri Auto-Sync Settings
            putBoolean("hijriAutoSyncEnabled", hijriAutoSyncEnabled)
            putBoolean("hijriManualOverride", hijriManualOverride)
            // effectiveAdjustment: يكتبها TypeScript — Kotlin تقرأها فقط
            putInt("hijriEffectiveAdjustment", hijriEffectiveAdjustment)
            
            // Save Azhan Settings
            putString("muazzinId", muazzinId ?: "egy_abdulbasit")
            putString("perPrayerSettingsJson", perPrayerSettingsJson ?: "{}")
            putBoolean("isPerPrayerEnabled", isPerPrayerEnabled ?: false)
            
            // Save Salawat Settings (Phase 2)
            if (salawatSettingsJson != null) {
                putString("salawatSettingsJson", salawatSettingsJson)
            }
            
            // Save Pre-Prayer Settings (Phase 3)
            if (prePrayerSettingsJson != null) {
                putString("prePrayerSettingsJson", prePrayerSettingsJson)
            }
            
            // Save Ramadan Settings
            if (ramadanSettingsJson != null) {
                putString("ramadanSettingsJson", ramadanSettingsJson)
            }
            
            putString("timezoneId", java.util.TimeZone.getDefault().id) // Store current timezone
            putLong("lastSync", System.currentTimeMillis())
            apply()
        }

        android.util.Log.d("MediaBridge", "💾 Persistence Data Synced: Loc=$lat,$lng, Muazzin=$muazzinId, Custom=${isPerPrayerEnabled}")
        call.resolve()
    }

    @PluginMethod
    fun registerSustainabilityWork(call: PluginCall) {
        android.util.Log.d("MediaBridge", "🚀 Registering Sustainability Workers...")

        try {
            // ── 1. SustainabilityWorker: كل 12 ساعة (جدولة الأذان + تحديث الـ Widget) ──
            val workRequest = PeriodicWorkRequestBuilder<SustainabilityWorker>(12, TimeUnit.HOURS)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "AlBayanSustainability",
                ExistingPeriodicWorkPolicy.KEEP,
                workRequest
            )

            // تشغيل فوري للتأكد من أن البيانات محدّثة الآن
            val oneTime = OneTimeWorkRequest.Builder(SustainabilityWorker::class.java).build()
            WorkManager.getInstance(context).enqueueUniqueWork(
                "AlBayanSustainabilityImmediate",
                ExistingWorkPolicy.REPLACE,
                oneTime
            )

            android.util.Log.d("MediaBridge", "✅ Sustainability Worker Registered")
            call.resolve()
        } catch (e: Exception) {
            android.util.Log.e("MediaBridge", "Failed to register workers", e)
            call.reject("Worker registration failed")
        }
    }

    // ============================================================================
    // HOME SCREEN WIDGET - Hijri Date Widget Data Update
    // ============================================================================

    /**
     * Update widget SharedPreferences with Hijri date and prayer data
     * Called from TypeScript when date/prayer data is loaded
     */
    @PluginMethod
    fun updateWidgetData(call: PluginCall) {
        android.util.Log.d("MediaBridge", "📱 updateWidgetData called")
        
        // Save to SharedPreferences for widget to read
        val prefs = context.getSharedPreferences("HijriWidgetPrefs", Context.MODE_PRIVATE)
        val editor = prefs.edit()
        
        if (call.hasOption("hijriDay")) {
            val hDay = call.getString("hijriDay")
            if (!hDay.isNullOrEmpty()) editor.putString(HijriDateWidgetProvider.KEY_HIJRI_DAY, hDay)
        }
        if (call.hasOption("hijriMonth")) {
            val hMonth = call.getString("hijriMonth")
            if (!hMonth.isNullOrEmpty()) editor.putString(HijriDateWidgetProvider.KEY_HIJRI_MONTH, hMonth)
        }
        if (call.hasOption("hijriYear")) {
            val hYear = call.getString("hijriYear")
            if (!hYear.isNullOrEmpty()) editor.putString(HijriDateWidgetProvider.KEY_HIJRI_YEAR, hYear)
        }
        if (call.hasOption("gregorianDate")) {
            val gDate = call.getString("gregorianDate")
            if (!gDate.isNullOrEmpty()) {
                // Always store today's ISO date as the unified comparison key.
                // This ensures the HijriDateWidgetProvider autonomous check knows
                // the app has already written a fresh date for today.
                val todayIso = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date())
                editor.putString(HijriDateWidgetProvider.KEY_GREGORIAN_DATE, todayIso)
                // Store the display value (as sent by TS) separately for the widget label
                editor.putString(HijriDateWidgetProvider.KEY_GREGORIAN_DATE_DISPLAY, gDate)
            }
        }
        if (call.hasOption("nextPrayerName")) {
            val pName = call.getString("nextPrayerName")
            if (!pName.isNullOrEmpty()) editor.putString(HijriDateWidgetProvider.KEY_NEXT_PRAYER_NAME, pName)
        }
        if (call.hasOption("nextPrayerTime")) {
            val pTime = call.getString("nextPrayerTime")
            if (!pTime.isNullOrEmpty()) editor.putString(HijriDateWidgetProvider.KEY_NEXT_PRAYER_TIME, pTime)
        }
        if (call.hasOption("nextPrayerTimestamp")) {
            val pTs = call.getLong("nextPrayerTimestamp") ?: -1L
            if (pTs > 0) editor.putLong(HijriDateWidgetProvider.KEY_NEXT_PRAYER_TIMESTAMP, pTs)
        }
        
        // Sync the hijri adjustment for the SustainabilityWorker
        if (call.hasOption("hijriAdjustment")) {
            val hijriAdjustment = call.getString("hijriAdjustment")
            if (hijriAdjustment != null) {
                val defaultPrefs = context.getSharedPreferences("${context.packageName}_preferences", Context.MODE_PRIVATE)
                defaultPrefs.edit().putString("hijri_adjustment", hijriAdjustment).apply()
            }
        }
        
        editor.apply()
        
        android.util.Log.d("MediaBridge", "✅ Widget data saved (partial update)")
        
        // Trigger widget refresh
        HijriDateWidgetProvider.updateAllWidgets(context)
        
        call.resolve()
    }

    /**
     * Manually refresh all widget instances
     */
    @PluginMethod
    fun refreshWidget(call: PluginCall) {
        android.util.Log.d("MediaBridge", "🔄 refreshWidget called")
        
        // Send broadcast to update all widgets
        val intent = Intent(HijriDateWidgetProvider.ACTION_REFRESH_WIDGET)
        intent.setPackage(context.packageName)
        context.sendBroadcast(intent)
        
        // Also call the static update method
        HijriDateWidgetProvider.updateAllWidgets(context)
        
        android.util.Log.d("MediaBridge", "✅ Widget refresh broadcast sent")
        call.resolve()
    }

    @PluginMethod
    fun scheduleAzhan(call: PluginCall) {
        val id = call.getInt("id") ?: return call.reject("ID required")
        val timestamp = call.getDouble("time")?.toLong() ?: return call.reject("Time required")
        val muazzinId = call.getString("muazzinId") ?: "egy_abdulbasit"
        val prayerName = call.getString("prayerName") ?: "الصلاة"
        val volume = call.getInt("volume") ?: 80

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        
        android.util.Log.d("MediaBridge", "📅 scheduleAzhan called: id=$id, time=$timestamp, muazzin=$muazzinId, prayer=$prayerName")
        
        // CRITICAL FIX (Android 12+): Use PendingIntent.getBroadcast to AzhanReceiver
        // BroadcastReceiver.onReceive() gets a legal 10-second window to start foreground service
        // Direct getForegroundService() fails silently when app is killed/background on Android 12+
        val muazzinName = call.getString("muazzinName") ?: ""
        val prayerTime = call.getString("prayerTime") ?: ""
        val azhanUrl = call.getString("azhanUrl") // NEW: Support for custom audio URL

        val receiverIntent = Intent(context, AzhanReceiver::class.java).apply {
            action = "ACTION_PLAY_AZHAN"
            putExtra("MUAZZIN_ID", muazzinId)
            putExtra("PRAYER_NAME", prayerName)
            putExtra("MUAZZIN_NAME", muazzinName)
            putExtra("PRAYER_TIME", prayerTime)
            putExtra("VOLUME", volume)
            if (azhanUrl != null) putExtra("AZHAN_URL", azhanUrl) // Pass URL if present
        }
        
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_CANCEL_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_CANCEL_CURRENT
        }

        // Use getBroadcast -> AzhanReceiver for reliable foreground service start on Android 12+
        val pendingIntent = PendingIntent.getBroadcast(context, id, receiverIntent, flags)

        try {
            // Use setAlarmClock for critical alarms - treated like a real alarm clock by the OS
            // This is more reliable on Xiaomi/MIUI devices that aggressively kill background apps
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                val showIntent = PendingIntent.getActivity(
                    context, 0, 
                    Intent(context, MainActivity::class.java),
                    PendingIntent.FLAG_IMMUTABLE
                )
                val alarmClockInfo = AlarmManager.AlarmClockInfo(timestamp, showIntent)
                alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)
                android.util.Log.d("MediaBridge", "Scheduled Azhan (setAlarmClock) for $prayerName at $timestamp with muazzin $muazzinId via AzhanReceiver")
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timestamp, pendingIntent)
                android.util.Log.d("MediaBridge", "Scheduled Azhan (setExactAndAllowWhileIdle) for $prayerName at $timestamp")
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, timestamp, pendingIntent)
                android.util.Log.d("MediaBridge", "⏰ Scheduled Azhan (setExact) for $prayerName at $timestamp")
            }
            android.util.Log.d("MediaBridge", "✅ Schedule Success: ID=$id, Time=$timestamp, Muazzin=$muazzinId")
            call.resolve()
        } catch (e: SecurityException) {
            android.util.Log.e("MediaBridge", "Permission denied for exact alarm: ${e.message}", e)
            call.reject("Permission denied for exact alarm: ${e.message}")
        } catch (e: Exception) {
            android.util.Log.e("MediaBridge", "Failed to schedule Azhan: ${e.message}", e)
            call.reject("Failed to schedule Azhan: ${e.message}")
        }
    }

    @PluginMethod
    fun scheduleAzhanBatch(call: PluginCall) {
        val alarms = call.getArray("alarms")
        if (alarms == null || alarms.length() == 0) {
            return call.resolve(JSObject().apply { put("count", 0) })
        }

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        var successCount = 0
        var failCount = 0
        val scheduledIds = mutableListOf<Int>() // Track scheduled IDs

        // Common intent flags
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_CANCEL_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_CANCEL_CURRENT
        }

        try {
            for (i in 0 until alarms.length()) {
                val alarm = alarms.getJSONObject(i)
                val id = alarm.optInt("id", -1)
                val timestamp = alarm.optLong("time", -1)
                
                if (id == -1 || timestamp == -1L) {
                    failCount++
                    continue
                }

                val muazzinId = alarm.optString("muazzinId", "egy_abdulbasit")
                val prayerName = alarm.optString("prayerName", "الصلاة")
                val volume = alarm.optInt("volume", 80)

                val muazzinName = alarm.optString("muazzinName", "")
                val prayerTime = alarm.optString("prayerTime", "")
                val azhanUrl = alarm.optString("azhanUrl", "") // NEW: Support for custom audio URL
                
                // CRITICAL FIX (Android 12+): Use getBroadcast -> AzhanReceiver
                // BroadcastReceiver gets legal window to start foreground service
                val receiverIntent = Intent(context, AzhanReceiver::class.java).apply {
                    action = "ACTION_PLAY_AZHAN"
                    putExtra("MUAZZIN_ID", muazzinId)
                    putExtra("PRAYER_NAME", prayerName)
                    putExtra("MUAZZIN_NAME", muazzinName)
                    putExtra("PRAYER_TIME", prayerTime)
                    putExtra("VOLUME", volume)
                    if (azhanUrl.isNotEmpty()) putExtra("AZHAN_URL", azhanUrl)
                }

                val pendingIntent = PendingIntent.getBroadcast(context, id, receiverIntent, flags)

                // Scheduling logic (Same as single scheduleAzhan)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    val showIntent = PendingIntent.getActivity(
                        context, 0,
                        Intent(context, MainActivity::class.java),
                        PendingIntent.FLAG_IMMUTABLE
                    )
                    val alarmClockInfo = AlarmManager.AlarmClockInfo(timestamp, showIntent)
                    alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timestamp, pendingIntent)
                } else {
                    alarmManager.setExact(AlarmManager.RTC_WAKEUP, timestamp, pendingIntent)
                }
                scheduledIds.add(id) // Track this ID
                successCount++
            }
            
            // Save scheduled IDs for later cancellation
            saveAlarmIds(KEY_AZHAN_IDS, scheduledIds)
            
            android.util.Log.d("MediaBridge", "✅ Batch scheduled: $successCount Azhan alarms, failed: $failCount")
            call.resolve(JSObject().apply { 
                put("count", successCount) 
                put("failed", failCount)
            })

        } catch (e: Exception) {
            android.util.Log.e("MediaBridge", "Batch schedule failed: ${e.message}", e)
            call.reject("Batch schedule failed: ${e.message}")
        }
    }

    @PluginMethod
    fun cancelAzhan(call: PluginCall) {
        val id = call.getInt("id") ?: return call.reject("ID required")
        
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        // Must use same intent type as scheduleAzhan for proper cancellation
        // Updated to match getBroadcast -> AzhanReceiver pattern
        val receiverIntent = Intent(context, AzhanReceiver::class.java).apply {
            action = "ACTION_PLAY_AZHAN"
        }
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_CANCEL_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_CANCEL_CURRENT
        }
        
        val pendingIntent = PendingIntent.getBroadcast(context, id, receiverIntent, flags)
        alarmManager.cancel(pendingIntent)
        // CRITICAL FIX: Clear cached extras
        pendingIntent.cancel()
        android.util.Log.d("MediaBridge", "Cancelled Azhan for id $id (PI cleared)")
        call.resolve()
    }

    /**
     * Schedule pre-prayer audio alerts in batch
     * Similar to Muslim Pro / Athan apps - plays a short alert before prayer time
     */
    @PluginMethod
    fun schedulePrePrayerAlertBatch(call: PluginCall) {
        val alerts = call.getArray("alerts")
        if (alerts == null || alerts.length() == 0) {
            return call.resolve(JSObject().apply { put("count", 0) })
        }

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        var successCount = 0
        var failCount = 0
        val scheduledIds = mutableListOf<Int>() // Track scheduled IDs

        try {
            for (i in 0 until alerts.length()) {
                val alert = alerts.getJSONObject(i)
                val id = alert.getInt("id")
                val timestamp = alert.getLong("time")
                val prayerName = alert.optString("prayerName", "الصلاة")
                val alertSound = alert.optString("alertSound", "alert_approaching")
                val volume = alert.optInt("volume", 80)

                // Create intent for PrePrayerAlertReceiver
                val receiverIntent = Intent(context, PrePrayerAlertReceiver::class.java).apply {
                    action = PrePrayerAlertReceiver.ACTION_PRE_PRAYER_ALERT
                    putExtra(PrePrayerAlertReceiver.EXTRA_ALERT_SOUND, alertSound)
                    putExtra(PrePrayerAlertReceiver.EXTRA_PRAYER_NAME, prayerName)
                    putExtra(PrePrayerAlertReceiver.EXTRA_VOLUME, volume)
                }

                val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    PendingIntent.FLAG_CANCEL_CURRENT or PendingIntent.FLAG_IMMUTABLE
                } else {
                    PendingIntent.FLAG_CANCEL_CURRENT
                }

                val pendingIntent = PendingIntent.getBroadcast(context, id, receiverIntent, flags)

                try {
                    // Use setExactAndAllowWhileIdle for pre-prayer alerts (less intrusive than setAlarmClock)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timestamp, pendingIntent)
                    } else {
                        alarmManager.setExact(AlarmManager.RTC_WAKEUP, timestamp, pendingIntent)
                    }
                    scheduledIds.add(id) // Track this ID
                    successCount++
                    android.util.Log.d("MediaBridge", "📢 Scheduled pre-prayer alert for $prayerName at $timestamp")
                } catch (e: Exception) {
                    failCount++
                    android.util.Log.e("MediaBridge", "Failed to schedule pre-prayer alert: ${e.message}")
                }
            }
            
            // Save scheduled IDs for later cancellation
            saveAlarmIds(KEY_PRE_PRAYER_IDS, scheduledIds)

            call.resolve(JSObject().apply {
                put("count", successCount)
                put("failed", failCount)
            })
            android.util.Log.d("MediaBridge", "✅ Pre-prayer alerts batch: $successCount scheduled, $failCount failed")

        } catch (e: Exception) {
            android.util.Log.e("MediaBridge", "Pre-prayer batch schedule failed: ${e.message}", e)
            call.reject("Pre-prayer batch schedule failed: ${e.message}")
        }
    }

    /**
     * Schedule Salawat (blessings upon Prophet ﷺ) reminder alerts in batch
     * Distributes reminders throughout the day based on user settings
     */
    @PluginMethod
    fun scheduleSalawatAlertBatch(call: PluginCall) {
        val alerts = call.getArray("alerts")
        if (alerts == null || alerts.length() == 0) {
            return call.resolve(JSObject().apply { put("count", 0) })
        }

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        var successCount = 0
        var failCount = 0
        val scheduledIds = mutableListOf<Int>() // Track scheduled IDs

        try {
            for (i in 0 until alerts.length()) {
                val alert = alerts.getJSONObject(i)
                val id = alert.getInt("id")
                val timestamp = alert.getLong("time")
                val soundId = alert.optString("soundId", "salawat_one")
                val soundEnabled = alert.optBoolean("soundEnabled", true)
                val volume = alert.optInt("volume", 80)
                val shouldResume = alert.optBoolean("shouldResume", false) // NEW: Smart Resume flag

                // Create intent for SalawatAlertReceiver
                val receiverIntent = Intent(context, SalawatAlertReceiver::class.java).apply {
                    action = SalawatAlertReceiver.ACTION_SALAWAT_ALERT
                    putExtra(SalawatAlertReceiver.EXTRA_SOUND_ID, soundId)
                    putExtra(SalawatAlertReceiver.EXTRA_SOUND_ENABLED, soundEnabled)
                    putExtra(SalawatAlertReceiver.EXTRA_VOLUME, volume)
                    putExtra(SalawatAlertReceiver.EXTRA_SHOULD_RESUME, shouldResume) // Pass it on
                }

                val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    PendingIntent.FLAG_CANCEL_CURRENT or PendingIntent.FLAG_IMMUTABLE
                } else {
                    PendingIntent.FLAG_CANCEL_CURRENT
                }

                val pendingIntent = PendingIntent.getBroadcast(context, id, receiverIntent, flags)

                try {
                    // Use setExactAndAllowWhileIdle for Salawat reminders
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timestamp, pendingIntent)
                    } else {
                        alarmManager.setExact(AlarmManager.RTC_WAKEUP, timestamp, pendingIntent)
                    }
                    scheduledIds.add(id) // Track this ID
                    successCount++
                    android.util.Log.d("MediaBridge", "🤲 Scheduled Salawat reminder at $timestamp with sound $soundId")
                } catch (e: Exception) {
                    failCount++
                    android.util.Log.e("MediaBridge", "Failed to schedule Salawat reminder: ${e.message}")
                }
            }
            
            // Save scheduled IDs for later cancellation
            saveAlarmIds(KEY_SALAWAT_IDS, scheduledIds)

            call.resolve(JSObject().apply {
                put("count", successCount)
                put("failed", failCount)
            })
            android.util.Log.d("MediaBridge", "✅ Salawat alerts batch: $successCount scheduled, $failCount failed")

        } catch (e: Exception) {
            android.util.Log.e("MediaBridge", "Salawat batch schedule failed: ${e.message}", e)
            call.reject("Salawat batch schedule failed: ${e.message}")
        }
    }

    private fun executeOnMainThread(action: () -> Unit) {
        bridge.activity.runOnUiThread(action)
    }

    @PluginMethod
    fun requestDndAccess(call: PluginCall) {
        try {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
            if (!notificationManager.isNotificationPolicyAccessGranted) {
                val intent = Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
                call.resolve(JSObject().apply { put("opened", true) })
            } else {
                call.resolve(JSObject().apply { put("alreadyGranted", true) })
            }
        } catch (e: Exception) {
            call.reject("Failed to open DND settings: ${e.message}")
        }
    }

    @PluginMethod
    fun checkDndAccess(call: PluginCall) {
        try {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
            val isGranted = notificationManager.isNotificationPolicyAccessGranted
            call.resolve(JSObject().apply { put("granted", isGranted) })
        } catch (e: Exception) {
            // Default to true if check fails to avoid blocking user
            call.resolve(JSObject().apply { put("granted", true) })
        }
    }

    @PluginMethod
    fun checkExactAlarmPermission(call: PluginCall) {
        val result = JSObject()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            result.put("canScheduleExactAlarms", alarmManager.canScheduleExactAlarms())
        } else {
            // Before Android 12, exact alarms are always allowed
            result.put("canScheduleExactAlarms", true)
        }
        call.resolve(result)
    }

    @PluginMethod
    fun requestExactAlarmPermission(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            if (!alarmManager.canScheduleExactAlarms()) {
                try {
                    val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                        data = Uri.parse("package:${context.packageName}")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(intent)
                    call.resolve(JSObject().apply { put("opened", true) })
                } catch (e: Exception) {
                    call.reject("Failed to open alarm settings: ${e.message}")
                }
            } else {
                call.resolve(JSObject().apply { put("alreadyGranted", true) })
            }
        } else {
            call.resolve(JSObject().apply { put("notRequired", true) })
        }
    }

    @PluginMethod
    fun setAzhanVolume(call: PluginCall) {
        val volume = call.getInt("volume") ?: return call.reject("Volume required")
        
        val serviceIntent = Intent(context, AudioPlaybackService::class.java).apply {
            action = "ACTION_SET_VOLUME"
            putExtra("VOLUME", volume)
        }
        
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
            call.resolve()
        } catch (e: Exception) {
            android.util.Log.e("MediaBridge", "SetAzhanVolume failed: ${e.message}", e)
            call.reject("SetAzhanVolume failed: ${e.message}")
        }
    }

    @PluginMethod
    fun pauseAzhan(call: PluginCall) {
        val serviceIntent = Intent(context, AudioPlaybackService::class.java).apply {
            action = AudioPlaybackService.ACTION_PAUSE_AZHAN
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
            call.resolve()
        } catch (e: Exception) {
            call.reject("pauseAzhan failed: ${e.message}")
        }
    }

    @PluginMethod
    fun resumeAzhan(call: PluginCall) {
        val serviceIntent = Intent(context, AudioPlaybackService::class.java).apply {
            action = AudioPlaybackService.ACTION_RESUME_AZHAN
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
            call.resolve()
        } catch (e: Exception) {
            call.reject("resumeAzhan failed: ${e.message}")
        }
    }

    @PluginMethod
    fun toggleMuteAzhan(call: PluginCall) {
        val serviceIntent = Intent(context, AudioPlaybackService::class.java).apply {
            action = AudioPlaybackService.ACTION_TOGGLE_MUTE_AZHAN
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
            call.resolve()
        } catch (e: Exception) {
            call.reject("toggleMuteAzhan failed: ${e.message}")
        }
    }
    @PluginMethod
    fun openAutoStart(call: PluginCall) {
        val manufacturers = arrayOf(
            // Xiaomi
            Intent().setComponent(ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")),
            Intent().setComponent(ComponentName("com.miui.securitycenter", "com.miui.powercenter.PowerSettings")),
            // Oppo
            Intent().setComponent(ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity")),
            Intent().setComponent(ComponentName("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity")),
            // Vivo
            Intent().setComponent(ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity")),
            // Huawei
            Intent().setComponent(ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity")),
            Intent().setComponent(ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"))
        )

        for (intent in manufacturers) {
            try {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
                call.resolve()
                return
            } catch (e: Exception) {
                // Continue to next intent
            }
        }
        
        // If no specific intent works, try generic App Details
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:${context.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to open AutoStart settings")
        }
    }

    @PluginMethod
    fun requestOverlayPermission(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(context)) {
                try {
                    val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).apply {
                        data = Uri.parse("package:${context.packageName}")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(intent)
                    call.resolve(JSObject().apply { put("opened", true) })
                } catch (e: Exception) {
                    // Fallback to generic list if package-specific fails
                    try {
                        val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                        context.startActivity(intent)
                        call.resolve(JSObject().apply { put("opened", true) })
                    } catch (e2: Exception) {
                        call.reject("Failed to open overlay settings: ${e2.message}")
                    }
                }
            } else {
                call.resolve(JSObject().apply { put("alreadyGranted", true) })
            }
        } else {
            call.resolve(JSObject().apply { put("notRequired", true) })
        }
    }

    @PluginMethod
    fun checkOverlayPermission(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            call.resolve(JSObject().apply { 
                put("granted", Settings.canDrawOverlays(context)) 
            })
        } else {
            call.resolve(JSObject().apply { put("granted", true) })
        }
    }

    @PluginMethod
    fun openAppSettings(call: PluginCall) {
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:${context.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to open app settings: ${e.message}")
        }
    }

    @PluginMethod
    fun requestLocationSettings(call: PluginCall) {
        try {
            val intent = Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            call.resolve(JSObject().apply { put("opened", true) })
        } catch (e: Exception) {
             call.reject("Failed to open location settings: ${e.message}")
        }
    }
    @PluginMethod
    fun checkSoundAssets(call: PluginCall) {
        val sounds = listOf("salawat_one", "salawat_two", "salawat_three", "egy_abdulbasit")
        val missing = JSArray()
        
        var allGood = true
        for (sound in sounds) {
            val resId = context.resources.getIdentifier(sound, "raw", context.packageName)
            if (resId == 0) {
                missing.put(sound)
                allGood = false
            }
        }
        
        val ret = JSObject()
        ret.put("missing", missing as Any)
        ret.put("allGood", allGood)
        call.resolve(ret)
    }

    /**
     * Cancel a range of alarm IDs blindly (Rescue Operation)
     * Used to clean up "Ghost Alarms" from previous buggy implementations
     */
    @PluginMethod
    fun cancelAlarmRange(call: PluginCall) {
        val startId = call.getInt("startId")
        val endId = call.getInt("endId")

        if (startId == null || endId == null) {
            return call.reject("startId and endId are required")
        }

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        var cancelledCount = 0

        try {
            // Iterate through the range and try to cancel each ID
            for (id in startId..endId) {
                // We must recreate the PendingIntent exactly as it was created.
                // Since we don't know the exact intent extras used by the ghost alarms,
                // we rely on the fact that PendingIntent.getBroadcast with FLAG_NO_CREATE
                // might return null if it doesn't exist, OR we just try to cancel blindly.
                //
                // CRITICAL DETECTIVE WORK:
                // The ghost alarms were likely created with SalawatAlertReceiver.
                // We create a generic intent for that receiver.
                // Extras shouldn't matter for cancellation if filterEquals returns true? 
                // Actually, lookup requires matching Intent structure.
                
                val receiverIntent = Intent(context, SalawatAlertReceiver::class.java).apply {
                    action = SalawatAlertReceiver.ACTION_SALAWAT_ALERT
                }
                
                // Try both Flag variants to be sure
                val flagImmutable = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
                val flagUpdate = PendingIntent.FLAG_UPDATE_CURRENT
                
                // We use FLAG_NO_CREATE to check if it exists first? 
                // No, just try to cancel.
                val pendingIntent = PendingIntent.getBroadcast(
                    context, 
                    id, 
                    receiverIntent, 
                    flagUpdate or flagImmutable
                )
                
                if (pendingIntent != null) {
                    alarmManager.cancel(pendingIntent)
                    pendingIntent.cancel()
                    cancelledCount++
                }
            }
            
            Log.d("MediaBridge", "🧹 Rescue Cleanup: Checked range $startId-$endId, cancelled potential PIs")
            call.resolve(JSObject().apply {
                put("checked", endId - startId + 1)
                put("status", "completed") 
            })
            
        } catch (e: Exception) {
            Log.e("MediaBridge", "Rescue cleanup failed", e)
            call.reject("Rescue cleanup failed: ${e.message}")
        }
    }

    @PluginMethod
    fun sendEmail(call: PluginCall) {
        val subject = call.getString("subject") ?: "Al-Bayan Feedback"
        val body = call.getString("body") ?: ""
        val attachmentPath = call.getString("attachmentPath")

        try {
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "message/rfc822" // Or "text/plain"
                putExtra(Intent.EXTRA_EMAIL, arrayOf("engahmedmohammed00@gmail.com"))
                putExtra(Intent.EXTRA_SUBJECT, subject)
                putExtra(Intent.EXTRA_TEXT, body)
                setPackage("com.google.android.gm") // Force Gmail
            }

            if (attachmentPath != null) {
                // Handling file URI
                val cleanPath = attachmentPath.replace("file://", "")
                val file = java.io.File(cleanPath)
                
                if (file.exists()) {
                    val uri = androidx.core.content.FileProvider.getUriForFile(
                        context,
                        context.packageName + ".fileprovider",
                        file
                    )
                    intent.putExtra(Intent.EXTRA_STREAM, uri)
                    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
            }

            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            call.resolve()
        } catch (e: android.content.ActivityNotFoundException) {
            // Gmail not installed? Fallback to generic chooser
            try {
                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "message/rfc822"
                    putExtra(Intent.EXTRA_EMAIL, arrayOf("engahmedmohammed00@gmail.com"))
                    putExtra(Intent.EXTRA_SUBJECT, subject)
                    putExtra(Intent.EXTRA_TEXT, body)
                    if (attachmentPath != null) {
                         val cleanPath = attachmentPath.replace("file://", "")
                         val file = java.io.File(cleanPath)
                         if (file.exists()) {
                             val uri = androidx.core.content.FileProvider.getUriForFile(
                                 context,
                                 context.packageName + ".fileprovider",
                                 file
                             )
                             putExtra(Intent.EXTRA_STREAM, uri)
                             addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                         }
                    }
                }
                context.startActivity(Intent.createChooser(intent, "Send Email"))
                call.resolve()
            } catch (e2: Exception) {
                 call.reject("Email failed: ${e2.message}")
            }
        } catch (e: Exception) {
            call.reject("Failed to open email: ${e.message}")
        }
    }
    @PluginMethod
    fun shareLogFile(call: PluginCall) {
        try {
            val fileName = call.getString("fileName") ?: "azhan_debug_log.txt"
            val file = File(context.getExternalFilesDir(null), fileName)

            if (!file.exists()) {
                call.reject("Log file not found")
                return
            }

            val uri = FileProvider.getUriForFile(
                context,
                context.packageName + ".fileprovider",
                file
            )

            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, "Azhan Debug Log")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            val chooser = Intent.createChooser(shareIntent, "Share Log File")
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(chooser)
            
            call.resolve()
        } catch (e: Exception) {
            Log.e("MediaBridge", "Error sharing log file", e)
            call.reject("Error sharing log file: ${e.message}")
        }
    }

    @PluginMethod
    fun deleteLogFile(call: PluginCall) {
        try {
            val fileName = call.getString("fileName") ?: "azhan_debug_log.txt"
            val file = File(context.getExternalFilesDir(null), fileName)

            if (file.exists()) {
                if (file.delete()) {
                    call.resolve()
                } else {
                    call.reject("Failed to delete log file")
                }
            } else {
                // Return success if file doesn't exist (idempotent)
                call.resolve()
            }
        } catch (e: Exception) {
            Log.e("MediaBridge", "Error deleting log file", e)
            call.reject("Error deleting log file: ${e.message}")
        }
    }
    @PluginMethod
    fun getDiagnosticInfo(call: PluginCall) {
        try {
            val ret = JSObject()
            
            // 1. Service State
            ret.put("isAzhanPlaying", isAzhanPlaying)
            
            // 2. Read last 10 lines of log file
            val fileName = "azhan_debug_log.txt"
            val file = File(context.getExternalFilesDir(null), fileName)
            val logs = JSArray()
            
            if (file.exists()) {
                // Read lines efficiently (reverse order would be better but simple readLines is fine for small logs)
                val lines = file.readLines()
                val lastLines = lines.takeLast(10)
                for (line in lastLines) {
                    logs.put(line)
                }
            } else {
                logs.put("Log file not found.")
            }
            ret.put("logs", logs)
            
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("Failed to get diagnostic info: ${e.message}")
        }
    }

    @PluginMethod
    fun getAzhanStopMethods(call: PluginCall) {
        try {
            val prefs = context.getSharedPreferences("AlBayanPrefs", Context.MODE_PRIVATE)
            val ret = JSObject()
            
            // Default to true if not set
            ret.put("masterEnabled", prefs.getBoolean("azhan_gesture_stop_enabled", true))
            ret.put("flipEnabled", prefs.getBoolean("azhan_gesture_flip_enabled", true))
            ret.put("proximityEnabled", prefs.getBoolean("azhan_gesture_proximity_enabled", true))
            ret.put("volumeEnabled", prefs.getBoolean("azhan_gesture_volume_enabled", true))
            
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("Failed to get stop methods: ${e.message}")
        }
    }

    @PluginMethod
    fun setAzhanStopMethods(call: PluginCall) {
        try {
            val prefs = context.getSharedPreferences("AlBayanPrefs", Context.MODE_PRIVATE)
            val editor = prefs.edit()
            
            if (call.hasOption("masterEnabled")) {
                editor.putBoolean("azhan_gesture_stop_enabled", call.getBoolean("masterEnabled", true) ?: true)
            }
            if (call.hasOption("flipEnabled")) {
                editor.putBoolean("azhan_gesture_flip_enabled", call.getBoolean("flipEnabled", true) ?: true)
            }
            if (call.hasOption("proximityEnabled")) {
                editor.putBoolean("azhan_gesture_proximity_enabled", call.getBoolean("proximityEnabled", true) ?: true)
            }
            if (call.hasOption("volumeEnabled")) {
                editor.putBoolean("azhan_gesture_volume_enabled", call.getBoolean("volumeEnabled", true) ?: true)
            }
            
            editor.apply()
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to set stop methods: ${e.message}")
        }
    }

    @PluginMethod
    fun getPersistenceData(call: PluginCall) {
        try {
            val prefs = context.getSharedPreferences("AlBayanPersistence", Context.MODE_PRIVATE)
            val ret = JSObject()

            if (prefs.contains("hijriAutoAdjustment")) {
                ret.put("hijriAutoAdjustment", prefs.getInt("hijriAutoAdjustment", 0))
            }
            if (prefs.contains("hijriAutoSyncEnabled")) {
                ret.put("hijriAutoSyncEnabled", prefs.getBoolean("hijriAutoSyncEnabled", false))
            }
            if (prefs.contains("hijriManualOverride")) {
                ret.put("hijriManualOverride", prefs.getBoolean("hijriManualOverride", false))
            }
            // hijriEffectiveAdjustment: القيمة الفعلية المطبّقة (كتبها TypeScript)
            if (prefs.contains("hijriEffectiveAdjustment")) {
                ret.put("hijriEffectiveAdjustment", prefs.getInt("hijriEffectiveAdjustment", 0))
            }

            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("Failed to get persistence data: ${e.message}")
        }
    }

    @PluginMethod
    fun fetchHijriDate(call: PluginCall) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val res = HijriAutoSyncNative.performFetch()
                if (res != null) {
                    val ret = JSObject()
                    ret.put("day", res.day)
                    ret.put("month", res.month)
                    ret.put("year", res.year)
                    call.resolve(ret)
                } else {
                    call.reject("API_FETCH_FAILED")
                }
            } catch (e: Exception) {
                Log.e("MediaBridge", "fetchHijriDate failed", e)
                call.reject("UNEXPECTED_ERROR: ${e.message}")
            }
        }
    }
}
