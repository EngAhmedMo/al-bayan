package com.albayan.quran

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import android.util.Log

class SustainabilityWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        Log.d("SustainabilityWorker", "💓 Heartbeat: Checking prayer schedule sustainability...")

        return try {

            // Run the Native Scheduler to ensure next 7 days are covered (Lightweight)
            NativePrayerScheduler.schedulePrayers(applicationContext)
            
            // ==========================================
            // 🌍 WIDGET UPDATE: PRIORITIZE APP-SET DATA
            // ==========================================
            // KEY FIX: The app (JS/TypeScript) uses Intl.DateTimeFormat (Umm al-Qura) for
            // Hijri calculation which is more accurate and includes the user's manual adjustment.
            // HijriUtil uses a different Tabular/Kuwaiti algorithm that may differ by 1-2 days.
            // 
            // STRATEGY: Read the day/month/year that the app already saved to HijriWidgetPrefs
            // (via MediaBridge.updateWidgetData). Only the next prayer time needs recalculation.
            // Fall back to HijriUtil ONLY if no app-set date exists (first boot before app opens).
            try {
            val now = java.util.Date()
            val widgetPrefs = applicationContext.getSharedPreferences("HijriWidgetPrefs", Context.MODE_PRIVATE)
            
            // Use ISO date as unified comparison key across TS and Native layers
            val isoDateFormat = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
            val todayStr = isoDateFormat.format(now)
            val savedGregorianDate = widgetPrefs.getString(HijriDateWidgetProvider.KEY_GREGORIAN_DATE, "")
            // Arabic display format for the widget label
            val displayDateFormat = java.text.SimpleDateFormat("EEEE، d MMMM", java.util.Locale("ar"))
            val displayDate = displayDateFormat.format(now)
            
            // 1. Calculate Hijri Date natively (avoid freezing)
            var hijriDay: String = widgetPrefs.getString(HijriDateWidgetProvider.KEY_HIJRI_DAY, "") ?: ""
            var hijriMonth: String = widgetPrefs.getString(HijriDateWidgetProvider.KEY_HIJRI_MONTH, "") ?: ""
            var hijriYear: String = widgetPrefs.getString(HijriDateWidgetProvider.KEY_HIJRI_YEAR, "") ?: ""
            var daysRemainingAr: String = widgetPrefs.getString(HijriDateWidgetProvider.KEY_HIJRI_DAYS_REMAINING, "") ?: ""
            
            // Only recalculate Hijri if it's a new day or data is missing.
            // This prevents overwriting the accurate app-set (Intl.DateTimeFormat) date with HijriUtil.
            val isDateFresh = savedGregorianDate == todayStr && hijriDay.isNotEmpty()
            val defaultPrefs = applicationContext.getSharedPreferences("${applicationContext.packageName}_preferences", Context.MODE_PRIVATE)
            val adjustmentStr = defaultPrefs.getString("hijri_adjustment", "0") ?: "0"
            val effectiveAdjustment = adjustmentStr.toIntOrNull() ?: 0

            if (!isDateFresh) {
                Log.d("SustainabilityWorker", "📅 New day detected — refreshing Hijri date checking multi-tier system...")
                
                // Try Tier 1: Precalculated TS JSON Cache
                val preCalc = HijriUtil.getPrecalculatedHijriDate(applicationContext, todayStr)
                
                if (preCalc != null) {
                    hijriDay = preCalc.day
                    hijriMonth = preCalc.month
                    hijriYear = preCalc.year
                    daysRemainingAr = preCalc.remaining
                    Log.d("SustainabilityWorker", "✅ Hijri (Tier 1 TS Cache): Day=$hijriDay Month=$hijriMonth")
                } else {
                    // Try Tier 2/3: Native Umm Al-Qura / Tabular Fallback
                    val hijriDate = HijriUtil.getHijriDate(now, effectiveAdjustment)
                    hijriDay   = HijriDateWidgetProvider.toArabicDigits(hijriDate.day)
                    hijriMonth = hijriDate.monthName
                    hijriYear  = HijriDateWidgetProvider.toArabicDigits(hijriDate.year)
                    val rawRemaining = 30 - hijriDate.day
                    daysRemainingAr = HijriDateWidgetProvider.toArabicDigits(
                        if (rawRemaining < 0) 0 else rawRemaining
                    )
                    Log.d("SustainabilityWorker", "✅ Native Fallback (adj=$effectiveAdjustment): $hijriDay $hijriMonth $hijriYear")
                }
            } else {
                Log.d("SustainabilityWorker", "✅ App-set Hijri Date is fresh for today. Skipping native recalculation.")
            }
            
            // 2. Get Next Prayer Time
            // PRIORITY: Use the app-set prayer timestamp if it is still in the future
            // (TypeScript/Adhan.js is more accurate than NativePrayerScheduler).
            // Fall back to NativePrayerScheduler only when the app-set data is stale.
            val appTimestamp = widgetPrefs.getLong(HijriDateWidgetProvider.KEY_NEXT_PRAYER_TIMESTAMP, -1L)
            val appPrayerName = widgetPrefs.getString(HijriDateWidgetProvider.KEY_NEXT_PRAYER_NAME, null)
            val appPrayerTime = widgetPrefs.getString(HijriDateWidgetProvider.KEY_NEXT_PRAYER_TIME, null)
            val now24 = System.currentTimeMillis()

            val useNative = appTimestamp <= 0L || appTimestamp <= now24 || appPrayerName.isNullOrEmpty()

            val editor = widgetPrefs.edit()

            // Update Hijri date (use app-set values or fallback)
            editor.putString(HijriDateWidgetProvider.KEY_HIJRI_DAY, hijriDay)
            editor.putString(HijriDateWidgetProvider.KEY_HIJRI_MONTH, hijriMonth)
            editor.putString(HijriDateWidgetProvider.KEY_HIJRI_YEAR, hijriYear)
            editor.putString(HijriDateWidgetProvider.KEY_HIJRI_DAYS_REMAINING, daysRemainingAr)

            // Update Gregorian Date — write ISO key (for comparison) and display key (for UI)
            editor.putString(HijriDateWidgetProvider.KEY_GREGORIAN_DATE, todayStr)
            editor.putString(HijriDateWidgetProvider.KEY_GREGORIAN_DATE_DISPLAY, displayDate)

            // Update next prayer time
            if (!useNative) {
                // ✅ App-set data is still fresh — keep it as-is, no overwrite
                Log.d("SustainabilityWorker", "✅ Prayer time from app (TypeScript/Adhan.js): $appPrayerName @ $appPrayerTime")
            } else {
                // ⚠️ Fallback: recalculate via NativePrayerScheduler
                val nextPrayer = NativePrayerScheduler.getNextPrayer(applicationContext)
                if (nextPrayer != null) {
                    editor.putString(HijriDateWidgetProvider.KEY_NEXT_PRAYER_NAME, nextPrayer.name)
                    editor.putLong(HijriDateWidgetProvider.KEY_NEXT_PRAYER_TIMESTAMP, nextPrayer.timeObj.time)

                    // FIX: Use toArabicDigitsString to preserve leading zero ("04" → "٠٤" not "٤")
                    val timeParts = nextPrayer.time.split(":")
                    val formattedTime12 = if (timeParts.size >= 2) {
                        val h24    = timeParts[0].toIntOrNull() ?: 12
                        val m      = timeParts[1].toIntOrNull() ?: 0
                        val period = if (h24 >= 12) "م" else "ص"
                        val h12    = if (h24 % 12 == 0) 12 else h24 % 12
                        val mStr   = String.format("%02d", m)
                        HijriDateWidgetProvider.toArabicDigits(h12) + ":" +
                            HijriDateWidgetProvider.toArabicDigitsString(mStr) + " " + period
                    } else {
                        nextPrayer.time
                    }
                    editor.putString(HijriDateWidgetProvider.KEY_NEXT_PRAYER_TIME, formattedTime12)
                    Log.w("SustainabilityWorker", "⚠️ Prayer time from NativePrayerScheduler (fallback): ${nextPrayer.name} @ ${nextPrayer.time}")
                }
            }
            
            editor.apply()
            
            // 4. Trigger Widget UI Refresh
            HijriDateWidgetProvider.updateAllWidgets(applicationContext)
            Log.d("SustainabilityWorker", "✅ Widget refreshed. IsDateFresh=$isDateFresh")
                
            } catch (e: Exception) {
                Log.e("SustainabilityWorker", "⚠️ Failed to update widget from worker", e)
            }

            Log.d("SustainabilityWorker", "✅ Sustainability check complete.")
            Result.success()
        } catch (e: Exception) {
            Log.e("SustainabilityWorker", "❌ Sustainability check failed", e)
            Result.retry()
        }
    }
}
