import { registerPlugin } from '@capacitor/core';

export interface MediaBridgePlugin {
    play(options: { url: string; title: string; subtitle: string; artworkUrl?: string; isStream?: boolean; mediaId?: string }): Promise<void>;
    playAzhan(options: { muazzinId: string; prayerName: string; muazzinName?: string; azhanUrl?: string }): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    toggle(): Promise<void>;
    stop(): Promise<void>;
    requestBatteryOptimizationBypass(): Promise<{ alreadyIgnored?: boolean }>;
    checkBatteryOptimization(): Promise<{ isIgnored: boolean }>;
    checkResourceExists(options: { muazzinId: string }): Promise<{ exists: boolean; cleanId: string; resId: number }>;
    requestNotificationsPermission(): Promise<void>;
    scheduleAzhan(options: { id: number; time: number; muazzinId: string; prayerName: string; volume?: number; azhanUrl?: string }): Promise<void>;
    scheduleAzhanBatch(options: { alarms: Array<{ id: number; time: number; muazzinId: string; prayerName: string; volume?: number; azhanUrl?: string }> }): Promise<{ count: number; failed: number }>;
    schedulePrePrayerAlertBatch(options: { alerts: Array<{ id: number; time: number; prayerName: string; alertSound?: string; volume?: number }> }): Promise<{ count: number; failed: number }>;
    scheduleSalawatAlertBatch(options: { alerts: Array<{ id: number; time: number; soundId?: string; soundEnabled?: boolean; volume?: number; shouldResume?: boolean }> }): Promise<{ count: number; failed: number }>;
    cancelAzhan(options: { id: number }): Promise<void>;
    cancelAllNativeAlarms(): Promise<{ cancelled: number; azhan: number; prePrayer: number; salawat: number }>;
    cancelAlarmRange(options: { startId: number; endId: number }): Promise<{ checked: number; status: string }>;
    cancelAllScheduledAzhan(): Promise<void>; // Added for cleanup consistency
    // DND and Alarm permission methods
    requestDndAccess(): Promise<{ opened?: boolean; alreadyGranted?: boolean }>;
    checkExactAlarmPermission(): Promise<{ canScheduleExactAlarms: boolean }>;
    requestExactAlarmPermission(): Promise<{ opened?: boolean; alreadyGranted?: boolean; notRequired?: boolean }>;
    setAzhanVolume(options: { volume: number }): Promise<void>;
    // DND Check method
    checkDndAccess(): Promise<{ granted: boolean }>;
    addListener(eventName: 'controlNotification' | 'onPlaybackStateChanged' | 'onIsPlayingChanged' | 'azhanDismissed' | 'azhanStarted' | 'azhanProgress' | 'azhanStateChanged' | 'mediaItemTransition' | 'salawatStarted' | 'salawatFinished' | 'sleepTimerFinished', listenerFunc: (data: any) => void): Promise<any>;
    // New Permission Methods
    openAutoStart(): Promise<void>;
    disableAutoStart?(): Promise<void>;
    isAutoStartEnabled?(): Promise<boolean>;
    requestOverlayPermission(): Promise<{ opened?: boolean; alreadyGranted?: boolean; notRequired?: boolean }>;
    checkOverlayPermission(): Promise<{ granted: boolean }>;
    openAppSettings(): Promise<void>;
    requestLocationSettings(): Promise<{ opened: boolean }>;
    sendEmailDirect(options: { subject: string; body: string; attachmentPath?: string }): Promise<void>;
    checkSoundAssets(): Promise<{ missing: string[], allGood: boolean }>;
    // Home Screen Widget
    updateWidgetData(options: {
        hijriDay: string;
        hijriMonth: string;
        hijriYear: string;
        gregorianDate: string;
        nextPrayerName?: string;
        nextPrayerTime?: string;
        nextPrayerTimestamp?: number;
        hijriAdjustment?: string;
        hijriDatesJson?: string;
    }): Promise<void>;
    savePersistenceData(options: {
        lat: number;
        lng: number;
        method?: string;
        madhab?: string;
        highLatitudeRule?: string;
        adjustmentsJson?: string;
        // NEW: Azhan Persistence for Native Scheduler
        muazzinId?: string;
        perPrayerSettingsJson?: string;
        isPerPrayerEnabled?: boolean;
        // NEW: Salawat Persistence for Native Scheduler
        salawatSettingsJson?: string;
        // NEW: Pre-Prayer Persistence for Native Scheduler (Phase 3)
        prePrayerSettingsJson?: string;
        // NEW: Ramadan Persistence for Native Scheduler
        ramadanSettingsJson?: string;
        // NEW: Hijri Auto-Sync Persistence for Native Widget

    }): Promise<void>;

    getPersistenceData(): Promise<{
        hijriAutoAdjustment?: number;

    }>;

    registerSustainabilityWork(): Promise<void>;

    refreshWidget(): Promise<void>;

    getCurrentAzhanState(): Promise<{ isPlayingAzhan: boolean; isReal: boolean }>;

    // Radio Station Navigation - For notification controls
    setRadioStationsList(options: { stations: Array<{ id: string; name: string; urls: string[] }>; currentIndex: number }): Promise<void>;
    skipToNextStation(): Promise<{ stationId: string; stationName: string } | null>;
    skipToPreviousStation(): Promise<{ stationId: string; stationName: string } | null>;

    // Gapless Playback
    queueNext(options: { url: string; title: string; subtitle: string; artworkUrl?: string; mediaId?: string }): Promise<void>;

    // Log Management
    shareLogFile(options: { fileName?: string }): Promise<void>;
    deleteLogFile(options: { fileName?: string }): Promise<void>;

    // Audio Focus Helpers
    pauseAudioIfPlaying(): Promise<{ wasPlaying: boolean }>;
    resumeAudioIfWasPlaying(): Promise<void>;

    // Bathroom/Privacy Mode
    setBathroomMode(options: { duration: number }): Promise<void>;
    getBathroomModeStatus(): Promise<{ isActive: boolean; endTime?: number; remainingSeconds?: number }>;

    // Sleep Timer
    setSleepTimer(options: { duration: number }): Promise<void>;
    cancelSleepTimer(): Promise<void>;
    getSleepTimerStatus(): Promise<{ isActive: boolean; endTime?: number; remainingSeconds?: number }>;

    getDiagnosticInfo(): Promise<{ isAzhanPlaying: boolean; logs: string[] }>;
    
    getAzhanStopMethods(): Promise<{ masterEnabled: boolean; flipEnabled: boolean; proximityEnabled: boolean; volumeEnabled: boolean }>;
    setAzhanStopMethods(options: { masterEnabled?: boolean; flipEnabled?: boolean; proximityEnabled?: boolean; volumeEnabled?: boolean }): Promise<void>;

}

export const MediaBridge = registerPlugin<MediaBridgePlugin>('MediaBridge');
