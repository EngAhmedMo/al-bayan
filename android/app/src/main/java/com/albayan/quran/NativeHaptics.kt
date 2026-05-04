package com.albayan.quran

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * NativeHaptics
 * A custom Capacitor plugin to trigger precise, highly-reliable hardware vibrations
 * using the raw Vibrator API. This bypasses the system's "touch feedback" settings
 * to ensure that Adhkar and Tasbih haptics work consistently across all Android devices,
 * mimicking the exact vibration behavior used in the Al-Bayan native notification receivers.
 */
@CapacitorPlugin(name = "NativeHaptics")
class NativeHaptics : Plugin() {

    @PluginMethod
    fun vibrate(call: PluginCall) {
        val style = call.getString("style") ?: "light"
        
        val pattern = when (style) {
            "light" -> longArrayOf(0, 30) // Wait 0ms, Vibrate 30ms (Light crisp tap)
            "medium" -> longArrayOf(0, 50)
            "heavy" -> longArrayOf(0, 80)
            "success" -> longArrayOf(0, 40, 60, 40) // Double tap
            "warning" -> longArrayOf(0, 50, 50, 50) // Triple tap
            "error" -> longArrayOf(0, 50, 100, 50)
            else -> longArrayOf(0, 30) // default
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                val vibrator = vibratorManager.defaultVibrator
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
            } else {
                @Suppress("DEPRECATION")
                val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(pattern, -1)
                }
            }
            call.resolve()
        } catch (e: Exception) {
            android.util.Log.e("NativeHaptics", "Vibration failed: ${e.message}")
            call.reject("Vibration failed", e)
        }
    }
}
