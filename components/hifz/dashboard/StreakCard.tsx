import React from 'react';
import { Flame, Check, Zap } from 'lucide-react';
import { toArabicDigits } from '../../../services/normalization';

interface StreakCardProps {
    streak: number;
    history: string[];
}

export const StreakCard: React.FC<StreakCardProps> = ({ streak, history }) => {

    // Helper: Local Today String
    const getLocalTodayString = (): string => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getWeekDays = () => {
        const d = new Date();
        const day = d.getDay();
        const diff = (day + 1) % 7;
        const sat = new Date(d);
        sat.setDate(d.getDate() - diff);

        const days = [];
        for (let i = 0; i < 7; i++) {
            const temp = new Date(sat);
            temp.setDate(sat.getDate() + i);
            days.push(temp);
        }
        return days;
    };

    const weekDays = getWeekDays();
    const todayStr = getLocalTodayString();

    return (
        <div className="group relative overflow-hidden rounded-3xl bg-white/80 dark:bg-navy-900/90 backdrop-blur-xl border border-white/30 dark:border-white/5 shadow-lg hover:shadow-xl transition-all duration-300 p-5 md:p-6 flex flex-col justify-between h-full select-none">

            {/* Ambient Glow - Enhanced */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-orange-500/25 transition-all duration-500"></div>

            {/* Fire particles for high streaks */}
            {streak >= 7 && (
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                    <Zap className="absolute top-4 right-8 text-orange-400 animate-pulse" size={14} />
                    <Zap className="absolute bottom-8 right-12 text-yellow-400 animate-pulse delay-150" size={12} />
                </div>
            )}

            <div className="flex items-center justify-between mb-5 relative z-10">
                <div>
                    <span className="text-xs md:text-sm font-bold text-navy-400 dark:text-navy-300 uppercase tracking-wider">سجل الالتزام</span>
                    <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-3xl md:text-4xl font-black text-navy-900 dark:text-white drop-shadow-sm">{toArabicDigits(streak)}</span>
                        <span className="text-xs text-navy-500 dark:text-navy-400 font-medium">يوم متتالي</span>
                    </div>
                </div>
                <div className="relative w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center text-orange-500 shadow-lg border border-orange-500/20 group-hover:scale-110 transition-transform duration-300">
                    {/* Animated flame */}
                    <Flame size={24} fill="currentColor" className="fill-current opacity-90 animate-pulse" />
                    {streak >= 7 && (
                        <div className="absolute inset-0 bg-orange-400/20 rounded-2xl animate-ping"></div>
                    )}
                </div>
            </div>

            {/* Week Grid - Enhanced */}
            <div className="grid grid-cols-7 gap-1.5 md:gap-2 relative z-10" dir="rtl">
                {weekDays.map((date, i) => {
                    const m = String(date.getMonth() + 1).padStart(2, '0');
                    const dStr = String(date.getDate()).padStart(2, '0');
                    const dateKey = `${date.getFullYear()}-${m}-${dStr}`;
                    const isToday = dateKey === todayStr;
                    const isDone = history.includes(dateKey);

                    return (
                        <div key={i} className="flex flex-col gap-1 items-center">
                            <span className={`text-[10px] md:text-xs font-bold transition-colors ${isToday ? 'text-orange-500' : 'text-navy-400 dark:text-navy-500'
                                }`}>
                                {['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'][i]}
                            </span>
                            <div className={`w-8 h-9 md:w-9 md:h-10 rounded-xl flex items-center justify-center text-xs font-black transition-all duration-300 ${isDone
                                    ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 scale-105 ring-2 ring-emerald-400/30'
                                    : isToday
                                        ? 'bg-white dark:bg-navy-800 border-2 border-orange-500 text-navy-900 dark:text-white shadow-md ring-2 ring-orange-400/20'
                                        : 'bg-navy-50/70 dark:bg-navy-800/60 text-navy-400 dark:text-navy-600 border border-navy-100 dark:border-navy-700'
                                }`}>
                                {isDone ? <Check size={14} strokeWidth={3} /> : <span className="text-[11px]">{toArabicDigits(date.getDate())}</span>}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Streak message */}
            {streak >= 7 && (
                <div className="mt-4 text-center">
                    <p className="text-xs text-orange-600 dark:text-orange-400 font-bold animate-pulse">
                        🔥 سلسلة رائعة! استمر في التقدم
                    </p>
                </div>
            )}
        </div>
    );
};
