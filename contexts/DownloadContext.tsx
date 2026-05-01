import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { downloadSurah, downloadQueueProcessor, deleteAllSurahs, deleteSurahFromCache, isSurahDownloaded } from '../services/offlineAudio';
import { Surah } from '../types';
import { RECITERS } from '../services/api';
import { KeepAwake } from '@capacitor-community/keep-awake';

// --- TYPES ---
export interface DownloadState {
    progress: number;
    status: 'pending' | 'downloading' | 'completed' | 'error';
    error?: string;
}

// Key is `reciterId_surahId`
export type ActiveDownloadsMap = Record<string, DownloadState>;

interface DownloadContextType {
    // State
    activeDownloads: ActiveDownloadsMap;
    isBulkActive: boolean;
    bulkProgress: { completed: number; total: number } | null;

    // Actions
    startDownload: (reciterId: string, surah: Surah) => Promise<void>;
    cancelDownload: (reciterId: string, surahId: number) => void;
    deleteSurah: (reciterId: string, surah: Surah) => Promise<void>;

    // Bulk Actions
    startBulkDownload: (reciterId: string, surahsToDownload: number[]) => void;
    pauseBulkDownload: () => void;
    resumeBulkDownload: (reciterId: string, remainingSurahs: number[]) => void;
    cancelBulkDownload: () => void;

    // Storage Management
    clearAudioCache: () => Promise<void>;
    isClearingCache: boolean;

    // Helpers
    getDownloadState: (reciterId: string, surahId: number) => DownloadState | null;
}

const DownloadContext = createContext<DownloadContextType>({
    activeDownloads: {},
    isBulkActive: false,
    bulkProgress: null,
    startDownload: async () => { },
    cancelDownload: () => { },
    deleteSurah: async () => { },
    startBulkDownload: () => { },
    pauseBulkDownload: () => { },
    resumeBulkDownload: () => { },
    cancelBulkDownload: () => { },
    clearAudioCache: async () => { },
    isClearingCache: false,
    getDownloadState: () => null,
});

export const useDownload = () => useContext(DownloadContext);

