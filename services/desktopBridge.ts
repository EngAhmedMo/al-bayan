import { invoke } from '@tauri-apps/api/core';
import type { MediaBridgePlugin } from './mediaBridge';
import { enable, isEnabled } from '@tauri-apps/plugin-autostart';

/**
 * DesktopBridge implements the same interface as MediaBridgePlugin
 * but uses Tauri's IPC commands instead of Capacitor's Native Bridge.
 */
class DesktopBridgeImplementation implements MediaBridgePlugin {
    
    // --- Audio Commands ---
    async play(options: { url: string; title: string; subtitle: string; artworkUrl?: string; isStream?: boolean; mediaId?: string }): Promise<void> {
        return invoke('play_audio', { path: options.url });
    }

    async playAzhan(options: { muazzinId: string; prayerName: string; muazzinName?: string; azhanUrl?: string }): Promise<void> {
        // Fallback to bundled path or provided URL
        const path = options.azhanUrl || `/audio/${options.muazzinId}.mp3`;
        return invoke('play_audio', { path });
    }

    async pause(): Promise<void> {
        return invoke('pause_audio');
    }

    async resume(): Promise<void> {
        return invoke('resume_audio');
    }

    async toggle(): Promise<void> {
        // Need to know current state, for now just play (frontend usually knows state)
        return invoke('resume_audio');
    }

    async stop(): Promise<void> {
        return invoke('stop_audio');
    }

    async setAzhanVolume(options: { volume: number }): Promise<void> {
        return invoke('set_audio_volume', { volume: options.volume });
    }

