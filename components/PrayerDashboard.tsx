import React, { useEffect, useState } from 'react';
import { Flame, Check, ChevronRight, Activity, Calendar } from 'lucide-react';
import { getCurrentStreak, getWeeklyCompletion, getTotalPrayersCount, ARABIC_DAY_NAMES } from '../services/storage';
import { getRandomFaithMessage, FaithMessage } from '../services/faithMessages';

export const PrayerDashboard: React.FC<{
    prayerCount: number; // Current day's count (0-5)
    onHistoryClick?: () => void;
}> = ({ prayerCount, onHistoryClick }) => {
    const [streak, setStreak] = useState(0);
    const [totalPrayers, setTotalPrayers] = useState(0);
    const [weeklyData, setWeeklyData] = useState<{ date: string, status: 'full' | 'partial' | 'none' }[]>([]);
    const [message, setMessage] = useState<FaithMessage | null>(null);

    useEffect(() => {
        // Load data
        setStreak(getCurrentStreak());
        setTotalPrayers(getTotalPrayersCount());
        setWeeklyData(getWeeklyCompletion());
    }, [prayerCount]); // Reload when prayer count changes

    useEffect(() => {
        // Smart Message Selection
        if (streak > 2 && prayerCount === 5) {
            setMessage(getRandomFaithMessage('success'));
        } else if (prayerCount === 5) {
            setMessage(getRandomFaithMessage('success'));
        } else if (prayerCount === 0) {
            // Check yesterday
            const yesterdayStatus = weeklyData[weeklyData.length - 2]?.status;
            if (yesterdayStatus === 'none' || yesterdayStatus === 'partial') {
                setMessage(getRandomFaithMessage('comfort'));
            } else {
                setMessage(getRandomFaithMessage('info'));
            }
        } else {
            setMessage(getRandomFaithMessage('info'));
        }
    }, [streak, prayerCount, weeklyData]);

    // Get today's index in the Arabic week (0=Saturday, 6=Friday)
    const todayDate = new Date().toISOString().split('T')[0];
    const todayIndex = weeklyData.findIndex(day => day.date === todayDate);

    return (
        <div className="w-full mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
            {/* Main Card - Glassmorphism & Dimensional Depth */}
            <div className="relative bg-white/80 dark:bg-navy-900/60 backdrop-blur-md rounded-[2rem] p-5 sm:p-6 shadow-xl border border-white/50 dark:border-navy-700 overflow-hidden group">

                {/* Decorative Background Gradient */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 group-hover:bg-emerald-500/15 transition-colors duration-700"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-gold-500/10 dark:bg-gold-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 group-hover:bg-gold-500/15 transition-colors duration-700"></div>

                {/* Top Row: Stats */}
                <div className="flex items-center justify-between mb-5 relative z-10">
                    <div className="flex items-center gap-2 sm:gap-3">
                        {/* Streak Badge */}
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold shadow-md transition-all duration-300 ${streak > 0
                            ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-orange-500/30'
                            : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-navy-400'
                            }`}>
                            <Flame size={16} className={streak > 0 ? "fill-white animate-pulse" : ""} />
                            <span>{streak} أيـام</span>
                        </div>

                        {/* Total Count (Subtle) */}
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-navy-50 dark:bg-navy-800 text-navy-600 dark:text-navy-300 text-xs font-bold font-mono">
                            <Activity size={14} />
                            <span>{totalPrayers}</span>
                        </div>
                    </div>

                    {/* History Button */}
                    <button
                        onClick={onHistoryClick}
                        className="p-2 rounded-full hover:bg-navy-100 dark:hover:bg-navy-800 text-navy-400 dark:text-navy-500 transition-colors"
                        aria-label="View History"
                    >
                        <Calendar size={20} />
                    </button>
                </div>

                {/* Middle Row: Weekly Rings (Visual Progress) - RTL Order: السبت → الجمعة */}
                <div className="flex justify-between items-center mb-5 relative z-10 gap-1">
                    {weeklyData.map((day, index) => {
                        const isToday = day.date === todayDate;
                        return (
                            <div key={index} className="flex flex-col items-center gap-1.5">
                                {/* The Ring */}
                                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${day.status === 'full'
                                    ? 'bg-emerald-500 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] scale-110'
                                    : day.status === 'partial'
                                        ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-500 text-amber-500'
                                        : isToday
                                            ? 'bg-gold-50 dark:bg-navy-800 border-gold-400 dark:border-gold-500 ring-2 ring-gold-300 dark:ring-gold-600'
                                            : 'bg-navy-50 dark:bg-navy-800 border-navy-200 dark:border-navy-700'
                                    }`}>
                                    {day.status === 'full' && <Check size={16} className="text-white stroke-[3px]" />}
                                    {day.status === 'partial' && <div className="w-2 h-2 rounded-full bg-amber-500"></div>}
                                </div>

                                {/* Day Label - Abbreviated (Remove 'ال' prefix) */}
                                <span className={`text-[10px] sm:text-[11px] font-bold transition-colors ${isToday
                                    ? 'text-gold-600 dark:text-gold-400'
                                    : 'text-navy-400 dark:text-navy-500'
                                    }`}>
                                    {ARABIC_DAY_NAMES[index].replace('ال', '')}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Bottom Row: Smart Motivational Message */}
                {message && (
                    <div className="relative z-10 bg-gradient-to-r from-navy-50 to-white dark:from-navy-800 dark:to-navy-900 rounded-xl p-4 border-r-4 border-r-gold-400 dark:border-r-gold-500 shadow-sm">
                        <p className="text-sm font-bold text-navy-800 dark:text-gray-100 mb-1 leading-relaxed">
                            {message.text}
                        </p>
                        <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                            <span className="text-[10px] text-navy-500 dark:text-navy-400 font-medium bg-navy-100 dark:bg-navy-950 px-2 py-0.5 rounded-md">
                                {message.source}
                            </span>
                            {prayerCount < 5 && (
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 animate-pulse">
                                    واصل .. باقي {5 - prayerCount} صلوات
                                </span>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};
