
import React, { useEffect, useState } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { MediaBridge } from '../services/mediaBridge';
import { Device } from '@capacitor/device';
import {
    Bell, MapPin, CheckCircle, ChevronRight, ShieldCheck,
    Zap, Layers, Clock, AlertTriangle, ArrowRight, X,
    BellOff, BatteryCharging
} from 'lucide-react';

interface PermissionStatus {
    notifications: boolean;
    location: boolean;
    overlay: boolean;
    exactAlarm: boolean;
    dndAccess: boolean;
    batteryOptimization: boolean;
}

export const PermissionGate: React.FC<{
    children?: React.ReactNode;
    isOpen?: boolean;
    onClose?: () => void;
}> = ({ children, isOpen: externalIsOpen, onClose }) => {
    const [status, setStatus] = useState<PermissionStatus>({
        notifications: false,
        location: false,
        overlay: false,
        exactAlarm: false,
        dndAccess: false,
        batteryOptimization: false
    });

    // UI State
    const [loading, setLoading] = useState(true);
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const [step, setStep] = useState(1); // 1: Essential, 2: AutoStart (Xiaomi), 3: Advanced
    const [manufacturer, setManufacturer] = useState<string>('');
    const [showAutoStartStep, setShowAutoStartStep] = useState(false);

    // Derived State: Use external connection if provided, otherwise internal
    const isModalOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

    const handleClose = () => {
        if (onClose) onClose();
        setInternalIsOpen(false);
        // Save that user has seen the gate to prevent automatic popping
        localStorage.setItem('bayan_gate_seen', 'true');
    };

    useEffect(() => {
        init();
    }, []);

    const init = async () => {
        if (!Capacitor.isNativePlatform()) {
            setLoading(false);
            return;
        }

        const info = await Device.getInfo();
        const mfr = (info.manufacturer || '').toLowerCase();
        setManufacturer(mfr);

        // Show AutoStart step only for specific problematic OEMs
        const autoStartOEMs = ['xiaomi', 'oppo', 'vivo', 'huawei', 'redmi', 'poco', 'realme'];
        setShowAutoStartStep(autoStartOEMs.some(oem => mfr.includes(oem)));

        await checkPermissions();
    };

    const checkPermissions = async () => {
        try {
            // 1. Notifications
            let isNotifGranted = false;
            try {
                const notifState = await (LocalNotifications as any).checkPermissions();
                isNotifGranted = notifState.display === 'granted';
            } catch (e) { console.warn("Notif check failed", e); }

            // 2. Location
            let isLocGranted = false;
            try {
                const locState = await Geolocation.checkPermissions();
                isLocGranted = locState.location === 'granted';
            } catch (e) { console.warn("Loc check failed", e); }

            // 3. Overlay
            let isOverlayGranted = true;
            try {
                const overlayState = await MediaBridge.checkOverlayPermission();
                isOverlayGranted = overlayState.granted;
            } catch (e) { console.warn("Overlay check failed", e); }

            // 4. Exact Alarm
            let isAlarmGranted = true;
            try {
                // Assuming newer Android versions need this check
                const alarmState = await MediaBridge.checkExactAlarmPermission();
                isAlarmGranted = alarmState.canScheduleExactAlarms;
            } catch (e) { console.warn("Alarm check failed", e); }

            // 5. DND Access (Do Not Disturb bypass)
            let isDndGranted = true;
            try {
                const dndState = await MediaBridge.checkDndAccess();
                isDndGranted = dndState.granted;
            } catch (e) { console.warn("DND check failed", e); }

            // 6. Battery Optimization bypass
            let isBatteryIgnored = true;
            try {
                const batteryState = await MediaBridge.checkBatteryOptimization();
                isBatteryIgnored = batteryState.isIgnored;
            } catch (e) { console.warn("Battery check failed", e); }

            setStatus({
                notifications: isNotifGranted,
                location: isLocGranted,
                overlay: isOverlayGranted,
                exactAlarm: isAlarmGranted,
                dndAccess: isDndGranted,
                batteryOptimization: isBatteryIgnored
            });

            // Logic to Open: Pro-active approach
            const hasSeenGate = localStorage.getItem('bayan_gate_seen') === 'true';
            const isAndroid = Capacitor.getPlatform() === 'android';

            if (!isNotifGranted) {
                // Notifications are always mandatory to open at Step 1
                setInternalIsOpen(true);
                setStep(1);
            } else if (!hasSeenGate) {
                // If notifications are fine but other critical things are missing (Android)
                if (isAndroid && (!isOverlayGranted || !isAlarmGranted)) {
                    setInternalIsOpen(true);
                    setStep(3); // Open directly at advanced step
                } else if (showAutoStartStep) {
                    // Check if AutoStart is relevant
                    // We can't check AutoStart status from code reliably, 
                    // so we only show it once or via button.
                }
            }

        } catch (e) {
            console.error("Permission check failed", e);
        } finally {
            setLoading(false);
        }
    };

    const requestNotifications = async () => {
        try {
            await LocalNotifications.requestPermissions();
            // Re-check individually
            const s = await (LocalNotifications as any).checkPermissions();
            if (s.display === 'granted') setStatus(p => ({ ...p, notifications: true }));
        } catch (e) { console.error(e); }
    };

    const requestLocation = async () => {
        try {
            await Geolocation.requestPermissions();
            const s = await Geolocation.checkPermissions();
            if (s.location === 'granted') setStatus(p => ({ ...p, location: true }));
        } catch (e) { console.error(e); }
    };

    const requestOverlay = async () => {
        try {
            await MediaBridge.requestOverlayPermission();
            // Overlay opens system settings, so we need to re-check when user returns
            // Use a short timeout to allow the settings activity to open first
            setTimeout(async () => {
                try {
                    const overlayState = await MediaBridge.checkOverlayPermission();
                    if (overlayState.granted) {
                        setStatus(p => ({ ...p, overlay: true }));
                    }
                } catch (e) { console.warn("Overlay recheck failed", e); }
            }, 1000);
        } catch (e) { console.error(e); }
    };

    const requestExactAlarm = async () => {
        try {
            await MediaBridge.requestExactAlarmPermission();
            // Same pattern - recheck after delay
            setTimeout(async () => {
                try {
                    const alarmState = await MediaBridge.checkExactAlarmPermission();
                    if (alarmState.canScheduleExactAlarms) {
                        setStatus(p => ({ ...p, exactAlarm: true }));
                    }
                } catch (e) { console.warn("Alarm recheck failed", e); }
            }, 1000);
        } catch (e) { console.error(e); }
    };

    const requestDndAccess = async () => {
        try {
            await MediaBridge.requestDndAccess();
            // Opens system settings - recheck after delay
            setTimeout(async () => {
                try {
                    const dndState = await MediaBridge.checkDndAccess();
                    if (dndState.granted) {
                        setStatus(p => ({ ...p, dndAccess: true }));
                    }
                } catch (e) { console.warn("DND recheck failed", e); }
            }, 1000);
        } catch (e) { console.error(e); }
    };

    const requestBatteryOptimization = async () => {
        try {
            await MediaBridge.requestBatteryOptimizationBypass();
            // Opens system settings - recheck after delay
            setTimeout(async () => {
                try {
                    const batteryState = await MediaBridge.checkBatteryOptimization();
                    if (batteryState.isIgnored) {
                        setStatus(p => ({ ...p, batteryOptimization: true }));
                    }
                } catch (e) { console.warn("Battery recheck failed", e); }
            }, 1000);
        } catch (e) { console.error(e); }
    };

    // Handler when app resumes (to re-check permissions modified in settings)
    useEffect(() => {
        const handleResume = async () => {
            // Re-check whenever modal opens
            if (isModalOpen) await checkPermissions();
        };
        handleResume();

        // Also re-check on visibility change (when coming back from settings)
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible' && isModalOpen) {
                await checkPermissions();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isModalOpen]);


    if (!Capacitor.isNativePlatform() || loading) return <>{children}</>;

    // Render nothing if closed
    if (!isModalOpen) return <>{children}</>;

    // Calculate completion for Next button logic
    const step1Complete = status.notifications && status.location;
    // Step 2 (AutoStart) is manual confirmation usually

    const renderStep1 = () => (
        <div className="space-y-4 animate-in slide-in-from-right duration-300">
            <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-navy-900 dark:text-white">الصلاحيات الأساسية</h3>
                <p className="text-navy-500 text-sm">لضمان عمل التطبيق بشكل صحيح</p>
            </div>

            {/* Notifications */}
            <PermissionItem
                icon={<Bell size={20} />}
                title="الإشعارات"
                desc="للتنبيهات والأذان"
                isGranted={status.notifications}
                onGrant={requestNotifications}
                color="emerald"
            />

            {/* Location */}
            <PermissionItem
                icon={<MapPin size={20} />}
                title="الموقع الجغرافي"
                desc="لحساب مواقيت الصلاة"
                isGranted={status.location}
                onGrant={requestLocation}
                color="blue"
            />
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-4 animate-in slide-in-from-right duration-300">
            <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-navy-900 dark:text-white">إعدادات {manufacturer}</h3>
                <p className="text-red-500 text-sm font-bold flex items-center justify-center gap-1">
                    <AlertTriangle size={14} />
                    مهم جداً لعمل الأذان
                </p>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-100 dark:border-orange-800 text-sm text-navy-700 dark:text-gray-200 leading-relaxed">
                تمنع أجهزة {manufacturer} التطبيقات من العمل في الخلفية بشكل افتراضي.
                <br />
                يرجى تفعيل <strong>"التشغيل التلقائي" (AutoStart)</strong> لضمان عمل الأذان.
            </div>

            <button
                onClick={() => MediaBridge.openAutoStart()}
                className="w-full py-4 bg-navy-900 text-white rounded-xl font-bold shadow-lg hover:bg-navy-800 flex items-center justify-center gap-2"
            >
                <Zap size={20} className="text-yellow-400" />
                فتح إعدادات التشغيل التلقائي
            </button>
        </div>
    );

    const renderStep3 = () => (
        <div className="space-y-4 animate-in slide-in-from-right duration-300">
            <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-navy-900 dark:text-white">صلاحيات متقدمة</h3>
                <p className="text-navy-500 text-sm">لتحسين الموثوقية (اختياري)</p>
            </div>

            {/* Overlay */}
            <PermissionItem
                icon={<Layers size={20} />}
                title="الظهور فوق التطبيقات"
                desc="لعرض شاشة الأذان الكاملة"
                isGranted={status.overlay}
                onGrant={requestOverlay}
                color="purple"
            />

            {/* Exact Alarm */}
            <PermissionItem
                icon={<Clock size={20} />}
                title="منبهات دقيقة"
                desc="لضبط الوقت بدقة عالية"
                isGranted={status.exactAlarm}
                onGrant={requestExactAlarm}
                color="indigo"
            />

            {/* DND Access - تجاوز عدم الإزعاج */}
            <PermissionItem
                icon={<BellOff size={20} />}
                title="تجاوز عدم الإزعاج"
                desc="لتشغيل الأذان في وضع الصامت"
                isGranted={status.dndAccess}
                onGrant={requestDndAccess}
                color="orange"
            />

            {/* Battery Optimization */}
            <PermissionItem
                icon={<BatteryCharging size={20} />}
                title="استثناء البطارية"
                desc="لمنع إيقاف التطبيق في الخلفية"
                isGranted={status.batteryOptimization}
                onGrant={requestBatteryOptimization}
                color="green"
            />
        </div>
    );

    const handleNext = () => {
        if (step === 1 && step1Complete) {
            if (showAutoStartStep) setStep(2);
            else setStep(3);
        } else if (step === 2) {
            setStep(3);
        } else {
            handleClose();
        }
    };

    return (
        <>
            {children}
            <div className="fixed inset-0 z-[100] bg-navy-950/95 backdrop-blur-md flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-white dark:bg-navy-900 rounded-3xl shadow-2xl overflow-hidden border border-navy-100 dark:border-navy-800 flex flex-col max-h-[90vh]">

                    {/* Header */}
                    <div className="bg-gold-500 p-6 text-center relative overflow-hidden shrink-0">
                        <div className="absolute top-0 left-0 w-full h-full bg-white/10 pattern-dots"></div>
                        <ShieldCheck size={40} className="mx-auto text-white mb-2 relative z-10" />
                        <h2 className="text-2xl font-bold text-white relative z-10 font-quran">إعداد التطبيق</h2>

                        {/* Progress Dots */}
                        <div className="flex justify-center gap-2 mt-4 relative z-10">
                            <div className={`w-2 h-2 rounded-full transition-all ${step >= 1 ? 'bg-white w-4' : 'bg-white/40'}`}></div>
                            {showAutoStartStep && <div className={`w-2 h-2 rounded-full transition-all ${step >= 2 ? 'bg-white w-4' : 'bg-white/40'}`}></div>}
                            <div className={`w-2 h-2 rounded-full transition-all ${step === 3 ? 'bg-white w-4' : 'bg-white/40'}`}></div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto flex-1">
                        {step === 1 && renderStep1()}
                        {step === 2 && renderStep2()}
                        {step === 3 && renderStep3()}
                    </div>

                    {/* Footer */}
                    <div className="p-6 bg-navy-50 dark:bg-navy-950 border-t border-navy-100 dark:border-navy-800 flex justify-between items-center shrink-0">
                        <button
                            onClick={handleClose}
                            className="text-gray-400 text-xs font-bold px-4 py-2 hover:bg-gray-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
                        >
                            تخطي
                        </button>

                        <button
                            onClick={handleNext}
                            disabled={step === 1 && !step1Complete} // Block step 1 only
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold shadow-lg transition-all ${(step === 1 && !step1Complete)
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-gold-500 text-white hover:bg-gold-600 hover:scale-105'
                                }`}
                        >
                            <span>{step === 3 ? 'إنهاء' : 'التالي'}</span>
                            {step === 3 ? <CheckCircle size={18} /> : <ArrowRight size={18} className="rotate-180" />}
                        </button>
                    </div>

                </div>
            </div>
        </>
    );
};

// Reusable Item Component
const PermissionItem = ({ icon, title, desc, isGranted, onGrant, color }: any) => {
    // Map color string to classes dynamically or statically
    const getColors = (c: string) => {
        const map: any = {
            emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200 granted-bg' },
            blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200 granted-bg' },
            purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200 granted-bg' },
            indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200 granted-bg' },
            orange: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200 granted-bg' },
            green: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200 granted-bg' },
        };
        return map[c] || map.emerald;
    };

    const theme = getColors(color);

    return (
        <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isGranted ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200' : 'bg-white dark:bg-navy-800 border-navy-100 dark:border-navy-700'}`}>
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${isGranted ? 'bg-emerald-100 text-emerald-600' : theme.bg + ' ' + theme.text}`}>
                    {icon}
                </div>
                <div>
                    <h3 className="font-bold text-navy-900 dark:text-white">{title}</h3>
                    <p className="text-xs text-navy-500">{desc}</p>
                </div>
            </div>
            {isGranted ? (
                <CheckCircle size={24} className="text-emerald-500" />
            ) : (
                <button onClick={onGrant} className="px-3 py-1.5 bg-navy-900 text-white text-xs font-bold rounded-lg shadow-md hover:bg-navy-800">
                    تفعيل
                </button>
            )}
        </div>
    );
};
