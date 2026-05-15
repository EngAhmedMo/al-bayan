import React, { useState, useEffect } from 'react';
import { App } from '@capacitor/app';
import { Clock, MapPin, Compass, Settings, X, MoonIcon, Sunrise, Sun, Sunset, Moon, Check, RotateCcw, Undo2, Quote, Navigation, Calendar, CheckCircle2, Circle, AlertCircle, Sliders, Signal } from 'lucide-react';
import { PRAYER_VIRTUES, getPrayerVirtue } from '../services/prayerVirtues';
import { PrayerData } from '../types';
import { PrayerTracking, markPrayerCompleted, undoPrayerCompletion, resetDailyPrayers, PRAYER_MESSAGES } from '../services/storage';
import { cancelMissedPrayerReminder } from '../services/notificationManager';
import { toArabicDigits } from '../services/normalization';
import { PrayerDashboard } from './PrayerDashboard';
import { PrayerHistoryCalendar } from './PrayerHistoryCalendar';
import { triggerPrayerSuccess, triggerDailyCompletion } from '../services/confetti';
import { useSettings, useTheme } from './Layout';
import { getPrayerAdjustments } from '../services/prayerCalculator';
import { LocationManager, AccuracyLevel } from '../services/LocationManager';

interface PrayerTimesModalProps {
    isOpen: boolean;
    onClose: () => void;
    prayerData: PrayerData | null;
    nextPrayer: { name: string; time: string; timeLeft: string } | null;
    prayerTracking: PrayerTracking;
    setPrayerTracking: React.Dispatch<React.SetStateAction<PrayerTracking>>;
    onRefreshLocation: () => void;
    onOpenQibla: () => void;
    onOpenSettings: () => void;
    locationError: string | null;
    loadingPrayer: boolean;
}

const PRAYER_NAMES: Record<string, string> = {
    Fajr: 'الفجر',
    Sunrise: 'الشروق',
    Dhuhr: 'الظهر', // Will be dynamically replaced with الجمعة on Fridays
    Asr: 'العصر',
    Maghrib: 'المغرب',
    Isha: 'العشاء',
};

// Helper: Get Dhuhr name based on day (Friday = الجمعة)
const getDhuhrName = (isFriday: boolean): string => isFriday ? 'الجمعة' : 'الظهر';

