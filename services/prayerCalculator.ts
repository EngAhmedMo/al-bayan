/**
 * Local Prayer Time Calculator
 * 
 * Uses adhan-js library for offline prayer time calculation.
 * No API required - calculates using astronomical algorithms.
 * 
 * This is the CORE of the bulletproof prayer system:
 * - Works offline
 * - Never expires
 * - Same accuracy as Aladhan API
 */

import { Coordinates, CalculationMethod, PrayerTimes, Madhab, CalculationParameters, HighLatitudeRule } from 'adhan';
import { PrayerData } from '../types';
import { gregorianToHijri, formatHijriDate } from './islamicCalendar';

// Supported calculation methods - All 12 methods from adhan library
export type CalculationMethodType =
    | 'egyptian'              // Egyptian General Authority of Survey
    | 'umm_al_qura'           // Umm al-Qura University, Makkah
    | 'muslim_world_league'   // Muslim World League
    | 'isna'                  // Islamic Society of North America
    | 'karachi'               // University of Islamic Sciences, Karachi
    | 'dubai'                 // Dubai, UAE
    | 'qatar'                 // Qatar
    | 'kuwait'                // Kuwait
    | 'singapore'             // Singapore
    | 'turkey'                // Turkey (Diyanet)
    | 'tehran'                // Institute of Geophysics, Tehran
    | 'moonsighting';         // Moonsighting Committee

// Madhab for Asr calculation
export type MadhabType = 'shafi' | 'hanafi';

// Storage keys
const KEY_CALCULATION_METHOD = 'prayer_calculation_method';
const KEY_MADHAB = 'prayer_madhab';
const KEY_HIGH_LATITUDE_RULE = 'prayer_high_latitude_rule';

/**
 * Get the current calculation method from storage
 */
export const getCalculationMethod = (): CalculationMethodType => {
    const stored = localStorage.getItem(KEY_CALCULATION_METHOD);
    return (stored as CalculationMethodType) || 'egyptian';
};

/**
 * Save calculation method preference
 */
export const setCalculationMethod = (method: CalculationMethodType): void => {
    localStorage.setItem(KEY_CALCULATION_METHOD, method);
};

/**
 * Get madhab preference
 */
export const getMadhab = (): MadhabType => {
    const stored = localStorage.getItem(KEY_MADHAB);
    return (stored as MadhabType) || 'shafi';
};

/**
 * Save madhab preference
 */
export const setMadhab = (madhab: MadhabType): void => {
    localStorage.setItem(KEY_MADHAB, madhab);
};

/**
 * Get high latitude rule preference
 */
export const getHighLatitudeRule = (): 'none' | 'middle_of_night' | 'seventh_of_night' | 'twilight_angle' => {
    const stored = localStorage.getItem(KEY_HIGH_LATITUDE_RULE);
    return (stored as any) || 'middle_of_night';
};

/**
 * Save high latitude rule preference
 */
export const setHighLatitudeRule = (rule: 'none' | 'middle_of_night' | 'seventh_of_night' | 'twilight_angle'): void => {
    localStorage.setItem(KEY_HIGH_LATITUDE_RULE, rule);
};

// Prayer time adjustments type (in minutes, can be negative)
export interface PrayerAdjustments {
    fajr: number;
    sunrise: number;
    dhuhr: number;
    asr: number;
    maghrib: number;
    isha: number;
}

const KEY_PRAYER_ADJUSTMENTS = 'prayer_time_adjustments';

/**
 * Get prayer time adjustments
 */
export const getPrayerAdjustments = (): PrayerAdjustments => {
    const stored = localStorage.getItem(KEY_PRAYER_ADJUSTMENTS);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch {
            return { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };
        }
    }
    return { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };
};

/**
 * Save prayer time adjustments
 */
export const setPrayerAdjustments = (adjustments: PrayerAdjustments): void => {
    localStorage.setItem(KEY_PRAYER_ADJUSTMENTS, JSON.stringify(adjustments));
};

/**
 * Reset all adjustments to zero
 */
export const resetPrayerAdjustments = (): void => {
    localStorage.setItem(KEY_PRAYER_ADJUSTMENTS, JSON.stringify({ fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }));
};

