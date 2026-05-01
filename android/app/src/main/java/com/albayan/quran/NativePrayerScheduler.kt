package com.albayan.quran

import android.content.Context
import android.util.Log
import com.batoulapps.adhan.CalculationMethod
import com.batoulapps.adhan.CalculationParameters
import com.batoulapps.adhan.Coordinates
import com.batoulapps.adhan.Madhab
import com.batoulapps.adhan.PrayerTimes
import com.batoulapps.adhan.data.DateComponents
import org.json.JSONObject
import java.util.Calendar
import java.util.Date
import java.util.GregorianCalendar
import android.content.Intent
import android.app.PendingIntent
import android.app.AlarmManager
import android.os.Build

/**
 * Native Prayer Scheduler - The "Brain" of Project Eternity.
 * Calculates and schedules prayer alarms purely in Native Kotlin.
 * Works independently of the WebView/JavaScript layer.
 */
object NativePrayerScheduler {

    private const val TAG = "NativeScheduler"
    private const val PREFS_NAME = "AlBayanPersistence"
    private const val BUFFER_MINUTES = 7

    /**
     * Schedule prayers for the next 7 days (Lightweight Policy)
     * Was 14 days, reduced to 7 per user request to keep system light and fast.
     * The SustainabilityWorker runs daily to keep this replenished.
     */
    fun schedulePrayers(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val lat = prefs.getFloat("lat", 0f).toDouble()
        val lng = prefs.getFloat("lng", 0f).toDouble()
        val method = prefs.getString("method", "egyptian") ?: "egyptian"
        val madhab = prefs.getString("madhab", "shafi") ?: "shafi"
        val adjustmentsJson = prefs.getString("adjustmentsJson", "{}") ?: "{}"

        if (lat == 0.0 && lng == 0.0) {
            Log.e(TAG, "❌ No location data found in persistence. Aborting native schedule.")
            return
        }

        // Timezone Sanity Check
        val storedTimezone = prefs.getString("timezoneId", "") ?: ""
        val currentTimezone = java.util.TimeZone.getDefault().id
        if (storedTimezone.isNotEmpty() && storedTimezone != currentTimezone) {
            Log.e(TAG, "❌ Timezone Mismatch (Stored: $storedTimezone, Current: $currentTimezone). Aborting native schedule.")
            
            // 🚀 IMPROVEMENT: Trigger the prompt via companion object so user does not miss it!
            TimezoneReceiver.showTimezonePrompt(context, currentTimezone)
            
            return
        }

        Log.d(TAG, "🧠 Starting Native Calculation: Lat=$lat, Lng=$lng, Method=$method")

        val coordinates = Coordinates(lat, lng)
        val params = getCalculationParams(method)
        
        if (madhab == "hanafi") {
            params.madhab = Madhab.HANAFI
        } else {
            params.madhab = Madhab.SHAFI
        }

        // Parse Adjustments
        val adjustments = parseAdjustments(adjustmentsJson)
        params.adjustments.fajr = adjustments["fajr"] ?: 0
        params.adjustments.dhuhr = adjustments["dhuhr"] ?: 0
        params.adjustments.asr = adjustments["asr"] ?: 0
        params.adjustments.maghrib = adjustments["maghrib"] ?: 0
        params.adjustments.isha = adjustments["isha"] ?: 0

        val calendar = GregorianCalendar()
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        var scheduledCount = 0

        // Schedule for next 7 days (Reduced from 14)
        for (i in 0 until 7) {
            val dateComponents = DateComponents.from(calendar.time)
            val prayers = PrayerTimes(coordinates, dateComponents, params)

            schedulePrayer(context, alarmManager, "Fajr", prayers.fajr, i, 1)
            schedulePrayer(context, alarmManager, "Dhuhr", prayers.dhuhr, i, 2)
            schedulePrayer(context, alarmManager, "Asr", prayers.asr, i, 3)
            schedulePrayer(context, alarmManager, "Maghrib", prayers.maghrib, i, 4)
            schedulePrayer(context, alarmManager, "Isha", prayers.isha, i, 5)

            scheduledCount += 5
            calendar.add(Calendar.DATE, 1)
        }

        Log.d(TAG, "✅ Native Scheduler complete. Encoded $scheduledCount alarms.")

        // ══════════════════════════════════════════════════════════════════════════
        // 🤲 SALAWAT SCHEDULER (Native Port for Sustainability)
        // ══════════════════════════════════════════════════════════════════════════
        // ══════════════════════════════════════════════════════════════════════════
        // 🤲 SALAWAT SCHEDULER (Native Port for Sustainability)
        // ══════════════════════════════════════════════════════════════════════════
        val salawatJson = prefs.getString("salawatSettingsJson", "{}") ?: "{}"
        scheduleSalawat(context, salawatJson, coordinates, params)
        
        // ══════════════════════════════════════════════════════════════════════════
        // 📢 PRE-PRAYER ALERTS (Native Port for Gap Fix)
        // ══════════════════════════════════════════════════════════════════════════
        val prePrayerJson = prefs.getString("prePrayerSettingsJson", "{}") ?: "{}"
        schedulePrePrayerAlerts(context, prePrayerJson, coordinates, params)

        // ══════════════════════════════════════════════════════════════════════════
        // 🌙 RAMADAN SPECIAL NOTIFICATIONS (Native Port for Sustainability)
        // ══════════════════════════════════════════════════════════════════════════
        val ramadanJson = prefs.getString("ramadanSettingsJson", "{}") ?: "{}"
        scheduleRamadanAlerts(context, ramadanJson, coordinates, params)
    }