export const PrayerTimesModal: React.FC<PrayerTimesModalProps> = ({
    isOpen,
    onClose,
    prayerData,
    nextPrayer,
    prayerTracking,
    setPrayerTracking,
    onRefreshLocation,
    onOpenQibla,
    onOpenSettings,
    locationError,
    loadingPrayer
}) => {
    const { openSettings } = useSettings();
    const { isDark } = useTheme();
    const [confirmPrayerModal, setConfirmPrayerModal] = useState<{ key: string, name: string } | null>(null);
    const [undoPrayerModal, setUndoPrayerModal] = useState<{ key: string, name: string } | null>(null);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false); // Controls the new Calendar Modal

    // Friday Detection: Check if today is Friday (day 5)
    const isFriday = new Date().getDay() === 5;

    // Handle Native Back Button (Android)
    useEffect(() => {
        if (!isOpen) return;

        const handleCloseAction = () => {
            if (confirmPrayerModal) {
                setConfirmPrayerModal(null);
                return;
            }
            if (undoPrayerModal) {
                setUndoPrayerModal(null);
                return;
            }
            if (showResetConfirm) {
                setShowResetConfirm(false);
                return;
            }
            if (showHistoryModal) {
                setShowHistoryModal(false);
                return;
            }
            onClose();
        };

        const handleNativeBack = async () => {
            handleCloseAction();
        };

        const listener = App.addListener('backButton', handleNativeBack);
        return () => {
            listener.then(l => l.remove());
        };
    }, [isOpen, onClose, confirmPrayerModal, undoPrayerModal, showResetConfirm, showHistoryModal]);

    // Handle Escape Key (Web/Desktop)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                if (confirmPrayerModal) {
                    setConfirmPrayerModal(null);
                    return;
                }
                if (undoPrayerModal) {
                    setUndoPrayerModal(null);
                    return;
                }
                if (showResetConfirm) {
                    setShowResetConfirm(false);
                    return;
                }
                if (showHistoryModal) {
                    setShowHistoryModal(false);
                    return;
                }
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, confirmPrayerModal, undoPrayerModal, showResetConfirm, showHistoryModal]);

    if (!isOpen) return null;

    const currentPrayerCount = Object.values(prayerTracking.prayers).filter(Boolean).length;

    const handlePrayerTap = (prayerKey: string, prayerName: string) => {
        if (prayerKey === 'Sunrise') return;
        const trackingKey = prayerKey.toLowerCase() as keyof PrayerTracking['prayers'];

        if (prayerTracking.prayers[trackingKey]) {
            setUndoPrayerModal({ key: trackingKey, name: prayerName });
        } else {
            setConfirmPrayerModal({ key: trackingKey, name: prayerName });
        }
    };

    const handleConfirmPrayer = () => {
        if (!confirmPrayerModal) return;
        const trackingKey = confirmPrayerModal.key as keyof PrayerTracking['prayers'];

        markPrayerCompleted(trackingKey);

        // SMART FEATURE: Cancel the "Did you pray?" reminder if it's pending
        cancelMissedPrayerReminder(trackingKey);

        const newTracking = { ...prayerTracking, prayers: { ...prayerTracking.prayers, [trackingKey]: true } };
        setPrayerTracking(newTracking);

        setConfirmPrayerModal(null);
        if (navigator.vibrate) navigator.vibrate(50);

        // Trigger Confetti
        triggerPrayerSuccess();

        // Check for daily completion (if count impacts this)
        const newCount = Object.values(newTracking.prayers).filter(Boolean).length;
        if (newCount === 5) {
            setTimeout(() => triggerDailyCompletion(), 500);
        }
    };

    const handleUndoPrayer = () => {
        if (!undoPrayerModal) return;
        const trackingKey = undoPrayerModal.key as keyof PrayerTracking['prayers'];

        undoPrayerCompletion(trackingKey);
        setPrayerTracking(prev => ({
            ...prev,
            prayers: { ...prev.prayers, [trackingKey]: false }
        }));

        setUndoPrayerModal(null);
        if (navigator.vibrate) navigator.vibrate(50);
    };

    const handleResetPrayers = () => {
        resetDailyPrayers();
        setPrayerTracking(prev => ({
            ...prev,
            prayers: { fajr: false, dhuhr: false, asr: false, maghrib: false, isha: false }
        }));
        setShowResetConfirm(false);
        if (navigator.vibrate) navigator.vibrate([50, 50]);
    };

    const formatTime12 = (time24: string) => {
        if (!time24) return { time: '', period: '' };
        const [hStr, mStr] = time24.split(':');
        const h = parseInt(hStr);
        const m = parseInt(mStr);
        const period = h >= 12 ? 'م' : 'ص';
        const h12 = h % 12 || 12;
        const paddedMinutes = m.toString().padStart(2, '0');
        return {
            time: `${toArabicDigits(h12)}:${toArabicDigits(paddedMinutes)}`,
            period
        };
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="relative w-full max-w-sm md:max-w-lg lg:max-w-xl bg-white dark:bg-navy-900 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 border border-navy-100 dark:border-navy-800 flex flex-col max-h-[90vh] lg:max-h-[85vh]">

                {/* Header */}
                <div className="p-5 border-b border-navy-100 dark:border-navy-800 flex justify-between items-center bg-gold-50 dark:bg-navy-950">
                    <h3 className="font-bold text-lg text-navy-900 dark:text-white flex items-center gap-2">
                        <Clock size={20} className="text-gold-500" /> مواقيت الصلاة
                    </h3>
                    <div className="flex gap-2">
                        <button
                            onClick={onRefreshLocation}
                            className="p-1.5 rounded-full hover:bg-navy-200 dark:hover:bg-navy-800 text-navy-500"
                            title="تحديث الموقع"
                        >
                            <MapPin size={20} />
                        </button>
                        <button
                            onClick={onOpenQibla}
                            className="p-1.5 rounded-full hover:bg-navy-200 dark:hover:bg-navy-800 text-gold-500"
                            title="اتجاه القبلة"
                        >
                            <Compass size={20} />
                        </button>
                        <button onClick={onOpenSettings} className="p-1.5 rounded-full hover:bg-navy-200 dark:hover:bg-navy-800 text-navy-500"><Settings size={20} /></button>
                        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-navy-200 dark:hover:bg-navy-800 text-navy-500"><X size={20} /></button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-slate-50 dark:bg-navy-900">
                    {loadingPrayer ? (
                        <div className="flex flex-col items-center justify-center py-10 space-y-4">
                            <div className="w-10 h-10 border-4 border-gold-200 border-t-gold-500 rounded-full animate-spin"></div>
                            <p className="text-sm font-bold text-navy-500 dark:text-navy-300">جاري تحديد الموقع...</p>
                        </div>
                    ) : locationError ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
                            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-500">
                                <MapPin size={28} />
                            </div>
                            <p className="text-sm font-bold text-navy-800 dark:text-white px-4">{locationError}</p>
                            <button onClick={onRefreshLocation} className="px-4 py-2 bg-navy-800 text-white rounded-xl text-sm font-bold shadow-md mt-2">إعادة المحاولة</button>
                        </div>
                    ) : prayerData ? (
                        <div className="space-y-6">

                            {/* Info Bar */}
                            <div className="text-center mb-2">
                                <div className="inline-flex items-center gap-1.5 bg-white dark:bg-navy-800 px-3 py-1 rounded-full border border-navy-100 dark:border-navy-700 shadow-sm text-xs font-bold text-navy-500 dark:text-navy-300 mb-2">
                                    <MapPin size={12} /> {localStorage.getItem('user_location_name') || `بتوقيت ${prayerData.meta.timezone}`}
                                    {LocationManager.hasManualLocation() && (
                                        <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[8px] font-bold rounded">يدوي</span>
                                    )}
                                </div>
                                <p className="text-xs text-navy-400 font-medium">{prayerData.date.hijri.weekday.ar} {prayerData.date.hijri.date}</p>

                                {/* Manual Adjustments Indicator */}
                                {(() => {
                                    const adjustments = getPrayerAdjustments();
                                    const hasAdjustments = Object.values(adjustments).some(v => v !== 0);
                                    const adjustmentCount = Object.values(adjustments).filter(v => v !== 0).length;

                                    if (!hasAdjustments) return null;

                                    return (
                                        <div className="mt-2 inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-300">
                                            <Sliders size={12} />
                                            <span className="text-[10px] font-bold">
                                                تعديلات يدوية مُطبقة ({adjustmentCount})
                                            </span>
                                        </div>
                                    );
                                })()}

                                {/* Location Accuracy Indicator */}
                                {(() => {
                                    const savedCoordsRaw = localStorage.getItem('user_location_coords');
                                    if (!savedCoordsRaw) return null;

                                    try {
                                        const { accuracy } = JSON.parse(savedCoordsRaw);
                                        if (!accuracy) return null;

                                        const level = LocationManager.getAccuracyLevel(accuracy);

                                        // Static classes for Tailwind JIT
                                        let badgeClass = '';
                                        let text = '';

                                        if (level === 'excellent' || level === 'good') {
                                            badgeClass = 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300';
                                            text = level === 'excellent' ? 'ممتازة' : 'جيدة';
                                        } else if (level === 'acceptable') {
                                            badgeClass = 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-300';
                                            text = 'مقبولة';
                                        } else if (level === 'poor') {
                                            badgeClass = 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300';
                                            text = 'ضعيفة';
                                        } else {
                                            badgeClass = 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800/50 text-gray-700 dark:text-gray-300';
                                            text = 'غير معروفة';
                                        }

                                        return (
                                            <div className={`mt-2 mr-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${badgeClass}`}>
                                                <Signal size={10} />
                                                <span className="text-[9px] font-bold">
                                                    دقة {text} ({Math.round(accuracy)}م)
                                                </span>
                                            </div>
                                        );
                                    } catch {
                                        return null;
                                    }
                                })()}
                            </div>

                            {/* Next Prayer Card */}
                            {nextPrayer && (
                                <div className="bg-gradient-to-br from-navy-800 to-navy-900 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden text-center">
                                    <div className="relative z-10">
                                        <p className="text-xs text-navy-300 font-bold uppercase tracking-wider mb-1">الصلاة القادمة</p>
                                        <h2 className="text-3xl font-bold font-quran mb-1 text-gold-400">{nextPrayer.name}</h2>
                                        <div className="text-4xl font-bold font-sans tracking-tight mb-2 flex items-baseline justify-center gap-2" dir="ltr">
                                            <span>{formatTime12(nextPrayer.time).time}</span>
                                            <span className="text-lg text-gold-500">{formatTime12(nextPrayer.time).period}</span>
                                        </div>
                                        <div className="inline-block bg-white/10 px-3 py-1 rounded-lg text-xs font-medium backdrop-blur-sm border border-white/10">
                                            {nextPrayer.timeLeft}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Prayer List */}
                            <div className="space-y-2 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
                                {[
                                    { name: 'الفجر', key: 'Fajr', trackKey: 'fajr', icon: <MoonIcon size={16} /> },
                                    { name: 'الشروق', key: 'Sunrise', trackKey: null, icon: <Sunrise size={16} /> },
                                    { name: getDhuhrName(isFriday), key: 'Dhuhr', trackKey: 'dhuhr', icon: <Sun size={16} /> },
                                    { name: 'العصر', key: 'Asr', trackKey: 'asr', icon: <Sun size={16} className="opacity-70" /> },
                                    { name: 'المغرب', key: 'Maghrib', trackKey: 'maghrib', icon: <Sunset size={16} /> },
                                    { name: 'العشاء', key: 'Isha', trackKey: 'isha', icon: <Moon size={16} /> },
                                ].map((p, idx) => {
                                    const time24 = prayerData.timings[p.key as keyof typeof prayerData.timings];
                                    const formatted = formatTime12(time24);
                                    const isNext = nextPrayer?.name === p.name;
                                    const isCompleted = p.trackKey ? prayerTracking.prayers[p.trackKey as keyof PrayerTracking['prayers']] : false;
                                    const isPrayer = p.trackKey !== null;

                                    // Virtue Lookup - Handle Friday specially
                                    const virtueKeyMap: Record<string, string> = {
                                        'الفجر': 'Fajr',
                                        'الشروق': 'Sunrise',
                                        'الظهر': 'Dhuhr',
                                        'الجمعة': 'Friday', // Friday prayer virtue
                                        'العصر': 'Asr',
                                        'المغرب': 'Maghrib',
                                        'العشاء': 'Isha'
                                    };
                                    const virtue = PRAYER_VIRTUES[virtueKeyMap[p.name]] || null;

                                    return (
                                        <div
                                            key={idx}
                                            className={`relative p-4 rounded-2xl border transition-all duration-300 ${isPrayer ? 'cursor-pointer' : ''} ${isNext
                                                ? 'bg-gold-50/50 dark:bg-gold-900/10 border-gold-200 dark:border-gold-700 shadow-sm scale-[1.02] z-10'
                                                : 'bg-white dark:bg-navy-900 border-neutral-100 dark:border-navy-800'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between pointer-events-none">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-xl transition-colors ${isCompleted
                                                        ? 'bg-emerald-500 text-white'
                                                        : isNext
                                                            ? 'bg-gold-500 text-white shadow-md'
                                                            : 'bg-navy-50 dark:bg-navy-800 text-navy-400 dark:text-navy-300'
                                                        }`}>
                                                        {isCompleted ? <Check size={18} /> : p.icon}
                                                    </div>
                                                    <div>
                                                        <h3 className={`font-bold text-base ${isNext ? 'text-navy-900 dark:text-white' : 'text-navy-600 dark:text-navy-300'}`}>
                                                            {p.name}
                                                        </h3>
                                                        <p className="text-xs font-mono text-navy-400 mt-0.5" dir="ltr">
                                                            {formatted.time} <span className="font-sans">{formatted.period}</span>
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Action Button - Only for prayers */}
                                                {isPrayer && (
                                                    <div className="pointer-events-auto">
                                                        {isCompleted ? (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handlePrayerTap(p.key, p.name); }}
                                                                className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition-all hover:bg-red-100 hover:text-red-500 group"
                                                                title="تراجع"
                                                            >
                                                                <Check size={20} className="group-hover:hidden" />
                                                                <RotateCcw size={20} className="hidden group-hover:block" />
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handlePrayerTap(p.key, p.name); }}
                                                                className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${isNext
                                                                    ? 'bg-navy-900 dark:bg-gold-500 text-white border-transparent shadow-lg shadow-gold-500/20 active:scale-95'
                                                                    : 'bg-transparent border-navy-200 dark:border-navy-700 text-navy-400 hover:border-gold-500 hover:text-gold-500'
                                                                    }`}
                                                            >
                                                                صليت
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Virtue / Hadith Section */}
                                            {virtue && (
                                                <div className={`mt-3 pt-3 border-t border-dashed ${isNext ? 'border-gold-200 dark:border-gold-800' : 'border-neutral-100 dark:border-navy-800'}`}>
                                                    <div className="flex gap-2 items-start">
                                                        <Quote size={12} className={`shrink-0 mt-1 ${isNext ? 'text-gold-500' : 'text-navy-300'} rotate-180`} />
                                                        <p className={`text-[11px] leading-relaxed font-medium ${isNext ? 'text-navy-700 dark:text-gray-300' : 'text-navy-400 dark:text-navy-500'}`}>
                                                            {virtue.text}
                                                            <span className="text-[9px] opacity-60 mr-1 block sm:inline sm:mr-2 text-navy-400">({virtue.source})</span>
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* INTEGRATED PRAYER DASHBOARD */}
                            <div className="mt-6 pt-6 border-t border-navy-100 dark:border-navy-800">
                                <h4 className="text-sm font-bold text-navy-500 dark:text-navy-400 mb-4 flex items-center gap-2">
                                    <Check size={16} /> متابعة الصلوات
                                </h4>
                                <PrayerDashboard
                                    prayerCount={currentPrayerCount}
                                    onHistoryClick={() => setShowHistoryModal(true)}
                                />
                            </div>

                        </div>
                    ) : null}
                </div>
            </div>

            {/* --- SUB MODALS (Confirm / Undo / Reset) --- */}

            {/* Confirmation Modal */}
            {
                confirmPrayerModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm" onClick={() => setConfirmPrayerModal(null)}></div>
                        <div className="relative w-full max-w-sm bg-white dark:bg-navy-900 rounded-3xl shadow-2xl overflow-hidden border border-navy-100 dark:border-navy-800 animate-in zoom-in-95">
                            <div className="p-6 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white text-center">
                                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
                                    <Check size={32} />
                                </div>
                                <h3 className="text-2xl font-bold font-quran">{confirmPrayerModal.name}</h3>
                            </div>
                            <div className="p-6 text-center">
                                <p className="text-lg font-bold text-navy-800 dark:text-white mb-4">هل صليت هذه الفريضة؟</p>
                                <div className="flex gap-3">
                                    <button onClick={() => setConfirmPrayerModal(null)} className="flex-1 py-3 px-4 rounded-xl font-bold text-navy-600 dark:text-navy-300 bg-navy-100 dark:bg-navy-800 hover:bg-navy-200 dark:hover:bg-navy-700 transition-colors">لاحقًا</button>
                                    <button onClick={handleConfirmPrayer} className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"><Check size={18} /> صليت ✓</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Undo Modal */}
            {
                undoPrayerModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-[2px] transition-opacity" onClick={() => setUndoPrayerModal(null)}></div>
                        <div className="relative w-full max-w-sm bg-white dark:bg-navy-900 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 border border-navy-100 dark:border-navy-700 p-6 text-center">
                            <div className="w-12 h-12 rounded-full bg-navy-100 dark:bg-navy-800 flex items-center justify-center mx-auto mb-4 text-navy-500"><Undo2 size={24} /></div>
                            <h3 className="font-bold text-lg text-navy-900 dark:text-white mb-2">تراجع عن الصلاة؟</h3>
                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setUndoPrayerModal(null)} className="flex-1 py-2.5 px-4 rounded-xl font-bold text-navy-500 hover:bg-navy-50 dark:hover:bg-navy-800 transition-colors">إلغاء</button>
                                <button onClick={handleUndoPrayer} className="flex-1 py-2.5 px-4 rounded-xl font-bold text-white bg-navy-600 hover:bg-navy-700 transition-colors">تراجع</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Reset Modal */}
            {
                showResetConfirm && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-[2px] transition-opacity" onClick={() => setShowResetConfirm(false)}></div>
                        <div className="relative w-full max-w-sm bg-white dark:bg-navy-900 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 border border-navy-100 dark:border-navy-700 p-6 text-center">
                            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4 text-red-500"><RotateCcw size={24} /></div>
                            <h3 className="font-bold text-lg text-navy-900 dark:text-white mb-2">إعادة تعيين الصلوات؟</h3>
                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setShowResetConfirm(false)} className="flex-1 py-2.5 px-4 rounded-xl font-bold text-navy-500 hover:bg-navy-50 dark:hover:bg-navy-800 transition-colors">إلغاء</button>
                                <button onClick={handleResetPrayers} className="flex-1 py-2.5 px-4 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 transition-colors">إعادة التعيين</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Prayer History Calendar Modal */}
            <PrayerHistoryCalendar
                isOpen={showHistoryModal}
                onClose={() => setShowHistoryModal(false)}
            />

        </div >
    );
};
