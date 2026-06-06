/**
 * HifzService.ts
 * 
 * Core business logic for the Al-Bayan Hifz (Memorization) System.
 */

import { SrsItem, calculateNextReview, createNewSrsItem, SrsGrade } from './srsAlgorithm';
import { HifzTestResult, QuizQuestion } from './hifzManager';
import { evaluateAchievements } from './gamification';

// --- Constants ---
const STORAGE_KEY = 'albayan_hifz_plan_v1';
const BACKUP_KEY = 'albayan_hifz_backup_v1';
const BACKUP_TIMESTAMP_KEY = 'albayan_hifz_backup_timestamp';
const BACKUP_INTERVAL_DAYS = 3;

// --- State Definitions ---
export interface HifzState {
    isSetup: boolean;
    planType: 'pages' | 'ayahs';

    // Plan Configuration
    amountPerDay: number;
    daysPerWeek: number;
    selectedDays: number[]; // 0-6 (Sun-Sat)

    // Progress Tracking
    currentProgress: number; // Cumulative count
    startPoint: number;      // Page 1 or Global Ayah 1
    history: string[];       // ISO Date strings (YYYY-MM-DD)
    lastCompletedDate: string | null;

    // User Preferences
    hasSeenOnboarding?: boolean;
    notificationEnabled: boolean;
    notificationTime: string; // HH:mm

    // Revision (Muraja'a) System
    revisionHistory: string[];
    lastRevisionDate: string | null;
    revisionAmount: number;
    todayRevisionDone: boolean;
    revisionNotificationEnabled: boolean;
    revisionNotificationTime: string;

    // Smart Cycles
    revisionStartPoint: number;
    revisionCycleCount?: number;

    // Algorithms & Stats
    srsItems: SrsItem[];     // Spaced Repetition Items
    testHistory: HifzTestResult[];
    mistakeMap?: { [ayahKey: string]: number };

    // Configuration
    testStrictness?: 'easy' | 'medium' | 'strict';
    preferredTestMode?: 'classic' | 'interactive';

    // Achievements Stats
    testStats?: {
        perfectTestsCount: number;
        reorderCount: number;
        blankedMushafPages: number[];
    };

    // Gamification
    unlockedAchievements?: string[];
}

export const DEFAULT_HIFZ_STATE: HifzState = {
    isSetup: false,
    planType: 'pages',
    amountPerDay: 2,
    daysPerWeek: 6,
    selectedDays: [0, 1, 2, 3, 4, 6], // Sat-Thu default
    currentProgress: 0,
    startPoint: 1,
    history: [],
    lastCompletedDate: null,

    notificationEnabled: true,
    notificationTime: '08:00',

    revisionHistory: [],
    lastRevisionDate: null,
    revisionAmount: 5,
    todayRevisionDone: false,
    revisionNotificationEnabled: true,
    revisionNotificationTime: '20:00',
    revisionStartPoint: 1,
    revisionCycleCount: 0,

    srsItems: [],
    testHistory: [],
    testStrictness: 'medium',
    preferredTestMode: 'interactive',

    testStats: {
        perfectTestsCount: 0,
        reorderCount: 0,
        blankedMushafPages: [],
    },

    unlockedAchievements: [],
};

export class HifzService {
    /**
     * Helper: Get today's date as YYYY-MM-DD string
     */
    static getTodayString(): string {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Load state from local storage with safe defaults and migration
     */
    static loadState(): HifzState {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return { ...DEFAULT_HIFZ_STATE };

            const parsed = JSON.parse(saved) as HifzState;

            // --- Migration Logic ---
            // Ensure all required fields exist (filling gaps from older versions)

            if (!parsed.selectedDays) {
                parsed.selectedDays = [0, 1, 2, 3, 4, 5, 6];
                parsed.daysPerWeek = 7;
            }

            if (parsed.revisionStartPoint === undefined) {
                parsed.revisionStartPoint = parsed.startPoint || 1;
            }

            if (!parsed.srsItems) parsed.srsItems = [];
            if (!parsed.testHistory) parsed.testHistory = [];
            if (!parsed.unlockedAchievements) parsed.unlockedAchievements = [];

            // Reset daily flags if it's a new day
            const todayStr = this.getTodayString();
            if (parsed.lastRevisionDate !== todayStr) {
                parsed.todayRevisionDone = false;
            }

            return parsed;
        } catch (e) {
            console.error('[HifzService] Failed to load state:', e);
            return { ...DEFAULT_HIFZ_STATE };
        }
    }

