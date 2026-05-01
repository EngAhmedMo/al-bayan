import React, { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { getPrayerHistory, PrayerHistoryDay } from '../services/storage';

interface PrayerHistoryModalProps {
    onClose: () => void;
}

export const PrayerHistoryModal: React.FC<PrayerHistoryModalProps> = ({ onClose }) => {
    const [history, setHistory] = useState<Record<string, PrayerHistoryDay>>({});
    const [viewDate, setViewDate] = useState(new Date());

    useEffect(() => {
        setHistory(getPrayerHistory());
    }, []);

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun

        // Adjust array to start from Saturday (Islamic week usually starts Sat or Sun, let's assume Sat=6, Sun=0. 
        // In this app, let's stick to standard Sun=0).
        // Actually, simple grid is fine.

        const res = [];
        // Empty slots
        for (let i = 0; i < firstDay; i++) res.push(null);
        // Days
        for (let i = 1; i <= days; i++) res.push(i);
        return res;
    };

    const days = getDaysInMonth(viewDate);
    const monthName = viewDate.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });

    const changeMonth = (delta: number) => {
        const newDate = new Date(viewDate);
        newDate.setMonth(newDate.getMonth() + delta);
        setViewDate(newDate);
    };

    const getDayStatus = (day: number) => {
        const dateStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return history[dateStr];
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative w-full max-w-sm bg-white dark:bg-navy-900 rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 border border-white/50 dark:border-navy-700">

                {/* Header */}
                <div className="p-6 bg-gradient-to-r from-emerald-500 to-teal-600 text-white relative">
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                        <X size={20} />
                    </button>
                    <h2 className="text-2xl font-bold mb-1">سجل التزامك</h2>
                    <p className="text-sm opacity-90">تابع أداءك وحافظ على صلاتك</p>
                </div>

                {/* Calendar Controls */}
                <div className="flex items-center justify-between p-4 px-6 border-b border-navy-100 dark:border-navy-800">
                    <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-navy-50 dark:hover:bg-navy-800 text-navy-500 dark:text-navy-400">
                        <ChevronRight size={20} />
                    </button>
                    <span className="font-bold text-navy-800 dark:text-white text-lg">{monthName}</span>
                    <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-navy-50 dark:hover:bg-navy-800 text-navy-500 dark:text-navy-400">
                        <ChevronLeft size={20} />
                    </button>
                </div>

                {/* Heatmap Grid */}
                <div className="p-6">
                    <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-navy-400">
                        <span>أحد</span><span>إثنين</span><span>ثلاثاء</span><span>أربعاء</span><span>خميس</span><span>جمعة</span><span>سبت</span>
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                        {days.map((day, i) => {
                            if (!day) return <div key={i}></div>;

                            const status = getDayStatus(day);
                            let bgClass = "bg-navy-50 dark:bg-navy-800 text-navy-400 dark:text-navy-500";

                            if (status) {
                                if (status.allCompleted) bgClass = "bg-emerald-500 text-white shadow-md shadow-emerald-500/30";
                                else if (status.completedCount > 0) bgClass = "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800";
                            }

                            return (
                                <div key={i} className={`aspect-square rounded-xl flex items-center justify-center text-sm font-bold transition-all ${bgClass}`}>
                                    {day}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Legend */}
                <div className="px-6 pb-6 flex justify-center gap-4 text-xs font-bold text-navy-500 dark:text-navy-400">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                        <span>مكتمل (5)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200"></div>
                        <span>جزئي</span>
                    </div>
                </div>

            </div>
        </div>
    );
};
