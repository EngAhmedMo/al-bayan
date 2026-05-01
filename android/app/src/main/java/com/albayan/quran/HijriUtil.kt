package com.albayan.quran

import java.util.Calendar
import java.util.Date

/**
 * Native Hijri Date Calculator
 * Uses a standard approximation (Tabular Islamic Calendar) suitable for
 * general display when the app is offline.
 */
object HijriUtil {

    private val HIJRI_MONTHS = arrayOf(
        "محرم", "صفر", "ربيع الأول", "ربيع الثاني",
        "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان",
        "رمضان", "شوال", "ذو القعدة", "ذو الحجة"
    )

    data class HijriDate(val day: Int, val month: Int, val year: Int, val monthName: String)

    /**
     * Calculate Hijri Date from a given Gregorian Date
     * Adjustment: Days to add/subtract.
     * DEFAULT ADJUSTMENT: -1 (To align Tabular algorithm with typical Umm al-Qura)
     */
    fun getHijriDate(date: Date, adjustment: Int = -1): HijriDate {
        val cal = Calendar.getInstance()
        cal.time = date
        
        if (adjustment != 0) {
            cal.add(Calendar.DATE, adjustment)
        }

        // Based on Tabular Islamic Calendar (Kuwaiti Algorithm)
        var day = cal.get(Calendar.DAY_OF_MONTH)
        var month = cal.get(Calendar.MONTH) // 0-based
        var year = cal.get(Calendar.YEAR)

        var m = month + 1
        var y = year
        if (m < 3) {
            y -= 1
            m += 12
        }

        var a = Math.floor(y / 100.0).toInt()
        var b = 2 - a + Math.floor(a / 4.0).toInt()
        
        if (y < 1583) b = 0
        if (y == 1582) {
            if (m > 10) b = -10
            if (m == 10) {
                b = 0
                if (day > 4) b = -10
            }
        }

        val jd = Math.floor(365.25 * (y + 4716)).toInt() + Math.floor(30.6001 * (m + 1)).toInt() + day + b - 1524

        // Dead code removed: Reverse Gregorian calculation was unnecessary
        // jd is used directly below for Hijri calculation

        // Convert to Hijri
        val iyear = 10631.0 / 30.0
        val epochastro = 1948084
        val shift1 = 8.01 / 60.0

        var z = jd - epochastro
        val cyc = Math.floor(z / 10631.0).toInt()
        z -= 10631 * cyc
        val j = Math.floor((z - shift1) / iyear).toInt()
        val iy = 30 * cyc + j
        z -= Math.floor(j * iyear + shift1).toInt()
        var im = Math.floor((z + 28.5001) / 29.5).toInt()
        if (im == 13) im = 12
        val id = z - Math.floor(29.5 * im - 29.0).toInt()

        val hYear = iy
        val hMonth = im 
        val hDay = id

        val monthName = if (hMonth in 1..12) HIJRI_MONTHS[hMonth - 1] else ""

        return HijriDate(hDay, hMonth, hYear, monthName)
    }
}