    private fun schedulePrePrayerAlerts(
        context: Context,
        settingsJson: String,
        coordinates: Coordinates,
        params: CalculationParameters
    ) {
        try {
            val settings = JSONObject(settingsJson)
            if (!settings.optBoolean("enabled", false)) return // Master switch

            val minutes = settings.optInt("minutes", 15)
            val sound = settings.optString("sound", "alert_prayer_reminder")
            // Volume usually follows Azhan volume, or separate? JS passes 'volume'.
            // Here we might need to read volume from prefs or default. 
            // Simplified: Use default volume or read from Azhan prefs if needed.
            val volume = 80 // Default safe volume

            val calendar = GregorianCalendar()
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            var scheduledCount = 0

            // Schedule for next 7 days (Same as Prayers)
            for (i in 0 until 7) {
                val dateComponents = DateComponents.from(calendar.time)
                val prayers = PrayerTimes(coordinates, dateComponents, params)

                scheduleSinglePrePrayer(context, alarmManager, "Fajr", prayers.fajr, i, 1, minutes, sound, volume)
                scheduleSinglePrePrayer(context, alarmManager, "Dhuhr", prayers.dhuhr, i, 2, minutes, sound, volume)
                scheduleSinglePrePrayer(context, alarmManager, "Asr", prayers.asr, i, 3, minutes, sound, volume)
                scheduleSinglePrePrayer(context, alarmManager, "Maghrib", prayers.maghrib, i, 4, minutes, sound, volume)
                scheduleSinglePrePrayer(context, alarmManager, "Isha", prayers.isha, i, 5, minutes, sound, volume)

                scheduledCount += 5
                calendar.add(Calendar.DATE, 1)
            }
            Log.d(TAG, "📢 Native Pre-Prayer Scheduler complete. Scheduled $scheduledCount alerts.")

        } catch (e: Exception) {
            Log.e(TAG, "❌ Error in Native Pre-Prayer Scheduler", e)
        }
    }