    /**
     * Save state to local storage and trigger auto-backup
     */
    static saveState(newState: HifzState): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
            this.handleAutoBackup(newState);
        } catch (e) {
            console.error('[HifzService] Failed to save state:', e);
        }
    }

    /**
     * Resets the entire Hifz plan to default (Factory Reset for Hifz).
     */
    static resetState(): HifzState {
        const freshState = { ...DEFAULT_HIFZ_STATE };
        this.saveState(freshState);
        return freshState;
    }

    /**
     * Internal: Handle automatic backup every X days
     */
    private static handleAutoBackup(state: HifzState): void {
        try {
            if (!state.isSetup || state.currentProgress === 0) return;

            const lastBackupStr = localStorage.getItem(BACKUP_TIMESTAMP_KEY);
            const now = Date.now();
            const shouldBackup = !lastBackupStr ||
                (now - parseInt(lastBackupStr)) > (BACKUP_INTERVAL_DAYS * 24 * 60 * 60 * 1000);

            if (shouldBackup) {
                localStorage.setItem(BACKUP_KEY, JSON.stringify({
                    data: state,
                    timestamp: now,
                    version: '1.0'
                }));
                localStorage.setItem(BACKUP_TIMESTAMP_KEY, now.toString());
                console.log('[HifzService] Auto-backup created');
            }
        } catch (e) {
            console.warn('[HifzService] Backup failed:', e);
        }
    }

    /**
     * Calculate Streak based on history and selected days
     */
    static calculateStreak(state: HifzState): number {
        if (!state.history || state.history.length === 0) return 0;

        const selectedDays = state.selectedDays || [0, 1, 2, 3, 4, 5, 6];
        let streak = 0;
        let checkDate = new Date();
        const todayStr = this.getTodayString();

        // Ensure we explicitly start check from today
        // (Date object defaults to now, which is correct)

        for (let i = 0; i < 365; i++) {
            const dateStr = this.formatDate(checkDate);
            const dayOfWeek = checkDate.getDay();

            // Skip non-scheduled days (Rest days don't break streak)
            if (!selectedDays.includes(dayOfWeek)) {
                checkDate.setDate(checkDate.getDate() - 1);
                continue;
            }

            // Check completion
            if (state.history.includes(dateStr)) {
                streak++;
            } else {
                // Not done.
                // If it's TODAY, streak isn't broken yet (user has time until midnight).
                // If it's BEFORE today, streak is broken.
                if (dateStr !== todayStr) {
                    break;
                }
            }

            checkDate.setDate(checkDate.getDate() - 1);
        }

        return streak;
    }

    private static formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Mark a page or unit as memorized
     */
    static markAsMemorized(currentState: HifzState, amount: number = 1): HifzState {
        const todayStr = this.getTodayString();

        const newHistory = currentState.history.includes(todayStr)
            ? currentState.history
            : [...currentState.history, todayStr];

        return {
            ...currentState,
            currentProgress: currentState.currentProgress + amount,
            lastCompletedDate: todayStr,
            history: newHistory
        };
    }

    /**
     * Mark revision as done for today
     */
    static markRevisionDone(currentState: HifzState): HifzState {
        const todayStr = this.getTodayString();

        const newRevHistory = currentState.revisionHistory.includes(todayStr)
            ? currentState.revisionHistory
            : [...currentState.revisionHistory, todayStr];

        // --- Logic Engine Update: Advance Cycle (Khatma) ---
        let nextStart = (currentState.revisionStartPoint || 1) + currentState.revisionAmount;
        let cycleCount = currentState.revisionCycleCount || 0;

        const totalUnits = currentState.planType === 'pages' ? 604 : 6236;

        if (nextStart > totalUnits) {
            // Khatma Complete! Return to user's original start point
            nextStart = currentState.startPoint;
            cycleCount += 1;
            // TODO: We could return a flag here to trigger a celebration "Khatma Completed"
        }

        return {
            ...currentState,
            lastRevisionDate: todayStr,
            todayRevisionDone: true,
            revisionHistory: newRevHistory,
            revisionStartPoint: nextStart,
            revisionCycleCount: cycleCount
        };
    }

    /**
     * Check for new achievements
     * Returns the list of NEWLY unlocked achievement IDs
     */
    static checkAndUnlockAchievements(currentState: HifzState): { newState: HifzState, newAchievements: string[] } {
        const streak = this.calculateStreak(currentState);
        const unlockedIds = evaluateAchievements(currentState, streak);

        const previousIds = currentState.unlockedAchievements || [];
        const newIds = unlockedIds.filter(id => !previousIds.includes(id));

        if (newIds.length > 0) {
            return {
                newState: {
                    ...currentState,
                    unlockedAchievements: [...previousIds, ...newIds]
                },
                newAchievements: newIds
            };
        }

        return { newState: currentState, newAchievements: [] };
    }

    /**
     * Process Quiz Result & Trigger Adaptive Logic
     * Central "Brain" for handling test outcomes, updating SRS, and suggesting changes.
     */
    static processQuizResult(
        currentState: HifzState,
        result: HifzTestResult,
        // Optional raw data for internal calculation (Preferred)
        details?: { questions: QuizQuestion[]; answers: Record<string, boolean> },
        // Legacy support
        updatedSrsItems?: SrsItem[]
    ): { newState: HifzState; alerts: string[] } {
        const alerts: string[] = [];
        let newState = { ...currentState };

        // 1. Update History
        const newHistory = [...(newState.testHistory || []), result];
        newState.testHistory = newHistory;

        // 2. Logic Hardening: Calculate SRS Internally
        let currentItems = [...newState.srsItems];

        if (details) {
            details.questions.forEach(q => {
                const isCorrect = details.answers[q.id];
                // Determine Grade (4 = Easy/Correct, 1 = Wrong)
                // We could add 'hesitation' logic later if UI tracks time per question
                const grade: SrsGrade = isCorrect ? 4 : 1;

                // Find or Create Item
                // Construct stable ID for SRS using Global Ayah Number
                // This ensures consistency across all quiz types and prevents duplicate SRS items
                const srsId = q.ayah ? `ayah_${q.ayah.number}` : q.id;

                let srsItem = currentItems.find(i => i.id === srsId);
                if (!srsItem) {
                    srsItem = createNewSrsItem(srsId);
                }

                // Calculate Next Review
                const updatedItem = calculateNextReview(srsItem, grade);

                // Update List
                const idx = currentItems.findIndex(i => i.id === srsId);
                if (idx >= 0) currentItems[idx] = updatedItem;
                else currentItems.push(updatedItem);
            });
            newState.srsItems = currentItems;

            // --- Mistake Map Update (New Logic) ---
            if (!newState.mistakeMap) newState.mistakeMap = {};

            details.questions.forEach(q => {
                const isCorrect = details.answers[q.id];
                if (q.ayah) {
                    const key = q.ayah.number.toString();
                    if (!isCorrect) {
                        // Increment mistake count
                        newState.mistakeMap![key] = (newState.mistakeMap![key] || 0) + 1;
                    } else {
                        // Healing: Decrease count if answered correctly
                        if (newState.mistakeMap![key] > 0) {
                            newState.mistakeMap![key] = Math.max(0, newState.mistakeMap![key] - 1);
                        }
                    }
                }
            });

        } else if (updatedSrsItems) {
            // Legacy / Fallback
            updatedSrsItems.forEach(updated => {
                const idx = currentItems.findIndex(i => i.id === updated.id);
                if (idx >= 0) currentItems[idx] = updated;
                else currentItems.push(updated);
            });
            newState.srsItems = currentItems;
        }

        // 3. Adaptive Logic: Check for repeated failures
        // If last 3 tests averaged < 60%, suggest a change
        // We only trigger this if we haven't nagged recently (e.g. reorderCount check)
        const recentTests = newHistory.slice(-3);
        const lowScoreThreshold = 60;

        if (recentTests.length >= 3) {
            const consecutiveFailures = recentTests.every(t => t.score < lowScoreThreshold);
            if (consecutiveFailures) {
                // Check if we haven't suggested this recently?
                // For simplicity, we just flag it. The UI decides how to show it.
                alerts.push('adaptive_reorder');

                // Increment reorder count to track how often user struggles
                if (newState.testStats) {
                    newState.testStats.reorderCount = (newState.testStats.reorderCount || 0) + 1;
                }
            }
        }

        // 4. Update Stats
        if (result.score === 100) {
            if (!newState.testStats) newState.testStats = { perfectTestsCount: 0, reorderCount: 0, blankedMushafPages: [] };
            newState.testStats.perfectTestsCount++;
        }

        return { newState, alerts };
    }

    /**
     * Undo daily wird completion safely, rolling back progress.
     */
    static undoDailyWird(currentState: HifzState): HifzState {
        const todayStr = this.getTodayString();

        // If not completed today, nothing to undo (or user is forcing undo of older date?)
        // For now, only undo TODAY's action for safety.
        if (!currentState.history.includes(todayStr)) {
            return currentState;
        }

        const newHistory = currentState.history.filter(d => d !== todayStr);

        // Rollback progress
        // We assume the amount added was amountPerDay. 
        // Corner case: If user was near end of Quran, they might have added less than amountPerDay.
        // Ideally we should track exactly how much was added, but for V1 we approximate or clamp.

        // Calculate what the "previous" progress would have been
        // Ensure we don't go below 0
        const newProgress = Math.max(0, currentState.currentProgress - currentState.amountPerDay);

        // Find the new "last completed date" from the remaining history
        // Sort history to be safe
        const sortedHistory = [...newHistory].sort();
        const newLastCompleted = sortedHistory.length > 0 ? sortedHistory[sortedHistory.length - 1] : null;

        return {
            ...currentState,
            currentProgress: newProgress,
            history: newHistory,
            lastCompletedDate: newLastCompleted
        };
    }

    /**
     * Mark daily wird as completed, advancing progress safely.
     */
    static completeDailyWird(currentState: HifzState): HifzState {
        const todayStr = this.getTodayString();

        // Prevent double completion on the same day
        if (currentState.history.includes(todayStr) || currentState.lastCompletedDate === todayStr) {
            return currentState;
        }

        // Calculate new progress
        // Max limit is 604 (Pages) or 6236 (Ayahs) based on startPoint
        const totalTarget = currentState.planType === 'pages' ? 604 : 6236;
        const currentLoc = currentState.startPoint + currentState.currentProgress;

        // Ensure we don't exceed total
        let amount = currentState.amountPerDay;
        if (currentLoc + amount > totalTarget) {
            amount = Math.max(0, totalTarget - currentLoc + 1);
        }

        const newHistory = currentState.history.includes(todayStr)
            ? currentState.history
            : [...currentState.history, todayStr];

        return {
            ...currentState,
            currentProgress: currentState.currentProgress + amount,
            lastCompletedDate: todayStr,
            history: newHistory
        };
    }

    /**
     * Create a robust JSON backup string with metadata and versioning.
     */
    static createBackup(state: HifzState): string {
        const backupData = {
            data: { ...state },
            meta: {
                version: '1.0', // Schema version
                timestamp: new Date().toISOString(),
                agent: 'AlBayan_HifzService',
                platform: typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform() ? 'mobile' : 'web',
                checkSum: state.history.length + (state.srsItems?.length || 0) // Simple integrity check
            }
        };
        return JSON.stringify(backupData, null, 2);
    }

    /**
     * Validate and Parse a Backup JSON string.
     * Performs strict schema validation and sanitization.
     * Throws descriptive errors for UI handling.
     */
    static validateAndRestore(jsonString: string): HifzState {
        try {
            const parsed = JSON.parse(jsonString);

            // 1. Structure Check (Legacy vs New)
            let rawState: any = parsed;
            if (parsed.meta && parsed.data) {
                // New Format
                rawState = parsed.data;
                // Optional: Validate Checksum if needed in future
                // const expectedSum = rawState.history.length + (rawState.srsItems?.length || 0);
                // if (parsed.meta.checkSum && parsed.meta.checkSum !== expectedSum) console.warn('Checksum mismatch');
            }

            // 2. Strict Schema Validation
            if (!rawState || typeof rawState !== 'object') {
                throw new Error('تنسيق الملف غير صالح (Root object missing)');
            }

            // Required Fields
            const requiredFields = ['planType', 'startPoint', 'currentProgress', 'history'];
            const missing = requiredFields.filter(field => rawState[field] === undefined);
            if (missing.length > 0) {
                throw new Error(`بيانات مفقودة: ${missing.join(', ')}`);
            }

            // Type Safety
            if (!['pages', 'ayahs'].includes(rawState.planType)) {
                throw new Error('نوع الخطة غير مدعوم');
            }
            if (!Array.isArray(rawState.history)) {
                throw new Error('سجل الحفظ تالف');
            }

            // 3. Sanitization & Defaults
            const cleanedState: HifzState = {
                isSetup: true, // Always valid if restoring
                planType: rawState.planType,
                startPoint: Number(rawState.startPoint) || 1,
                currentProgress: Number(rawState.currentProgress) || 0,
                amountPerDay: Number(rawState.amountPerDay) || 1,
                daysPerWeek: Number(rawState.daysPerWeek) || 6,
                selectedDays: Array.isArray(rawState.selectedDays) ? rawState.selectedDays : [0, 1, 2, 3, 4, 5, 6],

                // Notifications
                notificationEnabled: !!rawState.notificationEnabled,
                notificationTime: rawState.notificationTime || '05:00',

                // Revision System
                revisionHistory: Array.isArray(rawState.revisionHistory) ? rawState.revisionHistory : [],
                lastRevisionDate: rawState.lastRevisionDate || null,
                revisionAmount: Number(rawState.revisionAmount) || 1,
                todayRevisionDone: !!rawState.todayRevisionDone,
                revisionNotificationEnabled: !!rawState.revisionNotificationEnabled,
                revisionNotificationTime: rawState.revisionNotificationTime || '05:30',

                // Arrays - Default to empty if missing/corrupt
                history: Array.isArray(rawState.history) ? rawState.history : [],
                srsItems: Array.isArray(rawState.srsItems) ? rawState.srsItems : [],
                mistakeMap: rawState.mistakeMap && typeof rawState.mistakeMap === 'object' ? rawState.mistakeMap : {},
                testHistory: Array.isArray(rawState.testHistory) ? rawState.testHistory : [],
                unlockedAchievements: Array.isArray(rawState.unlockedAchievements) ? rawState.unlockedAchievements : [],

                // Optional
                lastCompletedDate: rawState.lastCompletedDate || null,
                revisionStartPoint: rawState.revisionStartPoint || 1,
                revisionCycleCount: rawState.revisionCycleCount || 0,

                // Config
                testStrictness: rawState.testStrictness,
                preferredTestMode: rawState.preferredTestMode,
                testStats: rawState.testStats
            };

            return cleanedState;

        } catch (e: any) {
            console.error('Restore Failed:', e);
            // Propagate clean user-friendly message
            throw new Error(e.message || 'فشل استعادة البيانات: الملف تالف');
        }
    }

    /**
     * Helper to merge new/updated SRS items into the main list.
     * Updates existing items by ID, appends new ones.
     */
    static mergeSrsItems(currentItems: SrsItem[], newItems: SrsItem[]): SrsItem[] {
        const itemMap = new Map(currentItems.map(i => [i.id, i]));

        newItems.forEach(item => {
            itemMap.set(item.id, item);
        });

        return Array.from(itemMap.values());
    }

    /**
     * Get the top mistakes (Ayahs with highest failure count)
     */
    static getTopMistakes(state: HifzState, limit: number = 20): number[] {
        if (!state.mistakeMap) return [];

        return Object.entries(state.mistakeMap)
            .filter(([, count]) => count > 0)
            .sort(([, countA], [, countB]) => countB - countA)
            .slice(0, limit)
            .map(([key]) => parseInt(key))
            .filter(n => !isNaN(n));
    }
}
