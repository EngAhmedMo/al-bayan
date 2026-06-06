import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Moon, Circle, Calendar as CalendarIcon } from 'lucide-react';
import { gregorianToHijri as getHijri, HijriDate } from '../services/islamicCalendar';
import { MONTH_MAP } from '../services/eventsData';
import { toArabicDigits } from '../services/normalization';
import { IslamicEvent } from '../types';

interface HijriCalendarGridProps {
    events: IslamicEvent[];
    onEventClick: (event: IslamicEvent) => void;
}

interface CalendarDay {
    gregorianDate: Date;
    hijri: { day: number; month: number; year: number; monthName: string };
    isToday: boolean;
    events: IslamicEvent[];
    moonPhase: string; // 'waxing', 'full', 'waning', 'new'
}

const WEEKDAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

// Moon Phase Helper
const getMoonPhaseIcon = (day: number) => {
    if (day === 1 || day === 30 || day === 29) return 'new'; // New Moon
    if (day >= 2 && day <= 6) return 'waxing-crescent';
    if (day >= 7 && day <= 9) return 'first-quarter';
    if (day >= 10 && day <= 12) return 'waxing-gibbous';
    if (day >= 13 && day <= 15) return 'full'; // Full Moon
    if (day >= 16 && day <= 19) return 'waning-gibbous';
    if (day >= 20 && day <= 22) return 'last-quarter';
    if (day >= 23 && day <= 28) return 'waning-crescent';
    return 'new';
};

