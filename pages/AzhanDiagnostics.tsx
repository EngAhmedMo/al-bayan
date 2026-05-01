import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { TopBar } from '../components/TopBar';
import { MediaBridge } from '../services/mediaBridge';
import { AzhanModal } from '../components/AzhanModal';
import { getNotificationSettings, getStoredAzhan, isPerPrayerMuazzinEnabled, getStoredAzhanForPrayer } from '../services/storage';
import { getTodayPrayerTimesLocal } from '../services/prayerCalculator';
import { MUAZZINS } from '../services/azhanData';
import {
    CheckCircle2, XCircle, RefreshCw, Play, Bell, Calendar,
    Shield, Layers, Volume2, Battery, Clock, ChevronLeft,
    AlertTriangle, Loader2, MapPin, Smartphone, Activity,
    Copy, Terminal, Info, FileAudio, X, Trash2
} from 'lucide-react';

interface DiagnosticCheck {
    id: string;
    label: string;
    icon: React.ReactNode;
    status: 'pending' | 'checking' | 'passed' | 'failed' | 'manual' | 'special';
    fixAction?: () => Promise<void>;
    description?: string;
}

const isAndroid = Capacitor.getPlatform() === 'android';

// Helper
const getNextPrayer = () => {
    const today = getTodayPrayerTimesLocal();
    if (!today) return null;
    const now = new Date();
    const currentHm = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const prayers = [
        { name: 'الفجر', time: today.timings.Fajr },
        { name: 'الظهر', time: today.timings.Dhuhr },
        { name: 'العصر', time: today.timings.Asr },
        { name: 'المغرب', time: today.timings.Maghrib },
        { name: 'العشاء', time: today.timings.Isha }
    ];

    return prayers.find(p => p.time > currentHm) || prayers[0]; // Next or first of tomorrow (simplified)
};

// --- NEW COMPONENT: DiagnosticModal ---
interface DiagnosticModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    content: React.ReactNode;
    type?: 'info' | 'success' | 'error' | 'warning';
}