// All calculation methods map
const METHODS: Record<CalculationMethodType, () => CalculationParameters> = {
    egyptian: CalculationMethod.Egyptian,
    umm_al_qura: CalculationMethod.UmmAlQura,
    muslim_world_league: CalculationMethod.MuslimWorldLeague,
    isna: CalculationMethod.NorthAmerica,
    karachi: CalculationMethod.Karachi,
    dubai: CalculationMethod.Dubai,
    qatar: CalculationMethod.Qatar,
    kuwait: CalculationMethod.Kuwait,
    singapore: CalculationMethod.Singapore,
    turkey: CalculationMethod.Turkey,
    tehran: CalculationMethod.Tehran,
    moonsighting: CalculationMethod.MoonsightingCommittee
};

/**
 * SMART METHOD SELECTION
 * World-class accuracy by auto-detecting the location and applying the locally authorized standard.
 */
const getRecommendedMethod = (lat: number, lng: number): CalculationMethodType => {
    // Egypt (Egyptian General Authority)
    if (lat >= 22 && lat <= 32 && lng >= 24 && lng <= 37) return 'egyptian';

    // Saudi Arabia (Umm Al Qura)
    if (lat >= 16 && lat <= 33 && lng >= 34 && lng <= 56) return 'umm_al_qura';

    // UAE - Dubai
    if (lat >= 22 && lat <= 26.5 && lng >= 51 && lng <= 56.5) return 'dubai';

    // Qatar
    if (lat >= 24.5 && lat <= 26.2 && lng >= 50.5 && lng <= 51.7) return 'qatar';

    // Kuwait
    if (lat >= 28.5 && lat <= 30.1 && lng >= 46.5 && lng <= 48.5) return 'kuwait';

    // Turkey (Diyanet)
    if (lat >= 36 && lat <= 42 && lng >= 26 && lng <= 45) return 'turkey';

    // Iran (Tehran)
    if (lat >= 25 && lat <= 40 && lng >= 44 && lng <= 64) return 'tehran';

    // Singapore & Malaysia
    if (lat >= -2 && lat <= 8 && lng >= 100 && lng <= 120) return 'singapore';

    // North America (ISNA)
    if (lat >= 24 && lat <= 72 && lng >= -170 && lng <= -50) return 'isna';

    // Pakistan, India, Bangladesh, Afghanistan (Karachi)
    if (lat >= 5 && lat <= 40 && lng >= 60 && lng <= 95) return 'karachi';

    // High latitudes (Nordic countries, UK, Canada) - MoonsightingCommittee
    if (Math.abs(lat) >= 48) return 'moonsighting';

    // Default for rest of world (Europe, Africa, etc.)
    return 'muslim_world_league';
};

/**
 * Determine high latitude rule based on location
 */
const getHighLatitudeRuleForLocation = (lat: number): any => {
    const storedRule = getHighLatitudeRule();

    if (storedRule === 'none') return HighLatitudeRule.MiddleOfTheNight; // Safe default

    // Auto-apply based on latitude
    if (Math.abs(lat) >= 55) {
        // Extreme latitudes (Nordic countries, northern Canada)
        return storedRule === 'seventh_of_night'
            ? HighLatitudeRule.SeventhOfTheNight
            : storedRule === 'twilight_angle'
                ? HighLatitudeRule.TwilightAngle
                : HighLatitudeRule.MiddleOfTheNight;
    } else if (Math.abs(lat) >= 48) {
        // High latitudes (UK, Germany, Poland, Canada)
        return HighLatitudeRule.MiddleOfTheNight;
    }

    return HighLatitudeRule.MiddleOfTheNight; // Normal latitudes don't need special handling
};

/**
 * Get calculation parameters based on method or auto-detect
 */
const getCalculationParams = (method: CalculationMethodType | undefined, lat: number, lng: number): CalculationParameters => {
    // If method is explicitly stored (user override), use it.
    // Otherwise, AUTO DETECT based on lat/lng.
    const stored = localStorage.getItem(KEY_CALCULATION_METHOD) as CalculationMethodType | null;

    const selectedMethod = method || stored || getRecommendedMethod(lat, lng);
    const methodFactory = METHODS[selectedMethod];

    return methodFactory ? methodFactory() : CalculationMethod.Egyptian();
};

/**
 * Format Date to HH:MM string
 */
const formatTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
};

/**
 * Apply minute adjustment to a Date
 */
const applyAdjustment = (date: Date, minutesToAdd: number): Date => {
    if (minutesToAdd === 0) return date;
    const adjusted = new Date(date.getTime());
    adjusted.setMinutes(adjusted.getMinutes() + minutesToAdd);
    return adjusted;
};

/**
 * Calculate prayer times locally for a specific date
 * This is the main function - works offline, never expires!
 */
