package com.albayan.quran

import android.content.Context
import android.util.Log
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

object HijriAutoSyncNative {
    
    private const val TAG = "HijriAutoSyncNative"
    private const val API_URL = "https://di107.dar-alifta.org/api/HijriDate?langID=2"
    
    // Using English response for easier parsing
    private val EN_MONTH_MAP = mapOf(
        "Muharram" to 1, "Safar" to 2, "Rabi' al-Awwal" to 3, "Rabi al-Awwal" to 3,
        "Rabi' al-Thani" to 4, "Rabi al-Thani" to 4, "Jumada al-Ula" to 5, "Jumada al-Oula" to 5,
        "Jumada al-Thani" to 6, "Jumada al-Akhirah" to 6, "Rajab" to 7, "Sha'ban" to 8, "Shaban" to 8,
        "Ramadan" to 9, "Shawwal" to 10, "Dhu-al-Qi'dah" to 11, "Dhul-Qi'dah" to 11, "Dhu al-Qi'dah" to 11,
        "Dhu-al-Hijjah" to 12, "Dhul-Hijjah" to 12, "Dhu al-Hijjah" to 12
    )
    
    private val HIJRI_MONTHS_AR = arrayOf(
        "محرم", "صفر", "ربيع الأول", "ربيع الثاني",
        "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان",
        "رمضان", "شوال", "ذو القعدة", "ذو الحجة"
    )

    data class SyncResult(val day: String, val month: String, val year: String, val monthInt: Int? = null, val dayInt: Int? = null, val yearInt: Int? = null)

    suspend fun fetchAndParseHijriDate(context: Context): SyncResult? = withContext(Dispatchers.IO) {
        try {
            val persistencePrefs = context.getSharedPreferences("AlBayanPersistence", Context.MODE_PRIVATE)
            val isEnabled = persistencePrefs.getBoolean("hijriAutoSyncEnabled", false)
            val isManualOverride = persistencePrefs.getBoolean("hijriManualOverride", false)
            // لا يوجد قيد جغرافي — المزامنة متاحة للجميع
            if (!isEnabled || isManualOverride) {
                return@withContext null
            }
            
            val defaultPrefs = context.getSharedPreferences("${context.packageName}_preferences", Context.MODE_PRIVATE)

            // 24-Hour Rate Limit Check
            val lastSyncDate = persistencePrefs.getString("hijriAutoLastSyncDate", "")
            val todayDate = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
            
            if (lastSyncDate == todayDate) {
                Log.d(TAG, "🌙 Already synced today natively, skipping network call to save battery.")
                return@withContext null
            }
            
            val result = performFetch()
            if (result != null) {
                persistencePrefs.edit().putString("hijriAutoLastSyncDate", todayDate).apply()
            }
            if (result != null && result.dayInt != null && result.monthInt != null && result.yearInt != null) {
                // Calculate drift against raw Native Hijri (0 adjustment)
                val localDateNoAdj = HijriUtil.getHijriDate(Date(), 0)
                val yearDiff = result.yearInt - localDateNoAdj.year
                val monthDiff = result.monthInt - localDateNoAdj.month
                val totalMonthDiff = (yearDiff * 12) + monthDiff

                var drift = 0
                if (totalMonthDiff == 0) {
                    drift = result.dayInt - localDateNoAdj.day
                } else if (totalMonthDiff == 1) {
                    drift = result.dayInt + (30 - localDateNoAdj.day)
                } else if (totalMonthDiff == -1) {
                    drift = -(localDateNoAdj.day + (30 - result.dayInt))
                }

                if (Math.abs(drift) <= 2) {
                    Log.d(TAG, "✅ Native calculated drift: $drift days")
                    persistencePrefs.edit().putInt("hijriAutoAdjustment", drift).apply()
                }
            }
            return@withContext result
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to fetch native Hijri sync", e)
        }
        return@withContext null
    }

    suspend fun performFetch(): SyncResult? = withContext(Dispatchers.IO) {
        try {
            Log.d(TAG, "🌙 Fetching Hijri date from Dar Al-Ifta (Native)...")
            
            val url = URL(API_URL)
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            // Spoof browser headers to avoid Dar Al-Ifta firewall blocks
            connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36")
            connection.setRequestProperty("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
            connection.setRequestProperty("Accept-Language", "en-US,en;q=0.5")
            connection.connectTimeout = 8000
            connection.readTimeout = 8000
            
            if (connection.responseCode == HttpURLConnection.HTTP_OK) {
                val bytes = connection.inputStream.readBytes()
                
                // Decode UTF-16LE if BOM is detected, else fallback to UTF-8
                val responseRaw = if (bytes.size >= 2 && bytes[0] == 0xFF.toByte() && bytes[1] == 0xFE.toByte()) {
                    String(bytes, 2, bytes.size - 2, Charsets.UTF_16LE)
                } else if (bytes.size >= 2 && bytes[0] == 0xFE.toByte() && bytes[1] == 0xFF.toByte()) {
                    String(bytes, 2, bytes.size - 2, Charsets.UTF_16BE)
                } else {
                    String(bytes, Charsets.UTF_8)
                }
                
                // Remove invisible BOM chars and JSON quotes
                val response = responseRaw.replace("\uFEFF", "").replace("\"", "").trim()
                Log.d(TAG, "🌙 API Response: $response")
                
                val tokens = response.split(Regex("\\s+"))
                if (tokens.size >= 3) {
                    val dayStr = tokens[0]
                    val yearStr = tokens.last()
                    val monthName = tokens.subList(1, tokens.size - 1).joinToString(" ")
                    
                    val dayInt = dayStr.toIntOrNull()
                    val yearInt = yearStr.toIntOrNull()
                    
                    var monthInt: Int? = EN_MONTH_MAP[monthName]
                    if (monthInt == null) {
                        val normalized = monthName.lowercase().replace("'", "")
                        monthInt = EN_MONTH_MAP.entries.firstOrNull { it.key.lowercase().replace("'", "") == normalized }?.value
                    }
                    
                    if (dayInt != null && yearInt != null && monthInt != null) {
                        val dayAr = HijriDateWidgetProvider.toArabicDigits(dayInt)
                        val yearAr = HijriDateWidgetProvider.toArabicDigits(yearInt)
                        val monthAr = HIJRI_MONTHS_AR.getOrNull(monthInt - 1) ?: monthName
                        
                        Log.d(TAG, "✅ Parsed native API date: $dayAr $monthAr $yearAr")
                        return@withContext SyncResult(dayAr, monthAr, yearAr, monthInt, dayInt, yearInt)
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ performFetch failed", e)
        }
        return@withContext null
    }
}
