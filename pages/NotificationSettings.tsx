
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { TopBar } from '../components/TopBar';
import {
    getNotificationSettings,
    updateSalahSettings,
    updateAdhkarSettings,
    updateQiyamSettings,
    updateFridaySettings,
    updateSalawatSettings,
    updateRamadanSettings,
    getStoredAzhanForPrayer,
    setStoredAzhanForPrayer,
    getStoredVolumeForPrayer,
    getStoredAzhan,
    isPerPrayerMuazzinEnabled,
    setPerPrayerMuazzinEnabled,
    clearAzhanSpecificSettings,
    NotificationSettings
} from '../services/storage';
import { MUAZZINS } from '../services/azhanData';
import { runBackgroundCheckup, requestBatteryOptimization, scheduleAllNotifications } from '../services/notificationManager';
import { SALAWAT_DEFAULTS } from '../constants/defaults';
import {
    Bell, Moon, Sun, Clock, BookOpen,
    ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
    Sunrise, Sunset, Settings2, Save, Volume2, VolumeX, Check,
    ShieldCheck, ChevronLeft, Play, Square, Calculator, Globe, MapPin,
    Navigation, X, Search, Calendar, RotateCcw, AlertTriangle, RefreshCw
} from 'lucide-react';

import { PermissionGate } from '../components/PermissionGate'; // Import the wizard
import { AzhanModal } from '../components/AzhanModal'; // Unified Azhan Interface
import { MediaBridge } from '../services/mediaBridge';
import { MinuteWheelPicker, ArabicTimePicker } from '../components/ArabicPickers';
import {
    getCalculationMethod, setCalculationMethod,
    getMadhab, setMadhab,
    getHighLatitudeRule, setHighLatitudeRule,
    getPrayerAdjustments, setPrayerAdjustments, resetPrayerAdjustments,
    CalculationMethodType, MadhabType, PrayerAdjustments
} from '../services/prayerCalculator';
import { getHijriAdjustment, setHijriAdjustment, formatHijriDate, gregorianToHijri } from '../services/islamicCalendar';
import { LocationManager, POPULAR_CITIES, CityData } from '../services/LocationManager';
import { isAutoSyncEnabled, setAutoSyncEnabled, forceSyncHijriDate, getLastSyncResult, SyncResult } from '../services/hijriAutoSync';

