package com.albayan.quran;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register custom plugins BEFORE calling super.onCreate()
        registerPlugin(MediaBridge.class);
        registerPlugin(NativeHaptics.class);
        
        super.onCreate(savedInstanceState);
    }
}
