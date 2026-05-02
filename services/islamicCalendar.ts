/**
 * Islamic Calendar Service
 * Provides Hijri date calculations with Manual Adjustment support
 * Uses Intl.DateTimeFormat (Umm al-Qura) as the base engine
 * Uses Intl.DateTimeFormat (Umm al-Qura) as the base engine
 */

import { Capacitor } from '@capacitor/core';
import { MediaBridge } from './mediaBridge';
import { toArabicDigits } from './normalization';
import { getDailyPrayersWithFallback } from './storage';

export const HIJRI_MONTHS = [
    'محرم', 'صفر', 'ربيع الأول', 'ربيع الثاني',
    'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
    'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
];

// Storage Keys
const KEY_HIJRI_ADJUSTMENT = 'hijri_adjustment';

export interface HijriDate {
    year: number;
    month: number;
    day: number;
    monthName: string;
}

export function getHijriAdjustment(): number {
    try {
        const manual = localStorage.getItem(KEY_HIJRI_ADJUSTMENT);
        return manual ? parseInt(manual) : 0;
    } catch {
        return 0;
    }
}

export function setHijriAdjustment(days: number, silent = false): void {
    localStorage.setItem(KEY_HIJRI_ADJUSTMENT, days.toString());

    // Dispatch event for reactive updates in UI
    window.dispatchEvent(new Event('hijri-date-changed'));

    if (silent) return;

    // Update Android Widget immediately with ISO date key
    if (Capacitor.isNativePlatform()) {
        const hijri = gregorianToHijri(new Date());
        const now = new Date();
        const displayDateFormat = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
        const displayDate = toArabicDigits(displayDateFormat.format(now));
        try {
            MediaBridge.updateWidgetData({
                hijriDay: toArabicDigits(hijri.day),
                hijriMonth: hijri.monthName,
                hijriYear: toArabicDigits(hijri.year),
                gregorianDate: displayDate, // Display format for widget
                hijriAdjustment: days.toString()
            });
        } catch (e) {
            console.error('Widget update failed', e);
        }
    }
}

/**
 * Convert Gregorian date to Hijri date
 * Uses Umm al-Qura (Intl) + Adjustment
 */
export function gregorianToHijri(date: Date = new Date()): HijriDate {
    // 1. Get Base Hijri Date using Intl (Umm al-Qura)
    const formatter = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura-nu-latn', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric'
    });

    let day = 1, month = 1, year = 1446;

    try {
        const parts = formatter.formatToParts(date);
        day = parseInt(parts.find(p => p.type === 'day')?.value || '1');
        month = parseInt(parts.find(p => p.type === 'month')?.value || '1');
        year = parseInt(parts.find(p => p.type === 'year')?.value || '1446');
    } catch (e) {
        console.error("Hijri Intl Error", e);
    }

    // 2. Apply Manual Adjustment
    const adjustment = getHijriAdjustment();
    if (adjustment !== 0) {
        // Simple day addition/subtraction
        // Note: This is an approximation. Precise lunar day shifting is complex without 
        // a full lunar calendar engine, but mostly sufficient for visual display.
        // For edge cases (end of month), we allow the numbers to flow and fix them.

        const dateObj = new Date(year, month - 1, day); // Treat as solar for math
        dateObj.setDate(dateObj.getDate() + adjustment);

        // Re-extract (This works because we are just shifting days, 
        // but crossing months in Hijri is slightly different from Solar. 
        // However, since we don't have a full Hijri math library, we accept 
        // that day 30 might become day 1 of next month or day 31 (which doesn't exist).
        // To do this strictly correctly, we would need to know the length of YOUR specific Hijri month.
        // Since that's variable, we clamp or wrap logically.)

        // BETTER APPROACH:
        // Use the adjustment to shift the SOURCE gregorian date before conversion?
        // NO, because 1 Gregorian Day != 1 Hijri Day perfectly everywhere.
        // BUT, visually, if I want to see "Tomorrow's Hijri Date" today, I usually mean source + 1.

        // Let's try shifting the Source Date first.
        // If user says "Hijri is ahead by 1 day", it means today (Gregorian) corresponds to Tomorrow (Hijri).
        // So we add adjustment to the input date?
        // If Adjustment = +1, we want to show Tomorrow's Hijri date.
        // So we run conversion on (Date + 1 day).

        const adjustedDate = new Date(date);
        adjustedDate.setDate(adjustedDate.getDate() + adjustment);

        try {
            const parts = formatter.formatToParts(adjustedDate);
            day = parseInt(parts.find(p => p.type === 'day')?.value || '1');
            month = parseInt(parts.find(p => p.type === 'month')?.value || '1');
            year = parseInt(parts.find(p => p.type === 'year')?.value || '1446');
        } catch {
            // Fallback to naive math if Intl fails on shifted date
            day += adjustment;
        }
    }

    return {
        year,
        month,
        day,
        monthName: HIJRI_MONTHS[month - 1] || ''
    };
}


