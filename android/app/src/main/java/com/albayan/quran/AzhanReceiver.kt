package com.albayan.quran

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager

class AzhanReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        // ══════════════════════════════════════════════════════════════════════════
        // 🔍 DIAGNOSTIC LOGGING - MILITARY GRADE
        // ══════════════════════════════════════════════════════════════════════════
        val logTag = "AzhanReceiver"

        // 🛡️ BATHROOM / PRIVACY MODE CHECK 🛡️
        val prefs = context.getSharedPreferences("AlBayanPrefs", Context.MODE_PRIVATE)
        val privacyEndTime = prefs.getLong("BATHROOM_MODE_END_TIME", 0)
        val now = System.currentTimeMillis()
        
        if (now < privacyEndTime) {
            android.util.Log.d(logTag, "🛑 BLOCKED: Bathroom/Privacy Mode is active. Skipping Azhan.")
            android.util.Log.d(logTag, "   Active until: ${java.util.Date(privacyEndTime)}")
            return
        }

        android.util.Log.d(logTag, "╔════════════════════════════════════════════════════════════════════╗")
        android.util.Log.d(logTag, "║ 🔔 AZHAN ALARM FIRED                                               ║")
        android.util.Log.d(logTag, "╠════════════════════════════════════════════════════════════════════╣")
        android.util.Log.d(logTag, "║ Action: ${intent.action?.padEnd(58)} ║")
        android.util.Log.d(logTag, "║ Timestamp: ${System.currentTimeMillis()}                            ║")
        
        val extras = intent.extras
        if (extras != null) {
            for (key in extras.keySet()) {
                @Suppress("DEPRECATION")
                val value = extras.get(key)
                android.util.Log.d(logTag, "║ EXTRA: ${key.padEnd(20)} = ${value.toString().take(30).padEnd(30)} ║")
            }
        } else {
            android.util.Log.d(logTag, "║ NO EXTRAS FOUND!                                                   ║")
        }
        android.util.Log.d(logTag, "╚════════════════════════════════════════════════════════════════════╝")

        
        val muazzinId = intent.getStringExtra("MUAZZIN_ID") ?: run {
            android.util.Log.e("AzhanReceiver", "❌ CRITICAL: No MUAZZIN_ID in intent extras!")
            android.util.Log.e("AzhanReceiver", "   Available keys: ${intent.extras?.keySet()?.joinToString() ?: "NONE"}")
            return
        }
        val prayerName = intent.getStringExtra("PRAYER_NAME") ?: "الصلاة"
        val muazzinName = intent.getStringExtra("MUAZZIN_NAME") ?: ""
        val prayerTime = intent.getStringExtra("PRAYER_TIME") ?: ""
        val volume = intent.getIntExtra("VOLUME", 80)
        val azhanUrl = intent.getStringExtra("AZHAN_URL")
        
        android.util.Log.d("AzhanReceiver", "──────────────────────────────────────────────────")
        android.util.Log.d("AzhanReceiver", "📿 Prayer: $prayerName at $prayerTime")
        android.util.Log.d("AzhanReceiver", "🎤 Muazzin ID: '$muazzinId'")
        android.util.Log.d("AzhanReceiver", "👤 Muazzin Name: $muazzinName")
        android.util.Log.d("AzhanReceiver", "🔊 Volume: $volume%")
        android.util.Log.d("AzhanReceiver", "🔗 URL: ${azhanUrl ?: "NULL (will use bundled)"}")
        android.util.Log.d("AzhanReceiver", "══════════════════════════════════════════════════")

        // CRITICAL: Acquire WakeLock IMMEDIATELY to ensure device stays awake
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        @Suppress("DEPRECATION")
        val wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "AlBayan:AzhanReceiverWakeLock"
        )
        
        try {
            wakeLock.acquire(60 * 1000L) // 60 seconds - extended for reliability
            android.util.Log.d("AzhanReceiver", "✅ WakeLock acquired for 60s")
        } catch (e: Exception) {
            android.util.Log.e("AzhanReceiver", "❌ Failed to acquire WakeLock: ${e.message}")
        }

        // STEP 1: Start AudioPlaybackService for sound
        val serviceIntent = Intent(context, AudioPlaybackService::class.java).apply {
            action = "ACTION_PLAY_AZHAN"
            putExtra("MUAZZIN_ID", muazzinId)
            putExtra("PRAYER_NAME", prayerName)
            putExtra("MUAZZIN_NAME", muazzinName)
            putExtra("PRAYER_TIME", prayerTime)
            putExtra("VOLUME", volume)
            putExtra("IS_REAL_PRAYER_TIME", true) // Mark as real prayer time for logic branching
            if (azhanUrl != null) putExtra("AZHAN_URL", azhanUrl) // Pass URL to Service
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
                android.util.Log.d("AzhanReceiver", "🚀 Started foreground service for Azhan")
            } else {
                context.startService(serviceIntent)
                android.util.Log.d("AzhanReceiver", "🚀 Started service for Azhan")
            }
        } catch (e: Exception) {
            android.util.Log.e("AzhanReceiver", "❌ Failed to start AudioPlaybackService: ${e.message}", e)
        }
        
        // Release WakeLock after service is started
        try {
            if (wakeLock.isHeld) {
                wakeLock.release()
                android.util.Log.d("AzhanReceiver", "WakeLock released")
            }
        } catch (e: Exception) {
            android.util.Log.w("AzhanReceiver", "Error releasing WakeLock: ${e.message}")
        }
        
        // NOTE: AzhanActivity (Native UI) removed - unified to React AzhanModal
        // The UI is now handled by React via MediaBridge 'azhanStarted' event
        // This ensures consistent UI across Light/Dark modes
        
        // ==========================================
        // 🌍 WIDGET UPDATE: IMMEDIATE REFRESH
        // ==========================================
        // Update widget immediately when Azhan starts so it points to the NEXT prayer.
        // KEY FIX: Use the SAME strategy as SustainabilityWorker:
        //   1. Prefer the Hijri date already set by the JS app (Umm al-Qura + user correction).
        //   2. Only fall back to HijriUtil if no app-set date exists, and apply saved adjustment.
        try {
            val now = java.util.Date()
            val widgetPrefs = context.getSharedPreferences("HijriWidgetPrefs", Context.MODE_PRIVATE)
            
            // Check if the JS app has already written a corrected Hijri date
            val appSetDay = widgetPrefs.getString(HijriDateWidgetProvider.KEY_HIJRI_DAY, null)
            val appSetMonth = widgetPrefs.getString(HijriDateWidgetProvider.KEY_HIJRI_MONTH, null)
            val appSetYear = widgetPrefs.getString(HijriDateWidgetProvider.KEY_HIJRI_YEAR, null)
            
            val hijriDay: String
            val hijriMonth: String
            val hijriYear: String
            
            if (appSetDay != null && appSetMonth != null && appSetYear != null) {
                // ✅ Use the accurate Hijri date set by JS (Umm al-Qura + user correction)
                hijriDay = appSetDay
                hijriMonth = appSetMonth
                hijriYear = appSetYear
                android.util.Log.d("AzhanReceiver", "✅ Widget: Using app-set Hijri date (Umm al-Qura): Day=$hijriDay Month=$hijriMonth")
            } else {
                // ⚠️ Fallback: App hasn't opened yet — read user's saved hijri_adjustment and apply it
                val defaultPrefs = context.getSharedPreferences("${context.packageName}_preferences", Context.MODE_PRIVATE)
                val adjustmentStr = defaultPrefs.getString("hijri_adjustment", "0") ?: "0"
                val adjustment = adjustmentStr.toIntOrNull() ?: 0
                
                val hijriDate = HijriUtil.getHijriDate(now, adjustment)
                hijriDay = HijriDateWidgetProvider.toArabicDigits(hijriDate.day)
                hijriMonth = hijriDate.monthName
                hijriYear = HijriDateWidgetProvider.toArabicDigits(hijriDate.year)
                android.util.Log.w("AzhanReceiver", "⚠️ Widget: No app-set date, using HijriUtil with adjustment=$adjustment")
            }
            
            // Recalculate days remaining based on Hijri day
            val dayInt = hijriDay.map { c ->
                val arabicChars = "٠١٢٣٤٥٦٧٨٩"
                val idx = arabicChars.indexOf(c)
                if (idx >= 0) idx.digitToChar() else c
            }.joinToString("").toIntOrNull() ?: 1
            val rawRemaining = 30 - dayInt
            val daysRemainingAr = HijriDateWidgetProvider.toArabicDigits(if (rawRemaining < 0) 0 else rawRemaining)
            
            val nextPrayerInfo = NativePrayerScheduler.getNextPrayer(context)
            
            val editor = widgetPrefs.edit()
            editor.putString(HijriDateWidgetProvider.KEY_HIJRI_DAY, hijriDay)
            editor.putString(HijriDateWidgetProvider.KEY_HIJRI_MONTH, hijriMonth)
            editor.putString(HijriDateWidgetProvider.KEY_HIJRI_YEAR, hijriYear)
            editor.putString(HijriDateWidgetProvider.KEY_HIJRI_DAYS_REMAINING, daysRemainingAr)
            
            val dateFormat = java.text.SimpleDateFormat("EEEE، d MMMM", java.util.Locale("ar"))
            editor.putString(HijriDateWidgetProvider.KEY_GREGORIAN_DATE, dateFormat.format(now))
            
            if (nextPrayerInfo != null) {
                editor.putString(HijriDateWidgetProvider.KEY_NEXT_PRAYER_NAME, nextPrayerInfo.name)
                // Use the constant key — consistent with HijriDateWidgetProvider & SustainabilityWorker
                editor.putLong(HijriDateWidgetProvider.KEY_NEXT_PRAYER_TIMESTAMP, nextPrayerInfo.timeObj.time)
                val rawTime = nextPrayerInfo.time
                val timeParts = rawTime.split(":")
                val formattedTime12 = if (timeParts.size >= 2) {
                    val h24    = timeParts[0].toIntOrNull() ?: 12
                    val m      = timeParts[1].toIntOrNull() ?: 0
                    val period = if (h24 >= 12) "م" else "ص"
                    val h12    = if (h24 % 12 == 0) 12 else h24 % 12
                    // Use shared helper — preserves leading zero ("04" → "٠٤" not "٤")
                    val mStr   = String.format("%02d", m)
                    HijriDateWidgetProvider.toArabicDigits(h12) + ":" +
                        HijriDateWidgetProvider.toArabicDigitsString(mStr) + " " + period
                } else rawTime
                editor.putString(HijriDateWidgetProvider.KEY_NEXT_PRAYER_TIME, formattedTime12)
            }
            editor.apply()
            
            HijriDateWidgetProvider.updateAllWidgets(context)
            android.util.Log.d("AzhanReceiver", "✅ Widget updated at Azhan time with corrected Hijri date")
        } catch (e: Exception) {
            android.util.Log.e("AzhanReceiver", "⚠️ Failed to update widget in receiver", e)
        }
    }
}