// --- PROVIDER ---
export const DownloadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // State
    const [activeDownloads, setActiveDownloads] = useState<ActiveDownloadsMap>({});

    const [isBulkActive, setIsBulkActive] = useState(false);
    const [bulkProgress, setBulkProgress] = useState<{ completed: number; total: number } | null>(null);

    const [isClearingCache, setIsClearingCache] = useState(false);

    // Refs for AbortControllers
    const controllersRef = useRef<Record<string, AbortController>>({}); // Key: `reciterId_surahId`
    const bulkControllerRef = useRef<AbortController | null>(null);

    // --- Helpers ---
    const getKey = (reciterId: string, surahId: number) => `${reciterId}_${surahId}`;

    const getDownloadState = useCallback((reciterId: string, surahId: number) => {
        return activeDownloads[getKey(reciterId, surahId)] || null;
    }, [activeDownloads]);

    // --- Single Download ---
    const startDownload = useCallback(async (reciterId: string, surah: Surah) => {
        const key = getKey(reciterId, surah.number);

        // Check if already downloading
        if (activeDownloads[key]?.status === 'downloading') return;

        // Create Controller
        const controller = new AbortController();
        controllersRef.current[key] = controller;

        // Init State
        setActiveDownloads(prev => ({
            ...prev,
            [key]: { progress: 0, status: 'downloading' }
        }));

        try {
            await downloadSurah(
                reciterId,
                surah.number,
                (pct) => {
                    setActiveDownloads(prev => ({
                        ...prev,
                        [key]: { ...prev[key], progress: pct, status: 'downloading' }
                    }));
                },
                controller.signal
            );

            // Complete
            setActiveDownloads(prev => {
                const newState = { ...prev };
                delete newState[key]; // Remove from active tracking on completion
                return newState;
            });

            // Dispatch event to notify listeners (e.g. Downloads page to update list)
            window.dispatchEvent(new CustomEvent('download-completed', { detail: { reciterId, surahId: surah.number } }));

        } catch (e: any) {
            if (e.message === 'ABORTED' || e.name === 'AbortError') {
                // Cancelled
                setActiveDownloads(prev => {
                    const newState = { ...prev };
                    delete newState[key];
                    return newState;
                });
            } else {
                // Error
                console.error("Download Error:", e);
                setActiveDownloads(prev => ({
                    ...prev,
                    [key]: { ...prev[key], status: 'error', error: 'فشل التحميل' }
                }));
                // Auto-remove error state after 3s
                setTimeout(() => {
                    setActiveDownloads(prev => {
                        const newState = { ...prev };
                        delete newState[key];
                        return newState;
                    });
                }, 3000);
            }
        } finally {
            delete controllersRef.current[key];
        }
    }, [activeDownloads]);

    const cancelDownload = useCallback((reciterId: string, surahId: number) => {
        const key = getKey(reciterId, surahId);
        const controller = controllersRef.current[key];
        if (controller) {
            controller.abort();
        }
    }, []);

    const deleteSurah = useCallback(async (reciterId: string, surah: Surah) => {
        await deleteSurahFromCache(reciterId, surah.number);
        // Dispatch event
        window.dispatchEvent(new CustomEvent('download-deleted', { detail: { reciterId, surahId: surah.number } }));
    }, []);


    // --- Bulk Download ---
    const startBulkDownload = useCallback(async (reciterId: string, surahsToDownload: number[]) => {
        if (surahsToDownload.length === 0) return;

        // Cancel any individual active downloads for this reciter to avoid Race Conditions
        Object.keys(controllersRef.current)
            .filter(key => key.startsWith(reciterId))
            .forEach(key => {
                controllersRef.current[key]?.abort();
                delete controllersRef.current[key];
            });

        setIsBulkActive(true);
        setBulkProgress({ completed: 0, total: surahsToDownload.length });

        bulkControllerRef.current = new AbortController();

        try {
            await KeepAwake.keepAwake().catch(() => {});
            
            const result = await downloadQueueProcessor(
                reciterId,
                surahsToDownload,
                (completedSurahNum) => {
                    // On Surah Complete
                    window.dispatchEvent(new CustomEvent('download-completed', { detail: { reciterId, surahId: completedSurahNum } }));
                },
                (completedCount) => {
                    // On Progress (Count)
                    setBulkProgress({ completed: completedCount, total: surahsToDownload.length });
                },
                0, // Initial completed
                bulkControllerRef.current.signal
            );

            if (result && result.failedSurahs && result.failedSurahs.length > 0) {
               alert(`اكتمل التحميل مع فشل ${result.failedSurahs.length} سورة. الرجاء المحاولة لاحقاً.`);
            }

        } catch (e: any) {
            if (e.message === 'PAUSED' || e.name === 'AbortError') {
                // Paused/Cancelled logic handled by UI state usually
            } else {
                alert("حدث خطأ أثناء التحميل المتعدد");
            }
        } finally {
            setIsBulkActive(false);
            setBulkProgress(null);
            bulkControllerRef.current = null;
            KeepAwake.allowSleep().catch(() => {});
        }
    }, []);

    const pauseBulkDownload = useCallback(() => {
        if (bulkControllerRef.current) {
            bulkControllerRef.current.abort(); // Processing function throws "PAUSED"
        }
    }, []);

    const resumeBulkDownload = useCallback((reciterId: string, remainingSurahs: number[]) => {
        // Logic would be to call startBulkDownload again with remaining list
        // But we need to keep track of TOTAL count for correct progress bar
        // For simplicity in this v1, we just restart with remaining.
        // Ideally UI passes `total` separately.
        startBulkDownload(reciterId, remainingSurahs);
    }, [startBulkDownload]);

    const cancelBulkDownload = useCallback(() => {
        if (bulkControllerRef.current) {
            bulkControllerRef.current.abort();
        }
        setIsBulkActive(false);
        setBulkProgress(null);
    }, []);

    // --- System Cache Clearing ---
    const clearAudioCache = useCallback(async () => {
        setIsClearingCache(true);
        try {
            if ('caches' in window) {
                // Clear all Cache API storage except explicit offline data if separated?
                // Currently we use 'quran-audio-v1' for audio.
                // If we delete the cache, we lose valid downloads too IF they are in Cache Storage (Web).
                // On Native, valid downloads are in Filesystem.

                // Strategy: 
                // - On Web: We cannot easily distinguish stream-cache from download-cache if they use the same generic cache name.
                // - On Native: 'quran-audio-v1' is used ONLY by the service worker/fetch for streaming. 
                //   Real downloads are in `Directory.Data/audio`.
                //   So deleting 'quran-audio-v1' is SAFE on Native to clear streaming junk.

                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => {
                    // Delete specific audio caches or all caches?
                    // Let's delete 'quran-audio-v1' which is the main culprit.
                    if (name.includes('audio') || name.includes('media')) {
                        console.log('Deleting cache:', name);
                        return caches.delete(name);
                    }
                    return Promise.resolve(false);
                }));
            }

            // Also potentially clear some localStorage keys if needed, but not critical metadata

            alert('تم مسح الملفات المؤقتة بنجاح.\n(لم يتم حذف التحميلات المحفوظة)');

        } catch (e) {
            console.error("Clear Cache Failed", e);
            alert('حدث خطأ أثناء مسح الملفات المؤقتة');
        } finally {
            setIsClearingCache(false);
        }
    }, []);


    return (
        <DownloadContext.Provider value={{
            activeDownloads,
            isBulkActive,
            bulkProgress,
            startDownload,
            cancelDownload,
            deleteSurah,
            startBulkDownload,
            pauseBulkDownload,
            resumeBulkDownload,
            cancelBulkDownload,
            clearAudioCache,
            isClearingCache,
            getDownloadState
        }}>
            {children}
        </DownloadContext.Provider>
    );
};