export const calculateLocalPrayerTimes = (
    lat: number,
    lng: number,
    date: Date = new Date(),
    method?: CalculationMethodType
): PrayerData => {
    const coordinates = new Coordinates(lat, lng);
    const params = getCalculationParams(method, lat, lng);

    // Apply user's madhab preference for Asr calculation
    const userMadhab = getMadhab();
    params.madhab = userMadhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;

    // Apply high latitude rule for extreme locations
    params.highLatitudeRule = getHighLatitudeRuleForLocation(lat);

    // Standard Egyptian General Authority of Survey uses 19.5 degrees for Fajr
    // We strictly follow the standard calculation without extra safety offsets
    // to match the local mosque Azhan times (e.g., 5:15 AM in Menia El Qamh).
    if (params.method === 'Egyptian') {
        // No manual offsets added - relying on standard calculation
    }

    const prayerTimes = new PrayerTimes(coordinates, date, params);

    // Get user's manual adjustments
    const adjustments = getPrayerAdjustments();

    const hijriDate = gregorianToHijri(date);
    const weekdays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

    return {
        timings: {
            Fajr: formatTime(applyAdjustment(prayerTimes.fajr, adjustments.fajr)),
            Sunrise: formatTime(applyAdjustment(prayerTimes.sunrise, adjustments.sunrise)),
            Dhuhr: formatTime(applyAdjustment(prayerTimes.dhuhr, adjustments.dhuhr)),
            Asr: formatTime(applyAdjustment(prayerTimes.asr, adjustments.asr)),
            Maghrib: formatTime(applyAdjustment(prayerTimes.maghrib, adjustments.maghrib)),
            Isha: formatTime(applyAdjustment(prayerTimes.isha, adjustments.isha)),
        },
        date: {
            readable: date.toLocaleDateString('ar-EG'),
            object: date,
            hijri: {
                date: formatHijriDate(hijriDate),
                month: { ar: hijriDate.monthName },
                weekday: { ar: weekdays[date.getDay()] }
            }
        },
        meta: {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
    };
};

/**
 * Get prayer times for today - main entry point
 * Uses stored location, calculates locally
 */
export const getTodayPrayerTimesLocal = (): PrayerData | null => {
    const locationStr = localStorage.getItem('user_location_coords');
    if (!locationStr) return null;

    try {
        const location = JSON.parse(locationStr);
        if (!location.lat || !location.lng) return null;

        return calculateLocalPrayerTimes(location.lat, location.lng, new Date());
    } catch {
        return null;
    }
};

/**
 * Get prayer times for a specific date
 */
export const getPrayerTimesForDate = (date: Date): PrayerData | null => {
    const locationStr = localStorage.getItem('user_location_coords');
    if (!locationStr) return null;

    try {
        const location = JSON.parse(locationStr);
        if (!location.lat || !location.lng) return null;

        return calculateLocalPrayerTimes(location.lat, location.lng, date);
    } catch {
        return null;
    }
};

/**
 * Check if location is stored
 */
export const hasStoredLocation = (): boolean => {
    const locationStr = localStorage.getItem('user_location_coords');
    if (!locationStr) return false;

    try {
        const location = JSON.parse(locationStr);
        return !!(location.lat && location.lng);
    } catch {
        return false;
    }
};

/**
 * Schedule prayers for the next 7 days
 * Returns array of prayer data for scheduling
 */
export const getWeekPrayerTimes = (): PrayerData[] => {
    const locationStr = localStorage.getItem('user_location_coords');
    if (!locationStr) return [];

    try {
        const location = JSON.parse(locationStr);
        if (!location.lat || !location.lng) return [];

        const prayers: PrayerData[] = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            prayers.push(calculateLocalPrayerTimes(location.lat, location.lng, date));
        }
        return prayers;
    } catch {
        return [];
    }
};

/**
 * Schedule prayers for the next 30 days
 * Robust scheduling to prevent system collapse if app isn't opened
 */
export const getMonthPrayerTimes = (): PrayerData[] => {
    const locationStr = localStorage.getItem('user_location_coords');
    if (!locationStr) return [];

    try {
        const location = JSON.parse(locationStr);
        if (!location.lat || !location.lng) return [];

        const prayers: PrayerData[] = [];
        for (let i = 0; i < 30; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            prayers.push(calculateLocalPrayerTimes(location.lat, location.lng, date));
        }
        return prayers;
    } catch {
        return [];
    }
};