export const HijriCalendarGrid: React.FC<HijriCalendarGridProps> = ({ events, onEventClick }) => {
    const [viewDate, setViewDate] = useState(new Date()); // A date within the month we are viewing
    const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
    const [currentMonthName, setCurrentMonthName] = useState('');
    const [currentYear, setCurrentYear] = useState(0);

    // Swipe State
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    // Minimum swipe distance
    const minSwipeDistance = 50;

    // Calculate the grid
    useEffect(() => {
        const generateGrid = () => {
            // 1. Find out which Hijri month viewDate belongs to
            const targetHijri = getHijri(viewDate);
            setCurrentMonthName(targetHijri.monthName);
            setCurrentYear(targetHijri.year);

            // 2. Find the Gregorian Start of this Hijri Month
            // We iterate backwards from viewDate until we hit Day 1
            // Limit to 30 days back to prevent infinite loops logic errors
            let tempDate = new Date(viewDate);
            let startOfHijriMonth = new Date(viewDate);

            // Safety counter
            let guard = 0;
            while (guard < 32) {
                const h = getHijri(tempDate);
                if (h.day === 1) {
                    startOfHijriMonth = new Date(tempDate);
                    break;
                }
                tempDate.setDate(tempDate.getDate() - 1);
                guard++;
            }

            // 3. Build the Month Days
            const days: CalendarDay[] = [];

            // We need to determine the weekday offset for the first day (Saturday? Sunday?)
            // But usually calendars show 35-42 cells. 
            // We just need the list of Hijri days (1..29/30) and their gregorian counterparts.
            // visual padding will be handled in render by checking startOfHijriMonth.getDay()

            let currentIterator = new Date(startOfHijriMonth);
            const targetMonthIndex = getHijri(startOfHijriMonth).month;

            // Loop until month changes
            while (true) {
                const h = getHijri(currentIterator);
                if (h.month !== targetMonthIndex) break; // Month changed

                // Check for events
                const daysEvents = events.filter(e =>
                    e.month === h.month && e.day.includes(h.day)
                );

                days.push({
                    gregorianDate: new Date(currentIterator),
                    hijri: h,
                    isToday: new Date().toDateString() === currentIterator.toDateString(),
                    events: daysEvents,
                    moonPhase: getMoonPhaseIcon(h.day)
                });

                currentIterator.setDate(currentIterator.getDate() + 1);

                // Safety break
                if (days.length > 30) break;
            }

            setCalendarDays(days);
        };

        generateGrid();
    }, [viewDate, events]);

    const handlePrevMonth = () => {
        // Go back 30 days (rough approximation is fine, the useEffect logic will auto-correct to the middle of prev month)
        // Better: Find start of current hijri month, subtract 5 days -> End of prev month
        const newDate = new Date(viewDate);
        newDate.setDate(newDate.getDate() - 29);
        setViewDate(newDate);
    };

    const handleNextMonth = () => {
        const newDate = new Date(viewDate);
        newDate.setDate(newDate.getDate() + 29);
        setViewDate(newDate);
    };

    // Calculate empty slots for start of week (if Hijri 1st is on Wednesday, we need 3 empty slots Sun-Tue)
    const startOffset = calendarDays.length > 0 ? calendarDays[0].gregorianDate.getDay() : 0;
    const blanks = Array(startOffset).fill(null);

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') {
                handlePrevMonth();
            } else if (e.key === 'ArrowLeft') {
                handleNextMonth();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [viewDate]);

    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null); // Reset touch end to avoid false positives
        setTouchStart(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        // In RTL:
        // Future (Next) is on the Left. Past (Prev) is on the Right.
        // Swipe Right (finger moving ->) pulls from Left -> Next Month.
        // Swipe Left (finger moving <-) pulls from Right -> Prev Month.
        if (isLeftSwipe) {
            handlePrevMonth();
        } else if (isRightSwipe) {
            handleNextMonth();
        }
    };

    return (
        <div 
            className="bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl rounded-3xl border border-gold-200 dark:border-navy-700 shadow-xl overflow-hidden touch-pan-y"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-navy-50 to-white dark:from-navy-800 dark:to-navy-900 border-b border-gold-100 dark:border-navy-700 flex items-center justify-between">
                {/* Right Button -> Past / Previous Month */}
                <button onClick={handlePrevMonth} className="p-2 rounded-xl hover:bg-gold-50 dark:hover:bg-navy-700 text-navy-600 dark:text-navy-300 transition-colors">
                    <ChevronRight size={20} />
                </button>

                <div className="text-center">
                    <h2 className="text-xl font-bold text-navy-900 dark:text-white font-quran">
                        {currentMonthName}
                    </h2>
                    <p className="text-xs font-bold text-gold-600 dark:text-gold-400 font-sans mt-0.5">
                        {toArabicDigits(currentYear)} هـ
                    </p>
                </div>

                {/* Left Button -> Future / Next Month */}
                <button onClick={handleNextMonth} className="p-2 rounded-xl hover:bg-gold-50 dark:hover:bg-navy-700 text-navy-600 dark:text-navy-300 transition-colors">
                    <ChevronLeft size={20} />
                </button>
            </div>

            {/* Weekdays */}
            <div className="grid grid-cols-7 border-b border-gold-100 dark:border-navy-800 bg-navy-50/50 dark:bg-navy-950/50">
                {WEEKDAYS.map(day => (
                    <div key={day} className="py-2 text-center text-[10px] font-bold text-navy-400 dark:text-navy-500">
                        {day}
                    </div>
                ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 auto-rows-fr">
                {/* Blank Start Days */}
                {blanks.map((_, i) => (
                    <div key={`blank-${i}`} className="min-h-[80px] border-b border-r border-gold-50 dark:border-navy-800/50 bg-gray-50/30 dark:bg-navy-950/30"></div>
                ))}

                {/* Actual Days */}
                {calendarDays.map((day, i) => {
                    const hasEvent = day.events.length > 0;
                    return (
                        <div
                            key={i}
                            onClick={() => hasEvent ? onEventClick(day.events[0]) : null}
                            className={`min-h-[80px] sm:min-h-[100px] p-1.5 relative border-b border-r border-gold-50 dark:border-navy-800/50 flex flex-col items-center justify-start group transition-colors ${day.isToday
                                ? 'bg-gold-50/50 dark:bg-gold-900/10'
                                : 'hover:bg-gray-50 dark:hover:bg-navy-800/50'
                                }`}
                        >
                            {/* Moon Phase (Visual Hint) - Only show for key phases to reduce clutter */}
                            {['full', 'new'].includes(day.moonPhase) && (
                                <div className="absolute top-1 left-1 opacity-20">
                                    {day.moonPhase === 'full'
                                        ? <div className="w-3 h-3 rounded-full bg-gold-400 shadow-[0_0_5px_rgba(251,191,36,0.5)]"></div>
                                        : <div className="w-3 h-3 rounded-full border border-navy-300"></div>
                                    }
                                </div>
                            )}

                            {/* Gregorian Date */}
                            <span className="text-[9px] text-navy-300 dark:text-navy-600 font-medium self-end px-1">
                                {day.gregorianDate.getDate()}
                            </span>

                            {/* Hijri Day (Centerpiece) */}
                            <span className={`text-xl sm:text-2xl font-bold font-sans mt-0.5 ${day.isToday
                                ? 'text-gold-600 dark:text-gold-400'
                                : 'text-navy-700 dark:text-navy-300'
                                }`}>
                                {toArabicDigits(day.hijri.day)}
                            </span>

                            {/* Event Dot */}
                            {hasEvent && (
                                <div className="mt-auto mb-1 flex gap-0.5">
                                    {day.events.slice(0, 3).map((_, idx) => (
                                        <div key={idx} className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm animate-pulse"></div>
                                    ))}
                                </div>
                            )}

                            {/* Today Marker */}
                            {day.isToday && (
                                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gold-400"></div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Footer / Legend */}
            <div className="p-3 bg-white dark:bg-navy-900 border-t border-gold-100 dark:border-navy-800 flex justify-center gap-4 text-[10px] text-navy-400">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <span>مناسبة</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-gold-400 opacity-20 shadow-[0_0_5px_rgba(251,191,36,0.5)]"></div>
                    <span>اكتمال القمر (الأيام البيض)</span>
                </div>

            </div>
        </div>
    );
};
