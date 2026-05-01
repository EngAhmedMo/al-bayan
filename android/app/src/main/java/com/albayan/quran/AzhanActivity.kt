package com.albayan.quran

import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.widget.Button
import android.widget.ImageButton
import android.widget.TextView
import android.view.KeyEvent
import androidx.appcompat.app.AppCompatActivity

class AzhanActivity : AppCompatActivity() {

    // UI State
    private var isPlaying = true
    private var isMuted = false
    
    // UI Elements
    private lateinit var btnPlayPause: ImageButton
    private lateinit var btnMute: ImageButton

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 1. Turn Screen On & Show Over Lock Screen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            keyguardManager.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            )
        }

        // 2. Setup Premium UI via XML
        setContentView(R.layout.activity_azhan)

        val prayerName = intent.getStringExtra("PRAYER_NAME") ?: "الصلاة"
        val prayerTime = intent.getStringExtra("PRAYER_TIME") ?: ""
        
        android.util.Log.d("AzhanActivity", "🚀 onCreate Called. Prayer: $prayerName, Time: $prayerTime")
        
        // Find Views
        val tvPrayerName = findViewById<TextView>(R.id.tv_prayer_name)
        val tvTime = findViewById<TextView>(R.id.tv_time)
        val tvMuazzin = findViewById<TextView>(R.id.tv_muazzin)
        
        val btnCloseTop = findViewById<ImageButton>(R.id.btn_close_top)
        val btnSettings = findViewById<ImageButton>(R.id.btn_settings)
        
        btnPlayPause = findViewById(R.id.btn_play_pause)
        val btnDismiss = findViewById<Button>(R.id.btn_dismiss)
        btnMute = findViewById(R.id.btn_mute)

        // Populate Data
        tvPrayerName.text = prayerName
        
        // Muazzin Name Logic
        val rawMuazzinName = intent.getStringExtra("MUAZZIN_NAME") ?: ""
        if (rawMuazzinName.isNotEmpty()) {
            tvMuazzin.text = rawMuazzinName
        } else {
             tvMuazzin.text = "البيان"
        }
        
        // Animation: Pulse/Rotate the Ring
        val ringView = findViewById<android.view.View>(R.id.ring_view)
        val rotator = android.animation.ObjectAnimator.ofFloat(ringView, "rotation", 0f, 360f)
        rotator.duration = 4000
        rotator.repeatCount = android.animation.ObjectAnimator.INFINITE
        rotator.interpolator = android.view.animation.LinearInterpolator()
        rotator.start()
        
        // Settings & Close Actions
        btnCloseTop.setOnClickListener {
             stopAzhan()
        }
        
        btnSettings.setOnClickListener {
            // Open App Settings
            val intent = Intent(this, MainActivity::class.java)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(intent)
            finish()
        }
        
        // ========== Prayer Time Display ==========
        // If prayer time is provided from scheduler, use it; otherwise fallback to current time
        if (prayerTime.isNotEmpty()) {
            tvTime.text = prayerTime
        } else {
            // Fallback: Format current device time with Arabic digits
            val calendar = java.util.Calendar.getInstance()
            val hour = calendar.get(java.util.Calendar.HOUR_OF_DAY)
            val minute = calendar.get(java.util.Calendar.MINUTE)
            
            val h12 = if (hour > 12) hour - 12 else if (hour == 0) 12 else hour
            val amPm = if (hour >= 12) "م" else "ص"
            
            val timeStr = String.format("%d:%02d", h12, minute)
                .replace('0', '٠')
                .replace('1', '١')
                .replace('2', '٢')
                .replace('3', '٣')
                .replace('4', '٤')
                .replace('5', '٥')
                .replace('6', '٦')
                .replace('7', '٧')
                .replace('8', '٨')
                .replace('9', '٩')
                
            tvTime.text = "$timeStr $amPm"
        }

        // ========== Play/Pause Button ==========
        btnPlayPause.setOnClickListener {
            if (isPlaying) {
                sendAzhanAction(AudioPlaybackService.ACTION_PAUSE_AZHAN)
            } else {
                sendAzhanAction(AudioPlaybackService.ACTION_RESUME_AZHAN)
            }
        }
        
        // ========== Mute Button ==========
        btnMute.setOnClickListener {
            sendAzhanAction(AudioPlaybackService.ACTION_TOGGLE_MUTE_AZHAN)
        }

        // ========== Stop Buttons ==========
        btnDismiss.setOnClickListener {
            android.util.Log.d("AzhanActivity", "Dismiss Button Clicked")
            stopAzhan()
        }
    }
    
    private fun sendAzhanAction(action: String) {
        val intent = Intent(this, AudioPlaybackService::class.java).apply {
            this.action = action
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }
    
    private fun updateButtonIcons() {
        // Update Play/Pause icon
        if (isPlaying) {
            btnPlayPause.setImageResource(R.drawable.ic_pause)
        } else {
            btnPlayPause.setImageResource(R.drawable.ic_play)
        }
        
        // Update Mute icon
        if (isMuted) {
            btnMute.setImageResource(R.drawable.ic_volume_off)
        } else {
            btnMute.setImageResource(R.drawable.ic_volume_on)
        }
    }

    private fun stopAzhan() {
        android.util.Log.d("AzhanActivity", "User requested STOP Azhan")
        // Send Broadcast to Web UI to reset state
        val dismissIntent = Intent("com.albayan.quran.ACTION_AZHAN_DISMISSED")
        sendBroadcast(dismissIntent)

        val stopIntent = Intent(this, AudioPlaybackService::class.java).apply {
            action = AudioPlaybackService.ACTION_STOP_AZHAN
        }
        startService(stopIntent)
        finish()
    }
    
    // ========== Broadcast Receivers ==========
    
    private val finishReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action == "com.albayan.quran.ACTION_AZHAN_FINISHED") {
                finish()
            }
        }
    }
    
    private val stateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action == AudioPlaybackService.ACTION_AZHAN_STATE_CHANGED) {
                isPlaying = intent.getBooleanExtra("isPlaying", true)
                isMuted = intent.getBooleanExtra("isMuted", false)
                updateButtonIcons()
            }
        }
    }

    override fun onStart() {
        super.onStart()
        
        // Register finish receiver
        val finishFilter = IntentFilter("com.albayan.quran.ACTION_AZHAN_FINISHED")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(finishReceiver, finishFilter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(finishReceiver, finishFilter)
        }
        
        // Register state receiver
        val stateFilter = IntentFilter(AudioPlaybackService.ACTION_AZHAN_STATE_CHANGED)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(stateReceiver, stateFilter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(stateReceiver, stateFilter)
        }
    }

    override fun onStop() {
        super.onStop()
        try {
            unregisterReceiver(finishReceiver)
            unregisterReceiver(stateReceiver)
        } catch (e: Exception) {
            // Ignore if not registered
        }
    }
    
    // ========== Hardware Button Handling ==========
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN || keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
            val prefs = getSharedPreferences("AlBayanPrefs", Context.MODE_PRIVATE)
            val gestureEnabled = prefs.getBoolean("azhan_gesture_stop_enabled", true)
            
            if (gestureEnabled) {
                android.util.Log.d("AzhanActivity", "Volume button pressed, stopping Azhan")
                
                // Optional: Provide a short haptic feedback
                val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as android.os.VibratorManager
                    vibratorManager.defaultVibrator
                } else {
                    @Suppress("DEPRECATION")
                    getSystemService(Context.VIBRATOR_SERVICE) as android.os.Vibrator
                }
                
                if (vibrator.hasVibrator()) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        vibrator.vibrate(android.os.VibrationEffect.createOneShot(200, android.os.VibrationEffect.DEFAULT_AMPLITUDE))
                    } else {
                        @Suppress("DEPRECATION")
                        vibrator.vibrate(200)
                    }
                }
                
                stopAzhan()
                return true // Consume the event so volume doesn't actually change
            }
        }
        return super.onKeyDown(keyCode, event)
    }
}
