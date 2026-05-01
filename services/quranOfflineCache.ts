/**
 * Quran Offline Cache Service
 * Provides offline-first access to Quran text with Tajweed markers
 * 
 * Priority Order:
 * 1. Static bundled data (100% offline, fastest)
 * 2. IndexedDB cache (for any updated data)
 * 3. API fallback (only if static and cache unavailable)
 */

import { Ayah } from '../types';
import { getAudioUrl } from './api';
import { getStaticPage } from './quranStaticData';

const DB_NAME = 'bayan-quran-cache';
const DB_VERSION = 1;
const STORE_NAME = 'pages-tajweed-v1';
const API_BASE = 'https://api.alquran.cloud/v1';

// Tajweed edition for colored text markers
const TAJWEED_EDITION = 'quran-tajweed';
const UTHMANI_EDITION = 'quran-uthmani';

let db: IDBDatabase | null = null;

/**
 * Initialize IndexedDB for Quran storage
 */
export const initQuranDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);

        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = (event.target as IDBOpenDBRequest).result;

            // Create pages store with page number as key
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const store = database.createObjectStore(STORE_NAME, { keyPath: 'pageNumber' });
                store.createIndex('cached', 'cached', { unique: false });
            }
        };
    });
};

/**
 * Get a page from cache
 */
export const getPageFromCache = async (pageNumber: number): Promise<Ayah[] | null> => {
    try {
        const database = await initQuranDB();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(pageNumber);

            request.onsuccess = () => {
                if (request.result) {
                    resolve(request.result.ayahs);
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error('Failed to get page from cache:', e);
        return null;
    }
};

/**
 * Save a page to cache
 */
export const savePageToCache = async (pageNumber: number, ayahs: Ayah[]): Promise<void> => {
    try {
        const database = await initQuranDB();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            store.put({
                pageNumber,
                ayahs,
                cached: Date.now()
            });

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    } catch (e) {
        console.error('Failed to save page to cache:', e);
    }
};

/**
 * Check how many pages are cached
 */
export const getCachedPageCount = async (): Promise<number> => {
    try {
        const database = await initQuranDB();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error('Failed to count cached pages:', e);
        return 0;
    }
};

/**
 * Fetch page with offline-first strategy
 * 
 * Priority:
 * 1. STATIC BUNDLED DATA - Instant, 100% offline (from quran-tajweed.json)
 * 2. IndexedDB Cache - For any user-cached data
 * 3. API Fallback - Only if both above fail
 */
export const fetchPageOffline = async (
    pageNumber: number,
    reciterId: string = 'ar.minshawi_murattal',
    useTajweed: boolean = true
): Promise<Ayah[]> => {

    // === PRIORITY 1: STATIC BUNDLED DATA (Guaranteed Offline) ===
    try {
        const staticPage = await getStaticPage(pageNumber);
        if (staticPage && staticPage.length > 0) {
            // Add audio URLs for current reciter
            return staticPage.map(a => ({
                ...a,
                audio: getAudioUrl(reciterId, a.number)
            }));
        }
    } catch (e) {
        console.warn(`[QuranCache] Static data unavailable for page ${pageNumber}:`, e);
    }

    // === PRIORITY 2: IndexedDB Cache ===
    try {
        const cached = await getPageFromCache(pageNumber);
        if (cached && cached.length > 0) {
            return cached.map(a => ({
                ...a,
                audio: getAudioUrl(reciterId, a.number)
            }));
        }
    } catch (e) {
        console.warn(`[QuranCache] IndexedDB unavailable for page ${pageNumber}:`, e);
    }

    // === PRIORITY 3: API Fallback (Online Only) ===
    try {
        const edition = useTajweed ? TAJWEED_EDITION : UTHMANI_EDITION;
        const res = await fetch(`${API_BASE}/page/${pageNumber}/${edition}`);

        if (!res.ok) throw new Error(`API Error: ${res.status}`);

        const data = await res.json();

        if (data.code === 200) {
            const ayahs: Ayah[] = data.data.ayahs.map((a: any) => ({
                ...a,
                audio: getAudioUrl(reciterId, a.number)
            }));
            // Cache for future offline use
            await savePageToCache(pageNumber, ayahs);
            return ayahs;
        }
    } catch (e) {
        console.error(`[QuranCache] API fetch failed for page ${pageNumber}:`, e);

        // Last resort: Try non-Tajweed edition
        if (useTajweed) {
            console.log(`[QuranCache] Falling back to Uthmani for page ${pageNumber}...`);
            return fetchPageOffline(pageNumber, reciterId, false);
        }
    }

    // All sources failed
    console.error(`[QuranCache] All sources failed for page ${pageNumber}`);
    return [];
};

/**
 * Download all Quran pages in background
 * Returns progress callback for UI updates
 */
export const downloadAllQuranPages = async (
    onProgress: (current: number, total: number) => void,
    useTajweed: boolean = true // Default true
): Promise<boolean> => {
    const TOTAL_PAGES = 604;
    let successCount = 0;

    // Check which pages are already cached
    const cachedCount = await getCachedPageCount();
    if (cachedCount >= TOTAL_PAGES) {
        onProgress(TOTAL_PAGES, TOTAL_PAGES);
        return true; // Already fully cached
    }

    try {
        // Download in batches to avoid overwhelming the API
        const BATCH_SIZE = 10;

        for (let page = 1; page <= TOTAL_PAGES; page += BATCH_SIZE) {
            const batch = [];

            for (let i = page; i < Math.min(page + BATCH_SIZE, TOTAL_PAGES + 1); i++) {
                // Check if already cached
                const cached = await getPageFromCache(i);
                if (!cached) {
                    batch.push(fetchAndCachePage(i, useTajweed));
                } else {
                    successCount++;
                }
            }

            // Wait for batch to complete
            const results = await Promise.allSettled(batch);
            successCount += results.filter(r => r.status === 'fulfilled').length;

            onProgress(Math.min(page + BATCH_SIZE - 1, TOTAL_PAGES), TOTAL_PAGES);

            // Small delay between batches to be respectful to the API
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return successCount >= TOTAL_PAGES * 0.95; // 95% success rate is acceptable
    } catch (e) {
        console.error('Failed to download all pages:', e);
        return false;
    }
};

/**
 * Helper to fetch and cache a single page
 */
const fetchAndCachePage = async (pageNumber: number, useTajweed: boolean): Promise<void> => {
    const edition = useTajweed ? TAJWEED_EDITION : UTHMANI_EDITION;
    const res = await fetch(`${API_BASE}/page/${pageNumber}/${edition}`);
    const data = await res.json();

    if (data.code === 200) {
        const ayahs: Ayah[] = data.data.ayahs.map((a: any) => ({
            ...a,
            // Audio URLs will be generated dynamically based on reciter
        }));
        await savePageToCache(pageNumber, ayahs);
    }
};

/**
 * Clear all cached Quran data
 */
export const clearQuranCache = async (): Promise<void> => {
    try {
        const database = await initQuranDB();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            store.clear();

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    } catch (e) {
        console.error('Failed to clear cache:', e);
    }
};