    // --- Scheduler Commands ---
    async scheduleAzhan(options: { id: number; time: number; muazzinId: string; prayerName: string; volume?: number; azhanUrl?: string }): Promise<void> {
        const timeStr = new Date(options.time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
        return invoke('schedule_azhan', {
            id: options.id.toString(),
            timeStr: timeStr,
            prayerName: options.prayerName,
            muazzinId: options.muazzinId,
            isPreAlert: false
        });
    }

    async scheduleAzhanBatch(options: { alarms: Array<{ id: number; time: number; muazzinId: string; prayerName: string; volume?: number; azhanUrl?: string }> }): Promise<{ count: number; failed: number }> {
        let failed = 0;
        for (const alarm of options.alarms) {
            try {
                await this.scheduleAzhan(alarm);
            } catch {
                failed++;
            }
        }
        return { count: options.alarms.length - failed, failed };
    }

    async schedulePrePrayerAlertBatch(options: { alerts: Array<{ id: number; time: number; prayerName: string; alertSound?: string; volume?: number }> }): Promise<{ count: number; failed: number }> {
        let failed = 0;
        for (const alert of options.alerts) {
            try {
                const timeStr = new Date(alert.time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
                await invoke('schedule_azhan', {
                    id: alert.id.toString(),
                    timeStr: timeStr,
                    prayerName: alert.prayerName,
                    muazzinId: alert.alertSound || 'alert_approaching',
                    isPreAlert: true
                });
            } catch {
                failed++;
            }
        }
        return { count: options.alerts.length - failed, failed };
    }

    async scheduleSalawatAlertBatch(options: { alerts: Array<{ id: number; time: number; soundId?: string; soundEnabled?: boolean; volume?: number; shouldResume?: boolean }> }): Promise<{ count: number; failed: number }> {
        // Basic mapping for salawat as alarms
        let failed = 0;
        for (const alert of options.alerts) {
            try {
                const timeStr = new Date(alert.time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
                await invoke('schedule_azhan', {
                    id: alert.id.toString(),
                    timeStr: timeStr,
                    prayerName: "الصلاة على النبي",
                    muazzinId: alert.soundId || 'salawat_one',
                    isPreAlert: true
                });
            } catch {
                failed++;
            }
        }
        return { count: options.alerts.length - failed, failed };
    }

    async cancelAzhan(options: { id: number }): Promise<void> {
        // Individual cancel not implemented in Rust yet, canceling all for simplicity or ignoring
        console.warn('cancelAzhan not implemented for Desktop individually');
    }

    async cancelAllNativeAlarms(): Promise<{ cancelled: number; azhan: number; prePrayer: number; salawat: number }> {
        await invoke('cancel_all_azhan');
        return { cancelled: 1, azhan: 1, prePrayer: 0, salawat: 0 };
    }

    async cancelAlarmRange(options: { startId: number; endId: number }): Promise<{ checked: number; status: string }> {
        return { checked: 0, status: 'ok' };
    }

    async cancelAllScheduledAzhan(): Promise<void> {
        return invoke('cancel_all_azhan');
    }

    // --- System / Persistence Commands ---
    async openAutoStart(): Promise<void> {
        if (!await isEnabled()) {
            await enable();
        }
    }

    async disableAutoStart(): Promise<void> {
        const { disable } = await import('@tauri-apps/plugin-autostart');
        await disable();
    }

    async isAutoStartEnabled(): Promise<boolean> {
        return await isEnabled();
    }

    async savePersistenceData(options: any): Promise<void> {
        localStorage.setItem('desktop_persistence', JSON.stringify(options));
    }

    async getPersistenceData(): Promise<any> {
        const data = localStorage.getItem('desktop_persistence');
        return data ? JSON.parse(data) : {};
    }

    // --- Unsupported / Mobile-Only Commands (No-Ops) ---
    async requestBatteryOptimizationBypass() { return { alreadyIgnored: true }; }
    async checkBatteryOptimization() { return { isIgnored: true }; }
    async checkResourceExists(options: { muazzinId: string }) { return { exists: true, cleanId: options.muazzinId, resId: 0 }; }
    async requestNotificationsPermission() {}
    async requestDndAccess() { return { alreadyGranted: true }; }
    async checkExactAlarmPermission() { return { canScheduleExactAlarms: true }; }
    async requestExactAlarmPermission() { return { notRequired: true }; }
    async checkDndAccess() { return { granted: true }; }
    async addListener(eventName: any, listenerFunc: any) { 
        // We can hook into Tauri events here for things like 'azhan_triggered'
        import('@tauri-apps/api/event').then(({ listen }) => {
            if (eventName === 'azhanStarted') {
                listen('azhan_triggered', (e: any) => {
                    const payload = e.payload;
                    listenerFunc({
                        prayerName: payload.prayer_name,
                        muazzinId: payload.muazzin_id,
                        isPreAlert: payload.is_pre_alert,
                        isReal: true
                    });
                });
            }
        });
        return { remove: () => {} }; 
    }
    async requestOverlayPermission() { return { notRequired: true }; }
    async checkOverlayPermission() { return { granted: true }; }
    async openAppSettings() {}
    async requestLocationSettings() { return { opened: false }; }
    async sendEmailDirect(options: any) {}
    async checkSoundAssets() { return { missing: [], allGood: true }; }
    async updateWidgetData(options: any) {}
    async registerSustainabilityWork() {}
    async refreshWidget() {}
    async getCurrentAzhanState() { return { isPlayingAzhan: false, isReal: false }; }
    async setRadioStationsList(options: any) {}
    async skipToNextStation() { return null; }
    async skipToPreviousStation() { return null; }
    async queueNext(options: any) {}
    async shareLogFile(options: any) {}
    async deleteLogFile(options: any) {}
    async pauseAudioIfPlaying() { return { wasPlaying: false }; }
    async resumeAudioIfWasPlaying() {}
    async setBathroomMode(options: any) {}
    async getBathroomModeStatus() { return { isActive: false }; }
    async setSleepTimer(options: any) {}
    async cancelSleepTimer() {}
    async getSleepTimerStatus() { return { isActive: false }; }
    async getDiagnosticInfo() { return { isAzhanPlaying: false, logs: [] }; }
    async getAzhanStopMethods() { return { masterEnabled: false, flipEnabled: false, proximityEnabled: false, volumeEnabled: false }; }
    async setAzhanStopMethods(options: any) {}
}

export const DesktopBridge = new DesktopBridgeImplementation();