export const NotificationSettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const [settings, setSettings] = useState<NotificationSettings | null>(null);
    const [expandedSection, setExpandedSection] = useState<string | null>('salah');
    const [saved, setSaved] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [savingStatus, setSavingStatus] = useState('');
    const [showPermissionWizard, setShowPermissionWizard] = useState(false);
    const [showAzhanPreview, setShowAzhanPreview] = useState(false);
    const [selectedPrayerForAzhan, setSelectedPrayerForAzhan] = useState<string | null>(null); // New: Track which prayer is being customized

    // Per-Prayer Muazzin Feature Toggle
    const [perPrayerEnabled, setPerPrayerEnabled] = useState(isPerPrayerMuazzinEnabled());

    // Prayer Calculation Settings
    const [calcMethod, setCalcMethod] = useState<CalculationMethodType>(getCalculationMethod());
    const [madhab, setMadhabState] = useState<MadhabType>(getMadhab());
    const [highLatRule, setHighLatRule] = useState(getHighLatitudeRule());
    const [adjustments, setAdjustments] = useState<PrayerAdjustments>(getPrayerAdjustments());
    const [hijriAdj, setHijriAdj] = useState(getHijriAdjustment());
    const [isManualOverride, setIsManualOverride] = useState(localStorage.getItem('hijri_manual_override') === 'true');
    
    // Hijri Auto Sync
    const [autoSyncEnabled, setAutoSyncEnabledState] = useState(isAutoSyncEnabled());
    const [syncResult, setSyncResult] = useState<SyncResult | null>(getLastSyncResult());
    const [isSyncing, setIsSyncing] = useState(false);

    // Manual Location Settings
    const [isManualLocation, setIsManualLocation] = useState(LocationManager.hasManualLocation());
    const [showCitySelector, setShowCitySelector] = useState(false);
    const [citySearchQuery, setCitySearchQuery] = useState('');
    const manualLoc = LocationManager.getManualLocation();

    // Audio Toggle State - tracks which audio is currently playing
    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

    // SYNC STATE: Track Volume for real-time updates
    const [azhanVolume, setAzhanVolume] = useState(80);

    // Battery Status
    const [batteryOptimized, setBatteryOptimized] = useState<'checking' | 'ignored' | 'restricted'>('checking');

    // Gesture Settings
    const [gestureSettings, setGestureSettings] = useState({ masterEnabled: true, flipEnabled: true, volumeEnabled: true });

    // Audio Preview Logic
    const currentAudioRef = React.useRef<HTMLAudioElement | null>(null);

    // Toggle audio preview - plays if stopped, stops if playing same audio
    const togglePreview = async (soundId: string, fileName: string) => {
        // ══════════════════════════════════════════════════════════════════════════
        // 🎯 FIX: DYNAMIC RANDOM PREVIEW
        // If "random" is selected, pick a random file from the available set
        // preventing the static "salawat_one.mp3" from always playing
        // ══════════════════════════════════════════════════════════════════════════
        let targetFileName = fileName;
        if (soundId === 'random') {
            const sounds = ['salawat_one.mp3', 'salawat_two.mp3', 'salawat_three.mp3', 'salawat_four.mp3', 'salawat_five.mp3'];
            const randomIndex = Math.floor(Math.random() * sounds.length);
            targetFileName = sounds[randomIndex];
            console.log('🎲 Random Preview Selected:', targetFileName);
        }

        // If same audio is playing, stop it
        if (playingAudioId === soundId) {
            if (currentAudioRef.current) {
                currentAudioRef.current.pause();
                currentAudioRef.current.currentTime = 0;
                currentAudioRef.current = null;
            }
            if (Capacitor.isNativePlatform()) {
                try {
                    await MediaBridge.stop();
                } catch (err) {
                    console.error("Native stop failed:", err);
                }
            }
            setPlayingAudioId(null);
            return;
        }

        // Stop any currently playing audio first
        if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current.currentTime = 0;
            currentAudioRef.current = null;
        }
        if (Capacitor.isNativePlatform() && playingAudioId) {
            try {
                await MediaBridge.stop();
            } catch (err) {
                console.error("Native stop failed:", err);
            }
        }

        // Play new audio
        setPlayingAudioId(soundId);

        if (Capacitor.isNativePlatform()) {
            // Android: Play from res/raw using MediaBridge
            const resourceId = targetFileName.replace(/\.[^/.]+$/, ""); // Strip extension
            try {
                await MediaBridge.play({
                    url: `android.resource://com.albayan.quran/raw/${resourceId}`,
                    title: 'معاينة الصلاة على النبي',
                    subtitle: 'إعدادات التنبيهات',
                    artworkUrl: 'https://al-bayan.app/icon-512.png',
                    isStream: false
                });

                // Listen for playback state changes to reset button when audio ends
                const listener = await MediaBridge.addListener('onIsPlayingChanged', (data: { isPlaying: boolean }) => {
                    if (!data.isPlaying) {
                        // Audio finished or stopped - reset button state
                        setPlayingAudioId(null);
                        // Remove listener after use
                        if (listener && typeof listener.remove === 'function') {
                            listener.remove();
                        }
                    }
                });
            } catch (err) {
                console.error("Native preview failed:", err);
                setPlayingAudioId(null);
            }
        } else {
            // Web: Use HTML5 Audio
            const audio = new Audio(`/audio/${targetFileName}`);
            currentAudioRef.current = audio;

            audio.play().catch(err => {
                console.error("Preview playback failed:", err);
                setPlayingAudioId(null);
            });

            audio.onended = () => {
                if (currentAudioRef.current === audio) {
                    currentAudioRef.current = null;
                    setPlayingAudioId(null);
                }
            };
        }
    };

    // SYNC: Listen for Global Settings Updates (Volume & Azhan ID)
    useEffect(() => {
        const handleSettingsUpdate = (e: CustomEvent) => {
            const newSettings = e.detail.settings as NotificationSettings;
            if (newSettings?.salah?.azhanVolume !== undefined) {
                // Determine if we should update local state
                // Only update if it's different to avoid jitter (though React handles this usually)
                setAzhanVolume(prev => prev !== newSettings.salah.azhanVolume ? newSettings.salah.azhanVolume : prev);
            }
        };

        window.addEventListener('notification-settings-updated', handleSettingsUpdate as EventListener);
        return () => window.removeEventListener('notification-settings-updated', handleSettingsUpdate as EventListener);
    }, []);

    useEffect(() => {
        setSettings(getNotificationSettings());

        // Check battery status
        if (Capacitor.isNativePlatform()) {
            MediaBridge.checkBatteryOptimization().then(res => {
                setBatteryOptimized(res.isIgnored ? 'ignored' : 'restricted');
            }).catch(() => setBatteryOptimized('restricted'));

            MediaBridge.checkOverlayPermission().then(res => {
                setSettings(prev => prev ? ({ ...prev, overlayGranted: res.granted }) : null);
            }).catch(() => { });

            // Load Gesture Settings
            MediaBridge.getAzhanStopMethods().then(res => {
                setGestureSettings(res);
            }).catch(() => { });
        }

        // Cleanup audio on unmount
        return () => {
            if (currentAudioRef.current) {
                currentAudioRef.current.pause();
                currentAudioRef.current = null;
            }
        };
    }, []);

    const handleSaveAll = async () => {
        if (!settings || isSaving) return; // Prevent double-clicks

        setIsSaving(true);
        setSavingStatus('جاري الحفظ...');

        try {
            updateSalahSettings(settings.salah);
            updateAdhkarSettings(settings.adhkar);
            updateQiyamSettings(settings.qiyam);
            updateFridaySettings(settings.friday);
            updateSalawatSettings(settings.salawat);
            if (settings.ramadan) updateRamadanSettings(settings.ramadan);

            // إعادة جدولة جميع التنبيهات بالإعدادات والأصوات الجديدة
            await scheduleAllNotifications(undefined, false, (progress, status) => {
                setSavingStatus(status);
            });

            setSaved(true);
            setSavingStatus('تم الحفظ بنجاح ✓');
            setTimeout(() => setSaved(false), 2000);
        } catch (e) {
            console.error('Failed to save settings:', e);
            setSavingStatus('حدث خطأ!');
        } finally {
            setIsSaving(false);
        }
    };

    // Force Default Kahf Time Fix (Legacy 9:00 -> 10:00)
    useEffect(() => {
        if (settings && settings.friday.kahfReminder.enabled && settings.friday.kahfReminder.time === '09:00') {
            console.log("Fixing Kahf Default Time: 09:00 -> 10:00");
            setSettings({
                ...settings,
                friday: {
                    ...settings.friday,
                    kahfReminder: { ...settings.friday.kahfReminder, time: '10:00' }
                }
            });
        }
    }, [settings?.friday.kahfReminder.time]);


    const toggleSection = (section: string) => {
        setExpandedSection(prev => {
            const newState = prev === section ? null : section;
            // Scroll to section if opening
            if (newState) {
                setTimeout(() => {
                    const el = document.getElementById(`section-${section}`);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 100);
            }
            return newState;
        });
    };

    if (!settings) return null;

    const ToggleSwitch: React.FC<{ enabled: boolean; onChange: (val: boolean) => void }> = ({ enabled, onChange }) => (
        <button
            onClick={() => onChange(!enabled)}
            className={`relative w-12 h-7 rounded-full transition-all duration-300 shadow-inner ${enabled
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-emerald-500/30'
                : 'bg-navy-200 dark:bg-navy-700'
                }`}
        >
            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${enabled ? 'left-6' : 'left-1'
                }`} />
        </button>
    );

    const SectionHeader: React.FC<{ title: string; icon: React.ReactNode; section: string }> = ({ title, icon, section }) => (
        <button
            id={`section-${section}`}
            onClick={(e) => {
                // Prevent toggling if clicking inside a propagation-stopped child (like picker)
                // (Though picker has stopPropagation, adding check here doesn't hurt)
                toggleSection(section);
            }}
            className={`w-full flex items-center justify-between p-4 md:p-5 rounded-2xl border transition-all duration-300 group
                ${expandedSection === section
                    ? 'bg-white/90 dark:bg-navy-900/90 border-gold-400/50 shadow-lg shadow-gold-500/5'
                    : 'bg-white/60 dark:bg-navy-900/60 border-white/50 dark:border-navy-700 hover:bg-white/80 dark:hover:bg-navy-800/80'
                } backdrop-blur-md`}
        >
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm transition-all duration-300
                    ${expandedSection === section
                        ? 'bg-gradient-to-br from-gold-500 to-amber-600 text-white shadow-gold-500/30 scale-110'
                        : 'bg-gradient-to-br from-gold-50 to-amber-50 dark:from-navy-800 dark:to-navy-750 text-gold-600 dark:text-gold-400'
                    }`}>
                    {icon}
                </div>
                <span className={`font-bold text-lg transition-colors ${expandedSection === section ? 'text-navy-900 dark:text-white' : 'text-navy-700 dark:text-navy-200'}`}>
                    {title}
                </span>
            </div>
            <div className={`p-2 rounded-full transition-all duration-300 ${expandedSection === section ? 'bg-gold-50 text-gold-600 rotate-180' : 'text-navy-400 group-hover:bg-navy-50 dark:group-hover:bg-navy-800'}`}>
                <ChevronDown size={20} />
            </div>
        </button>
    );

    return (
        <div className="flex flex-col min-h-full h-full bg-[#f4f4f5] dark:bg-navy-950 font-sans overflow-hidden">
            <div className="fixed inset-0 pointer-events-none opacity-30 dark:opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-multiply dark:mix-blend-overlay" />

            <TopBar
                title="إعدادات التنبيهات"
                extra={
                    <button
                        onClick={handleSaveAll}
                        disabled={isSaving}
                        className={`flex items-center gap-1.5 px-5 py-2.5 rounded-full font-bold text-xs md:text-sm transition-all duration-200 shadow-sm ${saved
                            ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                            : isSaving
                                ? 'bg-navy-300 dark:bg-navy-700 text-white cursor-wait'
                                : 'bg-gradient-to-r from-gold-500 to-amber-500 text-white hover:shadow-md hover:shadow-gold-500/30'
                            }`}
                    >
                        {isSaving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span className="max-w-[100px] truncate">{savingStatus || 'جاري...'}</span>
                            </>
                        ) : saved ? '✓ تم الحفظ' : <><Save size={14} /> حفظ</>}
                    </button>
                }
            />

            <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-32 landscape:pb-52 custom-scrollbar">
                <div className="max-w-3xl mx-auto space-y-4 md:space-y-5">




                    {/* Salah Section */}
                    <div>
                        <SectionHeader title="تنبيهات الصلاة" icon={<Bell size={20} />} section="salah" />
                        {expandedSection === 'salah' && (
                            <div className="mt-3 p-5 md:p-6 bg-white/70 dark:bg-navy-900/70 backdrop-blur-md rounded-3xl border border-white/50 dark:border-navy-700/50 space-y-5 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="flex items-center justify-between">
                                    <span className="text-navy-700 dark:text-navy-200 font-medium">تفعيل تنبيهات الصلاة</span>
                                    <ToggleSwitch
                                        enabled={settings.salah.enabled}
                                        onChange={(val) => setSettings({ ...settings, salah: { ...settings.salah, enabled: val } })}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-navy-700 dark:text-navy-200 font-medium">تنبيه قبل الصلاة</span>
                                    <ToggleSwitch
                                        enabled={settings.salah.preNotification}
                                        onChange={(val) => setSettings({ ...settings, salah: { ...settings.salah, preNotification: val } })}
                                    />
                                </div>
                                {settings.salah.preNotification && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between bg-navy-50/50 dark:bg-navy-800/50 p-3 rounded-xl">
                                            <span className="text-navy-600 dark:text-navy-300 text-sm font-medium">قبل الصلاة بـ</span>
                                            <MinuteWheelPicker
                                                value={settings.salah.preNotificationMinutes}
                                                onChange={(val) => setSettings({ ...settings, salah: { ...settings.salah, preNotificationMinutes: val } })}
                                                min={1}
                                                max={60}
                                                label="دقيقة"
                                            />
                                        </div>

                                        {/* Pre-Prayer Sound Selection */}
                                        <div className="bg-navy-50/50 dark:bg-navy-800/50 p-4 rounded-xl border border-navy-100 dark:border-navy-700">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-navy-700 dark:text-navy-200 font-bold text-sm">صوت التنبيه</span>
                                                <ToggleSwitch
                                                    enabled={settings.salah.preNotificationSoundEnabled ?? true}
                                                    onChange={(val) => setSettings({ ...settings, salah: { ...settings.salah, preNotificationSoundEnabled: val } })}
                                                />
                                            </div>

                                            {(settings.salah.preNotificationSoundEnabled ?? true) && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {[
                                                        { id: 'alert_prayer_reminder', name: 'الصوت الأول (تنبيه هادئ)', file: 'alert_prayer_reminder.mp3' },
                                                        { id: 'alert_approaching', name: 'الصوت الثاني (اقتراب الصلاة)', file: 'alert_approaching.mp3' }
                                                    ].map((sound) => {
                                                        const isSelected = (settings.salah.preNotificationSound || 'alert_prayer_reminder') === sound.id;
                                                        return (
                                                            <div
                                                                key={sound.id}
                                                                onClick={() => setSettings({ ...settings, salah: { ...settings.salah, preNotificationSound: sound.id } })}
                                                                className={`relative p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${isSelected
                                                                    ? 'bg-gold-50 dark:bg-gold-900/10 border-gold-500 shadow-sm'
                                                                    : 'bg-white dark:bg-navy-800 border-navy-200 dark:border-navy-700 hover:border-gold-300'
                                                                    }`}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-gold-500 bg-gold-500' : 'border-navy-300'}`}>
                                                                        {isSelected && <Check size={10} className="text-white" />}
                                                                    </div>
                                                                    <span className={`text-xs font-bold ${isSelected ? 'text-navy-800 dark:text-gold-100' : 'text-navy-600 dark:text-navy-300'}`}>
                                                                        {sound.name}
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        togglePreview(sound.id, sound.file);
                                                                    }}
                                                                    className={`relative p-2 rounded-full transition-all duration-300 flex items-center justify-center ${playingAudioId === sound.id
                                                                        ? 'bg-gradient-to-br from-gold-500 to-amber-500 text-white shadow-lg shadow-gold-500/30 animate-pulse'
                                                                        : 'bg-navy-100 dark:bg-navy-700 text-navy-500 dark:text-navy-300 hover:text-gold-600 hover:bg-gold-100 dark:hover:bg-gold-900/30'
                                                                        }`}
                                                                >
                                                                    {/* Sound Wave Animation for Playing State */}
                                                                    {playingAudioId === sound.id && (
                                                                        <div className="absolute -right-4 flex gap-0.5">
                                                                            <span className="w-0.5 h-2 bg-gold-400 rounded-full animate-[soundwave_0.4s_ease-in-out_infinite]" />
                                                                            <span className="w-0.5 h-3 bg-gold-400 rounded-full animate-[soundwave_0.4s_ease-in-out_infinite_0.1s]" />
                                                                            <span className="w-0.5 h-2 bg-gold-400 rounded-full animate-[soundwave_0.4s_ease-in-out_infinite_0.2s]" />
                                                                        </div>
                                                                    )}
                                                                    {playingAudioId === sound.id ? (
                                                                        <Square size={12} fill="currentColor" />
                                                                    ) : (
                                                                        <Play size={14} fill="currentColor" />
                                                                    )}
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Azhan Volume Slider - Enhanced Professional Design */}
                                <div className="pt-4 border-t border-navy-100 dark:border-navy-800">
                                    <div className="bg-gradient-to-br from-gold-50 to-amber-50 dark:from-navy-800/50 dark:to-navy-900/50 p-4 rounded-2xl border border-gold-100 dark:border-navy-700">
                                        {/* Header */}
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2.5 bg-gradient-to-br from-gold-500 to-amber-500 rounded-xl text-white shadow-lg shadow-gold-500/20">
                                                <Volume2 size={20} />
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-bold text-navy-800 dark:text-white text-sm">صوت الأذان</h4>
                                                <p className="text-[10px] text-navy-500 dark:text-navy-400">متصل بمستوى صوت المنبه في الجهاز</p>
                                            </div>
                                            <span className="text-lg font-bold text-gold-600 dark:text-gold-400 bg-white dark:bg-navy-800 px-3 py-1.5 rounded-xl shadow-sm">
                                                {settings.salah.azhanVolume ?? 80}%
                                            </span>
                                        </div>

                                        {/* Volume Slider with Icons - RTL Fixed - Matched Downloads.tsx Style */}
                                        <div className="flex items-center gap-3">
                                            <Volume2 size={18} className="text-gold-500 flex-shrink-0" />
                                            <div className="flex-1 relative" style={{ direction: 'ltr' }}>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    step="5"
                                                    value={settings.salah.azhanVolume ?? 80}
                                                    onChange={(e) => setSettings({ ...settings, salah: { ...settings.salah, azhanVolume: Number(e.target.value) } })}
                                                    className="w-full h-2.5 rounded-full appearance-none cursor-pointer"
                                                    style={{
                                                        background: `linear-gradient(to right, #D97706 0%, #F59E0B ${settings.salah.azhanVolume ?? 80}%, ${document.documentElement.classList.contains('dark') ? '#1f2937' : '#e5e7eb'} ${settings.salah.azhanVolume ?? 80}%, ${document.documentElement.classList.contains('dark') ? '#1f2937' : '#e5e7eb'} 100%)`
                                                    }}
                                                />
                                            </div>
                                            <VolumeX size={18} className="text-navy-400 dark:text-navy-500 flex-shrink-0" />
                                        </div>

                                        {/* Info Badge */}
                                        <div className="mt-4 p-2.5 bg-white/60 dark:bg-navy-900/60 backdrop-blur-sm rounded-xl flex items-start gap-2">
                                            <span className="text-amber-500 flex-shrink-0 mt-0.5">💡</span>
                                            <p className="text-[10px] text-navy-600 dark:text-navy-300 leading-relaxed">
                                                هذا الإعداد يتحكم في صوت الأذان بشكل مستقل، ويستخدم قناة صوت المنبه للعمل حتى في وضع "عدم الإزعاج".
                                            </p>
                                        </div>

                                        {/* Reset Button */}
                                        {(settings.salah.azhanVolume ?? 80) !== 80 && (
                                            <button
                                                onClick={() => setSettings({ ...settings, salah: { ...settings.salah, azhanVolume: 80 } })}
                                                className="mt-3 w-full py-2.5 px-4 bg-navy-50 dark:bg-navy-800 hover:bg-navy-100 dark:hover:bg-navy-700 text-navy-600 dark:text-navy-300 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 border border-navy-100 dark:border-navy-700"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                                                إعادة تعيين الافتراضي (80%)
                                            </button>
                                        )}
                                    </div>

                                    {/* Muazzin Selection (Using Unified AzhanModal) - Enhanced with Current Display */}
                                    <div className="mt-4 p-4 bg-gradient-to-r from-gold-50/50 via-amber-50/50 to-gold-50/50 dark:from-navy-800/80 dark:via-navy-850/80 dark:to-navy-800/80 rounded-2xl border border-gold-200/50 dark:border-navy-700">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-400 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-gold-500/30">
                                                <Volume2 size={20} />
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-bold text-sm text-navy-900 dark:text-white">صوت المؤذن</h4>
                                                <p className="text-[10px] text-navy-500 dark:text-navy-400">اختر المؤذن واستمع للمعاينة</p>
                                            </div>
                                            <button
                                                onClick={() => setShowAzhanPreview(true)}
                                                className="px-4 py-2 bg-gold-500 hover:bg-gold-600 text-white rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center gap-2"
                                            >
                                                <Play size={14} fill="currentColor" />
                                                معاينة
                                            </button>
                                        </div>

                                        {/* Current Muazzin Display Badge */}
                                        <div className="flex items-center justify-between bg-white dark:bg-navy-900 rounded-xl p-3 border border-gold-200/50 dark:border-navy-700">
                                            <span className="text-xs font-bold text-navy-500 dark:text-navy-400">المؤذن الحالي</span>
                                            <span className="text-sm font-bold text-gold-700 dark:text-gold-400 bg-gold-50 dark:bg-gold-900/20 px-3 py-1 rounded-lg">
                                                {MUAZZINS.find(m => m.id === getStoredAzhan())?.name || 'غير محدد'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Per-Prayer Customization */}
                                    <div className="mt-4 pt-4 border-t border-navy-100 dark:border-navy-700">
                                        {/* Header with Toggle */}
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                                                    <Settings2 size={16} />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-sm text-navy-800 dark:text-white">تخصيص المؤذن لكل صلاة</h4>
                                                    <p className="text-[10px] text-navy-400 dark:text-navy-500">اختر مؤذناً مختلفاً لكل صلاة</p>
                                                </div>
                                            </div>
                                            <ToggleSwitch
                                                enabled={perPrayerEnabled}
                                                onChange={async (val) => {
                                                    setPerPrayerEnabled(val);
                                                    setPerPrayerMuazzinEnabled(val);
                                                    // Reschedule to apply changes
                                                    await scheduleAllNotifications();
                                                }}
                                            />
                                        </div>

                                        {/* Feature Disabled Info */}
                                        {!perPrayerEnabled && (
                                            <div className="p-3 bg-navy-50 dark:bg-navy-800/50 rounded-xl border border-navy-100 dark:border-navy-700 text-center">
                                                <p className="text-xs text-navy-500 dark:text-navy-400">
                                                    عند إيقاف هذه الميزة، سيُستخدم المؤذن العام لجميع الصلوات
                                                </p>
                                                <p className="text-[10px] text-navy-400 dark:text-navy-500 mt-1">
                                                    المؤذن الحالي: <span className="font-bold text-gold-600">{MUAZZINS.find(m => m.id === getStoredAzhan())?.name}</span>
                                                </p>
                                            </div>
                                        )}

                                        {/* Prayer List - Only show when enabled */}
                                        {perPrayerEnabled && (
                                            <div className="space-y-2">
                                                {[
                                                    { key: 'fajr', name: 'الفجر', icon: '🌙' },
                                                    { key: 'dhuhr', name: 'الظهر', icon: '☀️' },
                                                    { key: 'asr', name: 'العصر', icon: '🌤️' },
                                                    { key: 'maghrib', name: 'المغرب', icon: '🌅' },
                                                    { key: 'isha', name: 'العشاء', icon: '🌌' },
                                                ].map((prayer) => {
                                                    const currentId = getStoredAzhanForPrayer(prayer.key);
                                                    const isRandom = currentId === 'random';
                                                    const globalId = getStoredAzhan();
                                                    const isUsingGlobal = currentId === globalId;
                                                    const muazzinName = MUAZZINS.find(m => m.id === currentId)?.name || 'غير محدد';

                                                    return (
                                                        <button
                                                            key={prayer.key}
                                                            onClick={() => setSelectedPrayerForAzhan(prayer.key)}
                                                            className="w-full p-3 bg-white dark:bg-navy-900/50 rounded-xl border border-navy-100 dark:border-navy-700 flex items-center justify-between hover:border-gold-300 transition-colors group"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-lg group-hover:scale-110 transition-transform">{prayer.icon}</span>
                                                                <div className="text-right">
                                                                    <span className="block text-xs font-bold text-navy-800 dark:text-white">{prayer.name}</span>
                                                                    <span className={`text-[10px] ${isRandom ? 'text-indigo-500 font-bold' : isUsingGlobal ? 'text-navy-400' : 'text-gold-600 font-bold'}`}>
                                                                        {isRandom ? '🔀 عشوائي' : isUsingGlobal ? `📢 ${muazzinName} (العام)` : `✨ ${muazzinName}`}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="px-3 py-1.5 bg-navy-50 dark:bg-navy-800 rounded-lg text-[10px] font-bold text-navy-600 dark:text-navy-300 group-hover:bg-gold-500 group-hover:text-white transition-colors">
                                                                تغيير
                                                            </div>
                                                        </button>
                                                    );
                                                })}


                                                {/* Reset All Button */}
                                                <button
                                                    onClick={async () => {
                                                        clearAzhanSpecificSettings();
                                                        await scheduleAllNotifications();
                                                        // Force UI refresh
                                                        setSettings({ ...settings });
                                                        if (navigator.vibrate) navigator.vibrate(30);
                                                    }}
                                                    className="mt-4 w-full py-3 px-4 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                                                >
                                                    <RotateCcw size={16} />
                                                    إعادة تعيين الكل (استخدام المؤذن العام)
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Azhan Stop Methods Settings */}
                                    <div className="mt-4 pt-4 border-t border-navy-100 dark:border-navy-700">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                                                    <ShieldCheck size={16} />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-sm text-navy-800 dark:text-white">طرق إيقاف الأذان (الذكية)</h4>
                                                    <p className="text-[10px] text-navy-400 dark:text-navy-500">اختر الوسائل المفضلة لإيقاف الأذان</p>
                                                </div>
                                            </div>
                                            <ToggleSwitch
                                                enabled={gestureSettings.masterEnabled}
                                                onChange={async (val) => {
                                                    const newSettings = { ...gestureSettings, masterEnabled: val };
                                                    setGestureSettings(newSettings);
                                                    if (Capacitor.isNativePlatform()) {
                                                        await MediaBridge.setAzhanStopMethods({ masterEnabled: val });
                                                    }
                                                }}
                                            />
                                        </div>

                                        {gestureSettings.masterEnabled && (
                                            <div className="space-y-2 mt-3 p-3 bg-navy-50/50 dark:bg-navy-800/30 rounded-xl border border-navy-100 dark:border-navy-700">
                                                <div className="flex items-center justify-between p-2 hover:bg-white dark:hover:bg-navy-800 rounded-lg transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-lg">🔄</span>
                                                        <div>
                                                            <span className="block text-xs font-bold text-navy-700 dark:text-navy-200">قلب الجهاز</span>
                                                            <span className="text-[10px] text-navy-500">إيقاف بقلب الموبايل على وجهه</span>
                                                        </div>
                                                    </div>
                                                    <ToggleSwitch
                                                        enabled={gestureSettings.flipEnabled}
                                                        onChange={async (val) => {
                                                            const newSettings = { ...gestureSettings, flipEnabled: val };
                                                            setGestureSettings(newSettings);
                                                            if (Capacitor.isNativePlatform()) {
                                                                await MediaBridge.setAzhanStopMethods({ flipEnabled: val });
                                                            }
                                                        }}
                                                    />
                                                </div>


                                                <div className="flex items-center justify-between p-2 hover:bg-white dark:hover:bg-navy-800 rounded-lg transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-lg">🔉</span>
                                                        <div>
                                                            <span className="block text-xs font-bold text-navy-700 dark:text-navy-200">زر خفض الصوت</span>
                                                            <span className="text-[10px] text-navy-500">إيقاف بالضغط على زر الصوت الجانبي</span>
                                                        </div>
                                                    </div>
                                                    <ToggleSwitch
                                                        enabled={gestureSettings.volumeEnabled}
                                                        onChange={async (val) => {
                                                            const newSettings = { ...gestureSettings, volumeEnabled: val };
                                                            setGestureSettings(newSettings);
                                                            if (Capacitor.isNativePlatform()) {
                                                                await MediaBridge.setAzhanStopMethods({ volumeEnabled: val });
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Adhkar Section */}
                    <div>
                        <SectionHeader title="تنبيهات الأذكار" icon={<BookOpen size={20} />} section="adhkar" />
                        {expandedSection === 'adhkar' && (
                            <div className="mt-2 p-5 md:p-6 bg-white/70 dark:bg-navy-900/70 backdrop-blur-md rounded-3xl border border-white/50 dark:border-navy-700/50 space-y-5 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Sunrise size={18} className="text-amber-500" />
                                        <span className="text-navy-700 dark:text-navy-200">أذكار الصباح</span>
                                    </div>
                                    <ToggleSwitch
                                        enabled={settings.adhkar.morning.enabled}
                                        onChange={(val) => setSettings({ ...settings, adhkar: { ...settings.adhkar, morning: { ...settings.adhkar.morning, enabled: val } } })}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Sunset size={18} className="text-orange-500" />
                                        <span className="text-navy-700 dark:text-navy-200">أذكار المساء</span>
                                    </div>
                                    <ToggleSwitch
                                        enabled={settings.adhkar.evening.enabled}
                                        onChange={(val) => setSettings({ ...settings, adhkar: { ...settings.adhkar, evening: { ...settings.adhkar.evening, enabled: val } } })}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Moon size={18} className="text-indigo-500" />
                                        <span className="text-navy-700 dark:text-navy-200">أذكار النوم</span>
                                    </div>
                                    <ToggleSwitch
                                        enabled={settings.adhkar.sleep.enabled}
                                        onChange={(val) => setSettings({ ...settings, adhkar: { ...settings.adhkar, sleep: { ...settings.adhkar.sleep, enabled: val } } })}
                                    />
                                </div>
                                {settings.adhkar.sleep.enabled && (
                                    <div className="flex items-center justify-between bg-navy-50/50 dark:bg-navy-800/50 p-3 rounded-xl">
                                        <span className="text-navy-600 dark:text-navy-300 text-sm font-medium">موعد التذكير</span>
                                        <ArabicTimePicker
                                            value={settings.adhkar.sleep.time}
                                            onChange={(val) => setSettings({ ...settings, adhkar: { ...settings.adhkar, sleep: { ...settings.adhkar.sleep, time: val } } })}
                                            label="أذكار النوم"
                                        />
                                    </div>
                                )}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Bell size={18} className="text-emerald-500" />
                                        <span className="text-navy-700 dark:text-navy-200">أذكار ما بعد الصلاة</span>
                                    </div>
                                    <ToggleSwitch
                                        enabled={settings.adhkar.afterPrayer.enabled}
                                        onChange={(val) => setSettings({ ...settings, adhkar: { ...settings.adhkar, afterPrayer: { ...settings.adhkar.afterPrayer, enabled: val } } })}
                                    />
                                </div>

                                {/* After Prayer Delay Settings - Professional Expandable */}
                                {settings.adhkar.afterPrayer.enabled && (
                                    <div className="mt-4 p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-navy-800/50 dark:to-navy-900/50 rounded-xl border border-emerald-200 dark:border-navy-700 space-y-4">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                                                <Clock size={18} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-sm text-navy-800 dark:text-white">توقيت التذكير بعد كل صلاة</h4>
                                                <p className="text-[10px] text-navy-500 dark:text-navy-400">اختر المدة بالدقائق بعد انتهاء الصلاة</p>
                                            </div>
                                        </div>

                                        {/* Prayer Delay Grid */}
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            {[
                                                { key: 'fajr' as const, name: 'الفجر', icon: '🌙' },
                                                { key: 'dhuhr' as const, name: 'الظهر', icon: '☀️' },
                                                { key: 'asr' as const, name: 'العصر', icon: '🌤️' },
                                                { key: 'maghrib' as const, name: 'المغرب', icon: '🌅' },
                                                { key: 'isha' as const, name: 'العشاء', icon: '🌌' },
                                            ].map(prayer => (
                                                <div key={prayer.key} className="bg-white dark:bg-navy-800 p-3 rounded-xl border border-navy-100 dark:border-navy-700">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-sm">{prayer.icon}</span>
                                                        <span className="text-xs font-bold text-navy-700 dark:text-navy-200">{prayer.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => {
                                                                const current = settings.adhkar.afterPrayer.delayMinutes[prayer.key];
                                                                if (current > 1) {
                                                                    setSettings({
                                                                        ...settings,
                                                                        adhkar: {
                                                                            ...settings.adhkar,
                                                                            afterPrayer: {
                                                                                ...settings.adhkar.afterPrayer,
                                                                                delayMinutes: {
                                                                                    ...settings.adhkar.afterPrayer.delayMinutes,
                                                                                    [prayer.key]: current - 1
                                                                                }
                                                                            }
                                                                        }
                                                                    });
                                                                }
                                                            }}
                                                            className="w-8 h-8 bg-navy-100 dark:bg-navy-700 rounded-lg text-navy-600 dark:text-navy-300 font-bold hover:bg-navy-200 dark:hover:bg-navy-600 transition-colors"
                                                        >
                                                            -
                                                        </button>
                                                        <div className="flex-1 text-center">
                                                            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                                                {(() => {
                                                                    const num = settings.adhkar.afterPrayer.delayMinutes[prayer.key];
                                                                    const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
                                                                    return String(num).split('').map(d => arabicNums[parseInt(d)]).join('');
                                                                })()}
                                                            </span>
                                                            <span className="text-[10px] text-navy-500 dark:text-navy-400 block">دقيقة</span>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                const current = settings.adhkar.afterPrayer.delayMinutes[prayer.key];
                                                                if (current < 30) {
                                                                    setSettings({
                                                                        ...settings,
                                                                        adhkar: {
                                                                            ...settings.adhkar,
                                                                            afterPrayer: {
                                                                                ...settings.adhkar.afterPrayer,
                                                                                delayMinutes: {
                                                                                    ...settings.adhkar.afterPrayer.delayMinutes,
                                                                                    [prayer.key]: current + 1
                                                                                }
                                                                            }
                                                                        }
                                                                    });
                                                                }
                                                            }}
                                                            className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400 font-bold hover:bg-emerald-200 dark:hover:bg-emerald-800/50 transition-colors"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Friday Special Timing */}
                                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/10 p-3 rounded-xl border border-amber-200 dark:border-amber-800/50">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-sm">🕌</span>
                                                    <span className="text-xs font-bold text-amber-700 dark:text-amber-300">الجمعة</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            const current = settings.adhkar.afterPrayer.fridayDhuhrDelay;
                                                            if (current > 1) {
                                                                setSettings({
                                                                    ...settings,
                                                                    adhkar: {
                                                                        ...settings.adhkar,
                                                                        afterPrayer: {
                                                                            ...settings.adhkar.afterPrayer,
                                                                            fridayDhuhrDelay: current - 1
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        }}
                                                        className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400 font-bold hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-colors"
                                                    >
                                                        -
                                                    </button>
                                                    <div className="flex-1 text-center">
                                                        <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                                                            {(() => {
                                                                const num = settings.adhkar.afterPrayer.fridayDhuhrDelay;
                                                                const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
                                                                return String(num).split('').map(d => arabicNums[parseInt(d)]).join('');
                                                            })()}
                                                        </span>
                                                        <span className="text-[10px] text-amber-600 dark:text-amber-400 block">دقيقة</span>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            const current = settings.adhkar.afterPrayer.fridayDhuhrDelay;
                                                            if (current < 90) {
                                                                setSettings({
                                                                    ...settings,
                                                                    adhkar: {
                                                                        ...settings.adhkar,
                                                                        afterPrayer: {
                                                                            ...settings.adhkar.afterPrayer,
                                                                            fridayDhuhrDelay: current + 1
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        }}
                                                        className="w-8 h-8 bg-amber-200 dark:bg-amber-800/50 rounded-lg text-amber-700 dark:text-amber-300 font-bold hover:bg-amber-300 dark:hover:bg-amber-700/50 transition-colors"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <p className="text-[10px] text-emerald-700 dark:text-emerald-300 bg-white/50 dark:bg-navy-900/50 p-2 rounded-lg text-center">
                                            💡 يُستحب قراءة أذكار ما بعد الصلاة مباشرة بعد التسليم
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Qiyam Section */}
                    <div>
                        <SectionHeader title="قيام الليل" icon={<Moon size={20} />} section="qiyam" />
                        {expandedSection === 'qiyam' && (
                            <div className="mt-2 p-5 md:p-6 bg-white/70 dark:bg-navy-900/70 backdrop-blur-md rounded-3xl border border-white/50 dark:border-navy-700/50 space-y-4 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="flex items-center justify-between">
                                    <span className="text-navy-700 dark:text-navy-200">تفعيل تذكير قيام الليل</span>
                                    <ToggleSwitch
                                        enabled={settings.qiyam.enabled}
                                        onChange={(val) => setSettings({ ...settings, qiyam: { ...settings.qiyam, enabled: val } })}
                                    />
                                </div>
                                {settings.qiyam.enabled && (
                                    <div className="flex items-center justify-between bg-navy-50/50 dark:bg-navy-800/50 p-3 rounded-xl">
                                        <span className="text-navy-600 dark:text-navy-300 text-sm font-medium">قبل الفجر بـ</span>
                                        <MinuteWheelPicker
                                            value={settings.qiyam.minutesBeforeFajr}
                                            onChange={(val) => setSettings({ ...settings, qiyam: { ...settings.qiyam, minutesBeforeFajr: val } })}
                                            min={15}
                                            max={120}
                                            step={5}
                                            label="دقيقة"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Friday Section */}
                    <div>
                        <SectionHeader title="تذكيرات الجمعة" icon={<Sun size={20} />} section="friday" />
                        {expandedSection === 'friday' && (
                            <div className="mt-2 p-5 md:p-6 bg-white/70 dark:bg-navy-900/70 backdrop-blur-md rounded-3xl border border-white/50 dark:border-navy-700/50 space-y-5 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                                {/* Kahf Reminder Toggle */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">📖</span>
                                        <span className="text-navy-700 dark:text-navy-200 font-medium">تذكير سورة الكهف</span>
                                    </div>
                                    <ToggleSwitch
                                        enabled={settings.friday.kahfReminder.enabled}
                                        onChange={(val) => setSettings({ ...settings, friday: { ...settings.friday, kahfReminder: { ...settings.friday.kahfReminder, enabled: val } } })}
                                    />
                                </div>

                                {/* Kahf Time Picker - only show when enabled */}
                                {settings.friday.kahfReminder.enabled && (
                                    <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-navy-800/50 dark:to-navy-900/50 rounded-xl border border-emerald-100 dark:border-navy-700">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                                                    <Clock size={18} />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-sm text-navy-800 dark:text-white">موعد التذكير</h4>
                                                    <p className="text-[10px] text-navy-500 dark:text-navy-400">يوم الجمعة</p>
                                                </div>
                                            </div>
                                            <ArabicTimePicker
                                                key={`kahf-picker-${settings.friday.kahfReminder.time}`} // Force re-render to ensure auto-scroll works
                                                value={settings.friday.kahfReminder.time || '10:00'}
                                                onChange={(val) => setSettings({
                                                    ...settings,
                                                    friday: {
                                                        ...settings.friday,
                                                        kahfReminder: { ...settings.friday.kahfReminder, time: val }
                                                    }
                                                })}
                                                label="سورة الكهف"
                                            />
                                        </div>
                                        <p className="mt-3 text-[10px] text-emerald-700 dark:text-emerald-300 bg-white/50 dark:bg-navy-900/50 p-2 rounded-lg">
                                            💡 يُستحب قراءة سورة الكهف يوم الجمعة. «من قرأ سورة الكهف في يوم الجمعة أضاء له من النور ما بين الجمعتين»
                                        </p>
                                    </div>
                                )}

                                {/* Dua Hour Toggle */}
                                <div className="flex items-center justify-between pt-2 border-t border-navy-100 dark:border-navy-800">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">🤲</span>
                                        <span className="text-navy-700 dark:text-navy-200 font-medium">تذكير ساعة الاستجابة</span>
                                    </div>
                                    <ToggleSwitch
                                        enabled={settings.friday.duaHour.enabled}
                                        onChange={(val) => setSettings({ ...settings, friday: { ...settings.friday, duaHour: { ...settings.friday.duaHour, enabled: val } } })}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Salawat Section */}
                    <div>
                        <SectionHeader title="الصلاة على النبي ﷺ" icon={<span className="text-lg">🤲</span>} section="salawat" />
                        {expandedSection === 'salawat' && (
                            <div className="mt-2 p-5 md:p-6 bg-white/70 dark:bg-navy-900/70 backdrop-blur-md rounded-3xl border border-white/50 dark:border-navy-700/50 space-y-6 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                                {/* Header Toggle */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-navy-700 dark:text-navy-200 font-bold block mb-1">تفعيل التذكير</span>
                                        <p className="text-[10px] text-navy-500 dark:text-navy-400">تنبيهات صوتية للصلاة على النبي ﷺ على مدار اليوم</p>
                                    </div>
                                    <ToggleSwitch
                                        enabled={settings.salawat?.enabled ?? false}
                                        onChange={(val) => setSettings({ ...settings, salawat: { ...settings.salawat, enabled: val } })}
                                    />
                                </div>

                                {settings.salawat?.enabled && (
                                    <>
                                        {/* Mode Selection Tabs */}
                                        <div className="space-y-3">
                                            <label className="text-sm font-bold text-navy-700 dark:text-navy-200">نوع التكرار</label>
                                            <div className="grid grid-cols-2 gap-2 p-1 bg-navy-100 dark:bg-navy-800 rounded-xl">
                                                {[
                                                    { id: 'hourly' as const, label: 'ساعي', icon: '⏰' },
                                                    { id: 'daily' as const, label: 'يومي', icon: '📅' }
                                                ].map((mode) => {
                                                    const isSelected = (settings.salawat?.mode ?? 'daily') === mode.id;
                                                    return (
                                                        <button
                                                            key={mode.id}
                                                            onClick={() => setSettings({ ...settings, salawat: { ...settings.salawat, mode: mode.id } })}
                                                            className={`py-3 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${isSelected
                                                                ? 'bg-white dark:bg-navy-900 text-gold-600 shadow-sm'
                                                                : 'text-navy-500 dark:text-navy-400 hover:text-navy-700'
                                                                }`}
                                                        >
                                                            <span>{mode.icon}</span>
                                                            <span>تكرار {mode.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Hourly Mode Frequency */}
                                        {(settings.salawat?.mode ?? 'daily') === 'hourly' && (
                                            <div className="space-y-3 pt-4 border-t border-navy-100 dark:border-navy-800">
                                                <label className="text-sm font-bold text-navy-700 dark:text-navy-200">عدد المرات كل ساعة</label>
                                                <div className="grid grid-cols-4 gap-2">
                                                    {[1, 2, 3, 4].map((count) => {
                                                        const isSelected = (settings.salawat?.timesPerHour ?? 1) === count;
                                                        return (
                                                            <button
                                                                key={count}
                                                                onClick={() => setSettings({ ...settings, salawat: { ...settings.salawat, timesPerHour: count } })}
                                                                className={`py-3 rounded-xl border transition-all text-xs font-bold ${isSelected
                                                                    ? 'bg-gold-500 text-white border-gold-500 shadow-md shadow-gold-500/20'
                                                                    : 'bg-white dark:bg-navy-800 text-navy-600 dark:text-navy-300 border-navy-200 dark:border-navy-700 hover:border-gold-300'
                                                                    }`}
                                                            >
                                                                {count} {count === 1 ? 'مرة' : 'مرات'}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                {/* Hourly Total Display */}
                                                <div className="p-3 bg-gradient-to-br from-gold-50 to-amber-50 dark:from-navy-800/50 dark:to-navy-900/50 rounded-xl flex items-center justify-between border border-gold-200 dark:border-navy-700">
                                                    <span className="text-sm text-navy-600 dark:text-navy-300 font-medium">المجموع اليومي التقريبي</span>
                                                    <span className="text-lg font-bold text-gold-600 dark:text-gold-400">
                                                        {(() => {
                                                            const startH = parseInt((settings.salawat?.startTime || SALAWAT_DEFAULTS.START_TIME).split(':')[0]);
                                                            const endH = parseInt((settings.salawat?.endTime || SALAWAT_DEFAULTS.END_TIME).split(':')[0]);
                                                            // Handle cross-day logic (e.g. 22:00 to 05:00)
                                                            const duration = endH >= startH ? (endH - startH) : (24 - startH + endH);
                                                            const count = (settings.salawat?.timesPerHour ?? 1) * duration;
                                                            return `${count} تذكير`;
                                                        })()}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-navy-500 dark:text-navy-400 text-center">
                                                    (محسوبة بناءً على {(() => {
                                                        const startH = parseInt((settings.salawat?.startTime || SALAWAT_DEFAULTS.START_TIME).split(':')[0]);
                                                        const endH = parseInt((settings.salawat?.endTime || SALAWAT_DEFAULTS.END_TIME).split(':')[0]);
                                                        const duration = endH >= startH ? (endH - startH) : (24 - startH + endH);
                                                        return duration;
                                                    })()} ساعة نشاط)
                                                </p>
                                            </div>
                                        )}

                                        {/* Daily Mode Frequency */}
                                        {(settings.salawat?.mode ?? 'daily') === 'daily' && (
                                            <div className="space-y-3 pt-4 border-t border-navy-100 dark:border-navy-800">
                                                <label className="text-sm font-bold text-navy-700 dark:text-navy-200">عدد التذكيرات في اليوم</label>
                                                <div className="grid grid-cols-4 gap-2">
                                                    {[1, 3, 5, 10].map((count) => {
                                                        const isSelected = (settings.salawat?.timesPerDay ?? 3) === count;
                                                        return (
                                                            <button
                                                                key={count}
                                                                onClick={() => setSettings({ ...settings, salawat: { ...settings.salawat, timesPerDay: count } })}
                                                                className={`py-3 rounded-xl border transition-all text-xs font-bold ${isSelected
                                                                    ? 'bg-gold-500 text-white border-gold-500 shadow-md shadow-gold-500/20'
                                                                    : 'bg-white dark:bg-navy-800 text-navy-600 dark:text-navy-300 border-navy-200 dark:border-navy-700 hover:border-gold-300'
                                                                    }`}
                                                            >
                                                                {count} {count === 1 ? 'مرة' : (count > 2 && count < 11) ? 'مرات' : 'مرة'}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Avoid Prayer Times Toggle */}
                                        <div className="pt-4 border-t border-navy-100 dark:border-navy-800">
                                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-between border border-blue-200 dark:border-blue-800">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg">🕌</span>
                                                    <div>
                                                        <span className="text-sm font-bold text-navy-700 dark:text-navy-200 block">تجنب أوقات الصلاة</span>
                                                        <p className="text-[10px] text-navy-500 dark:text-navy-400">لا يتعارض مع الأذان أو تنبيهات الصلاة</p>
                                                    </div>
                                                </div>
                                                <ToggleSwitch
                                                    enabled={settings.salawat?.avoidPrayerTimes ?? true}
                                                    onChange={(val) => setSettings({ ...settings, salawat: { ...settings.salawat, avoidPrayerTimes: val } })}
                                                />
                                            </div>
                                        </div>

                                        {/* Start and End Time Selection */}
                                        <div className="space-y-4 pt-4 border-t border-navy-100 dark:border-navy-800">
                                            <label className="text-sm font-bold text-navy-700 dark:text-navy-200">فترة التنبيهات (ساعات النشاط)</label>

                                            {/* Responsive Grid: Stacks on mobile, Side-by-side on larger screens */}
                                            <div className="flex flex-col sm:flex-row gap-4">

                                                {/* Start Time */}
                                                <div className="flex-1 bg-white dark:bg-navy-800 p-4 rounded-2xl border border-navy-200 dark:border-navy-700 shadow-sm">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-xs font-bold text-navy-500 dark:text-navy-400">يبدأ من</span>
                                                        <span className="text-xs text-gold-600 bg-gold-50 dark:bg-navy-900 px-2 py-1 rounded-lg">
                                                            {(() => {
                                                                const [h] = (settings.salawat?.startTime || SALAWAT_DEFAULTS.START_TIME).split(':').map(Number);
                                                                const period = h >= 12 ? 'مساءً' : 'صباحاً';
                                                                const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
                                                                return `${h12} ${period}`;
                                                            })()}
                                                        </span>
                                                    </div>
                                                    <div className="w-full">
                                                        <ArabicTimePicker
                                                            value={settings.salawat?.startTime || SALAWAT_DEFAULTS.START_TIME}
                                                            onChange={(val) => setSettings({ ...settings, salawat: { ...settings.salawat, startTime: val } })}
                                                            label="وقت البدء"
                                                        />
                                                    </div>
                                                </div>

                                                {/* End Time */}
                                                <div className="flex-1 bg-white dark:bg-navy-800 p-4 rounded-2xl border border-navy-200 dark:border-navy-700 shadow-sm">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-xs font-bold text-navy-500 dark:text-navy-400">يتوقف عند</span>
                                                        <span className="text-xs text-gold-600 bg-gold-50 dark:bg-navy-900 px-2 py-1 rounded-lg">
                                                            {(() => {
                                                                const [h] = (settings.salawat?.endTime || SALAWAT_DEFAULTS.END_TIME).split(':').map(Number);
                                                                const period = h >= 12 ? 'مساءً' : 'صباحاً';
                                                                const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
                                                                return `${h12} ${period}`;
                                                            })()}
                                                        </span>
                                                    </div>
                                                    <div className="w-full">
                                                        <ArabicTimePicker
                                                            value={settings.salawat?.endTime || SALAWAT_DEFAULTS.END_TIME}
                                                            onChange={(val) => setSettings({ ...settings, salawat: { ...settings.salawat, endTime: val } })}
                                                            label="وقت التوقف"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <p className="text-[10px] text-navy-500 dark:text-navy-400 text-center bg-navy-50/50 dark:bg-navy-900/50 p-2 rounded-xl">
                                                سيتم إيقاف التنبيهات تلقائياً خارج هذه الفترة لضمان راحتك ونومك الهادئ
                                            </p>
                                        </div>

                                        {/* Sound Settings */}
                                        <div className="space-y-3 pt-4 border-t border-navy-100 dark:border-navy-800">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 bg-gold-100 dark:bg-gold-900/30 rounded-lg text-gold-600">
                                                        <Volume2 size={16} />
                                                    </div>
                                                    <span className="text-sm font-bold text-navy-700 dark:text-navy-200">تشغيل الصوت</span>
                                                </div>
                                                <ToggleSwitch
                                                    enabled={settings.salawat?.soundEnabled ?? true}
                                                    onChange={(val) => setSettings({ ...settings, salawat: { ...settings.salawat, soundEnabled: val } })}
                                                />
                                            </div>

                                            {(settings.salawat?.soundEnabled ?? true) && (
                                                <div className="grid grid-cols-1 gap-3 mt-3">
                                                    {[
                                                        { id: 'random', name: 'تشغيل عشوائي', file: 'salawat_one.mp3' }, // Preview uses sound 1 (overridden by togglePreview)
                                                        { id: 'salawat_one', name: 'الصوت الأول', file: 'salawat_one.mp3' },
                                                        { id: 'salawat_two', name: 'الصوت الثاني', file: 'salawat_two.mp3' },
                                                        { id: 'salawat_three', name: 'الصوت الثالث', file: 'salawat_three.mp3' },
                                                        { id: 'salawat_four', name: 'الصوت الرابع', file: 'salawat_four.mp3' },
                                                        { id: 'salawat_five', name: 'الصوت الخامس', file: 'salawat_five.mp3' },
                                                    ].map((sound) => {
                                                        const isSelected = (settings.salawat?.selectedSound ?? 'salawat_one') === sound.id;
                                                        return (
                                                            <div
                                                                key={sound.id}
                                                                onClick={() => setSettings({ ...settings, salawat: { ...settings.salawat, selectedSound: sound.id } })}
                                                                className={`relative p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${isSelected
                                                                    ? 'bg-gold-50 dark:bg-gold-900/10 border-gold-500 shadow-sm'
                                                                    : 'bg-white dark:bg-navy-800 border-navy-200 dark:border-navy-700 hover:border-gold-300'
                                                                    }`}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-gold-500 bg-gold-500' : 'border-navy-300 dark:border-navy-600'}`}>
                                                                        {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
                                                                    </div>
                                                                    <div>
                                                                        <span className={`block text-sm font-bold ${isSelected ? 'text-navy-900 dark:text-white' : 'text-navy-700 dark:text-navy-200'}`}>
                                                                            {sound.name}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        togglePreview(sound.id, sound.file);
                                                                    }}
                                                                    className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm ${playingAudioId === sound.id
                                                                        ? 'bg-gradient-to-br from-gold-500 to-amber-500 text-white shadow-lg shadow-gold-500/30'
                                                                        : 'bg-navy-50 dark:bg-navy-700 text-navy-600 dark:text-navy-300 hover:bg-gold-500 hover:text-white'
                                                                        }`}
                                                                >
                                                                    {/* Pulsing Ring for Playing State */}
                                                                    {playingAudioId === sound.id && (
                                                                        <span className="absolute inset-0 rounded-full bg-gold-400/30 animate-ping" />
                                                                    )}
                                                                    {/* Sound Wave Animation */}
                                                                    {playingAudioId === sound.id && (
                                                                        <div className="absolute -right-4 flex gap-0.5">
                                                                            <span className="w-0.5 h-2.5 bg-gold-500 rounded-full animate-[soundwave_0.5s_ease-in-out_infinite]" style={{ animationDelay: '0ms' }} />
                                                                            <span className="w-0.5 h-4 bg-gold-500 rounded-full animate-[soundwave_0.5s_ease-in-out_infinite]" style={{ animationDelay: '100ms' }} />
                                                                            <span className="w-0.5 h-2.5 bg-gold-500 rounded-full animate-[soundwave_0.5s_ease-in-out_infinite]" style={{ animationDelay: '200ms' }} />
                                                                        </div>
                                                                    )}
                                                                    {playingAudioId === sound.id ? (
                                                                        <Square size={16} fill="currentColor" className="relative z-10" />
                                                                    ) : (
                                                                        <Play size={18} fill="currentColor" className="ml-0.5 relative z-10" />
                                                                    )}
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-2 p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl flex items-start gap-2 border border-emerald-100 dark:border-emerald-800/30">
                                            <span className="text-emerald-500 text-opacity-80 mt-0.5">✨</span>
                                            <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed font-medium">
                                                {(settings.salawat?.mode ?? 'daily') === 'hourly'
                                                    ? `سيتم إرسال ${(settings.salawat?.timesPerHour ?? 1)} تنبيه/ساعة خلال فترة نشاطك (${settings.salawat?.startTime || SALAWAT_DEFAULTS.START_TIME} - ${settings.salawat?.endTime || SALAWAT_DEFAULTS.END_TIME}).`
                                                    : 'يتم توزيع التذكيرات ذكياً خلال ساعات النشاط المحددة.'
                                                }
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 🌙 Ramadan Special Section */}
                    <div>
                        <SectionHeader title="تنبيهات رمضان" icon={<Moon size={20} />} section="ramadan" />
                        {expandedSection === 'ramadan' && (
                            <div className="mt-3 p-5 md:p-6 bg-white/70 dark:bg-navy-900/70 backdrop-blur-md rounded-3xl border border-white/50 dark:border-navy-700/50 space-y-5 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">

                                {/* Ramadan Header Info */}
                                <div className="p-4 bg-gradient-to-br from-indigo-50 via-purple-50 to-indigo-50 dark:from-indigo-900/20 dark:via-purple-900/20 dark:to-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-2xl">🌙</span>
                                        <div>
                                            <h4 className="font-bold text-indigo-800 dark:text-indigo-200 text-sm">تنبيهات شهر رمضان المبارك</h4>
                                            <p className="text-[10px] text-indigo-600 dark:text-indigo-400">تُفعّل تلقائياً خلال شهر رمضان فقط</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-indigo-700 dark:text-indigo-300 bg-white/50 dark:bg-navy-900/50 p-2 rounded-lg">
                                        💡 هذه الإشعارات تعمل فقط عندما يكون التاريخ الهجري في شهر رمضان (الشهر التاسع).
                                    </p>
                                </div>

                                {/* Suhoor Reminder */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">🍽️</span>
                                            <div>
                                                <span className="text-navy-700 dark:text-navy-200 font-bold">تذكير السحور</span>
                                                <p className="text-[10px] text-navy-500 dark:text-navy-400">قبل أذان الفجر</p>
                                            </div>
                                        </div>
                                        <ToggleSwitch
                                            enabled={settings.ramadan?.suhoorReminder?.enabled ?? false}
                                            onChange={(val) => setSettings({
                                                ...settings,
                                                ramadan: {
                                                    ...settings.ramadan,
                                                    suhoorReminder: { ...settings.ramadan?.suhoorReminder, enabled: val, minutesBefore: settings.ramadan?.suhoorReminder?.minutesBefore ?? 60 }
                                                }
                                            })}
                                        />
                                    </div>

                                    {settings.ramadan?.suhoorReminder?.enabled && (
                                        <div className="flex items-center justify-between bg-navy-50/50 dark:bg-navy-800/50 p-3 rounded-xl">
                                            <span className="text-navy-600 dark:text-navy-300 text-sm font-medium">قبل الفجر بـ</span>
                                            <MinuteWheelPicker
                                                value={settings.ramadan?.suhoorReminder?.minutesBefore ?? 60}
                                                onChange={(val) => setSettings({
                                                    ...settings,
                                                    ramadan: {
                                                        ...settings.ramadan,
                                                        suhoorReminder: { ...settings.ramadan?.suhoorReminder, enabled: true, minutesBefore: val }
                                                    }
                                                })}
                                                min={30}
                                                max={120}
                                                label="دقيقة"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Iftar Reminder */}
                                <div className="space-y-3 pt-4 border-t border-navy-100 dark:border-navy-800">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">🌅</span>
                                            <div>
                                                <span className="text-navy-700 dark:text-navy-200 font-bold">تذكير الإفطار</span>
                                                <p className="text-[10px] text-navy-500 dark:text-navy-400">قبل أذان المغرب</p>
                                            </div>
                                        </div>
                                        <ToggleSwitch
                                            enabled={settings.ramadan?.iftarReminder?.enabled ?? false}
                                            onChange={(val) => setSettings({
                                                ...settings,
                                                ramadan: {
                                                    ...settings.ramadan,
                                                    iftarReminder: { ...settings.ramadan?.iftarReminder, enabled: val, minutesBefore: settings.ramadan?.iftarReminder?.minutesBefore ?? 10 }
                                                }
                                            })}
                                        />
                                    </div>

                                    {settings.ramadan?.iftarReminder?.enabled && (
                                        <div className="flex items-center justify-between bg-navy-50/50 dark:bg-navy-800/50 p-3 rounded-xl">
                                            <span className="text-navy-600 dark:text-navy-300 text-sm font-medium">قبل المغرب بـ</span>
                                            <MinuteWheelPicker
                                                value={settings.ramadan?.iftarReminder?.minutesBefore ?? 10}
                                                onChange={(val) => setSettings({
                                                    ...settings,
                                                    ramadan: {
                                                        ...settings.ramadan,
                                                        iftarReminder: { ...settings.ramadan?.iftarReminder, enabled: true, minutesBefore: val }
                                                    }
                                                })}
                                                min={5}
                                                max={30}
                                                label="دقيقة"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Last Ten Nights */}
                                <div className="space-y-3 pt-4 border-t border-navy-100 dark:border-navy-800">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">✨</span>
                                            <div>
                                                <span className="text-navy-700 dark:text-navy-200 font-bold">العشر الأواخر</span>
                                                <p className="text-[10px] text-navy-500 dark:text-navy-400">تذكير خاص بليالي القدر المحتملة</p>
                                            </div>
                                        </div>
                                        <ToggleSwitch
                                            enabled={settings.ramadan?.lastTenNights?.enabled ?? false}
                                            onChange={(val) => setSettings({
                                                ...settings,
                                                ramadan: {
                                                    ...settings.ramadan,
                                                    lastTenNights: { enabled: val }
                                                }
                                            })}
                                        />
                                    </div>

                                    {settings.ramadan?.lastTenNights?.enabled && (
                                        <div className="p-3 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-xl border border-amber-200 dark:border-amber-800/50">
                                            <p className="text-xs text-amber-800 dark:text-amber-200">
                                                <span className="font-bold">✨ الليالي الفردية (21، 23، 25، 27، 29)</span>: رسالة خاصة تشجّع على التحري
                                            </p>
                                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                                <span className="font-bold">🌙 الليالي الشفعية</span>: تذكير بالإكثار من الدعاء والاستغفار
                                            </p>
                                            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2">
                                                يُرسل التذكير بعد صلاة العشاء بساعة واحدة
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Info Banner */}
                                <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-start gap-2 border border-emerald-100 dark:border-emerald-800/30">
                                    <span className="text-emerald-500 mt-0.5">💚</span>
                                    <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
                                        «من صام رمضان إيماناً واحتساباً غُفر له ما تقدم من ذنبه» - متفق عليه
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Prayer Calculation Settings Section */}
                    <div>
                        <SectionHeader title="إعدادات حساب المواقيت" icon={<Calculator size={20} />} section="calculation" />
                        {expandedSection === 'calculation' && (
                            <div className="mt-3 p-5 md:p-6 bg-white/70 dark:bg-navy-900/70 backdrop-blur-md rounded-3xl border border-white/50 dark:border-navy-700/50 space-y-5 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">

                                {/* Calculation Method */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Globe size={16} className="text-gold-500" />
                                        <span className="font-bold text-navy-800 dark:text-white text-sm">طريقة الحساب</span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {[
                                            { id: 'egyptian' as const, name: 'المصرية', desc: 'مصر وأفريقيا' },
                                            { id: 'umm_al_qura' as const, name: 'أم القرى', desc: 'السعودية' },
                                            { id: 'muslim_world_league' as const, name: 'رابطة العالم', desc: 'أوروبا وعالمي' },
                                            { id: 'isna' as const, name: 'ISNA', desc: 'أمريكا الشمالية' },
                                            { id: 'karachi' as const, name: 'كراتشي', desc: 'باكستان والهند' },
                                            { id: 'dubai' as const, name: 'دبي', desc: 'الإمارات' },
                                            { id: 'qatar' as const, name: 'قطر', desc: 'قطر' },
                                            { id: 'kuwait' as const, name: 'الكويت', desc: 'الكويت' },
                                            { id: 'turkey' as const, name: 'تركيا', desc: 'ديانت' },
                                            { id: 'singapore' as const, name: 'سنغافورة', desc: 'جنوب شرق آسيا' },
                                            { id: 'tehran' as const, name: 'طهران', desc: 'إيران' },
                                            { id: 'moonsighting' as const, name: 'رؤية الهلال', desc: 'خطوط العرض العالية' },
                                        ].map((method) => {
                                            const isSelected = calcMethod === method.id;
                                            return (
                                                <button
                                                    key={method.id}
                                                    onClick={() => {
                                                        setCalcMethod(method.id);
                                                        setCalculationMethod(method.id);
                                                    }}
                                                    className={`p-3 rounded-xl border transition-all text-right ${isSelected
                                                        ? 'bg-gold-50 dark:bg-gold-900/20 border-gold-500 shadow-sm'
                                                        : 'bg-white dark:bg-navy-800 border-navy-200 dark:border-navy-700 hover:border-gold-300'
                                                        }`}
                                                >
                                                    <span className={`block text-xs font-bold ${isSelected ? 'text-gold-700 dark:text-gold-400' : 'text-navy-700 dark:text-navy-200'}`}>
                                                        {method.name}
                                                    </span>
                                                    <span className="block text-[10px] text-navy-400 dark:text-navy-500 mt-0.5">
                                                        {method.desc}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Madhab Selection */}
                                <div className="pt-4 border-t border-navy-100 dark:border-navy-800 space-y-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <MapPin size={16} className="text-emerald-500" />
                                        <span className="font-bold text-navy-800 dark:text-white text-sm">حساب العصر (المذهب)</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { id: 'shafi' as const, name: 'الشافعي والمالكي والحنبلي', desc: 'ظل الشيء = طوله' },
                                            { id: 'hanafi' as const, name: 'الحنفي', desc: 'ظل الشيء = ضعف طوله' },
                                        ].map((m) => {
                                            const isSelected = madhab === m.id;
                                            return (
                                                <button
                                                    key={m.id}
                                                    onClick={() => {
                                                        setMadhabState(m.id);
                                                        setMadhab(m.id);
                                                    }}
                                                    className={`p-4 rounded-xl border transition-all text-right ${isSelected
                                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 shadow-sm'
                                                        : 'bg-white dark:bg-navy-800 border-navy-200 dark:border-navy-700 hover:border-emerald-300'
                                                        }`}
                                                >
                                                    <span className={`block text-sm font-bold ${isSelected ? 'text-emerald-700 dark:text-emerald-400' : 'text-navy-700 dark:text-navy-200'}`}>
                                                        {m.name}
                                                    </span>
                                                    <span className="block text-[10px] text-navy-400 dark:text-navy-500 mt-1">
                                                        {m.desc}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Manual Adjustments Section */}
                                    <div className="pt-4 border-t border-navy-100 dark:border-navy-800 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Clock size={16} className="text-amber-500" />
                                                <span className="font-bold text-navy-800 dark:text-white text-sm">تعديلات يدوية (دقائق)</span>
                                            </div>
                                            {Object.values(adjustments).some(v => v !== 0) && (
                                                <button
                                                    onClick={() => {
                                                        const reset = { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };
                                                        setAdjustments(reset);
                                                        resetPrayerAdjustments();
                                                    }}
                                                    className="text-[10px] text-red-500 hover:text-red-600 font-bold flex items-center gap-1"
                                                >
                                                    ↺ إعادة تعيين
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-navy-400 dark:text-navy-500 -mt-2">
                                            اضبط المواقيت لتتوافق مع مسجدك المحلي (من -30 إلى +30 دقيقة)
                                        </p>

                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            {[
                                                { key: 'fajr' as const, name: 'الفجر', icon: '🌅', color: 'indigo' },
                                                { key: 'sunrise' as const, name: 'الشروق', icon: '☀️', color: 'amber' },
                                                { key: 'dhuhr' as const, name: 'الظهر', icon: '🌞', color: 'yellow' },
                                                { key: 'asr' as const, name: 'العصر', icon: '🌤️', color: 'orange' },
                                                { key: 'maghrib' as const, name: 'المغرب', icon: '🌅', color: 'rose' },
                                                { key: 'isha' as const, name: 'العشاء', icon: '🌙', color: 'purple' },
                                            ].map((prayer) => {
                                                const value = adjustments[prayer.key];
                                                return (
                                                    <div
                                                        key={prayer.key}
                                                        className={`p-3 rounded-xl border transition-all ${value !== 0
                                                            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
                                                            : 'bg-white dark:bg-navy-800 border-navy-200 dark:border-navy-700'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className="text-sm">{prayer.icon}</span>
                                                            <span className="text-xs font-bold text-navy-700 dark:text-navy-200">{prayer.name}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <button
                                                                onClick={() => {
                                                                    if (value > -30) {
                                                                        const newAdj = { ...adjustments, [prayer.key]: value - 1 };
                                                                        setAdjustments(newAdj);
                                                                        setPrayerAdjustments(newAdj);
                                                                    }
                                                                }}
                                                                disabled={value <= -30}
                                                                className="w-8 h-8 rounded-lg bg-navy-100 dark:bg-navy-700 text-navy-600 dark:text-navy-300 font-bold text-lg flex items-center justify-center hover:bg-navy-200 dark:hover:bg-navy-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                            >
                                                                −
                                                            </button>
                                                            <span className={`text-sm font-bold min-w-[40px] text-center ${value > 0 ? 'text-emerald-600' : value < 0 ? 'text-amber-600' : 'text-navy-500 dark:text-navy-400'}`}>
                                                                {value > 0 ? `+${value}` : value}
                                                            </span>
                                                            <button
                                                                onClick={() => {
                                                                    if (value < 30) {
                                                                        const newAdj = { ...adjustments, [prayer.key]: value + 1 };
                                                                        setAdjustments(newAdj);
                                                                        setPrayerAdjustments(newAdj);
                                                                    }
                                                                }}
                                                                disabled={value >= 30}
                                                                className="w-8 h-8 rounded-lg bg-navy-100 dark:bg-navy-700 text-navy-600 dark:text-navy-300 font-bold text-lg flex items-center justify-center hover:bg-navy-200 dark:hover:bg-navy-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Usage hint */}
                                        <div className="p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800/50">
                                            <p className="text-[10px] text-amber-700 dark:text-amber-300 text-center">
                                                💡 التعديلات تُطبق على جميع حسابات المواقيت والتنبيهات
                                            </p>
                                        </div>
                                    </div>

                                    {/* High Latitude Info */}
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                                        <div className="flex items-start gap-2">
                                            <span className="text-blue-500">🌍</span>
                                            <div>
                                                <h4 className="text-xs font-bold text-blue-800 dark:text-blue-200">دعم خطوط العرض العالية</h4>
                                                <p className="text-[10px] text-blue-600 dark:text-blue-300 mt-1">
                                                    يتم تطبيق قواعد خاصة تلقائياً للمناطق الشمالية (السويد، كندا، إلخ) لضمان مواقيت صحيحة حتى في فترات الليل القصير.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-navy-500 text-center">
                                        يستخدم لضبط الاختلافات في رؤية الهلال عن تقويم أم القرى.
                                        {hijriAdj !== 0 && " (التعديل اليدوي يلغي التصحيح التلقائي)"}
                                    </p>
                                </div>

                            </div>
                        )}
                    </div>

                    {/* Location Settings Section */}
                    <div>
                        <SectionHeader title="إعدادات الموقع" icon={<MapPin size={20} />} section="location" />
                        {expandedSection === 'location' && (
                            <div className="mt-3 p-5 md:p-6 bg-white/70 dark:bg-navy-900/70 backdrop-blur-md rounded-3xl border border-white/50 dark:border-navy-700/50 space-y-5 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">

                                {/* Current Location Display */}
                                <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/10 rounded-xl border border-emerald-200 dark:border-emerald-800">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                                                <MapPin size={20} className="text-white" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-navy-800 dark:text-white text-sm">
                                                    {isManualLocation ? 'الموقع اليدوي' : 'الموقع التلقائي (GPS)'}
                                                </h4>
                                                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                                    {manualLoc?.cityName || localStorage.getItem('user_location_name') || 'غير محدد'}
                                                </p>
                                            </div>
                                        </div>
                                        {isManualLocation && (
                                            <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold rounded-full">
                                                يدوي
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* GPS or Manual Choice */}
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => {
                                            LocationManager.clearManualLocation();
                                            setIsManualLocation(false);
                                        }}
                                        className={`p-4 rounded-xl border transition-all text-center ${!isManualLocation
                                            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500'
                                            : 'bg-white dark:bg-navy-800 border-navy-200 dark:border-navy-700'
                                            }`}
                                    >
                                        <Navigation size={24} className={`mx-auto mb-2 ${!isManualLocation ? 'text-emerald-600' : 'text-navy-400'}`} />
                                        <span className={`block text-sm font-bold ${!isManualLocation ? 'text-emerald-700 dark:text-emerald-400' : 'text-navy-600 dark:text-navy-300'}`}>
                                            GPS تلقائي
                                        </span>
                                        <span className="text-[10px] text-navy-400">يُحدد موقعك تلقائياً</span>
                                    </button>

                                    <button
                                        onClick={() => setShowCitySelector(true)}
                                        className={`p-4 rounded-xl border transition-all text-center ${isManualLocation
                                            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-500'
                                            : 'bg-white dark:bg-navy-800 border-navy-200 dark:border-navy-700'
                                            }`}
                                    >
                                        <Globe size={24} className={`mx-auto mb-2 ${isManualLocation ? 'text-amber-600' : 'text-navy-400'}`} />
                                        <span className={`block text-sm font-bold ${isManualLocation ? 'text-amber-700 dark:text-amber-400' : 'text-navy-600 dark:text-navy-300'}`}>
                                            اختيار يدوي
                                        </span>
                                        <span className="text-[10px] text-navy-400">اختر مدينتك من القائمة</span>
                                    </button>
                                </div>

                                {/* Info */}
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800/50">
                                    <p className="text-[10px] text-blue-700 dark:text-blue-300 text-center">
                                        💡 اختر الموقع اليدوي إذا كان GPS لا يعمل بشكل صحيح
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Hijri Calendar Settings */}
                    <div>
                        <SectionHeader title="إعدادات التاريخ الهجري" icon={<Calendar size={20} />} section="hijri" />
                        {expandedSection === 'hijri' && (
                            <div className="mt-3 p-5 md:p-6 bg-white/70 dark:bg-navy-900/70 backdrop-blur-md rounded-3xl border border-white/50 dark:border-navy-700/50 space-y-5 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                                {/* Current Date Preview */}
                                <div className="p-4 bg-gradient-to-br from-gold-50 to-amber-50 dark:from-navy-800/50 dark:to-navy-900/50 rounded-xl border border-gold-200 dark:border-navy-700 text-center">
                                    <h4 className="text-xs font-bold text-navy-500 dark:text-navy-400 mb-1">التاريخ الحالي في التطبيق</h4>
                                    <p className="text-lg md:text-xl font-bold text-navy-800 dark:text-white" dir="rtl">
                                        {formatHijriDate(gregorianToHijri(new Date()))}
                                    </p>
                                </div>

                                {/* Adjustment Control */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-bold text-navy-800 dark:text-white">تصحيح التاريخ الهجري (يدوي)</label>
                                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${isManualOverride ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : hijriAdj === 0 ? 'bg-navy-100 dark:bg-navy-800 text-navy-600 dark:text-navy-300' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'}`}>
                                            {isManualOverride 
                                                ? `يدوي: ${hijriAdj > 0 ? '+' : ''}${hijriAdj} يوم` 
                                                : hijriAdj === 0 
                                                    ? 'افتراضي/تلقائي' 
                                                    : `تلقائي: ${hijriAdj > 0 ? '+' : ''}${hijriAdj} يوم`}
                                        </span>
                                    </div>

                                    <div className="p-4 bg-navy-50 dark:bg-navy-950/50 rounded-xl flex items-center justify-between gap-4">
                                        <button
                                            onClick={() => {
                                                if (hijriAdj > -2) {
                                                    const newVal = hijriAdj - 1;
                                                    setHijriAdj(newVal);
                                                    setHijriAdjustment(newVal);
                                                    setIsManualOverride(newVal !== 0);
                                                }
                                            }}
                                            disabled={hijriAdj <= -2}
                                            className="w-10 h-10 rounded-lg bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-700 flex items-center justify-center text-navy-600 dark:text-navy-300 hover:border-gold-500 disabled:opacity-50 disabled:hover:border-navy-200 transition-all font-bold text-lg"
                                        >
                                            -
                                        </button>

                                        <div className="flex-1 relative h-2 bg-navy-200 dark:bg-navy-800 rounded-full overflow-hidden">
                                            {/* Background markers */}
                                            <div className="absolute inset-0 flex justify-between px-1 z-0">
                                                <span className="w-0.5 h-full bg-white/50 dark:bg-navy-700"></span>
                                                <span className="w-0.5 h-full bg-white/50 dark:bg-navy-700"></span>
                                                <span className="w-0.5 h-full bg-white/50 dark:bg-navy-700"></span>
                                                <span className="w-0.5 h-full bg-white/50 dark:bg-navy-700"></span>
                                                <span className="w-0.5 h-full bg-white/50 dark:bg-navy-700"></span>
                                            </div>
                                            {/* Active Bar */}
                                            <div className="absolute top-0 bottom-0 right-1/2 bg-gold-500 transition-all duration-300 z-10"
                                                style={{
                                                    width: `${Math.abs(hijriAdj) * 25}%`,
                                                    right: hijriAdj >= 0 ? '50%' : 'auto',
                                                    left: hijriAdj < 0 ? '50%' : 'auto',
                                                    transformOrigin: 'center'
                                                }}>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => {
                                                if (hijriAdj < 2) {
                                                    const newVal = hijriAdj + 1;
                                                    setHijriAdj(newVal);
                                                    setHijriAdjustment(newVal);
                                                    setIsManualOverride(newVal !== 0);
                                                }
                                            }}
                                            disabled={hijriAdj >= 2}
                                            className="w-10 h-10 rounded-lg bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-700 flex items-center justify-center text-navy-600 dark:text-navy-300 hover:border-gold-500 disabled:opacity-50 disabled:hover:border-navy-200 transition-all font-bold text-lg"
                                        >
                                            +
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-navy-500 dark:text-navy-400 leading-relaxed text-center">
                                        يستخدم هذا الإعداد لتعديل التاريخ يدوياً في حال اختلاف رؤية الهلال عن التقويم الفلكي.
                                    </p>
                                </div>

                                {/* Auto Sync Feature */}
                                <div className="space-y-3 pt-4 border-t border-navy-100 dark:border-navy-800">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="text-sm font-bold text-navy-800 dark:text-white">المزامنة التلقائية للتاريخ الهجري</h4>
                                            <p className="text-[10px] text-navy-500 mt-1">يستخدم بيانات دار الإفتاء المصرية</p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const newVal = !autoSyncEnabled;
                                                setAutoSyncEnabled(newVal);
                                                setAutoSyncEnabledState(newVal);
                                            }}
                                            className={`relative w-12 h-6 rounded-full transition-colors ${autoSyncEnabled ? 'bg-gold-500' : 'bg-navy-200 dark:bg-navy-700'}`}
                                        >
                                            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${autoSyncEnabled ? 'translate-x-6' : 'translate-x-0'}`}></span>
                                        </button>
                                    </div>
                                    
                                    {autoSyncEnabled && isManualOverride && (
                                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800/30">
                                            <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                                                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                                                <p className="text-[10px] leading-relaxed">
                                                    <strong className="font-bold">المزامنة التلقائية معطلة حالياً</strong><br />
                                                    النظام الآن يعمل بـ (الضبط اليدوي). لعودة المزامنة التلقائية مع دار الإفتاء، اضغط على "مزامنة الآن" أو قُم بتصفير الضبط اليدوي.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {autoSyncEnabled && (
                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/30">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-bold text-blue-800 dark:text-blue-300">حالة المزامنة:</span>
                                                {syncResult ? (
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${syncResult.success ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'}`}>
                                                        {syncResult.success ? 'متزامن ✅' : 'خطأ ❌'}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-navy-100 text-navy-600 dark:bg-navy-800 dark:text-navy-400">
                                                        {isSyncing ? 'جاري الفحص ⏳' : 'لم يتم الفحص بعد'}
                                                    </span>
                                                )}
                                            </div>
                                            
                                            {syncResult && syncResult.success && (
                                                <div className="text-[10px] space-y-1 text-blue-700 dark:text-blue-400 mt-2 p-2 bg-white/50 dark:bg-navy-950/50 rounded-lg">
                                                    <div className="flex justify-between">
                                                        <span>تاريخ الإفتاء:</span>
                                                        <span dir="rtl">{syncResult.apiDate?.day} {syncResult.apiDate?.month} {syncResult.apiDate?.year}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>قيمة التصحيح:</span>
                                                        <span dir="ltr" className="font-mono">{syncResult.appliedAdjustment !== undefined ? `${syncResult.appliedAdjustment > 0 ? '+' : ''}${syncResult.appliedAdjustment}` : '0'} يوم</span>
                                                    </div>
                                                    <div className="flex justify-between text-navy-400 mt-1 border-t border-blue-200/50 dark:border-blue-800/50 pt-1">
                                                        <span>آخر فحص:</span>
                                                        <span>{new Date(syncResult.timestamp).toLocaleString('ar')}</span>
                                                    </div>
                                                </div>
                                            )}
                                            

                                            <button
                                                onClick={async () => {
                                                    setIsSyncing(true);
                                                    const res = await forceSyncHijriDate();
                                                    setSyncResult(res);
                                                    setIsManualOverride(false);
                                                    setHijriAdj(getHijriAdjustment()); // Update UI
                                                    setIsSyncing(false);
                                                }}
                                                disabled={isSyncing}
                                                className="mt-3 w-full py-2 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-100 text-xs font-bold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-colors hover:bg-blue-200 dark:hover:bg-blue-700"
                                            >
                                                {isSyncing ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                                مزامنة الآن
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* City Selector Modal */}
                    {showCitySelector && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm" onClick={() => setShowCitySelector(false)}></div>
                            <div className="relative w-full max-w-md md:max-w-lg bg-white dark:bg-navy-900 rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">

                                {/* Modal Header */}
                                <div className="p-4 border-b border-navy-100 dark:border-navy-800 bg-gradient-to-r from-gold-50 to-amber-50 dark:from-navy-900 dark:to-navy-950">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-bold text-lg text-navy-900 dark:text-white flex items-center gap-2">
                                            <Globe size={20} className="text-gold-500" />
                                            اختر مدينتك
                                        </h3>
                                        <button onClick={() => setShowCitySelector(false)} className="p-2 hover:bg-navy-100 dark:hover:bg-navy-800 rounded-full">
                                            <X size={20} className="text-navy-500" />
                                        </button>
                                    </div>

                                    {/* Search Input */}
                                    <div className="relative">
                                        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400" />
                                        <input
                                            type="text"
                                            placeholder="ابحث عن مدينتك..."
                                            value={citySearchQuery}
                                            onChange={(e) => setCitySearchQuery(e.target.value)}
                                            className="w-full pr-10 pl-4 py-3 bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                                        />
                                    </div>
                                </div>

                                {/* Cities List */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {(() => {
                                        const filtered = POPULAR_CITIES.filter(city =>
                                            city.nameAr.includes(citySearchQuery) ||
                                            city.name.toLowerCase().includes(citySearchQuery.toLowerCase()) ||
                                            city.countryAr.includes(citySearchQuery)
                                        );

                                        // Group by country
                                        const grouped = filtered.reduce((acc, city) => {
                                            if (!acc[city.countryAr]) acc[city.countryAr] = [];
                                            acc[city.countryAr].push(city);
                                            return acc;
                                        }, {} as Record<string, CityData[]>);

                                        return Object.entries(grouped).map(([country, cities]) => (
                                            <div key={country}>
                                                <h4 className="text-xs font-bold text-navy-500 dark:text-navy-400 mb-2 sticky top-0 bg-white dark:bg-navy-900 py-1">
                                                    🏳️ {country}
                                                </h4>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {cities.map((city) => (
                                                        <button
                                                            key={`${city.name}-${city.country}`}
                                                            onClick={() => {
                                                                LocationManager.setManualLocation(city);
                                                                setIsManualLocation(true);
                                                                setShowCitySelector(false);
                                                                setCitySearchQuery('');
                                                            }}
                                                            className="p-3 bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-700 rounded-xl text-right hover:border-gold-400 hover:bg-gold-50 dark:hover:bg-gold-900/10 transition-all"
                                                        >
                                                            <span className="block text-sm font-bold text-navy-800 dark:text-white">{city.nameAr}</span>
                                                            <span className="text-[10px] text-navy-400">{city.name}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Info Card */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                        <div className="flex items-start gap-3">
                            <Settings2 size={20} className="text-blue-500 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-blue-800 dark:text-blue-200 mb-1">ملاحظة</h4>
                                <p className="text-sm text-blue-600 dark:text-blue-300">
                                    التنبيهات تعمل بناءً على مواقيت الصلاة لموقعك الحالي. تأكد من تفعيل خدمات الموقع للحصول على مواقيت دقيقة.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Troubleshooting Section - Enhanced with Diagnostics */}
                    <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/10 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                        {/* Main Diagnostics Button */}
                        <button
                            onClick={() => navigate('/azhan-diagnostics')}
                            className="w-full p-4 bg-white dark:bg-navy-900/80 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-4 hover:shadow-md transition-all group"
                        >
                            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
                                <ShieldCheck size={24} />
                            </div>
                            <div className="flex-1 text-right">
                                <h4 className="font-bold text-navy-900 dark:text-white">التحقق من إعدادات الأذان</h4>
                                <p className="text-[11px] text-navy-500 dark:text-navy-400 mt-0.5">فحص شامل لجميع الأذونات والإعدادات المطلوبة</p>
                            </div>
                            <ChevronLeft size={20} className="text-navy-300 dark:text-navy-500 group-hover:text-emerald-500 transition-colors" />
                        </button>

                        {/* Secondary Buttons Row */}
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={() => setShowPermissionWizard(true)}
                                className="flex-1 py-2.5 px-3 bg-white dark:bg-navy-800 border border-emerald-200 dark:border-navy-700 rounded-xl text-navy-700 dark:text-navy-300 text-xs font-bold shadow-sm hover:bg-emerald-50 dark:hover:bg-navy-700 transition-colors"
                            >
                                معالج الإذونات
                            </button>

                            {batteryOptimized === 'ignored' ? (
                                <div className="flex-1 py-2.5 px-3 bg-emerald-100 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 rounded-xl text-emerald-700 dark:text-emerald-200 text-xs font-bold shadow-sm flex items-center justify-center gap-1 cursor-default">
                                    <Check size={16} /> استثناء البطارية مفعل
                                </div>
                            ) : (
                                <button
                                    onClick={async () => {
                                        try {
                                            const res = await MediaBridge.requestBatteryOptimizationBypass();
                                            if (res && res.alreadyIgnored) {
                                                setBatteryOptimized('ignored');
                                            } else {
                                                setTimeout(() => {
                                                    MediaBridge.checkBatteryOptimization().then(r => setBatteryOptimized(r.isIgnored ? 'ignored' : 'restricted'));
                                                }, 1000);
                                            }
                                        } catch (e) {
                                            console.error("Battery optimization request failed", e);
                                            try {
                                                await MediaBridge.openAppSettings();
                                            } catch (err) {
                                                alert("تعذر فتح الإعدادات تلقائياً. يرجى الذهاب لإعدادات الهاتف > التطبيقات > البيان > البطارية.");
                                            }
                                        }
                                    }}
                                    className="flex-1 py-2.5 px-3 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-xl text-amber-700 dark:text-amber-300 text-xs font-bold shadow-sm hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors flex items-center justify-center gap-1"
                                >
                                    <span>⚡</span> إلغاء قيود البطارية
                                </button>
                            )}
                        </div>
                    </div>


                    {/* Reliability & Battery Section - Moved to Bottom */}
                    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-navy-800/80 dark:to-navy-900/80 p-5 rounded-2xl border border-indigo-100 dark:border-navy-700 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

                        <div className="flex items-center gap-4 mb-4 relative">
                            <div className="min-w-[48px] h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                                <ShieldCheck size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-navy-900 dark:text-white">الموثوقية والبطارية</h3>
                                <p className="text-xs text-navy-500 dark:text-navy-400 leading-relaxed max-w-md">
                                    لضمان انطلاق الأذان في وقته بالضبط (بدون تأخير ٣-٥ دقائق)، يرجى منح الإذنات التالية.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3 relative z-10">
                            {/* 1. Battery Optimization */}
                            <div className="bg-white dark:bg-navy-900 rounded-xl p-3 border border-indigo-100/50 dark:border-navy-700 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${batteryOptimized === 'ignored' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                        {batteryOptimized === 'ignored' ? <Check size={16} /> : <Settings2 size={16} />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-navy-800 dark:text-white">تحسين البطارية</p>
                                        <p className="text-[10px] text-navy-500">منع النظام من تأخير الأذان</p>
                                    </div>
                                </div>
                                {batteryOptimized === 'ignored' ? (
                                    <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-lg border border-emerald-100">مفعل ✓</span>
                                ) : (
                                    <button
                                        onClick={async () => {
                                            if (Capacitor.isNativePlatform()) {
                                                await MediaBridge.requestBatteryOptimizationBypass();
                                                setTimeout(async () => {
                                                    const res = await MediaBridge.checkBatteryOptimization();
                                                    setBatteryOptimized(res.isIgnored ? 'ignored' : 'restricted');
                                                }, 2000); // Check after delay
                                            }
                                        }}
                                        className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] font-bold rounded-lg shadow-sm transition-colors"
                                    >
                                        إصلاح
                                    </button>
                                )}
                            </div>

                            {/* 2. Overlay Permission (Display Over Apps) */}
                            <div className="bg-white dark:bg-navy-900 rounded-xl p-3 border border-indigo-100/50 dark:border-navy-700 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${settings.overlayGranted ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                        {settings.overlayGranted ? <Check size={16} /> : <Settings2 size={16} />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-navy-800 dark:text-white">الظهور فوق التطبيقات</p>
                                        <p className="text-[10px] text-navy-500">لتشغيل شاشة الأذان من الخلفية</p>
                                    </div>
                                </div>
                                {settings.overlayGranted ? (
                                    <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-lg border border-emerald-100">مفعل ✓</span>
                                ) : (
                                    <button
                                        onClick={async () => {
                                            if (Capacitor.isNativePlatform()) {
                                                await MediaBridge.requestOverlayPermission();
                                                // Check loop
                                                const check = setInterval(async () => {
                                                    const res = await MediaBridge.checkOverlayPermission();
                                                    if (res.granted) {
                                                        setSettings(prev => prev ? ({ ...prev, overlayGranted: true }) : null);
                                                        clearInterval(check);
                                                    }
                                                }, 1000);
                                                setTimeout(() => clearInterval(check), 15000); // Timeout 15s
                                            }
                                        }}
                                        className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] font-bold rounded-lg shadow-sm transition-colors"
                                    >
                                        تفعيل
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Permission Wizard Logic */}
            <PermissionGate
                isOpen={showPermissionWizard}
                onClose={() => setShowPermissionWizard(false)}
            />


            {/* Unified Azhan Preview Modal */}
            {
                (showAzhanPreview || selectedPrayerForAzhan) && (
                    <AzhanModal
                        prayerName={selectedPrayerForAzhan
                            ? (selectedPrayerForAzhan === 'fajr' ? 'أذان الفجر' :
                                selectedPrayerForAzhan === 'dhuhr' ? 'أذان الظهر' :
                                    selectedPrayerForAzhan === 'asr' ? 'أذان العصر' :
                                        selectedPrayerForAzhan === 'maghrib' ? 'أذان المغرب' : 'أذان العشاء')
                            : "معاينة / تغيير الأذان العام"}
                        prayerTime={new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: false })}

                        initialAzhanId={selectedPrayerForAzhan
                            ? getStoredAzhanForPrayer(selectedPrayerForAzhan)
                            : undefined}

                        previewVolume={selectedPrayerForAzhan
                            ? (getStoredVolumeForPrayer(selectedPrayerForAzhan) ?? (settings.salah.azhanVolume ?? 80))
                            : (settings.salah.azhanVolume ?? 80)}

                        onClose={() => {
                            setShowAzhanPreview(false);
                            setSelectedPrayerForAzhan(null);
                        }}

                        // Specific Selection Handler
                        onSelect={selectedPrayerForAzhan ? (id, volume) => {
                            setStoredAzhanForPrayer(selectedPrayerForAzhan, id, volume);
                            scheduleAllNotifications();
                            setSelectedPrayerForAzhan(null);
                        } : undefined}

                        // Global Handler
                        onAzhanChanged={(newId) => {
                            if (!selectedPrayerForAzhan) {
                                scheduleAllNotifications();
                            }
                        }}
                    />
                )
            }
        </div>
    );
};
