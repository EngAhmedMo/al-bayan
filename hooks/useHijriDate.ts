import { useState, useEffect } from 'react';
import { gregorianToHijri, HijriDate } from '../services/islamicCalendar';

/**
 * Custom Hook for Reactive Hijri Date
 * Returns the current Hijri date and updates automatically when:
 * 1. The day changes (midnight)
 * 2. The user manually adjusts the Hijri offset in settings
 */
export function useHijriDate() {
    const [hijriDate, setHijriDate] = useState<HijriDate>(gregorianToHijri(new Date()));

    useEffect(() => {
        // Function to update state
        const updateDate = () => {
            setHijriDate(gregorianToHijri(new Date()));
        };

        // 1. Listen for manual adjustment changes
        window.addEventListener('hijri-date-changed', updateDate);

        // 2. Check for midnight updates (every minute)
        const interval = setInterval(() => {
            const now = new Date();
            // If it's 00:00, update
            if (now.getHours() === 0 && now.getMinutes() === 0) {
                updateDate();
            }
        }, 60000);

        return () => {
            window.removeEventListener('hijri-date-changed', updateDate);
            clearInterval(interval);
        };
    }, []);

    return hijriDate;
}
