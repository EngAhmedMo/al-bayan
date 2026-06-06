
import React, { useMemo, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Check, Clock, Trophy } from 'lucide-react';
import { HifzState, HifzService } from '../../services/HifzService';
import { toArabicDigits } from '../../services/normalization';

interface HifzCompletionCalendarProps {
    isOpen: boolean;
    onClose: () => void;
    state: HifzState;
}

export const HifzCompletionCalendar: React.FC<HifzCompletionCalendarProps> = ({ isOpen, onClose, state }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [touchStartY, setTouchStartY] = useState<number | null>(null);

    // --- Back Button Handler ---
    useEffect(() => {
        if (isOpen) {
            // Push a dummy state so back button closes modal instead of navigating back
            window.history.pushState({ modalOpen: true }, '');
            const handlePopState = () => {
                onClose();
            };
            window.addEventListener('popstate', handlePopState);
            return () => {
                window.removeEventListener('popstate', handlePopState);
            };
        }
    }, [isOpen, onClose]);

    // --- Calendar Grid Logic ---
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
        return { days, firstDay, year, month };
    };

    const { days, firstDay, year, month } = getDaysInMonth(currentMonth);
    const startOffset = (firstDay + 1) % 7;
    const monthName = currentMonth.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });

    const prevMonth = React.useCallback(() => setCurrentMonth(new Date(year, month - 1, 1)), [year, month]);
    const nextMonth = React.useCallback(() => setCurrentMonth(new Date(year, month + 1, 1)), [year, month]);

    // --- Keyboard Navigation (Desktop) ---
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') {
                prevMonth(); // In RTL/Arabic context, ArrowRight goes to previous month
            } else if (e.key === 'ArrowLeft') {
                nextMonth(); // ArrowLeft goes to next month
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, prevMonth, nextMonth, onClose]);

    // --- Logic: Calculate Expected Completion Date ---
    const completionData = useMemo(() => {
        if (!state.isSetup) return null;

        const totalUnits = state.planType === 'pages' ? 604 : 6236;
        const remaining = Math.max(0, totalUnits - (state.startPoint + state.currentProgress));

        // Simulation
        let daysNeeded = 0;
        const simDate = new Date();
        const selectedDays = state.selectedDays || [0, 1, 2, 3, 4, 6];

        let remainingSim = remaining;

        // Safety Break (limit 15 years to prevent infinite loop)
        while (remainingSim > 0 && daysNeeded < 5475) {
            simDate.setDate(simDate.getDate() + 1);
            daysNeeded++;

            // If it's a scheduled day
            if (selectedDays.includes(simDate.getDay())) {
                remainingSim -= state.amountPerDay;
            }
        }

        return {
            date: simDate,
            daysRemaining: daysNeeded
        };
    }, [state]);

    if (!isOpen) return null;

    // --- Swipe Navigation & Dismiss ---
    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchStartX(e.targetTouches[0].clientX);
        setTouchStartY(e.targetTouches[0].clientY);
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStartX === null || touchStartY === null) return;
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;

        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;

        // Detect horizontal swipe (for navigation) vs vertical swipe (to dismiss)
        if (Math.abs(diffX) > Math.abs(diffY)) {
            if (Math.abs(diffX) > 50) {
                if (diffX > 0) {
                    prevMonth();
                } else {
                    nextMonth();
                }
            }
        } else {
            if (diffY > 100) {
                onClose();
            }
        }
        setTouchStartX(null);
        setTouchStartY(null);
    };

    const renderDay = (dayNum: number) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const isCompleted = state.history.includes(dateStr);
        const isToday = dateStr === HifzService.getTodayString();

        let statusClass = 'bg-slate-50 dark:bg-navy-800 text-slate-400 dark:text-navy-600';
        let content = <span className="text-xs">{toArabicDigits(dayNum)}</span>;

        if (isCompleted) {
            statusClass = 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20';
            content = (
                <>
                    <span className="text-[10px] font-bold">{toArabicDigits(dayNum)}</span>
                    <Check size={12} className="mt-0.5" />
                </>
            );
        } else if (isToday) {
            statusClass = 'border-2 border-gold-500 text-gold-600 dark:text-gold-400 font-bold bg-gold-50 dark:bg-gold-500/10';
        }

        return (
            <div key={dayNum} className={`aspect-square rounded-xl flex flex-col items-center justify-center transition-all duration-300 ${statusClass}`}>
                {content}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm animate-in fade-in" onClick={onClose}></div>
            <div
                className="relative w-full max-w-sm bg-white dark:bg-navy-900 rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white/50 dark:border-navy-700 flex flex-col max-h-[90vh]"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >

                {/* Header Section (Prediction) */}
                <div className="p-6 bg-gradient-to-br from-navy-800 to-navy-900 text-white relative overflow-hidden" dir="ltr">
                    {/* Background Pattern */}
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <Trophy size={120} />
                    </div>

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 active:scale-90 transition-all z-20 touch-manipulation"
                        aria-label="إغلاق التقويم"
                    >
                        <X size={20} />
                    </button>

                    <div className="relative z-10 flex flex-col items-start pr-12">
                        <div className="flex items-center gap-2 mb-1 text-gold-400">
                            <Trophy size={18} />
                            <span className="text-xs font-bold uppercase tracking-wider">تاريخ الختم المتوقع</span>
                        </div>
                        <h2 className="text-3xl font-bold mb-2 font-sans text-left w-full">
                            {completionData ? completionData.date.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }) : '---'}
                        </h2>

                        <div className="flex items-center gap-4 text-xs font-mono text-navy-200 bg-navy-950/30 p-2 rounded-lg inline-flex backdrop-blur-md border border-white/5">
                            <div className="flex items-center gap-1.5 flex-row-reverse">
                                <Clock size={12} className="text-emerald-400" />
                                <span>متبقي {completionData ? toArabicDigits(completionData.daysRemaining) : '-'} يوم</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Calendar Controls */}
                <div className="p-4 flex items-center justify-between bg-navy-50/50 dark:bg-navy-950 border-b border-navy-100 dark:border-navy-800">
                    <button onClick={prevMonth} className="p-2 rounded-xl bg-white dark:bg-navy-800 shadow-sm hover:scale-105 transition-transform text-navy-600 dark:text-navy-300">
                        <ChevronRight size={20} />
                    </button>
                    <span className="font-bold text-navy-800 dark:text-white font-sans text-lg">{monthName}</span>
                    <button onClick={nextMonth} className="p-2 rounded-xl bg-white dark:bg-navy-800 shadow-sm hover:scale-105 transition-transform text-navy-600 dark:text-navy-300">
                        <ChevronLeft size={20} />
                    </button>
                </div>

                {/* Grid */}
                <div className="p-5 overflow-y-auto custom-scrollbar bg-white dark:bg-navy-900">
                    {/* Weekday Headers (Sat Start) */}
                    <div className="grid grid-cols-7 gap-2 mb-3 text-center">
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
                    <div className="mt-8 flex flex-wrap justify-center gap-4 text-[10px] font-bold text-navy-500 dark:text-navy-400">
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded bg-emerald-500 shadow shadow-emerald-500/30"></div>
                            تم الحفظ
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded border-2 border-gold-500 bg-gold-50 dark:bg-gold-500/10"></div>
                            اليوم
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded bg-slate-100 dark:bg-navy-800"></div>
                            لم يسجل
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
