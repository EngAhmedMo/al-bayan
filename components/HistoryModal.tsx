import React, { useState, useEffect } from 'react';
import { App } from '@capacitor/app';
import { X, Flame, Calendar, Trophy, Zap, BookOpen, CheckCircle2, Sparkles, Quote, History } from 'lucide-react';
import { getWeeklyCompletion, getCurrentStreak, getTotalPrayersCount } from '../services/storage';
import { PrayerHistoryCalendar } from './PrayerHistoryCalendar';

const toArabicDigits = (n: number | string) => {
    return n.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
};

const DAY_MAP: Record<string, string> = {
    'Saturday': 'السبت', 'Sunday': 'الأحد', 'Monday': 'الاثنين',
    'Tuesday': 'الثلاثاء', 'Wednesday': 'الأربعاء', 'Thursday': 'الخميس', 'Friday': 'الجمعة'
};

// Arabic day abbreviations (single character)
const DAY_SHORT_AR: Record<string, string> = {
    'السبت': 'س',
    'الأحد': 'ح',
    'الاثنين': 'ن',
    'الثلاثاء': 'ث',
    'الأربعاء': 'ر',
    'الخميس': 'خ',
    'الجمعة': 'ج',
};

// Fixed Arabic week order (Saturday to Friday)
const WEEK_DAYS_AR = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
}


