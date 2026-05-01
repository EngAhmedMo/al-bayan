import React, { useState, useEffect } from 'react';
import { X, Check, Clock } from 'lucide-react';
import { toArabicDigits } from '../services/normalization';

interface ArabicTimePickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (time24: string) => void;
    initialTime?: string; // HH:mm (24h)
}

export const ArabicTimePicker: React.FC<ArabicTimePickerProps> = ({ isOpen, onClose, onSelect, initialTime = "08:00" }) => {
    // Parse initial time to 12h format
    const [hour, setHour] = useState(8);
    const [minute, setMinute] = useState(0);
    const [period, setPeriod] = useState<'AM' | 'PM'>('AM');

    useEffect(() => {
        if (isOpen && initialTime) {
            const [h, m] = initialTime.split(':').map(Number);
            if (!isNaN(h) && !isNaN(m)) {
                if (h === 0) {
                    setHour(12);
                    setPeriod('AM');
                } else if (h === 12) {
                    setHour(12);
                    setPeriod('PM');
                } else if (h > 12) {
                    setHour(h - 12);
                    setPeriod('PM');
                } else {
                    setHour(h);
                    setPeriod('AM');
                }
                setMinute(m);
            }
        }
    }, [isOpen, initialTime]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        let h24 = hour;
        if (period === 'AM' && hour === 12) h24 = 0;
        if (period === 'PM' && hour !== 12) h24 = hour + 12;

        const timeStr = `${h24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        onSelect(timeStr);
        onClose();
    };

    const hours = Array.from({ length: 12 }, (_, i) => i + 1);

    // Custom minutes steps (0, 15, 30, 45) or full list? 
    // User probably wants granular control. Let's do intervals of 5 for UX, or full list?
    // Intervals of 5 is cleaner.
    const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-md" onClick={onClose}></div>

            <div className="relative w-full max-w-sm bg-white dark:bg-navy-900 rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 border border-gold-100 dark:border-navy-700">

                {/* Header Display */}
                <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 dark:from-black dark:via-navy-900 dark:to-black p-8 text-center relative overflow-hidden">
                    {/* Decorative Elements */}
                    <div className="absolute top-0 right-0 w-40 h-40 bg-gold-500/10 rounded-full blur-3xl -translate-y-10 translate-x-10"></div>
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-gold-400/10 rounded-full blur-2xl translate-y-10 -translate-x-10"></div>

                    <div className="flex items-center justify-center gap-2 mb-4 relative z-10">
                        <div className="w-8 h-8 rounded-lg bg-gold-500/20 flex items-center justify-center">
                            <Clock size={16} className="text-gold-400" />
                        </div>
                        <h3 className="text-gold-400 text-sm font-bold">وقت التذكير</h3>
                    </div>

                    <div className="flex items-center justify-center gap-4 text-white relative z-10" dir="ltr">
                        {/* Hour */}
                        <div className="text-5xl font-black font-sans text-white">
                            {toArabicDigits(hour)}
                        </div>
                        <span className="text-4xl text-gold-400 pb-2 animate-pulse">:</span>
                        {/* Minute */}
                        <div className="text-5xl font-black font-sans text-white">
                            {toArabicDigits(minute.toString().padStart(2, '0'))}
                        </div>
                    </div>

                    {/* Period Display */}
                    <div className="mt-3 text-gold-300 font-bold text-lg relative z-10">
                        {period === 'AM' ? 'صباحاً' : 'مساءً'}
                    </div>
                </div>

                {/* Selection Area */}
                <div className="p-6 bg-gradient-to-b from-white to-gold-50/30 dark:from-navy-900 dark:to-navy-950">
                    <div className="flex justify-between gap-3 h-52">

                        {/* Period Column */}
                        <div className="flex flex-col justify-center gap-3">
                            <button
                                onClick={() => setPeriod('AM')}
                                className={`px-5 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 ${period === 'AM'
                                    ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-105'
                                    : 'bg-navy-100 dark:bg-navy-800 text-navy-400 hover:bg-navy-200 dark:hover:bg-navy-700'
                                    }`}
                            >
                                صباحاً
                            </button>
                            <button
                                onClick={() => setPeriod('PM')}
                                className={`px-5 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 ${period === 'PM'
                                    ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30 scale-105'
                                    : 'bg-navy-100 dark:bg-navy-800 text-navy-400 hover:bg-navy-200 dark:hover:bg-navy-700'
                                    }`}
                            >
                                مساءً
                            </button>
                        </div>

                        {/* Minutes Column */}
                        <div className="flex-1 flex flex-col gap-2 overflow-y-auto custom-scrollbar items-center py-2 bg-white/80 dark:bg-navy-800/50 backdrop-blur-sm rounded-2xl border border-navy-100 dark:border-navy-700">
                            <span className="text-[10px] text-navy-400 font-bold mb-1 sticky top-0 bg-white dark:bg-navy-800 px-3 py-1 rounded-full">الدقيقة</span>
                            {minutes.map(m => (
                                <button
                                    key={m}
                                    onClick={() => setMinute(m)}
                                    className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold transition-all duration-300 ${minute === m
                                        ? 'bg-gradient-to-br from-gold-400 to-amber-500 text-white shadow-lg shadow-gold-500/30 scale-110'
                                        : 'text-navy-600 dark:text-navy-300 hover:bg-navy-100 dark:hover:bg-navy-700'
                                        }`}
                                >
                                    {toArabicDigits(m.toString().padStart(2, '0'))}
                                </button>
                            ))}
                        </div>

                        {/* Hours Column */}
                        <div className="flex-1 flex flex-col gap-2 overflow-y-auto custom-scrollbar items-center py-2 bg-white/80 dark:bg-navy-800/50 backdrop-blur-sm rounded-2xl border border-navy-100 dark:border-navy-700">
                            <span className="text-[10px] text-navy-400 font-bold mb-1 sticky top-0 bg-white dark:bg-navy-800 px-3 py-1 rounded-full">الساعة</span>
                            {hours.map(h => (
                                <button
                                    key={h}
                                    onClick={() => setHour(h)}
                                    className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold transition-all duration-300 ${hour === h
                                        ? 'bg-gradient-to-br from-navy-700 to-navy-900 dark:from-gold-500 dark:to-amber-600 text-white shadow-lg shadow-navy-500/30 dark:shadow-gold-500/30 scale-110'
                                        : 'text-navy-600 dark:text-navy-300 hover:bg-navy-100 dark:hover:bg-navy-700'
                                        }`}
                                >
                                    {toArabicDigits(h)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={handleConfirm}
                            className="flex-1 py-3.5 bg-gradient-to-br from-gold-400 to-amber-500 hover:from-gold-500 hover:to-amber-600 text-white rounded-xl font-bold shadow-lg shadow-gold-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <Check size={18} />
                            تم
                        </button>
                        <button
                            onClick={onClose}
                            className="flex-1 py-3.5 text-navy-500 dark:text-navy-400 font-bold bg-navy-100 dark:bg-navy-800 hover:bg-navy-200 dark:hover:bg-navy-700 rounded-xl transition-colors"
                        >
                            إلغاء
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

