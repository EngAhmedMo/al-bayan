/**
 * HifzContext.tsx
 * Wrapper Context around HifzService.
 * Provides reactive state to the UI layer.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { HifzService, HifzState, DEFAULT_HIFZ_STATE } from '../services/HifzService';

// --- Context Type ---
interface HifzContextType {
    state: HifzState | null;
    updateState: (newState: HifzState) => void;
    streak: number;
    totalTarget: number;
    progressPercent: number;
    hasHifzPlan: boolean;
    markPageAsMemorized: (pageNumber: number) => void;
    verifyAndMarkPage: (pageNumber: number) => Promise<boolean>; // New: Gatekeeper Logic
    // New: Active Session Persistence
    activeSession: 'revision' | null;
    setActiveSession: (session: 'revision' | null) => void;
    // New: Revision Tasks Persistence (To survive refresh)
    revisionTasks: any | null;
    setRevisionTasks: (tasks: any | null) => void;

    exportData: () => string;
    importData: (jsonData: string) => boolean;
    refreshData: () => void;
    resetPlan: () => void;
}

// --- Context ---
const HifzContext = createContext<HifzContextType | undefined>(undefined);

// --- Constants ---
const TOTAL_PAGES = 604;
const TOTAL_AYAHS = 6236;

// --- Provider Component ---
export const HifzProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<HifzState | null>(null);
    const [activeSession, setActiveSession] = useState<'revision' | null>(null);
    const [revisionTasks, setRevisionTasks] = useState<any | null>(null);

    // Initial Load
    useEffect(() => {
        const loaded = HifzService.loadState();
        setState(loaded);

        // Potential Improvement: Load active session from storage if we want it to survive Refresh/Close App
        // For now, React State is enough for Navigation (Reader <-> Dashboard)
    }, []);

    // Re-load helper
    const refreshData = () => {
        const loaded = HifzService.loadState();
        setState(loaded);
    };

    // Reset Plan
    const resetPlan = () => {
        const fresh = HifzService.resetState();
        setState(fresh);
    };

    // Save state wrapper
    const updateState = (newState: HifzState) => {
        // 1. Check for new achievements
        const result = HifzService.checkAndUnlockAchievements(newState);

        // 2. If new achievements, trigger celebration
        if (result.newAchievements.length > 0) {
            window.dispatchEvent(new CustomEvent('hifz-achievement-unlocked', { detail: result.newAchievements }));
        }

        const finalState = result.newState;
        const oldState = state; // Capture current state for comparison

        setState(finalState);
        HifzService.saveState(finalState);

        // 3. SMART NOTIFICATION UPDATE
        // Only trigger full rescheduling if NOTIFICATION SETTINGS changed.
        // Progress updates (currentProgress, history, etc.) do NOT require rescheduling.
        if (oldState) {
            const settingsChanged =
                finalState.notificationEnabled !== oldState.notificationEnabled ||
                finalState.notificationTime !== oldState.notificationTime ||
                finalState.revisionNotificationEnabled !== oldState.revisionNotificationEnabled ||
                finalState.revisionNotificationTime !== oldState.revisionNotificationTime ||
                JSON.stringify(finalState.selectedDays) !== JSON.stringify(oldState.selectedDays); // Days change might affect schedule

            if (settingsChanged) {
                console.log('[HifzContext] Settings changed - Requesting Reschedule');
                window.dispatchEvent(new Event('hifz-settings-changed'));
            } else {
                console.log('[HifzContext] State updated (Progress) - Skipping Reschedule');
            }
        } else {
            // Initial load or first setup - benign to schedule
            window.dispatchEvent(new Event('hifz-settings-changed'));
        }
    };

    // Mark a page as memorized
    const markPageAsMemorized = (pageNumber: number) => {
        if (!state || !state.isSetup) return;

        const expectedPage = state.startPoint + state.currentProgress;

        if (state.planType === 'pages' && pageNumber === expectedPage) {
            const updated = HifzService.markAsMemorized(state, 1);
            updateState(updated);
            if (navigator.vibrate) navigator.vibrate(100);
        }
    };

    // New: Controlled Verification Logic
    const verifyAndMarkPage = (pageNumber: number): Promise<boolean> => {
        return new Promise((resolve) => {
            if (!state || !state.isSetup) {
                resolve(false);
                return;
            }

            const event = new CustomEvent('hifz-test-request', {
                detail: {
                    page: pageNumber,
                    onSuccess: () => {
                        const expectedPage = state.startPoint + state.currentProgress;
                        if (state.planType === 'pages' && pageNumber === expectedPage) {
                            const updated = HifzService.markAsMemorized(state, 1);
                            updateState(updated);
                            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    },
                    onFailure: () => resolve(false),
                    onCancel: () => resolve(false)
                }
            });
            window.dispatchEvent(event);
        });
    };

    // Export data
    const exportData = (): string => {
        if (!state) return '{}';
        return JSON.stringify({
            exportDate: new Date().toISOString(),
            version: '2.0',
            data: state
        }, null, 2);
    };

    // Import data
    const importData = (jsonData: string): boolean => {
        try {
            const parsed = JSON.parse(jsonData);
            if (parsed.data && typeof parsed.data === 'object') {
                if (typeof parsed.data.isSetup === 'boolean') {
                    HifzService.saveState(parsed.data as HifzState);
                    setState(parsed.data as HifzState);
                    return true;
                }
            }
            return false;
        } catch (e) {
            console.error('Import failed:', e);
            return false;
        }
    };

    const streak = state ? HifzService.calculateStreak(state) : 0;
    const totalTarget = state ? (state.planType === 'pages' ? TOTAL_PAGES : TOTAL_AYAHS) : TOTAL_PAGES;
    const actualRange = state ? (totalTarget - state.startPoint + 1) : totalTarget;
    const progressPercent = state ? Math.min(100, Math.round((state.currentProgress / actualRange) * 100)) : 0;
    const hasHifzPlan = state?.isSetup || false;

    return (
        <HifzContext.Provider value={{
            state,
            updateState,
            streak,
            totalTarget,
            progressPercent,
            hasHifzPlan,
            markPageAsMemorized,
            verifyAndMarkPage,
            activeSession,
            setActiveSession,
            revisionTasks,
            setRevisionTasks,
            exportData,
            importData,
            refreshData,
            resetPlan
        }}>
            {children}
        </HifzContext.Provider>
    );
};

// --- Hook ---
export const useHifz = (): HifzContextType => {
    const context = useContext(HifzContext);
    if (context === undefined) {
        throw new Error('useHifz must be used within a HifzProvider');
    }
    return context;
};

// --- Optional Hook ---
export const useHifzOptional = (): HifzContextType | null => {
    const context = useContext(HifzContext);
    return context || null;
};

export default HifzContext;