export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose }) => {
    const [stats, setStats] = useState({
        currentStreak: 0,
        longestStreak: 0,
        completedCount: 0,
        unit: 'verses' as 'verses' | 'pages',
        prayersOnTime: 0,
    });

    const [weeklyActivity, setWeeklyActivity] = useState<{ day: string, status: 'full' | 'partial' | 'none' }[]>([]);
    const [todayAr, setTodayAr] = useState<string>('');
    const [showFullHistory, setShowFullHistory] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadStats();
        }
    }, [isOpen]);

    // Handle Native Back Button (Android)
    useEffect(() => {
        if (!isOpen) return;

        const handleNativeBack = async () => {
            if (showFullHistory) {
                setShowFullHistory(false);
                return;
            }
            onClose();
        };

        const listener = App.addListener('backButton', handleNativeBack);
        return () => {
            listener.then(l => l.remove());
        };
    }, [isOpen, onClose, showFullHistory]);

    // Handle Escape Key (Web/Desktop)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                if (showFullHistory) {
                    setShowFullHistory(false);
                } else {
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, showFullHistory]);

    const loadStats = () => {
        try {
            // 1. Load Prayer Data
            const streak = getCurrentStreak();
            const totalPrayers = getTotalPrayersCount();

            // Calculate "Prayers On Time" % (Approximation based on history)
            // If we have history, we can approximate. For now, max is Total / (Days * 5)
            // But getting exact days is tricky. Let's just show Total Count -> which is "completedCount" for Hifz?
            // Wait, the UI mixes Hifz and Prayers.
            // Top Left: Hifz. Top Right: Streak (Prayer?).
            // Let's use Streak for Prayer.

            // Calculate % : (Weekly Completed / 35) * 100
            const weekly = getWeeklyCompletion();

            // Build a map of day -> status from the data
            const mappedByDay: Record<string, 'full' | 'partial' | 'none'> = {};
            weekly.forEach(d => {
                const date = new Date(d.date);
                const dayNameEn = date.toLocaleDateString('en-US', { weekday: 'long' });
                const dayAr = DAY_MAP[dayNameEn] || dayNameEn;
                mappedByDay[dayAr] = d.status;
            });

            // Create fixed 7-day array (Saturday to Friday) with status
            const finalWeekly = WEEK_DAYS_AR.map(dayAr => ({
                day: dayAr,
                status: mappedByDay[dayAr] ?? 'none'
            }));
            setWeeklyActivity(finalWeekly);

            // Set current day for highlighting
            const todayEn = new Date().toLocaleDateString('en-US', { weekday: 'long' });
            setTodayAr(DAY_MAP[todayEn] || '');

            // 2. Load Hifz Data (Keep existing logic)
            const savedHifz = localStorage.getItem('albayan_hifz_plan_v1');
            let hifzCount = 0;
            let unit: 'verses' | 'pages' = 'verses';

            if (savedHifz) {
                const hifzState = JSON.parse(savedHifz);
                if (hifzState.planType === 'pages') {
                    hifzCount = hifzState.currentProgress || 0;
                    unit = 'pages';
                } else {
                    hifzCount = hifzState.currentProgress || 0;
                    unit = 'verses';
                }
            }

            // Calculate Prayer Commitment % (Weekly based)
            let weeklyTotal = 0;
            // We need a helper for count, but getWeeklyCompletion returns status.
            // Let's trust accurate updates.
            // For now, let's just use a placeholder based on streak or leave 100% if streak > 0?
            // Actually, let's use: (Streak > 7 ? 100 : (Streak/7)*100) or similar.
            // Better: Count partials.
            const commitParams = weekly.filter(d => d.status === 'full').length;
            const commitPercent = Math.round((commitParams / 7) * 100);

            setStats(prev => ({
                ...prev,
                completedCount: hifzCount,
                unit: unit,
                currentStreak: streak, // Now showing Prayer Streak
                prayersOnTime: commitPercent
            }));

        } catch (e) {
            console.error("Error loading stats", e);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
                <div className="w-full max-w-sm md:max-w-4xl bg-white dark:bg-navy-900 rounded-3xl shadow-2xl border border-gold-200/50 dark:border-navy-700 overflow-hidden relative animate-in zoom-in-95 duration-300 md:flex md:flex-row md:h-[550px]" onClick={(e) => e.stopPropagation()}>

                    {/* Header / Sidebar (Left on Tablet) */}
                    <div className="bg-gradient-to-br from-amber-500 via-gold-500 to-orange-600 p-6 pt-8 md:p-8 text-white relative overflow-hidden md:w-2/5 md:flex md:flex-col md:justify-between">
                        {/* Islamic Pattern Overlay */}
                        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/arabesque.png')]"></div>

                        {/* Decorative Glows */}
                        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-12 -mt-12 blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-400/20 rounded-full -ml-8 -mb-8 blur-2xl"></div>

                        {/* Trophy Icon */}
                        <div className="absolute top-4 right-4 opacity-15 md:opacity-10 scale-150 md:scale-[2]">
                            <Trophy size={80} />
                        </div>

                        {/* Close Button - Optimized Position */}
                        <button
                            onClick={(e) => { e.stopPropagation(); onClose(); }}
                            className="absolute top-4 left-4 z-50 p-2 md:p-3 bg-white/20 hover:bg-white/30 active:bg-white/40 rounded-xl transition-all hover:rotate-90 backdrop-blur-sm border border-white/20 shadow-lg text-white"
                            aria-label="إغلاق"
                        >
                            <X size={20} strokeWidth={2.5} />
                        </button>

                        {/* Title Section */}
                        <div className="relative z-10 mb-6 md:mb-0">
                            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm px-3 py-1 rounded-full border border-white/20 mb-4 shadow-sm">
                                <Sparkles size={12} className="text-yellow-200" />
                                <span className="text-[10px] font-bold text-white/95 uppercase tracking-widest">تتبع إنجازاتك</span>
                            </div>
                            <h2 className="text-2xl md:text-3xl font-bold font-quran mb-2 drop-shadow-md">إحصائيات العبادة</h2>
                            <p className="text-amber-50/90 text-xs md:text-sm font-bold leading-relaxed">تابع التزامك اليومي في الصلاة والحفظ القرآني</p>
                        </div>

                        {/* Stats Cards - Adaptive Layout */}
                        <div className="flex items-center gap-3 mt-4 md:mt-8 relative z-10 md:flex-col md:gap-4 md:items-stretch">
                            {/* Prayer Streak Card */}
                            <div className="flex-1 bg-white/20 backdrop-blur-xl rounded-2xl p-4 md:p-5 border border-white/20 flex flex-col items-center md:flex-row md:gap-4 shadow-lg hover:bg-white/25 transition-all group">
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-orange-300 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30 group-hover:scale-110 transition-transform">
                                    <Flame className="text-white" fill="currentColor" size={20} />
                                </div>
                                <div className="text-center md:text-right">
                                    <span className="block text-3xl md:text-2xl font-black font-sans leading-none mb-1 md:mb-0">{toArabicDigits(stats.currentStreak)}</span>
                                    <span className="text-[10px] md:text-xs text-white/90 font-bold">أيام التزام</span>
                                </div>
                            </div>

                            {/* Memorization Card */}
                            <div className="flex-1 bg-white/20 backdrop-blur-xl rounded-2xl p-4 md:p-5 border border-white/20 flex flex-col items-center md:flex-row md:gap-4 shadow-lg hover:bg-white/25 transition-all group">
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform">
                                    <CheckCircle2 className="text-white" size={20} />
                                </div>
                                <div className="text-center md:text-right">
                                    <span className="block text-3xl md:text-2xl font-black font-sans leading-none mb-1 md:mb-0">{toArabicDigits(stats.completedCount)}</span>
                                    <span className="text-[10px] md:text-xs text-white/90 font-bold">{stats.unit === 'pages' ? 'صفحة محفوظة' : 'آية محفوظة'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Body / Content (Right on Tablet) */}
                    <div className="p-5 sm:p-6 md:p-8 space-y-5 bg-gradient-to-b from-white to-gold-50/30 dark:from-navy-900 dark:to-navy-950 md:w-3/5 md:overflow-y-auto md:flex md:flex-col md:justify-center custom-scrollbar">

                        {/* Weekly Activity (Dynamic) - Enhanced */}
                        <div className="bg-white dark:bg-navy-800 p-4 rounded-2xl border border-gold-100 dark:border-navy-700 shadow-lg shadow-gold-500/5 dark:shadow-navy-950/50">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-navy-900 dark:text-white font-bold flex items-center gap-2 text-sm">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-400 to-amber-500 flex items-center justify-center shadow-lg shadow-gold-500/20">
                                        <Calendar size={14} className="text-white" />
                                    </div>
                                    النشاط الأسبوعي
                                </h3>
                                <button
                                    onClick={() => setShowFullHistory(true)}
                                    className="p-2 rounded-full hover:bg-navy-100 dark:hover:bg-navy-800 text-navy-400 dark:text-navy-500 transition-colors"
                                    title="السجل الكامل"
                                >
                                    <Calendar size={20} />
                                </button>
                            </div>
                            <div className="flex justify-between items-end h-24 px-1 md:px-4">
                                {weeklyActivity.map((day, idx) => {
                                    const isToday = day.day === todayAr;
                                    return (
                                        <div
                                            key={idx}
                                            className={`flex flex-col items-center gap-2 group flex-1 transition-transform ${isToday ? 'scale-110 -translate-y-1' : ''
                                                }`}
                                        >
                                            {/* Day Circle/Bar */}
                                            <div className="relative">
                                                <div
                                                    className={`w-4 h-4 md:w-5 md:h-5 rounded-full transition-all duration-500
                                                    ${day.status === 'full'
                                                            ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/40'
                                                            : day.status === 'partial'
                                                                ? 'bg-gradient-to-br from-amber-400 to-amber-500 shadow-md shadow-amber-500/30'
                                                                : 'bg-gray-200 dark:bg-navy-700'
                                                        } ${isToday ? 'ring-4 ring-gold-200 dark:ring-navy-600' : ''}`}
                                                />
                                                {day.status === 'full' && (
                                                    <CheckCircle2
                                                        size={12}
                                                        className="absolute -top-1.5 -right-1.5 text-emerald-500 bg-white dark:bg-navy-800 rounded-full"
                                                    />
                                                )}
                                            </div>
                                            {/* Day Label */}
                                            <span className={`text-[10px] md:text-xs font-bold transition-colors ${isToday
                                                ? 'text-gold-600 dark:text-gold-400'
                                                : 'text-navy-400 dark:text-navy-500'
                                                }`}>
                                                {DAY_SHORT_AR[day.day] ?? day.day}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Detailed Stats - Enhanced */}
                        <div className="grid grid-cols-2 gap-3 md:gap-4">
                            {/* Memorized Pages/Verses */}
                            <div className="bg-white dark:bg-navy-800 p-4 rounded-2xl border border-gold-100 dark:border-navy-700 shadow-lg shadow-gold-500/5 dark:shadow-navy-950/50 flex items-center gap-3 hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-default group">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:rotate-6 transition-transform">
                                    <BookOpen size={20} className="text-white" />
                                </div>
                                <div>
                                    <span className="block text-xl font-black text-navy-900 dark:text-white font-sans">{toArabicDigits(stats.completedCount)}</span>
                                    <span className="text-[10px] text-navy-500 dark:text-navy-400 font-bold">{stats.unit === 'pages' ? 'صفحة' : 'آية'}</span>
                                </div>
                            </div>

                            {/* Prayer Commitment */}
                            <div className="bg-white dark:bg-navy-800 p-4 rounded-2xl border border-gold-100 dark:border-navy-700 shadow-lg shadow-gold-500/5 dark:shadow-navy-950/50 flex items-center gap-3 hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-default group">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:rotate-6 transition-transform">
                                    <Zap size={20} className="text-white" />
                                </div>
                                <div>
                                    <span className="block text-xl font-black text-navy-900 dark:text-white font-sans">%{toArabicDigits(stats.prayersOnTime)}</span>
                                    <span className="text-[10px] text-navy-500 dark:text-navy-400 font-bold">التزام</span>
                                </div>
                            </div>
                        </div>

                        {/* Motivation Quote - Enhanced */}
                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/10 border border-amber-200/50 dark:border-amber-700/30 p-4 rounded-2xl shadow-lg shadow-amber-500/5 relative overflow-hidden">
                            {/* Decorative Quote Icon */}
                            <div className="absolute top-2 right-2 opacity-10">
                                <Quote size={40} className="text-amber-600" />
                            </div>
                            <p className="text-center text-amber-800 dark:text-amber-200 text-sm font-quran leading-loose relative z-10">
                                "أَحَبُّ الْأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ"
                            </p>
                            <p className="text-center text-amber-600/70 dark:text-amber-400/50 text-[10px] font-bold mt-2">متفق عليه</p>
                        </div>

                    </div>
                </div>
            </div>
            {/* Full History Calendar Modal */}
            <PrayerHistoryCalendar isOpen={showFullHistory} onClose={() => setShowFullHistory(false)} />
        </>
    );
};
