package com.albayan.quran

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.util.Log

/**
 * Al-Bayan Hijri Date Widget Provider
 *
 * Displays the Hijri date, Gregorian date, and next prayer countdown.
 *
 * Update strategy:
 *   - AlarmManager fires ACTION_REFRESH_WIDGET every 60 seconds for a live countdown.
 *   - updatePeriodMillis is set to 0 in widget_hijri_date_info.xml — we own the schedule.
 *   - Data (dates, prayer names, timestamps) is written to SharedPreferences by the JS app
 *     (via MediaBridge.updateWidgetData) and by SustainabilityWorker as a fallback.
 *   - When the last widget instance is removed (onDisabled) the repeating alarm is cancelled.
 */
class HijriDateWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val TAG = "HijriDateWidget"
        const val PREFS_NAME = "HijriWidgetPrefs"

        // Preference Keys
        const val KEY_HIJRI_DAY             = "hijri_day"
        const val KEY_HIJRI_MONTH           = "hijri_month"
        const val KEY_HIJRI_YEAR            = "hijri_year"
        // KEY_GREGORIAN_DATE stores the ISO date (yyyy-MM-dd) used as the unified comparison key
        // across TypeScript and Native layers to detect day changes reliably.
        const val KEY_GREGORIAN_DATE        = "gregorian_date_iso"
        // KEY_GREGORIAN_DATE_DISPLAY stores the human-readable Arabic date for display in the widget UI.
        const val KEY_GREGORIAN_DATE_DISPLAY = "gregorian_date_display"
        const val KEY_NEXT_PRAYER_NAME      = "next_prayer_name"
        const val KEY_NEXT_PRAYER_TIME      = "next_prayer_time"
        const val KEY_HIJRI_DAYS_REMAINING  = "hijri_days_remaining"
        const val KEY_NEXT_PRAYER_TIMESTAMP = "next_prayer_timestamp"

        // Actions
        const val ACTION_REFRESH_WIDGET = "com.albayan.quran.ACTION_REFRESH_WIDGET"

        // How often the countdown updates (milliseconds)
        private const val UPDATE_INTERVAL_MS = 60_000L   // 1 minute

        // Arabic month names
        private val HIJRI_MONTHS = arrayOf(
            "محرم", "صفر", "ربيع الأول", "ربيع الثاني",
            "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان",
            "رمضان", "شوال", "ذو القعدة", "ذو الحجة"
        )

        // Arabic numeral conversion
        private val ARABIC_DIGITS = arrayOf('٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩')

        fun toArabicDigits(number: Int): String =
            number.toString().map { ARABIC_DIGITS[it - '0'] }.joinToString("")

        /** Convert a zero-padded string like "04" to "٠٤" without losing the leading zero. */
        fun toArabicDigitsString(s: String): String =
            s.map { c ->
                val idx = "0123456789".indexOf(c)
                if (idx >= 0) ARABIC_DIGITS[idx] else c
            }.joinToString("")

        fun getHijriMonthName(monthNumber: Int): String =
            if (monthNumber in 1..12) HIJRI_MONTHS[monthNumber - 1] else ""

        // ── AlarmManager helpers ──────────────────────────────────────────────────

        /**
         * Schedule (or reschedule) a per-minute wake-up that keeps the countdown live.
         * Uses setExactAndAllowWhileIdle so Doze Mode cannot delay it beyond ~1 min.
         */
        fun scheduleNextMinuteUpdate(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val pending = buildRefreshPendingIntent(context)

            val triggerAt = System.currentTimeMillis() + UPDATE_INTERVAL_MS

            try {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP, triggerAt, pending
                    )
                } else {
                    alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pending)
                }
                Log.d(TAG, "⏰ Next widget update scheduled in ${UPDATE_INTERVAL_MS / 1000}s")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to schedule widget update alarm", e)
            }
        }

        /**
         * Cancel the repeating alarm when the last widget is removed.
         */
        fun cancelScheduledUpdates(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            alarmManager.cancel(buildRefreshPendingIntent(context))
            Log.d(TAG, "🛑 Widget minute-update alarm cancelled (no widgets left)")
        }

        private fun buildRefreshPendingIntent(context: Context): PendingIntent {
            val intent = Intent(context, HijriDateWidgetProvider::class.java).apply {
                action = ACTION_REFRESH_WIDGET
            }
            val flags = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M)
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            else
                PendingIntent.FLAG_UPDATE_CURRENT
            return PendingIntent.getBroadcast(context, 9999, intent, flags)
        }

        /**
         * Trigger an immediate UI refresh on all active widget instances.
         * Call this from MediaBridge / SustainabilityWorker after writing to SharedPreferences.
         */
        fun updateAllWidgets(context: Context) {
            val intent = Intent(context, HijriDateWidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
            }
            context.sendBroadcast(intent)
        }
    }

    // ── AppWidgetProvider lifecycle ───────────────────────────────────────────

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        Log.d(TAG, "onUpdate called for ${appWidgetIds.size} widgets")
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
        // Ensure the per-minute alarm is alive
        scheduleNextMinuteUpdate(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        val action = intent.action ?: return

        if (action == ACTION_REFRESH_WIDGET ||
            action == AppWidgetManager.ACTION_APPWIDGET_UPDATE
        ) {
            Log.d(TAG, "onReceive: refreshing all widgets (action=$action)")

            val appWidgetManager = AppWidgetManager.getInstance(context)
            val ids = appWidgetManager.getAppWidgetIds(
                android.content.ComponentName(context, HijriDateWidgetProvider::class.java)
            )

            if (ids.isNotEmpty()) {
                for (id in ids) {
                    updateAppWidget(context, appWidgetManager, id)
                }
                // Re-arm the alarm for the next minute
                scheduleNextMinuteUpdate(context)
            } else {
                // No widgets on screen — cancel the alarm to save battery
                cancelScheduledUpdates(context)
            }
        }
    }

    override fun onEnabled(context: Context) {
        Log.d(TAG, "onEnabled — first widget added, starting minute updates")
        scheduleNextMinuteUpdate(context)
    }

    override fun onDisabled(context: Context) {
        Log.d(TAG, "onDisabled — last widget removed, stopping minute updates")
        cancelScheduledUpdates(context)
    }

    // ── Core update logic ─────────────────────────────────────────────────────

    private fun updateAppWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        try {
            Log.d(TAG, "Updating widget ID: $appWidgetId")

            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

            // ── 1. Autonomous Date Recalculation ───────────────────────────────
            // KEY FIX: Use language-neutral ISO date (yyyy-MM-dd) as the comparison key.
            // Previously used "EEEE، d MMMM" (Arabic locale) which NEVER matched the format
            // sent by TypeScript (toLocaleDateString 'ar-EG'), causing the autonomous updater
            // to ALWAYS overwrite the correct TS-synced Hijri date with HijriUtil's result.
            val now = java.util.Date()
            val isoDateFormat = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
            val todayIso = isoDateFormat.format(now)
            val storedIsoDate = prefs.getString(KEY_GREGORIAN_DATE, "")

            // Display-only format for the Gregorian label shown in the widget
            val displayDateFormat = java.text.SimpleDateFormat("EEEE، d MMMM", java.util.Locale("ar"))
            val rawDisplayDate = displayDateFormat.format(now)
            // Convert to Arabic digits (e.g. "2" -> "٢")
            val displayDate = toArabicDigitsString(rawDisplayDate)

            // Only run HijriUtil fallback if the app (TypeScript) has NOT already written
            // a fresh Hijri date for today. This respects the TS as the source of truth.
            if (todayIso != storedIsoDate) {
                Log.d(TAG, "🌙 Autonomous Update: New day detected ($storedIsoDate → $todayIso), using HijriUtil fallback...")
                val editor = prefs.edit()
                
                // القيمة الفعلية المحسوبة من TypeScript — المصدر الوحيد للحقيقة
                val defaultPrefs = context.getSharedPreferences("${context.packageName}_preferences", Context.MODE_PRIVATE)
                val adjustmentStr = defaultPrefs.getString("hijri_adjustment", "0") ?: "0"
                val adjustment = adjustmentStr.toIntOrNull() ?: 0

                // Calculate fresh Hijri Date using HijriUtil (fallback)
                val hijriDate = HijriUtil.getHijriDate(now, adjustment)
                val newHijriDay = toArabicDigits(hijriDate.day)
                val newHijriMonth = hijriDate.monthName
                val newHijriYear = toArabicDigits(hijriDate.year)
                
                val rawRemaining = 30 - hijriDate.day
                val newDaysRemaining = toArabicDigits(if (rawRemaining < 0) 0 else rawRemaining)

                // Save with the unified ISO date key so TS writes will be correctly detected
                editor.putString(KEY_HIJRI_DAY, newHijriDay)
                editor.putString(KEY_HIJRI_MONTH, newHijriMonth)
                editor.putString(KEY_HIJRI_YEAR, newHijriYear)
                editor.putString(KEY_HIJRI_DAYS_REMAINING, newDaysRemaining)
                editor.putString(KEY_GREGORIAN_DATE, todayIso)
                editor.putString(KEY_GREGORIAN_DATE_DISPLAY, displayDate)
                editor.apply()
                
                Log.d(TAG, "✅ Autonomous Fallback: $newHijriDay $newHijriMonth $newHijriYear (adj: $adjustment)")
            } else {
                Log.d(TAG, "✅ App-set date is fresh for $todayIso — skipping HijriUtil override")
            }

            // Read stored data (which might have just been updated above)
            val hijriDay            = prefs.getString(KEY_HIJRI_DAY, "١")                      ?: "١"
            val hijriMonth          = prefs.getString(KEY_HIJRI_MONTH, "محرم")                ?: "محرم"
            val hijriYear           = prefs.getString(KEY_HIJRI_YEAR, "١٤٤٦")                 ?: "١٤٤٦"
            // Use display key for widget label; fall back to current date if not set
            val gregorianDateDisplay = prefs.getString(KEY_GREGORIAN_DATE_DISPLAY, displayDate) ?: displayDate
            val nextPrayerName      = prefs.getString(KEY_NEXT_PRAYER_NAME, "الظهر")           ?: "الظهر"
            val nextPrayerTime      = prefs.getString(KEY_NEXT_PRAYER_TIME, "--:--")           ?: "--:--"
            val daysRemaining       = prefs.getString(KEY_HIJRI_DAYS_REMAINING, "")            ?: ""
            val nextPrayerTimestamp = prefs.getLong(KEY_NEXT_PRAYER_TIMESTAMP, -1L)

            val views = RemoteViews(context.packageName, R.layout.widget_hijri_date)

            // ── Static text fields ──────────────────────────────────────────────
            views.setTextViewText(R.id.hijri_day,    hijriDay)
            views.setTextViewText(R.id.hijri_month,  hijriMonth)
            views.setTextViewText(R.id.hijri_year,   "\u200F$hijriYear هـ\u200F")
            views.setTextViewText(
                R.id.gregorian_date,
                if (gregorianDateDisplay.isEmpty()) "---" else gregorianDateDisplay
            )
            views.setTextViewText(
                R.id.next_prayer_name,
                if (nextPrayerName.isEmpty()) "---" else nextPrayerName
            )
            views.setTextViewText(R.id.next_prayer_time, nextPrayerTime)

            val remainingText = if (daysRemaining.isNotEmpty())
                "$daysRemaining يوم لنهاية الشهر الهجري" else ""
            views.setTextViewText(R.id.hijri_days_remaining, remainingText)

            // ── Live countdown (recalculated every minute) ──────────────────────
            if (nextPrayerTimestamp > 0) {
                val timeDiff = nextPrayerTimestamp - System.currentTimeMillis()

                if (timeDiff > 0) {
                    val totalMins = (timeDiff / 60_000L).coerceAtLeast(0)
                    val hours     = (totalMins / 60).toInt()
                    val mins      = (totalMins % 60).toInt()

                    val mStr = String.format("%02d", mins)

                    val formattedCountdown = if (hours > 0) {
                        "${toArabicDigits(hours)}:${toArabicDigitsString(mStr)}"
                    } else {
                        toArabicDigitsString(mStr)
                    }

                    val dynamicUnit  = if (hours > 0) "س" else "د"
                    views.setTextViewText(R.id.timer_label, "متبقي على الصلاة: ")
                    views.setTextViewText(R.id.timer_unit,  dynamicUnit)
                    views.setViewVisibility(R.id.prayer_countdown,          android.view.View.GONE)
                    views.setViewVisibility(R.id.prayer_countdown_fallback, android.view.View.VISIBLE)
                    views.setTextViewText(R.id.prayer_countdown_fallback, formattedCountdown)

                    Log.d(TAG, "⏱ Countdown: $hours h $mins m → $formattedCountdown")
                } else {
                    // Prayer time has passed. 
                    // Self-Healing Fallback: Recalculate next prayer if AzhanReceiver missed it or we're precisely in the buffer window.
                    val nextPrayerInfo = NativePrayerScheduler.getNextPrayer(context)
                    
                    if (nextPrayerInfo != null && nextPrayerInfo.timeObj.time > System.currentTimeMillis()) {
                        Log.d(TAG, "🔧 Self-Healing: Recalculating next prayer directly in Widget -> ${nextPrayerInfo.name}")
                        val editor = prefs.edit()
                        editor.putString(KEY_NEXT_PRAYER_NAME, nextPrayerInfo.name)
                        editor.putLong(KEY_NEXT_PRAYER_TIMESTAMP, nextPrayerInfo.timeObj.time)
                        
                        val rawTime = nextPrayerInfo.time
                        val timeParts = rawTime.split(":")
                        val formattedTime12 = if (timeParts.size >= 2) {
                            val h24    = timeParts[0].toIntOrNull() ?: 12
                            val m      = timeParts[1].toIntOrNull() ?: 0
                            val period = if (h24 >= 12) "م" else "ص"
                            val h12    = if (h24 % 12 == 0) 12 else h24 % 12
                            val mStr   = String.format("%02d", m)
                            toArabicDigits(h12) + ":" + toArabicDigitsString(mStr) + " " + period
                        } else rawTime
                        
                        editor.putString(KEY_NEXT_PRAYER_TIME, formattedTime12)
                        editor.apply()
                        
                        // Restart the update cycle with the fresh data
                        updateAllWidgets(context)
                        return // Exit this pass to avoid applying stale UI state
                    } else {
                        // Show dashes if calculation fails or still yields past date
                        views.setTextViewText(R.id.timer_label, "متبقي على الصلاة: ")
                        views.setTextViewText(R.id.timer_unit,  "")
                        views.setViewVisibility(R.id.prayer_countdown,          android.view.View.GONE)
                        views.setViewVisibility(R.id.prayer_countdown_fallback, android.view.View.VISIBLE)
                        views.setTextViewText(R.id.prayer_countdown_fallback, "--")
                    }
                }
            } else {
                views.setTextViewText(R.id.timer_label, "متبقي على الصلاة: ")
                views.setTextViewText(R.id.timer_unit,  "")
                views.setViewVisibility(R.id.prayer_countdown,          android.view.View.GONE)
                views.setViewVisibility(R.id.prayer_countdown_fallback, android.view.View.VISIBLE)
                views.setTextViewText(R.id.prayer_countdown_fallback, "--")
            }

            // ── Click intents ───────────────────────────────────────────────────
            val generalIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val generalPending = PendingIntent.getActivity(
                context, appWidgetId, generalIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val prayerIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("openPrayerTimes", true)
            }
            val prayerPending = PendingIntent.getActivity(
                context, appWidgetId + 100, prayerIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            views.setOnClickPendingIntent(R.id.widget_container,      generalPending)
            views.setOnClickPendingIntent(R.id.countdown_container,   prayerPending)
            views.setOnClickPendingIntent(R.id.prayer_pill_container, prayerPending)

            appWidgetManager.updateAppWidget(appWidgetId, views)
            Log.d(TAG, "Widget $appWidgetId updated ✅ (Prayer=$nextPrayerName @ $nextPrayerTime)")

        } catch (e: Exception) {
            Log.e(TAG, "Error updating widget $appWidgetId", e)
        }
    }
}
