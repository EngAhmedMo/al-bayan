import React from 'react';
import { motion } from 'framer-motion';
import { SrsItem, getDueItems } from '../../services/srsAlgorithm';
import { HifzTestResult } from '../../services/hifzManager';
import { toArabicDigits } from '../../services/normalization';
import { Activity, AlertTriangle, Calendar, TrendingUp, Layers, Zap, ArrowUpRight } from 'lucide-react';

// --- Design System ---
const CARD_STYLE = "bg-white dark:bg-navy-900 rounded-3xl p-5 md:p-6 shadow-sm border border-gray-100 dark:border-navy-700";

// --- Review Forecast Component ---
export const ReviewForecast = ({ srsItems }: { srsItems: SrsItem[] }) => {
    const now = new Date();
    const todayCount = srsItems.filter(i => getDueItems(srsItems).includes(i)).length;

    const nextDays = Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setDate(now.getDate() + i + 1);
        const count = srsItems.filter(item => {
            const dueDate = new Date(item.dueDate);
            return dueDate.toDateString() === d.toDateString();
        }).length;
        return { day: d, count, isToday: false };
    });

    return (
        <div className={CARD_STYLE}>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                        <Calendar className="text-indigo-500" size={20} />
                    </div>
                    <div>
                        <h4 className="font-bold text-navy-900 dark:text-white text-base">حِمل المراجعة</h4>
                        <p className="text-[10px] text-gray-500 font-bold">الأسبوع القادم</p>
                    </div>
                </div>
                <div className="text-xs font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 rounded-full">
                    {toArabicDigits(todayCount)} اليوم
                </div>
            </div>

            <div className="flex items-end justify-between gap-3 h-32 pt-4">
                {/* Columns */}
                {[{ day: now, count: todayCount, isToday: true }, ...nextDays].map((d, i) => {
                    const max = Math.max(20, ...nextDays.map(d => d.count), todayCount);
                    const heightPercent = Math.max(15, (d.count / max) * 100);

                    return (
                        <div key={i} className="flex flex-col items-center gap-2 w-full group relative">
                            {/* Bar */}
                            <div className="w-full relative flex items-end justify-center h-full">
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: `${heightPercent}%` }}
                                    transition={{ type: "spring", stiffness: 100, damping: 20, delay: i * 0.05 }}
                                    className={`w-full max-w-[24px] rounded-t-xl relative transition-all duration-300 ${d.isToday
                                        ? 'bg-gradient-to-t from-indigo-600 to-indigo-400 shadow-lg shadow-indigo-500/20'
                                        : 'bg-gray-100 dark:bg-navy-800 group-hover:bg-indigo-200 dark:group-hover:bg-navy-700'
                                        }`}
                                >
                                    {/* Tooltip */}
                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-navy-900 text-white text-[10px] py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all font-bold whitespace-nowrap z-20 shadow-xl pointer-events-none mb-2">
                                        {toArabicDigits(d.count)} آية
                                        <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-navy-900"></div>
                                    </div>
                                </motion.div>
                            </div>

                            {/* Label */}
                            <span className={`text-[10px] font-bold ${d.isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}>
                                {i === 0 ? 'اليوم' : d.day.toLocaleDateString('ar-EG', { weekday: 'short' }).replace('ال', '')}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- Mistake History Chart ---
export const MistakeHistoryChart = ({ mistakeMap }: { mistakeMap?: Record<string, number> }) => {
    if (!mistakeMap || Object.keys(mistakeMap).length === 0) return null;

    const sortedMistakes = Object.entries(mistakeMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3); // Showing Top 3 only for cleaner UI

    return (
        <div className={CARD_STYLE}>
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-amber-50 dark:bg-amber-900/30 rounded-xl">
                    <AlertTriangle className="text-amber-500" size={20} />
                </div>
                <div>
                    <h4 className="font-bold text-navy-900 dark:text-white text-base">نقاط التركيز</h4>
                    <p className="text-[10px] text-gray-500 font-bold">أكثر الأخطاء تكراراً</p>
                </div>
            </div>

            <div className="space-y-3">
                {sortedMistakes.map(([key, count], idx) => (
                    <div key={key} className="flex items-center justify-between p-3 bg-amber-50/50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-800/30 group hover:border-amber-200 transition-colors">
                        <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-white dark:bg-navy-800 flex items-center justify-center text-xs font-black text-amber-500 shadow-sm border border-amber-100 dark:border-amber-800/50">
                                {idx + 1}
                            </span>
                            <span className="text-xs md:text-sm font-quran text-navy-800 dark:text-navy-100">
                                موضع #{toArabicDigits(key)}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-white dark:bg-navy-800 px-2 py-1 rounded-lg border border-amber-100 dark:border-amber-800/30">
                            {toArabicDigits(count)} <span className="text-[8px] opacity-70">أخطاء</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


// --- Accuracy Trend Chart ---
export const AccuracyTrendChart = ({ history }: { history: HifzTestResult[] }) => {
    if (!history || history.length === 0) return null;

    const data = history.slice(-10); // Last 10 tests

    return (
        <div className={CARD_STYLE}>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl">
                        <TrendingUp className="text-emerald-500" size={20} />
                    </div>
                    <div>
                        <h4 className="font-bold text-navy-900 dark:text-white text-base">مستوى الأداء</h4>
                        <p className="text-[10px] text-gray-500 font-bold">آخر ١٠ اختبارات</p>
                    </div>
                </div>
                <div className="flex items-center gap-1 text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-lg">
                    <ArrowUpRight size={14} />
                    <span className="text-xs font-bold">94%</span>
                </div>
            </div>

            <div className="h-32 flex items-end justify-between gap-1.5 px-2 relative">
                {/* Guidelines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-30">
                    <div className="border-t border-dashed border-gray-300 w-full"></div>
                    <div className="border-t border-dashed border-gray-300 w-full"></div>
                    <div className="border-t border-dashed border-gray-300 w-full"></div>
                </div>

                {data.map((h, i) => (
                    <div key={i} className="flex flex-col items-center flex-1 h-full justify-end group z-10">
                        <div className="relative w-full flex justify-center h-full items-end">
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${Math.max(15, h.score)}%` }}
                                transition={{ type: "spring", stiffness: 80, delay: i * 0.05 }}
                                className={`w-2 md:w-3 rounded-t-full transition-all duration-300 hover:w-3 md:hover:w-4 ${h.score >= 90 ? 'bg-emerald-500' :
                                    h.score >= 70 ? 'bg-amber-400' : 'bg-red-400'
                                    }`}
                            >
                                {/* Tooltip */}
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-navy-900 text-white text-[10px] px-2 py-1 rounded shadow-xl whitespace-nowrap z-20">
                                    {toArabicDigits(h.score)}%
                                </div>
                            </motion.div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Consistency Heatmap ---
export const ConsistencyHeatmap = ({ history, onDayClick }: { history: string[], onDayClick?: (date: string, status: boolean) => void }) => {
    const weeks = 14;
    const days = weeks * 7;
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - (days - 1));

    const heatmapData: { isDone: boolean, date: string }[][] = [];
    const monthLabels: { label: string, index: number }[] = [];
    let currentWeek: { isDone: boolean, date: string }[] = [];

    const arabicMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

    for (let i = 0; i < days; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const ds = String(d.getDate()).padStart(2, '0');
        const key = `${y}-${m}-${ds}`;

        if (d.getDate() <= 7 && currentWeek.length === 0) {
            monthLabels.push({ label: arabicMonths[d.getMonth()], index: heatmapData.length });
        }

        currentWeek.push({ isDone: history.includes(key), date: key });

        if (currentWeek.length === 7) {
            heatmapData.push(currentWeek);
            currentWeek = [];
        }
    }

    return (
        <div className={CARD_STYLE}>
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                    <Layers className="text-blue-500" size={20} />
                </div>
                <div>
                    <h4 className="font-bold text-navy-900 dark:text-white text-base">الالتزام اليومي</h4>
                    <p className="text-[10px] text-gray-500 font-bold">آخر 3 شهور</p>
                </div>
            </div>

            {/* Heatmap Grid */}
            <div className="flex justify-start overflow-x-auto pb-4 custom-scrollbar" dir="rtl">
                <div className="flex gap-1.5 md:gap-2">
                    {heatmapData.map((week, wi) => (
                        <div key={wi} className="flex flex-col gap-1.5 md:gap-2">
                            {week.map((dayData, di) => (
                                <motion.div
                                    key={di}
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    whileHover={{ scale: 1.2 }}
                                    transition={{ delay: (wi * 7 + di) * 0.002 }}
                                    onClick={() => onDayClick?.(dayData.date, dayData.isDone)}
                                    className={`w-3 h-3 md:w-3.5 md:h-3.5 rounded-[2px] cursor-pointer transition-all ${dayData.isDone
                                        ? 'bg-emerald-500 shadow-sm shadow-emerald-500/20'
                                        : 'bg-gray-100 dark:bg-navy-800 hover:bg-gray-200 dark:hover:bg-navy-700'
                                        }`}
                                    title={dayData.date}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-4 mt-2 text-[10px] font-bold text-gray-400">
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-[2px] bg-gray-100 dark:bg-navy-800"></div>
                    <span>لم يكتمل</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-500"></div>
                    <span>مكتمل</span>
                </div>
            </div>
        </div>
    );
};

// --- SRS Strength Chart ---
export const SRSStrengthChart = ({ srsItems }: { srsItems: SrsItem[] }) => {
    if (!srsItems) return null;

    const strong = srsItems.filter(i => i.interval > 20).length;
    const good = srsItems.filter(i => i.interval <= 20 && i.interval > 7).length;
    const fair = srsItems.filter(i => i.interval <= 7 && i.interval > 3).length;
    const weak = srsItems.filter(i => i.interval <= 3).length;
    const total = strong + good + fair + weak || 1;

    const stats = [
        { label: 'قوي', count: strong, color: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/10', text: 'text-emerald-600', percent: (strong / total) * 100 },
        { label: 'جيد', count: good, color: 'bg-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/10', text: 'text-blue-600', percent: (good / total) * 100 },
        { label: 'متوسط', count: fair, color: 'bg-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/10', text: 'text-amber-600', percent: (fair / total) * 100 },
        { label: 'ضعيف', count: weak, color: 'bg-red-400', bg: 'bg-red-50 dark:bg-red-900/10', text: 'text-red-500', percent: (weak / total) * 100 },
    ];

    return (
        <div className={CARD_STYLE}>
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-rose-50 dark:bg-rose-900/30 rounded-xl">
                    <Zap className="text-rose-500" size={20} />
                </div>
                <div>
                    <h4 className="font-bold text-navy-900 dark:text-white text-base">قوة الحفظ</h4>
                    <p className="text-[10px] text-gray-500 font-bold">تحليل خوارزمية SRS</p>
                </div>
            </div>

            <div className="space-y-4">
                {/* Progress Bar */}
                <div className="h-4 w-full flex rounded-full overflow-hidden shadow-inner bg-gray-100 dark:bg-navy-800">
                    {stats.map((s, i) => s.count > 0 && (
                        <motion.div
                            key={i}
                            initial={{ width: 0 }}
                            animate={{ width: `${s.percent}%` }}
                            transition={{ duration: 1, delay: i * 0.1 }}
                            className={`${s.color} h-full border-r border-white/20 last:border-0`}
                        />
                    ))}
                </div>

                {/* Legend Chips */}
                <div className="grid grid-cols-2 gap-3">
                    {stats.map((s, i) => (
                        <div key={i} className={`flex items-center justify-between p-2.5 rounded-xl ${s.bg}`}>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${s.color}`} />
                                <span className={`text-[10px] md:text-xs font-bold ${s.text}`}>{s.label}</span>
                            </div>
                            <span className={`text-xs md:text-sm font-black ${s.text}`}>{toArabicDigits(s.count)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