const DiagnosticModal: React.FC<DiagnosticModalProps> = ({ isOpen, onClose, title, content, type = 'info' }) => {
    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle2 className="w-6 h-6 text-emerald-500" />;
            case 'error': return <XCircle className="w-6 h-6 text-red-500" />;
            case 'warning': return <AlertTriangle className="w-6 h-6 text-amber-500" />;
            default: return <Info className="w-6 h-6 text-blue-500" />;
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-md bg-black/40 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-navy-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-stone-200 dark:border-navy-700">
                <div className="flex items-center justify-between p-4 border-b border-stone-100 dark:border-navy-800 bg-stone-50 dark:bg-navy-950">
                    <div className="flex items-center gap-2">
                        {getIcon()}
                        <h3 className="font-bold text-lg text-navy-900 dark:text-white">{title}</h3>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-stone-200 dark:hover:bg-navy-800 transition-colors">
                        <X size={20} className="text-stone-500 dark:text-stone-400" />
                    </button>
                </div>
                <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {content}
                </div>
                <div className="p-4 bg-stone-50 dark:bg-navy-950 border-t border-stone-100 dark:border-navy-800 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-navy-800 text-white rounded-xl font-bold hover:bg-navy-900 transition-colors"
                    >
                        حسناً
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- UPDATED COMPONENT: LiveLogPrompter ---
const LiveLogPrompter = () => {
    const [logs, setLogs] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadLogs();
        const interval = setInterval(loadLogs, 3000); // Auto-refresh every 3s when visible
        return () => clearInterval(interval);
    }, []);

    const loadLogs = async () => {
        if (!Capacitor.isNativePlatform()) {
            setLogs(["(السجلات متاحة فقط على أندرويد - Android Only)"]);
            return;
        }
        setLoading(true);
        try {
            // @ts-ignore
            const info = await MediaBridge.getDiagnosticInfo();
            if (info && info.logs) {
                setLogs(info.logs.length > 0 ? info.logs : ["(السجل فارغ. النظام يعمل بسلام)"]);
            } else {
                setLogs(["(لم يتم العثور على سجلات - تأكد من صلاحيات الملفات)"]);
            }
        } catch (e) {
            setLogs(["فشل تحميل السجلات. هل الخدمة تعمل؟", String(e)]);
        } finally {
            setLoading(false);
            // Auto-scroll to bottom only if user is near bottom
            if (scrollRef.current) {
                const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
                if (scrollHeight - scrollTop - clientHeight < 100) {
                    setTimeout(() => {
                        if (scrollRef.current) scrollRef.current!.scrollTop = scrollRef.current!.scrollHeight;
                    }, 50);
                }
            }
        }
    };

    const copyLogs = () => {
        const text = logs.join('\n');
        navigator.clipboard.writeText(text).then(() => alert("تم نسخ السجل!"));
    };

    return (
        <div className="relative group w-full flex flex-col h-full min-h-[16rem]">
            <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="text-sm font-bold text-navy-900 dark:text-stone-200 flex items-center gap-2">
                    <Terminal size={16} className="text-stone-400" />
                    السجل الحي (Live Logs)
                </h3>
                <div className="flex gap-2">
                    <button
                        onClick={copyLogs}
                        className="p-1.5 bg-stone-100 dark:bg-navy-800 hover:bg-stone-200 dark:hover:bg-navy-700 rounded-lg text-xs text-stone-600 dark:text-stone-300 flex items-center gap-1 transition-colors border border-stone-200 dark:border-navy-700 shadow-sm"
                        title="نسخ السجل"
                    >
                        <Copy size={12} /> <span className="hidden sm:inline">نسخ</span>
                    </button>
                    <button
                        onClick={loadLogs}
                        className={`p-1.5 bg-gold-50 dark:bg-gold-900/10 hover:bg-gold-100 dark:hover:bg-gold-900/30 rounded-lg text-xs font-bold text-gold-600 dark:text-gold-400 flex items-center gap-1.5 transition-all border border-gold-100 dark:border-gold-800/30 shadow-sm ${loading ? 'opacity-80' : ''}`}
                        title="تحديث"
                    >
                        <RefreshCw size={14} className={loading ? "animate-spin" : "text-gold-500 dark:text-gold-400"} /> <span className="hidden sm:inline">تحديث</span>
                    </button>
                </div>
            </div>

            <div
                ref={scrollRef}
                className="flex-1 font-mono text-[10px] sm:text-xs leading-relaxed overflow-y-auto custom-scrollbar p-3 bg-stone-50 dark:bg-navy-950 rounded-xl border border-stone-200 dark:border-navy-800 select-text shadow-inner shadow-stone-100 dark:shadow-black/20 transform transition-all"
                dir="ltr"
                style={{ maxHeight: '80vh' }}
            >
                {logs.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 text-stone-500 h-full flex-col">
                        {loading ? <Loader2 size={24} className="animate-spin text-indigo-500" /> : <Activity size={24} className="text-stone-300" />}
                        <p>{loading ? "جاري قراءة السجلات..." : "لا توجد سجلات حالياً"}</p>
                    </div>
                ) : (
                    logs.map((line, i) => (
                        <div key={i} className="border-b border-stone-100 dark:border-navy-800/50 pb-0.5 mb-0.5 last:border-0 last:mb-0 hover:bg-stone-100 dark:hover:bg-navy-900 transition-colors px-1 rounded break-all flex gap-2 items-start">
                            <span className="text-stone-400 dark:text-stone-600 select-none w-6 inline-block text-right text-[9px] shrink-0 mt-[1px]">{(i + 1)}</span>
                            <span className={`flex-1 break-words ${line.includes('❌') || line.includes('Error') || line.includes('FAILED') ? 'text-red-600 dark:text-red-400 font-bold' : ''} ${line.includes('✅') || line.includes('SUCCESS') ? 'text-emerald-700 dark:text-emerald-400 font-bold' : ''} ${line.includes('⚠️') || line.includes('WARNING') ? 'text-amber-600 dark:text-amber-400' : 'text-stone-700 dark:text-stone-300'}`}>
                                {line}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};


export const AzhanDiagnostics: React.FC = () => {
    const navigate = useNavigate();
    const [isRunning, setIsRunning] = useState(false);
    const [showAzhanPreview, setShowAzhanPreview] = useState(false);
    // NEW: State for testing specific muazzin from Logic Simulator
    const [testMuazzinPreview, setTestMuazzinPreview] = useState<{ id: string, name: string } | null>(null);
    const [allPassed, setAllPassed] = useState(false);
    const animationDelayRef = useRef(0);

    // Modal State
    const [modalConfig, setModalConfig] = useState<{ isOpen: boolean; title: string; content: React.ReactNode; type?: 'info' | 'success' | 'error' | 'warning' } | null>(null);

    const showModal = (title: string, content: React.ReactNode, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
        setModalConfig({ isOpen: true, title, content, type });
    };

    const closeModal = () => {
        setModalConfig(null);
    };

    const [checks, setChecks] = useState<DiagnosticCheck[]>([
        {
            id: 'azhan_enabled',
            label: 'تم تمكين إشعار الأذان',
            icon: <Bell size={20} />,
            status: 'pending',
        },
        {
            id: 'location_saved',
            label: 'تم تحديد الموقع',
            icon: <MapPin size={20} />,
            status: 'pending',
        },
        {
            id: 'prayer_times_loaded',
            label: 'تم تحميل قائمة مواقيت الصلوات',
            icon: <Calendar size={20} />,
            status: 'pending',
        },
        {
            id: 'audio_file_exists',
            label: 'ملف صوت المؤذن المختار موجود',
            icon: <Volume2 size={20} />,
            status: 'pending',
        },
        {
            id: 'notification_permission',
            label: 'تم تمكين أذونات الإشعار',
            icon: <Shield size={20} />,
            status: 'pending',
        },
        {
            id: 'overlay_permission',
            label: 'تم تمكين أذونات النافذة العائمة',
            icon: <Layers size={20} />,
            status: 'pending',
        },
        {
            id: 'battery_optimization',
            label: 'استثناء من تحسين البطارية',
            icon: <Battery size={20} />,
            status: 'pending',
        },
        {
            id: 'exact_alarm_permission',
            label: 'إذن التنبيه الدقيق',
            icon: <Clock size={20} />,
            status: 'pending',
        },
        {
            id: 'auto_start',
            label: 'التشغيل التلقائي (Xiaomi/Samsung)',
            icon: <Smartphone size={20} />,
            status: 'pending',
            description: 'مهم لأجهزة شاومي وسامسونج وهواوي',
            fixAction: async () => {
                // Open auto-start settings for manual verification
                await MediaBridge.openAutoStart();
            }
        }
    ]);

    // Handle Android back button
    useEffect(() => {
        if (!isAndroid) return;

        const listener = App.addListener('backButton', () => {
            navigate(-1);
        });

        return () => {
            listener.then(l => l.remove());
        };
    }, [navigate]);

    // Update a single check's status
    const updateCheck = (id: string, status: DiagnosticCheck['status'], fixAction?: () => Promise<void>) => {
        setChecks(prev => prev.map(c =>
            c.id === id ? { ...c, status, fixAction } : c
        ));
    };

    // Run all diagnostics
    const runDiagnostics = async () => {
        setIsRunning(true);
        animationDelayRef.current = 0;

        // Reset all checks
        setChecks(prev => prev.map(c => ({ ...c, status: 'pending' })));
        setAllPassed(false);

        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        // Check 1: Azhan notification enabled
        await delay(300);
        updateCheck('azhan_enabled', 'checking');
        await delay(400);
        try {
            const settings = getNotificationSettings();
            const isEnabled = settings.salah?.enabled !== false;
            updateCheck('azhan_enabled', isEnabled ? 'passed' : 'failed');
        } catch {
            updateCheck('azhan_enabled', 'failed');
        }

        // Check 2: Location saved (essential for prayer times)
        await delay(300);
        updateCheck('location_saved', 'checking');
        await delay(400);
        try {
            const locationStr = localStorage.getItem('user_location_coords');
            const hasLocation = locationStr && JSON.parse(locationStr).lat;
            updateCheck('location_saved', hasLocation ? 'passed' : 'failed');
        } catch {
            updateCheck('location_saved', 'failed');
        }

        // Check 3: Prayer times loaded
        await delay(300);
        updateCheck('prayer_times_loaded', 'checking');
        await delay(400);
        const prayerTimes = getTodayPrayerTimesLocal();
        updateCheck('prayer_times_loaded', prayerTimes ? 'passed' : 'failed');

        // Check 4: Audio File Exists (Phase 2 Improvement)
        await delay(300);
        updateCheck('audio_file_exists', 'checking');
        await delay(400);
        try {
            if (isAndroid) {
                const currentId = getStoredAzhan();
                // Handle Random Mode by checking default fallback or just passing 'random' to a smarter checker
                // For now, if random, we check default (Abdulbasit) as that's the base fallback
                const targetId = currentId === 'random' ? 'egy_abdulbasit' : currentId;

                const res = await MediaBridge.checkResourceExists({ muazzinId: targetId });
                if (res.exists) {
                    updateCheck('audio_file_exists', 'passed');
                } else {
                    console.error(`Audio file for ${targetId} not found! Clean ID: ${res.cleanId}`);
                    updateCheck('audio_file_exists', 'failed');
                }
            } else {
                updateCheck('audio_file_exists', 'passed');
            }
        } catch (e) {
            console.error("Audio check failed", e);
            updateCheck('audio_file_exists', 'failed');
        }

        // Check 5: Notification permission
        await delay(300);
        updateCheck('notification_permission', 'checking');
        await delay(400);
        try {
            if (isAndroid) {
                const permStatus = await LocalNotifications.requestPermissions();
                const granted = permStatus.display === 'granted';
                updateCheck('notification_permission', granted ? 'passed' : 'failed', async () => {
                    await LocalNotifications.requestPermissions();
                });
            } else {
                updateCheck('notification_permission', 'passed');
            }
        } catch {
            updateCheck('notification_permission', 'failed');
        }

        // Check 6: Overlay permission
        await delay(300);
        updateCheck('overlay_permission', 'checking');
        await delay(400);
        try {
            if (isAndroid) {
                const overlayResult = await MediaBridge.checkOverlayPermission();
                updateCheck('overlay_permission', overlayResult.granted ? 'passed' : 'failed', async () => {
                    await MediaBridge.requestOverlayPermission();
                });
            } else {
                updateCheck('overlay_permission', 'passed');
            }
        } catch {
            updateCheck('overlay_permission', 'passed');
        }

        // Check 7: Battery optimization
        await delay(300);
        updateCheck('battery_optimization', 'checking');
        await delay(400);
        try {
            if (isAndroid) {
                const batteryResult = await MediaBridge.checkBatteryOptimization();
                updateCheck('battery_optimization', batteryResult.isIgnored ? 'passed' : 'failed', async () => {
                    await MediaBridge.requestBatteryOptimizationBypass();
                });
            } else {
                updateCheck('battery_optimization', 'passed');
            }
        } catch {
            updateCheck('battery_optimization', 'passed');
        }

        // Check 8: Exact alarm permission
        await delay(300);
        updateCheck('exact_alarm_permission', 'checking');
        await delay(400);
        try {
            if (isAndroid) {
                const alarmResult = await MediaBridge.checkExactAlarmPermission();
                updateCheck('exact_alarm_permission', alarmResult.canScheduleExactAlarms ? 'passed' : 'failed', async () => {
                    await MediaBridge.requestExactAlarmPermission();
                });
            } else {
                updateCheck('exact_alarm_permission', 'passed');
            }
        } catch {
            updateCheck('exact_alarm_permission', 'passed');
        }

        // Check 9: Auto-start
        await delay(300);
        updateCheck('auto_start', 'checking');
        await delay(400);
        if (isAndroid) {
            updateCheck('auto_start', 'manual', async () => {
                await MediaBridge.openAutoStart();
            });
        } else {
            updateCheck('auto_start', 'passed');
        }

        // Finished
        await delay(300);
        setIsRunning(false);
    };

    // Calculate if all passed
    useEffect(() => {
        const allDone = checks.every(c => c.status === 'passed' || c.status === 'failed' || c.status === 'manual');
        const allGood = checks.every(c => c.status === 'passed' || c.status === 'manual');
        if (allDone && !isRunning) {
            setAllPassed(allGood);
        }
    }, [checks, isRunning]);

    // Run on mount
    useEffect(() => {
        const timer = setTimeout(() => runDiagnostics(), 500);
        return () => clearTimeout(timer);
    }, []);

    const getStatusIcon = (status: DiagnosticCheck['status']) => {
        switch (status) {
            case 'pending':
                return <div className="w-6 h-6 rounded-full border-2 border-stone-300 dark:border-stone-600" />;
            case 'checking':
                return <Loader2 className="w-6 h-6 text-gold-500 animate-spin" />;
            case 'passed':
                return <CheckCircle2 className="w-6 h-6 text-emerald-500" />;
            case 'failed':
                return <XCircle className="w-6 h-6 text-red-500" />;
            case 'manual':
                return <AlertTriangle className="w-6 h-6 text-amber-500" />;
        }
    };

    return (
        <div className="flex flex-col min-h-full bg-gradient-to-b from-stone-50 to-white dark:from-navy-950 dark:to-navy-900">
            {/* Modal Injection */}
            {modalConfig && (
                <DiagnosticModal
                    isOpen={modalConfig.isOpen}
                    onClose={closeModal}
                    title={modalConfig.title}
                    content={modalConfig.content}
                    type={modalConfig.type}
                />
            )}

            {/* Header */}
            <TopBar
                title="التحقق من تذكيرات الصلاة"
                showBack
            />

            {/* Main Content */}
            <div className="flex-1 px-5 py-6">
                {/* Checks List */}
                <div className="relative">
                    {/* Vertical Dashed Line */}
                    <div className="absolute right-[34px] top-4 bottom-4 w-px border-r-2 border-dashed border-emerald-200 dark:border-emerald-900/50" />

                    <div className="space-y-0">
                        {checks.map((check, index) => (
                            <div
                                key={check.id}
                                className={`relative flex items-center gap-4 py-4 px-3 rounded-2xl transition-all duration-500
                  ${check.status === 'passed' ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}
                  ${check.status === 'failed' ? 'bg-red-50/50 dark:bg-red-900/10' : ''}
                  ${check.status === 'manual' ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}
                `}
                                style={{
                                    opacity: check.status === 'pending' ? 0.5 : 1,
                                    transform: check.status !== 'pending' ? 'translateX(0)' : 'translateX(10px)',
                                }}
                            >
                                {/* Status Icon */}
                                <div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-full bg-white dark:bg-navy-800 shadow-sm border border-stone-100 dark:border-navy-700">
                                    {getStatusIcon(check.status)}
                                </div>

                                {/* Label */}
                                <div className="flex-1">
                                    <span className={`font-bold text-sm transition-colors duration-300
                    ${check.status === 'passed' ? 'text-stone-800 dark:text-stone-200' : ''}
                    ${check.status === 'failed' ? 'text-red-700 dark:text-red-400' : ''}
                    ${check.status === 'manual' ? 'text-amber-700 dark:text-amber-400' : ''}
                    ${check.status === 'pending' || check.status === 'checking' ? 'text-stone-500 dark:text-stone-400' : ''}
                  `}>
                                        {check.label}
                                    </span>
                                    {check.status === 'manual' && (
                                        <span className="text-[10px] text-amber-600 dark:text-amber-500 block mt-0.5">يتطلب التحقق اليدوي</span>
                                    )}
                                </div>

                                {/* Fix/Verify Button (if failed or manual) */}
                                {(check.status === 'failed' || check.status === 'manual') && check.fixAction && (
                                    <button
                                        onClick={async () => {
                                            if (check.fixAction) {
                                                await check.fixAction();
                                                setTimeout(() => runDiagnostics(), 1000);
                                            }
                                        }}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors
                                          ${check.status === 'failed'
                                                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                                                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                                            }`}
                                    >
                                        {check.status === 'manual' ? 'تحقق' : 'إصلاح'}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Summary Banner */}
                {!isRunning && checks.every(c => c.status !== 'pending' && c.status !== 'checking') && (
                    <div className={`mt-6 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500
            ${allPassed
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800'
                        }
          `}>
                        {allPassed ? (
                            <>
                                <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                                <div>
                                    <p className="font-bold text-emerald-800 dark:text-emerald-300">جميع الإعدادات صحيحة!</p>
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400">سيعمل الأذان بشكل طبيعي إن شاء الله</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                                <div>
                                    <p className="font-bold text-amber-800 dark:text-amber-300">بعض الإعدادات تحتاج إصلاح</p>
                                    <p className="text-xs text-amber-600 dark:text-amber-400">اضغط على "إصلاح" لحل المشكلات</p>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Actions */}
            <div className="sticky bottom-0 p-5 bg-gradient-to-t from-white via-white to-transparent dark:from-navy-900 dark:via-navy-900">
                <div className="flex flex-col gap-3">
                    {/* Re-check Button */}
                    <button
                        onClick={runDiagnostics}
                        disabled={isRunning}
                        className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all
              ${allPassed && !isRunning
                                ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                                : 'bg-gradient-to-r from-stone-100 to-stone-200 dark:from-navy-800 dark:to-navy-800 text-stone-700 dark:text-stone-300 hover:from-gold-100 hover:to-amber-100 dark:hover:from-gold-900/30 dark:hover:to-amber-900/20'
                            }
              ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}
            `}
                    >
                        {isRunning ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                جاري الفحص...
                            </>
                        ) : (
                            <>
                                {allPassed ? <CheckCircle2 className="w-5 h-5" /> : <RefreshCw className="w-5 h-5" />}
                                إعادة التحقق
                            </>
                        )}
                    </button>

                    {/* Preview Azhan Button */}
                    <button
                        onClick={() => setShowAzhanPreview(true)}
                        className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-gold-600 dark:text-gold-400 hover:bg-gold-50 dark:hover:bg-gold-900/20 transition-colors"
                    >
                        <Play className="w-4 h-4" />
                        معاينة تأثير الأذان
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Azhan Preview Modal */}
            {showAzhanPreview && (
                <AzhanModal
                    prayerName="معاينة"
                    prayerTime={new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    onClose={() => setShowAzhanPreview(false)}
                />
            )}

            {/* Test Muazzin Preview Modal - For specific muazzin testing */}
            {testMuazzinPreview && (
                <AzhanModal
                    prayerName={`معاينة تجربة (${testMuazzinPreview.name})`}
                    prayerTime={new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    initialAzhanId={testMuazzinPreview.id}
                    onClose={() => setTestMuazzinPreview(null)}
                />
            )}
            {/* Logic Simulator Section */}
            {!isRunning && allPassed && (
                <div className="mt-6 animate-in slide-in-from-bottom-6 duration-700">
                    <div className="bg-white dark:bg-navy-900 rounded-3xl p-5 border border-stone-200 dark:border-navy-700 shadow-xl shadow-stone-200/50 dark:shadow-black/30">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
                                <Activity size={20} className="text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-navy-900 dark:text-white">محاكي اتخاذ القرار</h3>
                                <p className="text-xs text-navy-500 dark:text-navy-400">توقع ماذا سيحدث في الصلاة القادمة</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {(() => {
                                // Logic Simulation
                                const nextPrayer = getNextPrayer();
                                if (!nextPrayer) return <p className="text-center text-sm text-navy-500">لا توجد صلوات قادمة اليوم</p>;

                                const isPerPrayer = isPerPrayerMuazzinEnabled();
                                const globalAzhan = getStoredAzhan();
                                const specificSetting = getStoredAzhanForPrayer(nextPrayer.name); // This returns resolved ID

                                // To know if it came from specific or global, we check raw storage manually or infer
                                const rawSpecific = localStorage.getItem('settings_azhan_specific');
                                let source = 'الإعداد العام';
                                let isSpecificActive = false;

                                if (isPerPrayer && rawSpecific) {
                                    const parsed = JSON.parse(rawSpecific);
                                    // Map Arabic name to key
                                    let key = '';
                                    if (nextPrayer.name.includes('الفجر')) key = 'fajr';
                                    else if (nextPrayer.name.includes('الظهر') || nextPrayer.name.includes('الجمعة')) key = 'dhuhr';
                                    else if (nextPrayer.name.includes('العصر')) key = 'asr';
                                    else if (nextPrayer.name.includes('المغرب')) key = 'maghrib';
                                    else if (nextPrayer.name.includes('العشاء')) key = 'isha';

                                    if (key && parsed[key]) {
                                        source = 'تخصيص الصلاة';
                                        isSpecificActive = true;
                                    }
                                }

                                const muazzinName = MUAZZINS.find(m => m.id === specificSetting)?.name || specificSetting;

                                return (
                                    <>
                                        <div className="flex items-center justify-between p-3 bg-stone-50 dark:bg-navy-950 rounded-2xl border border-stone-100 dark:border-navy-800">
                                            <span className="text-xs font-bold text-stone-600 dark:text-stone-400">الصلاة القادمة</span>
                                            <span className="text-sm font-bold text-navy-800 dark:text-white">{nextPrayer.name} ({nextPrayer.time})</span>
                                        </div>

                                        {/* Decision Path Visualization */}
                                        <div className="relative pl-4 space-y-6 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200 dark:before:bg-navy-700">
                                            {/* Step 1: Per Prayer Check */}
                                            <div className="relative flex items-start gap-3">
                                                <div className={`w-4 h-4 rounded-full mt-0.5 shrink-0 border-2 ${isPerPrayer ? 'bg-indigo-500 border-indigo-500' : 'bg-white dark:bg-navy-900 border-stone-300 dark:border-navy-600'}`}></div>
                                                <div>
                                                    <p className="text-xs font-bold text-navy-900 dark:text-white">فحص التخصيص</p>
                                                    <p className="text-[10px] text-navy-500 dark:text-navy-400">
                                                        {isPerPrayer ? (isSpecificActive ? 'مفعل ويوجد تخصيص' : 'مفعل لكن لا يوجد تخصيص لهذه الصلاة') : 'الميزة معطلة'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Step 2: Global Check (if needed) */}
                                            <div className="relative flex items-start gap-3">
                                                <div className={`w-4 h-4 rounded-full mt-0.5 shrink-0 border-2 ${!isSpecificActive ? 'bg-indigo-500 border-indigo-500' : 'bg-white dark:bg-navy-900 border-stone-300 dark:border-navy-600'}`}></div>
                                                <div>
                                                    <p className="text-xs font-bold text-navy-900 dark:text-white">فحص الإعداد العام</p>
                                                    <p className="text-[10px] text-navy-500 dark:text-navy-400">
                                                        المؤذن العام: {MUAZZINS.find(m => m.id === globalAzhan)?.name || globalAzhan}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Step 3: Final Decision */}
                                            <div className="relative flex items-start gap-3">
                                                <div className="w-4 h-4 rounded-full mt-0.5 shrink-0 border-2 bg-emerald-500 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]"></div>
                                                <div>
                                                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">القرار النهائي للنظام</p>
                                                    <p className="text-xs font-bold text-navy-900 dark:text-white mt-1">
                                                        سيتم تشغيل: <span className="text-emerald-600 dark:text-emerald-400">{muazzinName}</span>
                                                    </p>
                                                    <p className="text-[10px] text-navy-400 dark:text-navy-500 mt-1">
                                                        المصدر: {source}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Path Resolver & Test Play */}
                                        <div className="mt-4 pt-4 border-t border-stone-100 dark:border-navy-800">
                                            {/* Live Storage Values Display */}
                                            <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                                                <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-2">📦 القيم الفعلية في التخزين:</p>
                                                <div className="space-y-1 text-[10px] font-mono text-indigo-600 dark:text-indigo-400">
                                                    <p><span className="text-indigo-400">settings_azhan:</span> <span className="text-indigo-800 dark:text-indigo-200">{globalAzhan}</span></p>
                                                    <p><span className="text-indigo-400">per_prayer_enabled:</span> <span className="text-indigo-800 dark:text-indigo-200">{isPerPrayer ? 'true' : 'false'}</span></p>
                                                    <p><span className="text-indigo-400">resolved_id:</span> <span className="text-indigo-800 dark:text-indigo-200 font-bold">{specificSetting}</span></p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    onClick={async () => {
                                                        // Show detailed diagnostic info
                                                        const isCustom = specificSetting.startsWith('custom_');
                                                        let path = '';
                                                        let fullPath = '';

                                                        // Pre-check path
                                                        if (isCustom) {
                                                            try {
                                                                const { getPlayableAzhanUrlForNative } = await import('../services/offlineAudio');
                                                                const result = await getPlayableAzhanUrlForNative(specificSetting);
                                                                fullPath = result || 'غير معروف';
                                                                path = result ? 'تم العثور عليه (Storage)' : '❌ الملف غير موجود';
                                                            } catch (e) { path = 'خطأ: ' + e; }
                                                        } else {
                                                            path = `(مدمج في res/raw/${specificSetting})`;
                                                            fullPath = `android.resource://${Capacitor.getPlatform() === 'android' ? 'com.albayan.quran' : 'app'}/raw/${specificSetting}`;
                                                        }

                                                        showModal(
                                                            "تحليل الملف الصوتي",
                                                            <div className="space-y-4 text-sm text-stone-700 dark:text-stone-300">
                                                                <div className="bg-stone-100 dark:bg-navy-800 p-3 rounded-xl border border-stone-200 dark:border-navy-700">
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <FileAudio className="w-4 h-4 text-indigo-500" />
                                                                        <span className="font-bold">المؤذن (ID):</span> {specificSetting}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <Info className="w-4 h-4 text-indigo-500" />
                                                                        <span className="font-bold">النوع:</span> {isCustom ? 'مخصص (مرفوع)' : 'مدمج (Bundled)'}
                                                                    </div>
                                                                    <div className="flex flex-col gap-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <MapPin className="w-4 h-4 text-indigo-500" />
                                                                            <span className="font-bold">المسار الظاهري:</span>
                                                                        </div>
                                                                        <code className="block bg-black/5 dark:bg-black/30 p-2 rounded text-[10px] break-all font-mono select-all">
                                                                            {path}
                                                                        </code>
                                                                        {isCustom && (
                                                                            <>
                                                                                <span className="text-[10px] font-bold mt-1">المسار الكامل:</span>
                                                                                <code className="block bg-black/5 dark:bg-black/30 p-2 rounded text-[10px] break-all font-mono select-all">
                                                                                    {fullPath}
                                                                                </code>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded-xl border border-amber-100 dark:border-amber-800/30">
                                                                    <h4 className="font-bold text-amber-800 dark:text-amber-400 mb-1 flex items-center gap-2">
                                                                        <Layers className="w-4 h-4" /> طريقة التشغيل
                                                                    </h4>
                                                                    <p className="text-xs text-amber-700 dark:text-amber-300">
                                                                        {isCustom
                                                                            ? 'يتم تمرير مسار الملف (File URI) إلى مشغل الوسائط مباشرة.'
                                                                            : 'يتم استخدام معرف الموارد (Resource ID) للوصول للملف المدمج داخل التطبيق.'}
                                                                    </p>
                                                                </div>
                                                            </div>,
                                                            'info'
                                                        );
                                                    }}
                                                    className="py-2.5 bg-stone-100 dark:bg-navy-800 rounded-xl text-xs font-bold text-navy-600 dark:text-navy-300 hover:bg-stone-200 dark:hover:bg-navy-700 transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <MapPin size={14} />
                                                    فحص المسار
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        // ✅ FIXED: Use AzhanModal directly instead of playAzhan
                                                        // This avoids race conditions that caused Modal flash+close
                                                        setTestMuazzinPreview({
                                                            id: specificSetting,
                                                            name: muazzinName
                                                        });
                                                    }}
                                                    className="py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                                                >
                                                    <Play size={14} fill="currentColor" />
                                                    تـجـربـة الصوت فعلياً
                                                </button>
                                            </div>
                                        </div>

                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>

            )}

            {/* LIVE LOG VIEWER (New Diagnostic Feature) */}
            {!isRunning && allPassed && (
                <div className="mt-6 mb-10 animate-in slide-in-from-bottom-8 duration-700">
                    <div className="bg-stone-900 dark:bg-black rounded-3xl p-5 border border-stone-800 shadow-xl overflow-hidden">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-stone-800 rounded-xl">
                                    <Terminal size={20} className="text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-stone-200">سجل النظام الحي</h3>
                                    <p className="text-xs text-stone-400">آخر العمليات المسجلة في النظام (Native)</p>
                                </div>
                            </div>
                            <button
                                onClick={async () => {
                                    try {
                                        // @ts-ignore
                                        const info = await MediaBridge.getDiagnosticInfo();
                                        if (info.logs) {
                                            // Optional: Add logic to confirm before delete
                                            // For now, we trust the user or just delete.
                                            // Let's use a browser confirm or the modal (but modal returns void).
                                            if (confirm("هل تريد مسح السجل؟")) {
                                                await MediaBridge.deleteLogFile({});
                                                // Force refresh if possible or let user refresh via internal button
                                            }
                                        }
                                    } catch (e) { showModal("خطأ", "فشل: " + e, 'error'); }
                                }}
                                className="p-2 bg-stone-800 rounded-full text-stone-400 hover:text-white hover:bg-red-900/50 hover:text-red-400 transition-colors"
                                title="مسح السجلات"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>

                        <div className="bg-black/50 rounded-xl border border-stone-800/50 shadow-inner">
                            <LiveLogPrompter />
                        </div>
                    </div>
                </div>
            )
            }

        </div >
    );
};