    private fun scheduleSinglePrePrayer(
        context: Context,
        alarmManager: AlarmManager,
        name: String,
        prayerTime: Date,
        dayOffset: Int,
        prayerId: Int,
        minutesBefore: Int,
        sound: String,
        volume: Int
    ) {
        // Calculate Pre-Prayer Time
        val alertTime = Date(prayerTime.time - (minutesBefore * 60000L))
        
        // Skip if time is in the past
        if (alertTime.before(Date())) return

        try {
            // ID Logic: ID_OFFSET_PRE_PRAYER (20000) + (dayOffset * 100) + prayerId
            val uniqueId = 20000 + (dayOffset * 100) + prayerId

            // Map English names to Arabic for consistent display
            val arabicName = when(name) {
                "Fajr" -> "الفجر"
                "Dhuhr" -> "الظهر"
                "Asr" -> "العصر"
                "Maghrib" -> "المغرب"
                "Isha" -> "العشاء"
                else -> name
            }

            val intent = Intent(context, PrePrayerAlertReceiver::class.java).apply {
                action = PrePrayerAlertReceiver.ACTION_PRE_PRAYER_ALERT
                putExtra(PrePrayerAlertReceiver.EXTRA_ALERT_SOUND, sound)
                putExtra(PrePrayerAlertReceiver.EXTRA_PRAYER_NAME, arabicName)
                putExtra(PrePrayerAlertReceiver.EXTRA_VOLUME, volume)
            }
            
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }

            val pendingIntent = PendingIntent.getBroadcast(context, uniqueId, intent, flags)

            // Use setExactAndAllowWhileIdle for pre-prayer alerts (less intrusive than setAlarmClock)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, alertTime.time, pendingIntent)
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, alertTime.time, pendingIntent)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to schedule Pre-Prayer $name: ${e.message}")
        }
    }

    private fun scheduleSalawat(
        context: Context,
        settingsJson: String,
        coordinates: Coordinates,
        params: CalculationParameters
    ) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        try {
            val settings = JSONObject(settingsJson)
            if (!settings.optBoolean("enabled", false)) return

            val mode = settings.optString("mode", "daily")
            val timesPerHour = settings.optInt("timesPerHour", 1)
            val timesPerDay = settings.optInt("timesPerDay", 3)
            val avoidPrayerTimes = settings.optBoolean("avoidPrayerTimes", true)
            val soundEnabled = settings.optBoolean("soundEnabled", true)
            val selectedSound = settings.optString("selectedSound", "salawat_one")
            
            // Time Window
            val startStr = settings.optString("startTime", "08:00")
            val endStr = settings.optString("endTime", "22:00")
            val startH = startStr.split(":")[0].toIntOrNull() ?: 8
            val endH = endStr.split(":")[0].toIntOrNull() ?: 22
            
            // Calculate Active Hours
            val activeHours = if (endH >= startH) (endH - startH) else (24 - startH + endH)
            
            // ══════════════════════════════════════════════════════════════════════════
            // 🛑 DYNAMIC BUDGETING: Prevent "Maximum limit of concurrent alarms 500 reached"
            // ══════════════════════════════════════════════════════════════════════════
            // Android 12+ strict limit: 500 alarms. We must stay well below this.
            // Safety Target: ~350 alarms max for Salawat (leave room for Prayers + UI + System)
            
            var dailyLoadEstimate = 0
            if (mode == "hourly") {
                 // Worst Case: timesPerHour * activeHours
                 // e.g. 4 * 16 = 64/day.
                 dailyLoadEstimate = timesPerHour * activeHours
            } else {
                 dailyLoadEstimate = timesPerDay
            }
            
            // Avoid division by zero
            if (dailyLoadEstimate < 1) dailyLoadEstimate = 1
            
            // Calculate Max Safe Days
            val SYSTEM_ALARM_LIMIT = 500
            val SAFETY_BUFFER = 150 // Reserve for Prayers (70), Capacitor (50), other apps
            val MAX_SAFE_ALARMS = SYSTEM_ALARM_LIMIT - SAFETY_BUFFER // ~350
            
            // Dynamic Horizon
            val safeDays = (MAX_SAFE_ALARMS / dailyLoadEstimate)
            // Clamp: Minimum 2 days (for reliability), Maximum 5 days (User requested "Light & Sustainable")
            // Was 14, now 5 per request to keep system light.
            val actualLookaheadDays = safeDays.coerceIn(2, 5)
            
            Log.d(TAG, "📉 Dynamic Budgeting: DailyLoad=$dailyLoadEstimate, MaxSafe=$MAX_SAFE_ALARMS, SafeDays=$safeDays -> Using: $actualLookaheadDays days")

            // 🧹 CLEANUP: Cancel ALL potential Salawat alarms (Range 800000 - 802000)
            // This prevents "Ghost Alarms" if we switch from High Freq (short horizon) to Low Freq,
            // or mainly to ensure we don't start with a full buffer.
            cancelSalawatRange(context, alarmManager, 800000, 802000)

            var totalScheduled = 0
            val calendar = GregorianCalendar() // Starts now

            for (dayIndex in 0 until actualLookaheadDays) {
                // 1. Calculate Prayer Times for Conflict Avoidance
                val dateComponents = DateComponents.from(calendar.time)
                val prayers = PrayerTimes(coordinates, dateComponents, params)
                
                val blockedWindows = mutableListOf<Pair<Long, Long>>()
                if (avoidPrayerTimes) {
                    // preNotificationMinutes default 10
                    val preMin = 10 
                    val prayerTimesList = listOf(prayers.fajr, prayers.dhuhr, prayers.asr, prayers.maghrib, prayers.isha)
                    
                    for (pt in prayerTimesList) {
                        val start = pt.time - (preMin + BUFFER_MINUTES) * 60000
                        val end = pt.time + BUFFER_MINUTES * 60000
                        blockedWindows.add(Pair(start, end))
                    }
                }

                // 2. Generate Candidate Times
                val candidateTimes = mutableListOf<Date>()
                val dayDate = calendar.time // This is noon/midnight of that day? No, it preserves current time but add days?
                // GregorianCalendar initialized with current time.
                // We need to set hours carefully.
                
                if (mode == "hourly") {
                    for (h in 0 until activeHours) {
                        val hour = (startH + h) % 24
                        // For hourly, we need simpler distribution? 
                        // JS used: hour loop + timesPerHour loop
                        // JS: interval = 60 / (times + 1) -> Actually typically 60/times if strict.
                        // Let's match JS logic: interval = 60 / (timesPerHour + 1)
                        val intervalMin = 60 / (timesPerHour + 1)
                        
                        for (i in 0 until timesPerHour) {
                            val min = intervalMin * (i + 1)
                            
                            val candCal = Calendar.getInstance()
                            candCal.time = dayDate
                            candCal.set(Calendar.HOUR_OF_DAY, hour)
                            candCal.set(Calendar.MINUTE, min)
                            candCal.set(Calendar.SECOND, 0)
                            candCal.set(Calendar.MILLISECOND, 0)
                            
                            // Cross-day adjustment check
                            if (endH < startH && hour < startH) {
                                candCal.add(Calendar.DATE, 1) // It's next day relative to 'dayDate' start
                            }
                            
                            candidateTimes.add(candCal.time)
                        }
                    }
                } else {
                    // Daily
                    val intervalMin = (activeHours * 60) / (timesPerDay + 1)
                    val startBase = Calendar.getInstance()
                    startBase.time = dayDate
                    startBase.set(Calendar.HOUR_OF_DAY, startH)
                    startBase.set(Calendar.MINUTE, 0)
                    startBase.set(Calendar.SECOND, 0)
                    
                    for (i in 0 until timesPerDay) {
                        val offsetMin = intervalMin * (i + 1)
                        val candCal = startBase.clone() as Calendar
                        candCal.add(Calendar.MINUTE, offsetMin)
                        candidateTimes.add(candCal.time)
                    }
                }

                // 3. Filter and Schedule
                var slotIndex = 0
                val now = Date().time
                
                for (cand in candidateTimes) {
                    val time = cand.time
                    if (time <= now) continue

                    // Check Blocked
                    var isBlocked = false
                    for (window in blockedWindows) {
                        if (time >= window.first && time <= window.second) {
                            isBlocked = true
                            break
                        }
                    }
                    if (isBlocked) continue
                    
                    // Strict Window Check (Redundant if generation is correct, but safe)
                    val cCal = Calendar.getInstance()
                    cCal.time = cand
                    val cHour = cCal.get(Calendar.HOUR_OF_DAY)
                    val cMin = cCal.get(Calendar.MINUTE)
                    val cTime = cHour * 60 + cMin
                    val sTime = startH * 60
                    val eTime = endH * 60
                    
                    var inWindow = false
                    if (startH <= endH) {
                        inWindow = cTime >= sTime && cTime < eTime
                    } else {
                        inWindow = cTime >= sTime || cTime < eTime
                    }
                    if (!inWindow) continue

                    // Schedule
                    val uniqueId = 800000 + (dayIndex * 100) + slotIndex
                    slotIndex++
                    
                    // Limit total alarms? JS has 250 limit. Native loop 14 days * ~10 = 140. Safe.
                    
                    // Sound Selection (Random)
                    // OPTIMIZATION: Pass "random" directly to let AudioPlaybackService handle "Smart Shuffle" (Runtime)
                    // instead of pre-selecting it weeks in advance.
                    val soundIdToUse = selectedSound

                    try {
                        val intent = Intent(context, SalawatAlertReceiver::class.java).apply {
                            action = SalawatAlertReceiver.ACTION_SALAWAT_ALERT
                            putExtra(SalawatAlertReceiver.EXTRA_SOUND_ID, soundIdToUse)
                            putExtra(SalawatAlertReceiver.EXTRA_SOUND_ENABLED, soundEnabled)
                            putExtra(SalawatAlertReceiver.EXTRA_SHOULD_RESUME, true) // Native always resumes?
                        }
                        
                        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                        } else {
                            PendingIntent.FLAG_UPDATE_CURRENT
                        }
                        
                        val pendingIntent = PendingIntent.getBroadcast(context, uniqueId, intent, flags)
                        
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                             alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, time, pendingIntent)
                        } else {
                             alarmManager.setExact(AlarmManager.RTC_WAKEUP, time, pendingIntent)
                        }
                        totalScheduled++
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to schedule Salawat $uniqueId", e)
                    }
                }

                calendar.add(Calendar.DATE, 1) // Next day
            }
            
            Log.d(TAG, "✅ Native Salawat Scheduler complete. Scheduled $totalScheduled reminders.")
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error in Native Salawat Scheduler", e)
        }
    }

    private fun cancelSalawatRange(context: Context, alarmManager: AlarmManager, startId: Int, endId: Int) {
        // Efficiently cancel a range of alarms
        // We don't need to know if they exist; creating a matching PendingIntent and cancelling it works.
        // For 2000 IDs, this loop is fast enough (just object creation + IPC).
        
        Log.d(TAG, "🧹 Cleaning up Salawat Alarms Range $startId - $endId")
        val intent = Intent(context, SalawatAlertReceiver::class.java)
        intent.action = SalawatAlertReceiver.ACTION_SALAWAT_ALERT
        
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        for (id in startId..endId) {
            try {
                // To cancel, we must create a PendingIntent that matches the original.
                // RequestCode (id) must match.
                val pendingIntent = PendingIntent.getBroadcast(context, id, intent, flags)
                alarmManager.cancel(pendingIntent)
                pendingIntent.cancel()
            } catch (e: Exception) {
                // Ignore errors during cleanup
            }
        }
    }


    private fun schedulePrayer(
        context: Context,
        alarmManager: AlarmManager,
        name: String,
        time: Date,
        dayOffset: Int,
        prayerId: Int
    ) {
        // Skip if time is in the past
        if (time.before(Date())) return

        try {

        // ID Generation Logic (Must match JS logic for consistency/overwriting)
        // JS: ID_OFFSET_PRAYERS (10000) + (dayIndex * 100) + prayerId
        // Native Day Offset calculation might differ slightly from JS "current month array" logic
        // But for "Sustainability" (backup), ensuring we have alerts is priority.
        // We use a separate ID range to avoid conflict?
        // NO. Better to OVERWRITE so we don't have double alarms if both run.
        // JS Logic: ID_OFFSET_PRAYERS + dayIndex*100 + id.
        // JS calculates 30 days. Native calculates 14 days starting TODAY.
        // So dayOffset 0 is Today. JS index 0 is Today. Ideally they align.
        
        val uniqueId = 10000 + (dayOffset * 100) + prayerId
        
        // ══════════════════════════════════════════════════════════════════════════
        // 🎯 FIX: READ SAVED MUAZZIN PREFERENCES (Synced from MediaBridge)
        // ══════════════════════════════════════════════════════════════════════════
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val globalMuazzinId = prefs.getString("muazzinId", "egy_abdulbasit") ?: "egy_abdulbasit"
        val isPerPrayerEnabled = prefs.getBoolean("isPerPrayerEnabled", false)
        val perPrayerJson = prefs.getString("perPrayerSettingsJson", "{}") ?: "{}"
        
        var targetMuazzinId = globalMuazzinId
        
        if (isPerPrayerEnabled) {
            try {
                val perPrayerObj = JSONObject(perPrayerJson)
                // Keys used in JSON: fajr, dhuhr, asr, maghrib, isha
                // Name passed to function: Fajr, Dhuhr, Asr, Maghrib, Isha
                val key = name.lowercase()
                
                if (perPrayerObj.has(key)) {
                    val entry = perPrayerObj.get(key)
                    if (entry is String) {
                        targetMuazzinId = entry
                    } else if (entry is JSONObject) {
                         targetMuazzinId = entry.optString("id", globalMuazzinId)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error parsing per-prayer JSON", e)
            }
        }
        
        // Handle "Random" in Native (Simplified Fallback)
        // If random, we default to a safe bundled one to ensure sound plays, 
        // or let the service handle 'random' string (Service handles it!)
        // Service handles 'random', so we can pass it through.
        
        // Map English names to Arabic for consistent display
        val arabicName = when(name) {
            "Fajr" -> "الفجر"
            "Dhuhr" -> "الظهر"
            "Asr" -> "العصر"
            "Maghrib" -> "المغرب"
            "Isha" -> "العشاء"
            else -> name
        }

        val intent = Intent(context, AzhanReceiver::class.java).apply {
            action = "ACTION_PLAY_AZHAN"
            putExtra("MUAZZIN_ID", targetMuazzinId)
            putExtra("PRAYER_NAME", arabicName)
            putExtra("MUAZZIN_NAME", "") // Service will look it up
        }

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        val pendingIntent = PendingIntent.getBroadcast(context, uniqueId, intent, flags)

            // CRITICAL FIX: Use setAlarmClock for reliable execution in Doze Mode
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                val showIntent = PendingIntent.getActivity(
                    context, 0,
                    Intent(context, MainActivity::class.java),
                    PendingIntent.FLAG_IMMUTABLE
                )
                val alarmClockInfo = AlarmManager.AlarmClockInfo(time.time, showIntent)
                alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, time.time, pendingIntent)
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, time.time, pendingIntent)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to schedule $name: ${e.message}")
        }
    }



    // ==========================================
    // 🌍 WIDGET HELPER: GET NEXT PRAYER
    // ==========================================
    
    data class NextPrayerInfo(val name: String, val time: String, val timeObj: Date)

    fun getNextPrayer(context: Context): NextPrayerInfo? {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val lat = prefs.getFloat("lat", 0f).toDouble()
        val lng = prefs.getFloat("lng", 0f).toDouble()
        val method = prefs.getString("method", "egyptian") ?: "egyptian"
        val madhab = prefs.getString("madhab", "shafi") ?: "shafi"
        val adjustmentsJson = prefs.getString("adjustmentsJson", "{}") ?: "{}"

        if (lat == 0.0 && lng == 0.0) return null

        val coordinates = Coordinates(lat, lng)
        val params = getCalculationParams(method)
        if (madhab == "hanafi") params.madhab = Madhab.HANAFI
        
        val adjustments = parseAdjustments(adjustmentsJson)
        params.adjustments.fajr = adjustments["fajr"] ?: 0
        params.adjustments.dhuhr = adjustments["dhuhr"] ?: 0
        params.adjustments.asr = adjustments["asr"] ?: 0
        params.adjustments.maghrib = adjustments["maghrib"] ?: 0
        params.adjustments.isha = adjustments["isha"] ?: 0

        val now = Date()
        // Add 60s buffer to avoid race conditions when alarms fire at the exact prayer time
        val bufferNow = Date(now.time + 60000L)
        val cal = GregorianCalendar()
        
        // Check Today
        var dateComponents = DateComponents.from(cal.time)
        var prayers = PrayerTimes(coordinates, dateComponents, params)
        
        var next = findNextInDay(prayers, bufferNow)
        
        // If not found today, check tomorrow (Fajr)
        if (next == null) {
            cal.add(Calendar.DATE, 1)
            dateComponents = DateComponents.from(cal.time)
            prayers = PrayerTimes(coordinates, dateComponents, params)
            next = NextPrayerInfo("الفجر", formatTime(prayers.fajr), prayers.fajr)
        }
        
        return next
    }

    private fun findNextInDay(prayers: PrayerTimes, now: Date): NextPrayerInfo? {
        // Simple linear check
        if (prayers.fajr.after(now)) return NextPrayerInfo("الفجر", formatTime(prayers.fajr), prayers.fajr)
        if (prayers.dhuhr.after(now)) return NextPrayerInfo("الظهر", formatTime(prayers.dhuhr), prayers.dhuhr)
        if (prayers.asr.after(now)) return NextPrayerInfo("العصر", formatTime(prayers.asr), prayers.asr)
        if (prayers.maghrib.after(now)) return NextPrayerInfo("المغرب", formatTime(prayers.maghrib), prayers.maghrib)
        if (prayers.isha.after(now)) return NextPrayerInfo("العشاء", formatTime(prayers.isha), prayers.isha)
        return null
    }

    private fun formatTime(date: Date): String {
        val cal = Calendar.getInstance()
        cal.time = date
        // Simple HH:mm formatting
        val hour = cal.get(Calendar.HOUR_OF_DAY)
        val min = cal.get(Calendar.MINUTE)
        return String.format("%02d:%02d", hour, min)
    }

    private fun getCalculationParams(method: String): CalculationParameters {

        val calculationMethod = when (method) {
            "egyptian" -> CalculationMethod.EGYPTIAN
            "umm_al_qura" -> CalculationMethod.UMM_AL_QURA
            "muslim_world_league" -> CalculationMethod.MUSLIM_WORLD_LEAGUE
            "karachi" -> CalculationMethod.KARACHI
            "moonsighting" -> CalculationMethod.MOON_SIGHTING_COMMITTEE
            "kuwait" -> CalculationMethod.KUWAIT
            "qatar" -> CalculationMethod.QATAR
            "singapore" -> CalculationMethod.SINGAPORE
            "tehran" -> CalculationMethod.EGYPTIAN // Fallback: TEHRAN not in Adhan 1.2.1
            "turkey" -> CalculationMethod.EGYPTIAN // Fallback: TURKEY not in Adhan 1.2.1
            "dubai" -> CalculationMethod.DUBAI
            "isna" -> CalculationMethod.NORTH_AMERICA
            else -> CalculationMethod.EGYPTIAN
        }
        return calculationMethod.parameters
    }

    private fun parseAdjustments(json: String): Map<String, Int> {
        val map = mutableMapOf<String, Int>()
        try {
            val obj = JSONObject(json)
            map["fajr"] = obj.optInt("fajr", 0)
            map["dhuhr"] = obj.optInt("dhuhr", 0)
            map["asr"] = obj.optInt("asr", 0)
            map["maghrib"] = obj.optInt("maghrib", 0)
            map["isha"] = obj.optInt("isha", 0)
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing adjustments", e)
        }
        return map
    }

    private fun scheduleRamadanAlerts(
        context: Context,
        settingsJson: String,
        coordinates: Coordinates,
        params: CalculationParameters
    ) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        try {
            val settings = JSONObject(settingsJson)

            // Read the accurately synced Hijri date from the Widget Prefs
            val widgetPrefs = context.getSharedPreferences("HijriWidgetPrefs", Context.MODE_PRIVATE)
            val appSetMonthStr = widgetPrefs.getString(HijriDateWidgetProvider.KEY_HIJRI_MONTH, null)
            val isRamadan = appSetMonthStr == "رمضان" || appSetMonthStr == "Ramadan"
            
            // If it's not Ramadan according to the synced accurate date, fallback to algorithmic check just in case
            val calendarForAlg = GregorianCalendar()
            val algorithmicHijri = HijriUtil.getHijriDate(calendarForAlg.time, 0)
            
            val isActuallyRamadan = isRamadan || algorithmicHijri.month == 9

            if (!isActuallyRamadan) {
                return // ZERO budget consumption outside Ramadan
            }

            val calendar = GregorianCalendar()
            var scheduledCount = 0

            for (i in 0 until 7) {
                val dateComponents = DateComponents.from(calendar.time)
                val prayers = PrayerTimes(coordinates, dateComponents, params)
                
                // Get Hijri Day for 'Last 10 Nights' check
                val currentAlgHijri = HijriUtil.getHijriDate(calendar.time, 0)
                val hijriDay = currentAlgHijri.day

                // 4.1 Suhoor Reminder
                val suhoorObj = settings.optJSONObject("suhoorReminder")
                if (suhoorObj != null && suhoorObj.optBoolean("enabled", false)) {
                    val minutesBefore = suhoorObj.optInt("minutesBefore", 60)
                    val alertTime = Date(prayers.fajr.time - (minutesBefore * 60000L))
                    if (alertTime.after(Date())) {
                        val title = "🌙 وقت السحور"
                        val body = "تذكر نية الصيام. تسحروا فإن في السحور بركة."
                        val id = 50000 + (i * 100) + 1
                        scheduleSingleRamadanAlert(context, alarmManager, alertTime, id, title, body, "alert_prayer_reminder", 80)
                        scheduledCount++
                    }
                }

                // 4.2 Iftar Reminder
                val iftarObj = settings.optJSONObject("iftarReminder")
                if (iftarObj != null && iftarObj.optBoolean("enabled", false)) {
                    val minutesBefore = iftarObj.optInt("minutesBefore", 10)
                    val alertTime = Date(prayers.maghrib.time - (minutesBefore * 60000L))
                    if (alertTime.after(Date())) {
                        val title = "🌙 اقترب الإفطار"
                        val body = "جهز فطورك، واذكر دعاء الإفطار. للصائم دعوة لا ترد."
                        val id = 50000 + (i * 100) + 2
                        scheduleSingleRamadanAlert(context, alarmManager, alertTime, id, title, body, "alert_prayer_reminder", 80)
                        scheduledCount++
                    }
                }

                // 4.3 Last Ten Nights (Ramadan 21-30, 1 hour after Isha)
                val lastTenObj = settings.optJSONObject("lastTenNights")
                if (lastTenObj != null && lastTenObj.optBoolean("enabled", false) && hijriDay >= 21) {
                    val alertTime = Date(prayers.isha.time + 60 * 60000L) // 1 hour after Isha
                    if (alertTime.after(Date())) {
                        val nightNumber = if (prayers.isha.hours >= 12) hijriDay + 1 else hijriDay // Simplistic night check
                        val isOdd = nightNumber % 2 != 0
                        val title = if (isOdd) "✨ ليلة وترية ($nightNumber رمضان)" else "✨ ليالي العشر الأواخر"
                        val body = "اللهم إنك عفو تحب العفو فاعف عنا. اجتهد في الدعاء والقيام."
                        val id = 50000 + (i * 100) + 3
                        scheduleSingleRamadanAlert(context, alarmManager, alertTime, id, title, body, "alert_prayer_reminder", 80)
                        scheduledCount++
                    }
                }

                calendar.add(Calendar.DATE, 1)
            }
            Log.d(TAG, "🌙 Native Ramadan Scheduler complete. Scheduled \$scheduledCount alerts.")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error in Native Ramadan Scheduler", e)
        }
    }

    private fun scheduleSingleRamadanAlert(
        context: Context,
        alarmManager: AlarmManager,
        time: Date,
        id: Int,
        title: String,
        body: String,
        sound: String,
        volume: Int
    ) {
        try {
            val intent = Intent(context, RamadanAlertReceiver::class.java).apply {
                action = RamadanAlertReceiver.ACTION_RAMADAN_ALERT
                putExtra(RamadanAlertReceiver.EXTRA_TITLE, title)
                putExtra(RamadanAlertReceiver.EXTRA_BODY, body)
                putExtra(RamadanAlertReceiver.EXTRA_SOUND, sound)
                putExtra(RamadanAlertReceiver.EXTRA_VOLUME, volume)
            }

            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }

            val pendingIntent = PendingIntent.getBroadcast(context, id, intent, flags)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, time.time, pendingIntent)
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, time.time, pendingIntent)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to schedule Ramadan Alert \$title: \${e.message}")
        }
    }
}
