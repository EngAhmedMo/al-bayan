import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Check, Minus } from 'lucide-react';
import { getPrayerHistory, PrayerHistoryDay } from '../services/storage';

interface PrayerHistoryCalendarProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PrayerHistoryCalendar: React.FC<PrayerHistoryCalendarProps> = ({ isOpen, onClose }) => {
    const history = useMemo(() => getPrayerHistory(), [isOpen]);
    const today = new Date();
    const [currentMonth, setCurrentMonth] = React.useState(new Date());

    if (!isOpen) return null;

    // Calendar Logic
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
        // Adjust for Saturday start if needed, but standard grid usually Sun or Mon.
        // Let's assume standard Sunday start for grid simplicity, or Arabic Saturday.
        // Arabic often starts Saturday. Let's stick to simple grid, maybe Saturday start.
        return { days, firstDay, year, month };
    };

    const { days, firstDay, year, month } = getDaysInMonth(currentMonth);

    // Adjust firstDay to align with Saturday start (if Sun=0, Sat=6. If we want Sat to be col 0:
    // Sat=0... Fri=6. 
    // Std Day: Sun=0. 
    // Target: Sat=0.
    // Shift: (day + 1) % 7 ? No. Sat(6) -> 0. Sun(0) -> 1. 
    // Formula: (day + 1) % 7
    const startOffset = (firstDay + 1) % 7;

    const monthName = currentMonth.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });

    const prevMonth = () => {
        setCurrentMonth(new Date(year, month - 1, 1));
    };

    const nextMonth = () => {
        setCurrentMonth(new Date(year, month + 1, 1));
    };

    const renderDay = (dayNum: number) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const entry: PrayerHistoryDay | undefined = history[dateStr];
        const isToday = dateStr === today.toISOString().split('T')[0];
        const isFuture = new Date(dateStr) > today;

        let statusClass = 'bg-slate-50 dark:bg-navy-800 text-slate-400';
        let content = <span className="text-xs">{dayNum}</span>;

        if (!isFuture && entry) {
            if (entry.allCompleted) {
                statusClass = 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20';
                content = (
                    <>
                        <span className="text-[10px] font-bold">{dayNum}</span>
                        <Check size={12} className="mt-0.5" />
                    </>
                );
            } else if (entry.completedCount > 0) {
                statusClass = 'bg-amber-400 text-white';
                content = (
                    <>
                        <span className="text-[10px] font-bold">{dayNum}</span>
                        <div className="flex gap-0.5 mt-1">
                            {/* Mini Dots for completed */}
                            {Array.from({ length: Math.min(entry.completedCount, 3) }).map((_, i) => (
                                <div key={i} className="w-1 h-1 rounded-full bg-white/80" />
                            ))}
                            {entry.completedCount > 3 && <span className="text-[8px] leading-none">+</span>}
                        </div>
                    </>
                );
            } else {
                statusClass = 'bg-red-50 dark:bg-red-900/10 text-red-300';
            }
        } else if (isToday) {
            statusClass = 'border-2 border-primary text-primary font-bold';
        }

        return (
            <div key={dayNum} className={`aspect-square rounded-xl flex flex-col items-center justify-center transition-all ${statusClass}`}>
                {content}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative w-full max-w-sm bg-white dark:bg-navy-900 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 border border-navy-100 dark:border-navy-800 flex flex-col max-h-[85vh]">

                {/* Header */}
                <div className="p-5 border-b border-navy-100 dark:border-navy-800 bg-white dark:bg-navy-900 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-navy-900 dark:text-white font-bold">
                        <CalendarIcon className="text-gold-500" size={20} />
                        <h3>سجل الصلوات</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-navy-50 dark:hover:bg-navy-800 rounded-full transition-colors text-navy-400">
                        <X size={20} />
                    </button>
                </div>

                {/* Calendar Controls */}
                <div className="p-4 flex items-center justify-between bg-navy-50/50 dark:bg-navy-950">
                    <button onClick={prevMonth} className="p-2 rounded-xl bg-white dark:bg-navy-800 shadow-sm hover:scale-105 transition-transform"><ChevronRight size={18} /></button>
                    <span className="font-bold text-navy-800 dark:text-white font-quran text-lg">{monthName}</span>
                    <button onClick={nextMonth} className="p-2 rounded-xl bg-white dark:bg-navy-800 shadow-sm hover:scale-105 transition-transform"><ChevronLeft size={18} /></button>
                </div>

                {/* Grid */}
                <div className="p-4 overflow-y-auto custom-scrollbar">
                    {/* Weekday Headers (Sat Start) */}
                    <div className="grid grid-cols-7 gap-2 mb-2 text-center">
                        {['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'].map(d => (
                            <span key={d} className="text-xs font-bold text-navy-400">{d}</span>
                        ))}
                    </div>

                    {/* Days */}
                    <div className="grid grid-cols-7 gap-2">
                        {/* Empty Slots */}
                        {Array.from({ length: startOffset }).map((_, i) => (
                            <div key={`empty-${i}`} />
                        ))}

                        {/* Actual Days */}
                        {Array.from({ length: days }).map((_, i) => renderDay(i + 1))}
                    </div>

                    {/* Legend */}
                    <div className="mt-6 flex flex-wrap justify-center gap-4 text-[10px] text-navy-500 dark:text-navy-400">
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-500"></div>مكتمل</div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-400"></div>جزئي</div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-slate-100 dark:bg-navy-800 border border-dashed border-navy-300"></div>لم يسجل</div>
                    </div>
                </div>

            </div>
        </div>
    );
};