/**
 * Get the Hijri date string formatted for display
 */
export function formatHijriDate(hijri: HijriDate): string {
    return `${hijri.day} ${hijri.monthName} ${hijri.year}`;
}

/**
 * Get today's Hijri date display string
 */
export function getTodayHijriDisplay(): string {
    const hijri = gregorianToHijri(new Date());
    return formatHijriDate(hijri);
}

// ------------------------------------------------------------------
// Legacy/Helper Functions (kept for compatibility but using new engine)
// ------------------------------------------------------------------

/**
 * Check if today is in Ramadan
 */
export function isRamadan(date: Date = new Date()): boolean {
    const hijri = gregorianToHijri(date);
    return hijri.month === 9;
}

/**
 * Check if we're in the last 10 days of Ramadan
 */
export function isLastTenOfRamadan(date: Date = new Date()): boolean {
    const hijri = gregorianToHijri(date);
    return hijri.month === 9 && hijri.day >= 21;
}

/**
 * Check if today is a Laylatul Qadr night (odd nights in last 10)
 * Note: exact calculation depends on sighting, this is an estimate
 */
export function isLaylaTulQadrNight(date: Date = new Date()): boolean {
    const hijri = gregorianToHijri(date);
    return hijri.month === 9 && hijri.day >= 21 && hijri.day % 2 === 1;
}

/**
 * Check if today is a white day (13th, 14th, 15th)
 */
export function isWhiteDay(date: Date = new Date()): boolean {
    const hijri = gregorianToHijri(date);
    return hijri.day === 13 || hijri.day === 14 || hijri.day === 15;
}

/**
 * Check if today is Monday or Thursday
 */
export function isMonOrThu(date: Date = new Date()): boolean {
    const day = date.getDay();
    return day === 1 || day === 4; // 1 = Monday, 4 = Thursday
}

// ------------------------------------------------------------------
// Event Data (Static - kept for reference, but logic might move)
// ------------------------------------------------------------------
export const ISLAMIC_EVENTS: Record<string, { name: string; description: string; type: 'fasting' | 'celebration' | 'special' }> = {
    '1-1': { name: 'رأس السنة الهجرية', description: 'بداية العام الهجري الجديد', type: 'celebration' },
    '1-9': { name: 'تاسوعاء', description: 'اليوم التاسع من محرم - صيام مستحب', type: 'fasting' },
    '1-10': { name: 'عاشوراء', description: 'اليوم العاشر من محرم - صيام مستحب', type: 'fasting' },
    '3-12': { name: 'المولد النبوي', description: 'ذكرى ولادة النبي ﷺ', type: 'celebration' },
    '7-27': { name: 'الإسراء والمعراج', description: 'ذكرى رحلة الإسراء والمعراج', type: 'special' },
    '8-15': { name: 'ليلة النصف من شعبان', description: 'ليلة مباركة يستحب فيها الدعاء', type: 'special' },
    '9-1': { name: 'بداية رمضان', description: 'أول أيام شهر رمضان المبارك', type: 'special' },
    '10-1': { name: 'عيد الفطر', description: 'عيد الفطر المبارك', type: 'celebration' },
    '12-8': { name: 'يوم التروية', description: 'اليوم الثامن من ذي الحجة', type: 'special' },
    '12-9': { name: 'يوم عرفة', description: 'أفضل أيام الدهر - صيام مستحب', type: 'fasting' },
    '12-10': { name: 'عيد الأضحى', description: 'عيد الأضحى المبارك', type: 'celebration' },
};

export interface IslamicEvent {
    name: string;
    description: string;
    type: 'fasting' | 'celebration' | 'special';
    hijriDate: HijriDate;
    gregorianDate: Date;
}

export function getIslamicEvent(date: Date = new Date()): IslamicEvent | null {
    const hijri = gregorianToHijri(date);
    const key = `${hijri.month}-${hijri.day}`;
    const event = ISLAMIC_EVENTS[key];
    if (event) {
        return { ...event, hijriDate: hijri, gregorianDate: date };
    }
    return null;
}

export function getUpcomingEvents(days: number = 30): IslamicEvent[] {
    const events: IslamicEvent[] = [];
    const now = new Date();
    for (let i = 0; i < days; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() + i);
        const event = getIslamicEvent(date);
        if (event) {
            events.push(event);
        }
    }
    return events;
}
