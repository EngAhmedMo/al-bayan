package com.albayan.quran

import android.content.Context
import android.media.AudioAttributes
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.os.VibrationAttributes
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
            "light" -> longArrayOf(0, 45) // Crisp, felt tap (45ms) for rapid counts
            "medium" -> longArrayOf(0, 80) // Medium single pulse (80ms) for buttons
            "heavy" -> longArrayOf(0, 120) // Heavy single pulse (120ms) for resets
            "dhikr_change" -> longArrayOf(0, 80, 100, 80) // Elegant Double Pulse for dhikr swap
            "success" -> longArrayOf(0, 100, 100, 100, 80, 150) // Rich Premium Triple Pulse for completion
            "warning" -> longArrayOf(0, 60, 60, 60) // Symmetrical alert pulse
            "error" -> longArrayOf(0, 60, 120, 60)
            else -> longArrayOf(0, 45) // default
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                val vibrator = vibratorManager.defaultVibrator
                
                // Build VibrationAttributes with USAGE_ALARM to bypass global touch haptics disabled settings (essential for Android 12+)
                val vibrationAttributes = VibrationAttributes.Builder()
                    .setUsage(VibrationAttributes.USAGE_ALARM)
                    .build()
                    
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1), vibrationAttributes)
            } else {
                @Suppress("DEPRECATION")
                val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                
                // Build AudioAttributes with USAGE_ALARM to bypass global touch haptics disabled settings for older SDKs
                val audioAttributes = AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .build()

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1), audioAttributes)
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
