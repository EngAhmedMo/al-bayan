import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, X } from 'lucide-react';

// Convert number to Arabic numeral
const toArabicNumeral = (num: number): string => {
    const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return num.toString().split('').map(digit => arabicNumerals[parseInt(digit)] || digit).join('');
};

interface MinuteWheelPickerProps {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    label?: string;
}

/**
 * Professional wheel-style minute picker with Arabic numerals
 * Opens as a centered modal overlay with scroll snapping
 */
export const MinuteWheelPicker: React.FC<MinuteWheelPickerProps> = ({
    value,
    onChange,
    min = 1,
    max = 60,
    step = 1,
    label = 'دقيقة'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [localValue, setLocalValue] = useState(value);
    const scrollRef = useRef<HTMLDivElement>(null);
    const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

    // Generate array of values
    const values: number[] = [];
    for (let i = min; i <= max; i += step) {
        values.push(i);
    }

    const ITEM_HEIGHT = 48;
    const CONTAINER_HEIGHT = 240; // Visible height
    const SPACER_HEIGHT = (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2; // (240 - 48) / 2 = 96px

    // Sync localValue and scroll to selected value when opening
    useEffect(() => {
        if (isOpen) {
            setLocalValue(value);
            // Need a slight delay to ensure layout is ready
            requestAnimationFrame(() => {
                if (scrollRef.current) {
                    const selectedIndex = values.indexOf(value);
                    if (selectedIndex !== -1) {
                        scrollRef.current.scrollTop = selectedIndex * ITEM_HEIGHT;
                    }
                }
            });
        }
    }, [isOpen, value]);

    const handleScroll = () => {
        if (!scrollRef.current) return;
        if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
        
        scrollTimeout.current = setTimeout(() => {
            if (scrollRef.current) {
                const scrollTop = scrollRef.current.scrollTop;
                let index = Math.round(scrollTop / ITEM_HEIGHT);
                index = Math.max(0, Math.min(index, values.length - 1));
                setLocalValue(values[index]);
            }
        }, 150);
    };

    // Helper to scroll to index smoothly
    const scrollToIndex = (index: number) => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({
                top: index * ITEM_HEIGHT,
                behavior: 'smooth'
            });
        }
    };

    const handleItemClick = (val: number, index: number) => {
        setLocalValue(val);
        scrollToIndex(index);
    };

    // Portal Content for Modal
    const modalContent = isOpen ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            {/* Backdrop Click Handler */}
            <div className="absolute inset-0" onClick={() => setIsOpen(false)} />

            {/* Modal Content */}
            <div className="relative w-full max-w-[280px] bg-white dark:bg-navy-900 rounded-3xl shadow-2xl border border-white/20 dark:border-navy-700 animate-in zoom-in-95 duration-200 overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-navy-50 dark:bg-navy-800 border-b border-navy-100 dark:border-navy-700">
                    <h3 className="text-sm font-bold text-navy-800 dark:text-white">اختر المدة ({label})</h3>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-1 rounded-full hover:bg-navy-200 dark:hover:bg-navy-700 text-navy-500 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-4 flex flex-col items-center">

                    {/* Scrollable Wheel Container */}
                    <div className="relative w-full h-[240px] flex items-center justify-center bg-navy-50/50 dark:bg-navy-900/50 rounded-xl overflow-hidden">

                        {/* Selection Highlight Box - Perfectly Centered */}
                        <div className="absolute top-1/2 left-4 right-4 h-[48px] -translate-y-1/2 bg-white dark:bg-navy-800 rounded-lg shadow-sm border border-gold-400 dark:border-gold-600 pointer-events-none z-0 opacity-90" />

                        {/* Scroll Area */}
                        <div
                            ref={scrollRef}
                            className="w-full h-full overflow-y-auto scroll-smooth relative z-10 snap-y snap-mandatory hide-scrollbar"
                            onScroll={handleScroll}
                        >
                            <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>

                            {/* Top Spacer */}
                            <div style={{ height: SPACER_HEIGHT }} />

                            <div className="flex flex-col items-center w-full">
                                {values.map((val, index) => {
                                    const isSelected = val === localValue;
                                    return (
                                        <button
                                            key={val}
                                            onClick={() => handleItemClick(val, index)}
                                            className={`w-full h-[48px] flex-shrink-0 flex items-center justify-center snap-center transition-all duration-200 ${isSelected
                                                ? 'text-3xl font-bold text-gold-600 dark:text-gold-400 scale-110'
                                                : 'text-lg text-navy-400 dark:text-navy-500 scale-90 opacity-60 hover:opacity-100'
                                                }`}
                                        >
                                            {toArabicNumeral(val)}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Bottom Spacer */}
                            <div style={{ height: SPACER_HEIGHT }} />
                        </div>
                    </div>

                    {/* Done Button */}
                    <button
                        onClick={() => {
                            onChange(localValue);
                            setIsOpen(false);
                        }}
                        className="w-full mt-4 py-3 bg-gradient-to-r from-gold-500 to-amber-500 hover:to-amber-600 text-white font-bold rounded-xl shadow-lg shadow-gold-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        <Check size={18} />
                        <span>تم الاختيار</span>
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    return (
        <>
            {/* Display Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-navy-800 rounded-xl border border-navy-200 dark:border-navy-700 shadow-sm hover:border-gold-400 transition-all group"
            >
                <span className="text-lg font-bold text-gold-600 dark:text-gold-400 min-w-[2rem] text-center group-hover:scale-110 transition-transform">
                    {toArabicNumeral(value)}
                </span>
                <span className="text-xs font-bold text-navy-500 dark:text-navy-400">{label}</span>
                <ChevronDown size={14} className="text-navy-400" />
            </button>

            {/* Portal Rendering */}
            {typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null}
        </>
    );
};

interface ArabicTimePickerProps {
    value: string; // "HH:MM"
    onChange: (value: string) => void;
    label?: string;
}

/**
 * Professional Arabic time picker with scrollable hours/minutes wheels (Scroll Snap)
 * Opens as a centered modal overlay
 */
export const ArabicTimePicker: React.FC<ArabicTimePickerProps> = ({
    value,
    onChange,
    label = 'الوقت'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [localValue, setLocalValue] = useState(value);

    // Parse prop value for closed display
    const [propHours24, propMinutes] = value ? value.split(':').map(Number) : [12, 0];
    const propPeriod = propHours24 >= 12 ? 'PM' : 'AM';
    const propHours12 = propHours24 % 12 || 12;

    // Parse local value for open modal
    const [hours24, minutes] = localValue ? localValue.split(':').map(Number) : [12, 0];
    const period = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 || 12;

    // Generate arrays
    const hoursArray = Array.from({ length: 12 }, (_, i) => i + 1); // 1-12
    const minutesArray = Array.from({ length: 60 }, (_, i) => i);   // 0-59

    const ITEM_HEIGHT = 48;
    const CONTAINER_HEIGHT = 240;
    const SPACER_HEIGHT = (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2; // 96px

    // Refs for auto-scrolling
    const hoursScrollRef = useRef<HTMLDivElement>(null);
    const minutesScrollRef = useRef<HTMLDivElement>(null);
    const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

    // Update Time Helper applies locally
    const updateLocalTime = (newHour12: number, newPeriod: 'AM' | 'PM', newMinute: number) => {
        let newHour24 = newHour12;

        if (newPeriod === 'AM') {
            if (newHour12 === 12) newHour24 = 0; // 12 AM -> 00
        } else {
            if (newHour12 !== 12) newHour24 = newHour12 + 12; // 1 PM -> 13, 12 PM -> 12
        }

        const paddedHour = newHour24.toString().padStart(2, '0');
        const paddedMinute = newMinute.toString().padStart(2, '0');
        setLocalValue(`${paddedHour}:${paddedMinute}`);
    };

    const formatDisplay = () => {
        const p = propPeriod === 'AM' ? 'صباحاً' : 'مساءً';
        return `${toArabicNumeral(propHours12)}:${toArabicNumeral(propMinutes).padStart(2, '٠')} ${p}`;
    };

    // Sync on open
    useEffect(() => {
        if (isOpen) {
            setLocalValue(value);
            const [h24, m] = value ? value.split(':').map(Number) : [12, 0];
            const h12 = h24 % 12 || 12;
            
            requestAnimationFrame(() => {
                if (hoursScrollRef.current) {
                    hoursScrollRef.current.scrollTop = (h12 - 1) * ITEM_HEIGHT;
                }
                if (minutesScrollRef.current) {
                    minutesScrollRef.current.scrollTop = m * ITEM_HEIGHT;
                }
            });
        }
    }, [isOpen, value]);

    // Scroll listeners
    const handleHoursScroll = () => {
        if (!hoursScrollRef.current) return;
        if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
        scrollTimeout.current = setTimeout(() => {
            if (hoursScrollRef.current) {
                const scrollTop = hoursScrollRef.current.scrollTop;
                let index = Math.round(scrollTop / ITEM_HEIGHT);
                index = Math.max(0, Math.min(index, hoursArray.length - 1));
                const newHour12 = hoursArray[index];
                updateLocalTime(newHour12, period, minutes);
            }
        }, 150);
    };

    const handleMinutesScroll = () => {
        if (!minutesScrollRef.current) return;
        if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
        scrollTimeout.current = setTimeout(() => {
            if (minutesScrollRef.current) {
                const scrollTop = minutesScrollRef.current.scrollTop;
                let index = Math.round(scrollTop / ITEM_HEIGHT);
                index = Math.max(0, Math.min(index, minutesArray.length - 1));
                const newMinute = minutesArray[index];
                updateLocalTime(hours12, period, newMinute);
            }
        }, 150);
    };

    const scrollWheelTo = (ref: React.RefObject<HTMLDivElement>, index: number) => {
        if (ref.current) {
            ref.current.scrollTo({
                top: index * ITEM_HEIGHT,
                behavior: 'smooth'
            });
        }
    };

    // Portal Content for Modal
    const modalContent = isOpen ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={() => setIsOpen(false)} />

            <div className="relative w-full max-w-[340px] bg-white dark:bg-navy-900 rounded-3xl shadow-2xl border border-white/20 dark:border-navy-700 animate-in zoom-in-95 duration-200 overflow-hidden">

                <div className="flex items-center justify-between p-4 bg-navy-50 dark:bg-navy-800 border-b border-navy-100 dark:border-navy-700">
                    <h3 className="text-base font-bold text-navy-800 dark:text-white">تحديد الوقت ({label})</h3>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-1 rounded-full hover:bg-navy-200 dark:hover:bg-navy-700 text-navy-500 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    <div className="flex gap-4 items-center justify-center direction-ltr h-[240px]">

                        {/* Period Toggle (AM/PM) */}
                        <div className="flex flex-col gap-2 h-full justify-center">
                            <button
                                onClick={() => updateLocalTime(hours12, 'AM', minutes)}
                                className={`px-4 py-3 rounded-xl text-sm font-bold transition-all ${period === 'AM'
                                    ? 'bg-gold-500 text-white shadow-lg shadow-gold-500/30 scale-105'
                                    : 'bg-navy-50 dark:bg-navy-800 text-navy-500 dark:text-navy-400 hover:bg-navy-100 dark:hover:bg-navy-700'}`}
                            >
                                صباحاً
                            </button>
                            <button
                                onClick={() => updateLocalTime(hours12, 'PM', minutes)}
                                className={`px-4 py-3 rounded-xl text-sm font-bold transition-all ${period === 'PM'
                                    ? 'bg-navy-700 text-white shadow-lg shadow-navy-900/50 scale-105'
                                    : 'bg-navy-50 dark:bg-navy-800 text-navy-500 dark:text-navy-400 hover:bg-navy-100 dark:hover:bg-navy-700'}`}
                            >
                                مساءً
                            </button>
                        </div>

                        {/* Divider */}
                        <div className="w-[1px] h-32 bg-navy-100 dark:bg-navy-700" />

                        {/* Minutes Wheel */}
                        <div className="flex flex-col items-center h-full relative w-20 bg-navy-50/50 dark:bg-navy-900/50 rounded-xl overflow-hidden">
                            {/* Label */}
                            <span className="absolute top-2 text-[10px] text-navy-400 font-bold uppercase tracking-wider z-20 pointer-events-none">الدقيقة</span>

                            {/* Highlight Box */}
                            <div className="absolute top-1/2 left-1 right-1 h-[48px] -translate-y-1/2 bg-white dark:bg-navy-800 rounded-lg shadow-sm border border-gold-400 dark:border-gold-600 pointer-events-none z-0 opacity-90 transition-all" />

                            <div
                                ref={minutesScrollRef}
                                className="w-full h-full overflow-y-auto scroll-smooth relative z-10 snap-y snap-mandatory hide-scrollbar"
                                onScroll={handleMinutesScroll}
                            >
                                <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>

                                <div style={{ height: SPACER_HEIGHT }} />

                                {minutesArray.map((min) => (
                                    <button
                                        key={min}
                                        onClick={() => {
                                            updateLocalTime(hours12, period, min);
                                            scrollWheelTo(minutesScrollRef, min);
                                        }}
                                        className={`w-full h-[48px] flex items-center justify-center transition-all flex-shrink-0 snap-center ${min === minutes
                                            ? 'text-2xl font-bold text-gold-600 dark:text-gold-400 scale-105'
                                            : 'text-lg text-navy-300 dark:text-navy-600 hover:text-navy-500 dark:hover:text-navy-400 scale-90 opacity-60'
                                            }`}
                                    >
                                        {toArabicNumeral(min).padStart(2, '٠')}
                                    </button>
                                ))}

                                <div style={{ height: SPACER_HEIGHT }} />
                            </div>
                        </div>

                        <span className="text-2xl font-bold text-navy-300 pb-6">:</span>

                        {/* Hours Wheel */}
                        <div className="flex flex-col items-center h-full relative w-20 bg-navy-50/50 dark:bg-navy-900/50 rounded-xl overflow-hidden">
                            <span className="absolute top-2 text-[10px] text-navy-400 font-bold uppercase tracking-wider z-20 pointer-events-none">الساعة</span>

                            {/* Highlight Box */}
                            <div className="absolute top-1/2 left-1 right-1 h-[48px] -translate-y-1/2 bg-white dark:bg-navy-800 rounded-lg shadow-sm border border-gold-400 dark:border-gold-600 pointer-events-none z-0 opacity-90 transition-all" />

                            <div
                                ref={hoursScrollRef}
                                className="w-full h-full overflow-y-auto scroll-smooth relative z-10 snap-y snap-mandatory hide-scrollbar"
                                onScroll={handleHoursScroll}
                            >
                                <div style={{ height: SPACER_HEIGHT }} />
                                {hoursArray.map((hr) => (
                                    <button
                                        key={hr}
                                        onClick={() => {
                                            updateLocalTime(hr, period, minutes);
                                            scrollWheelTo(hoursScrollRef, hr - 1);
                                        }}
                                        className={`w-full h-[48px] flex items-center justify-center transition-all flex-shrink-0 snap-center ${hr === hours12
                                            ? 'text-2xl font-bold text-gold-600 dark:text-gold-400 scale-105'
                                            : 'text-lg text-navy-300 dark:text-navy-600 hover:text-navy-500 dark:hover:text-navy-400 scale-90 opacity-60'
                                            }`}
                                    >
                                        {toArabicNumeral(hr)}
                                    </button>
                                ))}
                                <div style={{ height: SPACER_HEIGHT }} />
                            </div>
                        </div>
                    </div>

                    {/* Done Button */}
                    <button
                        onClick={() => {
                            onChange(localValue);
                            setIsOpen(false);
                        }}
                        className="w-full mt-6 py-3 bg-gradient-to-r from-gold-500 to-amber-500 hover:to-amber-600 text-white font-bold rounded-xl shadow-lg shadow-gold-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        <Check size={20} />
                        <span>حفظ الوقت</span>
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    return (
        <>
            {/* Display Button */}
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-navy-800 rounded-xl border border-navy-200 dark:border-navy-700 shadow-sm hover:border-gold-400 transition-all min-w-[140px] group"
            >
                <div className="flex-1 flex items-center justify-center gap-1">
                    <span className="text-xl font-bold text-gold-600 dark:text-gold-400 group-hover:scale-105 transition-transform">
                        {formatDisplay()}
                    </span>
                </div>
                <ChevronDown size={16} className="text-navy-400" />
            </button>

            {/* Portal Rendering */}
            {typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null}
        </>
    );
};

export { toArabicNumeral };
