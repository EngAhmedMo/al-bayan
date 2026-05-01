/**
 * Spaced Repetition System (SRS) Algorithm
 * Based on SuperMemo-2 (SM-2) tailored for Quran Memorization.
 * 
 * Logic:
 * - Items have an Ease Factor (EF) starting at 2.5.
 * - Intervals increase based on EF and performance rating.
 * - Grades: 
 *   0: Blackout (Complete failure) -> Reset
 *   1: Wrong (Incorrect answer) -> Reset
 *   2: Hard (Struggled, many hints) -> Interval * 1.2
 *   3: Good (Correct with hesitation) -> Interval * EF
 *   4: Easy (Perfect recall) -> Interval * EF * 1.3 (Bonus)
 */

export interface SrsItem {
    id: string;        // Unique ID (e.g., "page_102" or "ayah_2_255")
    dueDate: string;   // ISO Date string (YYYY-MM-DD)
    interval: number;  // Current interval in days
    repetition: number;// Number of successful repetitions
    efactor: number;   // Ease Factor (Min 1.3)
    mistakesCount?: number; // Total mistakes
    failHistory?: string[]; // Dates of failures
}

export type SrsGrade = 0 | 1 | 2 | 3 | 4;

const MIN_EF = 1.3;
const INITIAL_EF = 2.5;

// Helper for Local Date String (YYYY-MM-DD)
const getTodayString = (): string => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const createNewSrsItem = (id: string): SrsItem => ({
    id,
    dueDate: getTodayString(), // Due immediately (Local Time)
    interval: 0,
    repetition: 0,
    efactor: INITIAL_EF,
    mistakesCount: 0,
    failHistory: []
});

export const calculateNextReview = (item: SrsItem, grade: SrsGrade): SrsItem => {
    let { interval, repetition, efactor, mistakesCount = 0, failHistory = [] } = item;
    let nextInterval = 0;
    const today = getTodayString();

    // 1. Update Ease Factor (Standard SM-2 Formula)
    // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    // where q is grade (0-5, we map 0-4 to roughly fit) in standard SM-2.
    // Let's settle on a simpler logic for 0-4 scale:

    // Grade 0/1: Fail
    if (grade <= 1) {
        repetition = 0;
        interval = 1; // Review tomorrow
        // Slightly penalize EF for failure
        efactor = Math.max(MIN_EF, efactor - 0.2);

        // Track mistake
        mistakesCount += 1;
        if (!failHistory.includes(today)) {
            failHistory = [...failHistory, today].slice(-10); // Keep last 10 failures
        }
    } else {
        // Success (2, 3, 4)

        // Update EF
        // 4 (Easy) -> Increase EF
        // 3 (Good) -> Keep or slight increase
        // 2 (Hard) -> Decrease EF

        if (grade === 4) efactor += 0.15;
        else if (grade === 2) efactor -= 0.15;
        // Grade 3: Change nothing or slight nudge

        efactor = Math.max(MIN_EF, efactor);

        // Calculate Interval
        if (repetition === 0) {
            nextInterval = 1;
        } else if (repetition === 1) {
            nextInterval = 6;
        } else {
            // Apply SRS Formula
            let idealInterval = interval * efactor;

            // Add Fuzz Factor: ±7.5% deviation for intervals > 10 days
            // This prevents "Review Avalanches" where many items fall due on exactly the same day
            if (idealInterval > 10) {
                const fuzzWrapper = (Math.random() * 0.15) - 0.075; // Random between -0.075 and +0.075
                idealInterval = idealInterval * (1 + fuzzWrapper);
            }

            nextInterval = Math.ceil(idealInterval);
        }

        repetition += 1;
        interval = nextInterval;
    }

    // New Due Date
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + interval);

    // Format next due date locally
    const nextYear = nextDate.getFullYear();
    const nextMonth = String(nextDate.getMonth() + 1).padStart(2, '0');
    const nextDay = String(nextDate.getDate()).padStart(2, '0');
    const dueDateStr = `${nextYear}-${nextMonth}-${nextDay}`;

    return {
        ...item,
        interval,
        repetition,
        efactor,
        dueDate: dueDateStr,
        mistakesCount,
        failHistory
    };
};

/**
 * Helper to get items due for review
 */
export const getDueItems = (items: SrsItem[], limit: number = 20): SrsItem[] => {
    const today = getTodayString();
    return items
        .filter(item => item.dueDate <= today)
        .sort((a, b) => {
            // Prioritize items with smaller intervals (harder/newer items) first
            if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
            return a.interval - b.interval;
        })
        .slice(0, limit);
};
