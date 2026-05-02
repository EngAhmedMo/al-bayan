package com.albayan.quran

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import kotlinx.coroutines.launch

/**
 * DateChangeReceiver
 *
 * Listens to system DATE_CHANGED broadcast (fires at midnight) and
 * TIME_CHANGED (user manually changes time).
 *
 * Priority logic:
 *   1. Try Dar Al-Ifta API (if auto-sync enabled & no manual override).
 *   2. Fall back to HijriUtil + hijriEffectiveAdjustment (from AlBayanPersistence).
 *
 * KEY FIX: Writes KEY_GREGORIAN_DATE in ISO format (yyyy-MM-dd) so that
 * HijriDateWidgetProvider can correctly detect a fresh app-set date and
 * avoid overwriting it with HijriUtil every time.
 */
class DateChangeReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "DateChangeReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action != Intent.ACTION_DATE_CHANGED && action != Intent.ACTION_TIME_CHANGED) return

        Log.d(TAG, "📅 System date/time changed — refreshing widget ($action)")
        
        val pendingResult = goAsync()
        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch {
            try {
                val now = java.util.Date()
                val widgetPrefs = context.getSharedPreferences("HijriWidgetPrefs", Context.MODE_PRIVATE)

                // ── 1. Resolve the correct Hijri date ──────────────────────────────────
                var hijriDay: String = ""
                var hijriMonth: String = ""
                var hijriYear: String = ""
                var daysRemainingAr: String = ""

                // المصدر الموحّد للـ adjustment — يكتبه TypeScript فقط
                val defaultPrefs = context.getSharedPreferences("${context.packageName}_preferences", Context.MODE_PRIVATE)
                val adjustmentStr = defaultPrefs.getString("hijri_adjustment", "0") ?: "0"
                val effectiveAdjustment = adjustmentStr.toIntOrNull() ?: 0

                // Use HijriUtil + hijriEffectiveAdjustment
                val hijriDate = HijriUtil.getHijriDate(now, effectiveAdjustment)
                hijriDay   = HijriDateWidgetProvider.toArabicDigits(hijriDate.day)
                hijriMonth = hijriDate.monthName
                hijriYear  = HijriDateWidgetProvider.toArabicDigits(hijriDate.year)

                val rawRemaining = 30 - hijriDate.day
                daysRemainingAr = HijriDateWidgetProvider.toArabicDigits(
                    if (rawRemaining < 0) 0 else rawRemaining
                )
                Log.d(TAG, "✅ Hijri (HijriUtil fallback, adj=$effectiveAdjustment): Day=$hijriDay Month=$hijriMonth")

                // ── 2. Get next prayer time ────────────────────────────────────────────
                val nextPrayer = NativePrayerScheduler.getNextPrayer(context)

            // ── 3. Write updated data to SharedPreferences ─────────────────────────
            // KEY FIX: كتابة ISO date في KEY_GREGORIAN_DATE (ليس عربي) حتى تعمل
            // آلية Source-of-Truth lock في HijriDateWidgetProvider بشكل صحيح.
            // KEY_GREGORIAN_DATE_DISPLAY يحتوي على الصيغة العربية للعرض فقط.
            val isoFormat     = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
            val displayFormat = java.text.SimpleDateFormat("EEEE، d MMMM", java.util.Locale("ar"))
            val editor = widgetPrefs.edit()

            editor.putString(HijriDateWidgetProvider.KEY_HIJRI_DAY, hijriDay)
            editor.putString(HijriDateWidgetProvider.KEY_HIJRI_MONTH, hijriMonth)
            editor.putString(HijriDateWidgetProvider.KEY_HIJRI_YEAR, hijriYear)
            editor.putString(HijriDateWidgetProvider.KEY_HIJRI_DAYS_REMAINING, daysRemainingAr)
            // ISO للمقارنة + عربي للعرض
            editor.putString(HijriDateWidgetProvider.KEY_GREGORIAN_DATE, isoFormat.format(now))
            editor.putString(HijriDateWidgetProvider.KEY_GREGORIAN_DATE_DISPLAY, displayFormat.format(now))

            if (nextPrayer != null) {
                // PRIORITY FIX: Only write Native prayer data if app-set timestamp is stale.
                // The app (TypeScript/Adhan.js) is the more accurate source; prefer it.
                val appTimestamp = widgetPrefs.getLong(HijriDateWidgetProvider.KEY_NEXT_PRAYER_TIMESTAMP, -1L)
                val useNative = appTimestamp <= 0L || appTimestamp <= System.currentTimeMillis()

                if (useNative) {
                    editor.putString(HijriDateWidgetProvider.KEY_NEXT_PRAYER_NAME, nextPrayer.name)
                    editor.putLong(HijriDateWidgetProvider.KEY_NEXT_PRAYER_TIMESTAMP, nextPrayer.timeObj.time)

                    val timeParts = nextPrayer.time.split(":")
                    val formattedTime = if (timeParts.size >= 2) {
                        val h24    = timeParts[0].toIntOrNull() ?: 12
                        val m      = timeParts[1].toIntOrNull() ?: 0
                        val period = if (h24 >= 12) "م" else "ص"
                        val h12    = if (h24 % 12 == 0) 12 else h24 % 12
                        // FIX: Use toArabicDigitsString to preserve leading zero ("04" → "٠٤" not "٤")
                        val mStr   = String.format("%02d", m)
                        HijriDateWidgetProvider.toArabicDigits(h12) + ":" +
                            HijriDateWidgetProvider.toArabicDigitsString(mStr) + " " + period
                    } else nextPrayer.time
                    editor.putString(HijriDateWidgetProvider.KEY_NEXT_PRAYER_TIME, formattedTime)
                    Log.d(TAG, "⏰ Next prayer (native fallback): ${nextPrayer.name} @ ${nextPrayer.time}")
                } else {
                    Log.d(TAG, "⏰ Keeping app-set prayer time (still valid, more accurate)")
                }
            }

            editor.apply()

            // ── 4. Trigger widget UI refresh ───────────────────────────────────────
            HijriDateWidgetProvider.updateAllWidgets(context)
            Log.d(TAG, "✅ Widget refreshed after date/time change")

        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to update widget on date/time change", e)
        } finally {
            pendingResult.finish()
        }
        }
    }
}
