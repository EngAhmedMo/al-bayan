/**
 * Hijri Auto-Sync Service
 * Automatically corrects the Hijri date using the official Dar Al-Ifta Egypt API.
 * Works globally — no geographic restriction.
 *
 * Architecture:
 *   1. Manual adjustment always takes priority (user override)
 *   2. Auto-sync runs when: enabled + no manual override + not already synced today
 *   3. Fallback to Umm al-Qura (Intl) with effectiveAdjustment
 *
 * API: https://di107.dar-alifta.org/api/HijriDate?langID=2
 * Response: Plain text, e.g. "6 Dhu-al-Qi'dah 1447"
 */

import { gregorianToHijri, setHijriAdjustment, getHijriAdjustment } from './islamicCalendar';
import { toArabicDigits } from './normalization';
import { Capacitor } from '@capacitor/core';
import { MediaBridge } from './mediaBridge';
import { MONTH_MAP } from './eventsData';
import { getDailyPrayersWithFallback } from './storage';

// ============================================================================
// CONSTANTS
// ============================================================================

const EGYPT_API_BASE = 'https://di107.dar-alifta.org/api/HijriDate';
const SYNC_TIMEOUT_MS = 8000; // 8 seconds max for API request

// Storage Keys
const KEY_AUTO_SYNC_ENABLED = 'hijri_auto_sync_enabled';
const KEY_LAST_SYNC_DATE = 'hijri_last_auto_sync_date';
const KEY_AUTO_ADJUSTMENT = 'hijri_auto_adjustment';
const KEY_LAST_SYNC_RESULT = 'hijri_last_sync_result';

// No geographic bounding box — sync is available globally

// ============================================================================
// MONTH NAME MAPPING (English API response → month number)
// ============================================================================

// The API may return slightly different spellings, so we cover variants
const EN_MONTH_MAP: Record<string, number> = {
    // Standard forms from the API
    "Muharram": 1,
    "Safar": 2,
    "Rabi' al-Awwal": 3,
    "Rabi' al-Thani": 4,
    "Jumada al-Ula": 5,
    "Jumada al-Thani": 6,
    "Rajab": 7,
    "Sha'ban": 8,
    "Ramadan": 9,
    "Shawwal": 10,
    "Dhu-al-Qi'dah": 11,
    "Dhu-al-Hijjah": 12,
    // Common alternate spellings
    "Rabi al-Awwal": 3,
    "Rabi al-Thani": 4,
    "Jumada al-Oula": 5,
    "Jumada al-Akhirah": 6,
    "Shaban": 8,
    "Dhul-Qi'dah": 11,
    "Dhul-Hijjah": 12,
    "Dhu al-Qi'dah": 11,
    "Dhu al-Hijjah": 12,
    "Zul-Qa'dah": 11,
    "Zul-Hijjah": 12,
    "Dhul Qadah": 11,
    "Dhul Hijjah": 12,
};

// Arabic month names (for langID=1 fallback)
const AR_MONTH_MAP: Record<string, number> = {
    "محرم": 1,
    "صفر": 2,
    "ربيع الأول": 3,
    "ربيع الآخر": 4,
    "ربيع الثاني": 4,
    "جمادى الأولى": 5,
    "جمادى الآخرة": 6,
    "جمادى الثانية": 6,
    "رجب": 7,
    "شعبان": 8,
    "رمضان": 9,
    "شوال": 10,
    "ذو القعدة": 11,
    "ذي القعدة": 11,
    "ذو الحجة": 12,
    "ذي الحجة": 12,
};

// ============================================================================
// INTERFACES
// ============================================================================

export interface HijriApiDate {
    day: number;
    month: number;
    year: number;
}

export interface SyncResult {
    success: boolean;
    apiDate?: HijriApiDate;
    localDate?: HijriApiDate;
    drift?: number; // difference in days (API - local)
    appliedAdjustment?: number;
    timestamp: number;
    error?: string;
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * @deprecated الوظيفة لم تعد ضرورية — المزامنة متاحة للجميع
 * أُبقي عليها للتوافق مع أي استدعاء قديم.
 */
export function isEgyptianLocation(): boolean {
    return true; // دائماً true — رُفع القيد الجغرافي
}

/**
 * Get the auto-sync enabled state
 */
export function isAutoSyncEnabled(): boolean {
    return localStorage.getItem(KEY_AUTO_SYNC_ENABLED) === 'true';
}

/**
 * Set the auto-sync enabled state
 */
export function setAutoSyncEnabled(enabled: boolean): void {
    localStorage.setItem(KEY_AUTO_SYNC_ENABLED, enabled ? 'true' : 'false');

    if (!enabled) {
        // Clear auto adjustment when disabled
        localStorage.removeItem(KEY_AUTO_ADJUSTMENT);
        // Re-apply (which will now use manual or 0)
        window.dispatchEvent(new Event('hijri-date-changed'));
    }
}

/**
 * Get the stored auto adjustment value
 */
export function getAutoAdjustment(): number {
    try {
        const stored = localStorage.getItem(KEY_AUTO_ADJUSTMENT);
        return stored ? parseInt(stored) : 0;
    } catch {
        return 0;
    }
}

/**
 * Get last sync result for UI display
 */
export function getLastSyncResult(): SyncResult | null {
    try {
        const stored = localStorage.getItem(KEY_LAST_SYNC_RESULT);
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
}

// ============================================================================
// API FETCH & PARSE
// ============================================================================

/**
 * Convert Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩) to Latin (0123456789)
 */
function arabicToLatinDigits(str: string): string {
    return str.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/**
 * Parse English API response: "6 Dhu-al-Qi'dah 1447"
 */
function parseEnglishResponse(text: string): HijriApiDate | null {
    const trimmed = text.trim();
    if (!trimmed) return null;

    try {
        // Format: "DAY MONTH_NAME YEAR"
        // Day is the first token, year is the last, month name is everything in between
        const tokens = trimmed.split(/\s+/);
        if (tokens.length < 3) return null;

        const day = parseInt(tokens[0]);
        const year = parseInt(tokens[tokens.length - 1]);
        const monthName = tokens.slice(1, -1).join(' ');

        if (isNaN(day) || isNaN(year) || day < 1 || day > 30 || year < 1400) {
            return null;
        }

        // Try exact match first
        let month = EN_MONTH_MAP[monthName];

        // If no exact match, try fuzzy matching (case-insensitive, ignore apostrophes)
        if (!month) {
            const normalized = monthName.toLowerCase().replace(/['']/g, "'");
            for (const [key, val] of Object.entries(EN_MONTH_MAP)) {
                if (key.toLowerCase().replace(/['']/g, "'") === normalized) {
                    month = val;
                    break;
                }
            }
        }

        if (!month) {
            console.warn(`[HijriSync] Unknown month name: "${monthName}"`);
            return null;
        }

        return { day, month, year };
    } catch (e) {
        console.warn('[HijriSync] Failed to parse English response:', e);
        return null;
    }
}

/**
 * Parse Arabic API response: "٦ ذي القعدة ١٤٤٧"
 */
function parseArabicResponse(text: string): HijriApiDate | null {
    const trimmed = arabicToLatinDigits(text.trim());
    if (!trimmed) return null;

    try {
        const tokens = trimmed.split(/\s+/);
        if (tokens.length < 3) return null;

        const day = parseInt(tokens[0]);
        const year = parseInt(tokens[tokens.length - 1]);
        const monthName = tokens.slice(1, -1).join(' ');

        if (isNaN(day) || isNaN(year) || day < 1 || day > 30 || year < 1400) {
            return null;
        }

        const month = AR_MONTH_MAP[monthName];
        if (!month) {
            console.warn(`[HijriSync] Unknown Arabic month name: "${monthName}"`);
            return null;
        }

        return { day, month, year };
    } catch (e) {
        console.warn('[HijriSync] Failed to parse Arabic response:', e);
        return null;
    }
}

/**
 * Fetch the official Hijri date from Dar Al-Ifta Egypt API.
 * Tries English first (easier to parse), falls back to Arabic.
 * On Native Android, uses the MediaBridge to bypass Mixed Content/CORS issues.
 */
async function fetchEgyptianHijriDate(): Promise<HijriApiDate | null> {
    // NATIVE BRIDGE: Bypass Webview Mixed Content/CORS restrictions
    if (Capacitor.isNativePlatform()) {
        try {
            console.log('[HijriSync] 📱 Using Native Bridge for API fetch...');
            const res = await MediaBridge.fetchHijriDate();
            if (res) {
                // Bridge returns Arabic digits, convert back to numbers
                const day = parseInt(arabicToLatinDigits(res.day));
                const year = parseInt(arabicToLatinDigits(res.year));
                
                // Month: performFetch in Kotlin returns the name, but we need the number.
                // Wait, performFetch returns SyncResult(dayAr, monthAr, yearAr) where monthAr is from HIJRI_MONTHS_AR
                // We can find the index in AR_MONTH_MAP or similar.
                let month = AR_MONTH_MAP[res.month];
                
                if (day && year && month) {
                    return { day, month, year };
                }
            }
        } catch (e) {
            console.warn('[HijriSync] Native bridge fetch failed:', e);
        }
    }

    // WEB FALLBACK (or fallback if bridge fails)
    // Note: This will likely fail in Android Webview due to Mixed Content (HTTP API on HTTPS app)
    // but works in Dev (localhost) or Browser.
    
    // Try English first
    const enResult = await fetchApiWithLang(2);
    if (enResult) {
        const parsed = parseEnglishResponse(enResult);
        if (parsed) return parsed;
    }

    // Fallback to Arabic
    const arResult = await fetchApiWithLang(1);
    if (arResult) {
        const parsed = parseArabicResponse(arResult);
        if (parsed) return parsed;
    }

    return null;
}

/**
 * Fetch from API with specific language
 */
async function fetchApiWithLang(langID: number): Promise<string | null> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);

        const response = await fetch(`${EGYPT_API_BASE}?langID=${langID}`, {
            signal: controller.signal,
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });
        clearTimeout(timeoutId);

        if (!response.ok) return null;

        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let text = '';
        
        // Check for BOM to decode UTF-16
        if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
            text = new TextDecoder('utf-16le').decode(bytes.subarray(2));
        } else if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
            text = new TextDecoder('utf-16be').decode(bytes.subarray(2));
        } else {
            text = new TextDecoder('utf-8').decode(bytes);
        }
        
        // Remove invisible BOM chars and JSON quotes
        text = text.replace(/[\uFEFF]/g, '').replace(/(^"|"$)/g, '').trim();
        
        return text.length > 0 ? text : null;
    } catch (e) {
        // Network error, timeout, or abort — all silently handled
        console.warn(`[HijriSync] API fetch failed (lang=${langID}):`, e);
        return null;
    }
}

// ============================================================================
// DRIFT CALCULATION
// ============================================================================

/**
 * Calculate the drift between API date and local Umm al-Qura date.
 * Returns the number of days the API is ahead (+) or behind (-) compared to Intl.
 * 
 * Example: If API says "6" and Intl says "8", drift = -2
 * Meaning: to match Egypt, we need adjustment = -2
 */
function calculateDrift(apiDate: HijriApiDate): number {
    // Get raw Umm al-Qura date (NO adjustment applied)
    const formatter = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura-nu-latn', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric'
    });

    try {
        const parts = formatter.formatToParts(new Date());
        let localDay = parseInt(parts.find(p => p.type === 'day')?.value || '1');
        let localMonth = parseInt(parts.find(p => p.type === 'month')?.value || '1');
        let localYear = parseInt(parts.find(p => p.type === 'year')?.value || '1446');

        // MAGHRIB BOUNDARY FIX:
        // In Islam, the new day starts after Maghrib. Dar Al-Ifta's API often updates 
        // to the next day immediately after Maghrib. But Intl.DateTimeFormat changes at Midnight.
        // If we sync between Maghrib and Midnight, we must shift our local date forward by 1 
        // to correctly compare it with the API date.
        const prayers = getDailyPrayersWithFallback();
        if (prayers && prayers.timings && prayers.timings.Maghrib) {
            const maghribStr = prayers.timings.Maghrib.split(' ')[0];
            const [h, m] = maghribStr.split(':').map(Number);
            const now = new Date();
            const maghribTime = new Date();
            maghribTime.setHours(h, m, 0, 0);

            if (now > maghribTime) {
                // Shift local date to tomorrow
                localDay += 1;
                // Approximate rollover (enough for drift logic)
                if (localDay > 30) {
                    localDay = 1;
                    localMonth += 1;
                    if (localMonth > 12) {
                        localMonth = 1;
                        localYear += 1;
                    }
                }
                console.log(`[HijriSync] 🌙 Past Maghrib, shifted local date to: ${localDay}/${localMonth}/${localYear}`);
            }
        }

        // Calculate absolute month difference (elegantly handles year boundaries)
        const yearDiff = apiDate.year - localYear;
        const monthDiff = apiDate.month - localMonth;
        const totalMonthDiff = (yearDiff * 12) + monthDiff;

        if (totalMonthDiff === 0) {
            // Same month
            return apiDate.day - localDay;
        } else if (totalMonthDiff === 1) {
            // API is in the NEXT month (e.g., API: 1 Muharram 1446, Local: 29 Dhu al-Hijjah 1445)
            return apiDate.day + (30 - localDay); 
        } else if (totalMonthDiff === -1) {
            // API is in the PREVIOUS month (e.g., API: 29 Dhu al-Hijjah 1445, Local: 1 Muharram 1446)
            return -(localDay + (30 - apiDate.day));
        }

        // If months differ by more than 1, something is very wrong → ignore
        console.warn('[HijriSync] Large month difference, ignoring:', { apiDate, localDay, localMonth, localYear, totalMonthDiff });
        return 0;
    } catch (e) {
        console.error('[HijriSync] Drift calculation failed:', e);
        return 0;
    }
}

// ============================================================================
// MAIN SYNC LOGIC
// ============================================================================

/**
 * Synchronize state from Native Background Worker to TS localStorage.
 * This ensures that if the background worker updated the adjustment,
 * the TS layer gets the new value immediately upon app launch.
 */
export async function syncNativeStateToTS(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
        const data = await MediaBridge.getPersistenceData();
        if (data && data.hijriAutoAdjustment !== undefined) {
            const current = localStorage.getItem(KEY_AUTO_ADJUSTMENT);
            if (current !== data.hijriAutoAdjustment.toString()) {
                console.log(`[HijriSync] 🔄 Background worker synced native drift: ${data.hijriAutoAdjustment}`);
                localStorage.setItem(KEY_AUTO_ADJUSTMENT, data.hijriAutoAdjustment.toString());
                // Trigger global update
                window.dispatchEvent(new Event('hijri-date-changed'));
            }
        }
    } catch (e) {
        console.warn('[HijriSync] Failed to sync native state to TS:', e);
    }
}

/**
 * Check if we should attempt a sync right now.
 * Conditions:
 *   1. Auto-sync is enabled
 *   2. User is in Egypt (by coordinates)
 *   3. Manual override is NOT active
 *   4. We're in the critical period (days 28-2 of Hijri month)
 *   5. Haven't already synced today
 */
function shouldSync(): boolean {
    // 1. Feature enabled?
    if (!isAutoSyncEnabled()) return false;

    // 2. Manual override active? (user took manual control — skip auto)
    const manualOverride = localStorage.getItem('hijri_manual_override');
    if (manualOverride === 'true') return false;

    // 3. Already synced today?
    const lastSync = localStorage.getItem(KEY_LAST_SYNC_DATE);
    const today = new Date().toDateString();
    if (lastSync === today) return false;

    return true;
}

/**
 * Get raw Hijri day (without any adjustment) for sync decision
 */
function getRawHijriDay(): number {
    try {
        const formatter = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura-nu-latn', {
            day: 'numeric'
        });
        const parts = formatter.formatToParts(new Date());
        return parseInt(parts.find(p => p.type === 'day')?.value || '15');
    } catch {
        return 15; // Safe default (mid-month = never sync)
    }
}

/**
 * Main entry point: Attempt to sync the Hijri date with Dar Al-Ifta API.
 * This is designed to be called from Home.tsx on app open.
 * 
 * Returns the sync result for logging/UI purposes.
 * 
 * IMPORTANT: This function is completely safe to call at any time:
 * - If conditions aren't met, it returns immediately (no network call)
 * - If API fails, nothing changes (fail-safe)
 * - If drift is 0, no adjustment is applied
 */
export async function syncHijriDateIfNeeded(): Promise<SyncResult | null> {
    // SYNC NATIVE BACKGROUND STATE FIRST
    // Ensures that if the app is opened offline, it still benefits from 
    // any adjustments calculated natively in the background.
    await syncNativeStateToTS();

    if (!shouldSync()) return null;

    console.log('[HijriSync] 🌙 Starting auto-sync...');

    try {
        // 1. Fetch from API
        const apiDate = await fetchEgyptianHijriDate();
        if (!apiDate) {
            const result: SyncResult = {
                success: false,
                timestamp: Date.now(),
                error: 'API_FETCH_FAILED'
            };
            localStorage.setItem(KEY_LAST_SYNC_DATE, new Date().toDateString());
            localStorage.setItem(KEY_LAST_SYNC_RESULT, JSON.stringify(result));
            return result;
        }

        // 2. Calculate drift
        const drift = calculateDrift(apiDate);

        // 3. Sanity check: drift should be -2 to +2 at most
        if (Math.abs(drift) > 2) {
            console.warn(`[HijriSync] Drift ${drift} is too large, ignoring`);
            const result: SyncResult = {
                success: false,
                apiDate,
                drift,
                timestamp: Date.now(),
                error: 'DRIFT_TOO_LARGE'
            };
            localStorage.setItem(KEY_LAST_SYNC_DATE, new Date().toDateString());
            localStorage.setItem(KEY_LAST_SYNC_RESULT, JSON.stringify(result));
            return result;
        }

        // 4. Get local date for reporting
        const localHijri = gregorianToHijri(new Date());
        const localDate: HijriApiDate = {
            day: localHijri.day,
            month: localHijri.month,
            year: localHijri.year
        };

        // 5. Apply adjustment if drift is non-zero
        if (drift !== 0) {
            localStorage.setItem(KEY_AUTO_ADJUSTMENT, drift.toString());
            // Trigger UI update via the same mechanism as manual adjustment
            window.dispatchEvent(new Event('hijri-date-changed'));
            
            // CRITICAL: Update Native Widget immediately
            updateWidgetAfterSync(drift);
            
            console.log(`[HijriSync] ✅ Applied auto-adjustment: ${drift} day(s)`);
        } else {
            // Drift is 0, clear any previous auto adjustment
            localStorage.removeItem(KEY_AUTO_ADJUSTMENT);
            window.dispatchEvent(new Event('hijri-date-changed'));
            
            // CRITICAL: Update Native Widget immediately
            updateWidgetAfterSync(0);
            
            console.log('[HijriSync] ✅ No adjustment needed (dates match)');
        }

        // 6. Store result
        const result: SyncResult = {
            success: true,
            apiDate,
            localDate,
            drift,
            appliedAdjustment: drift,
            timestamp: Date.now()
        };
        localStorage.setItem(KEY_LAST_SYNC_DATE, new Date().toDateString());
        localStorage.setItem(KEY_LAST_SYNC_RESULT, JSON.stringify(result));

        return result;
    } catch (e) {
        console.error('[HijriSync] Unexpected error:', e);
        const result: SyncResult = {
            success: false,
            timestamp: Date.now(),
            error: 'UNEXPECTED_ERROR'
        };
        localStorage.setItem(KEY_LAST_SYNC_DATE, new Date().toDateString());
        localStorage.setItem(KEY_LAST_SYNC_RESULT, JSON.stringify(result));
        return result;
    }
}

/**
 * Force a sync regardless of conditions (for manual "Sync Now" button)
 */
export async function forceSyncHijriDate(): Promise<SyncResult> {
    console.log('[HijriSync] 🔄 Force sync requested...');

    try {
        // Clear manual overrides so auto-sync can take effect
        localStorage.removeItem('hijri_manual_override');
        localStorage.removeItem('hijri_adjustment');

        const apiDate = await fetchEgyptianHijriDate();
        if (!apiDate) {
            return {
                success: false,
                timestamp: Date.now(),
                error: 'API_FETCH_FAILED'
            };
        }

        const drift = calculateDrift(apiDate);

        if (Math.abs(drift) <= 2) {
            if (drift !== 0) {
                localStorage.setItem(KEY_AUTO_ADJUSTMENT, drift.toString());
            } else {
                localStorage.removeItem(KEY_AUTO_ADJUSTMENT);
            }
            window.dispatchEvent(new Event('hijri-date-changed'));
            updateWidgetAfterSync(drift);
        }

        // Calculate local date AFTER applying the new adjustment
        const localHijri = gregorianToHijri(new Date());

        const result: SyncResult = {
            success: true,
            apiDate,
            localDate: { day: localHijri.day, month: localHijri.month, year: localHijri.year },
            drift,
            appliedAdjustment: Math.abs(drift) <= 2 ? drift : 0,
            timestamp: Date.now(),
            error: Math.abs(drift) > 2 ? 'DRIFT_TOO_LARGE' : undefined
        };
        localStorage.setItem(KEY_LAST_SYNC_DATE, new Date().toDateString());
        localStorage.setItem(KEY_LAST_SYNC_RESULT, JSON.stringify(result));
        return result;
    } catch (e) {
        console.error('[HijriSync] Force sync failed:', e);
        const result: SyncResult = {
            success: false,
            timestamp: Date.now(),
            error: 'UNEXPECTED_ERROR'
        };
        localStorage.setItem(KEY_LAST_SYNC_DATE, new Date().toDateString());
        localStorage.setItem(KEY_LAST_SYNC_RESULT, JSON.stringify(result));
        return result;
    }
}

/**
 * Helper to update the native Android widget after an auto-sync adjustment.
 * Uses gregorianDate as ISO string for consistent cross-platform comparison.
 */
function updateWidgetAfterSync(adjustment: number): void {
    if (!Capacitor.isNativePlatform()) return;

    const hijri = gregorianToHijri(new Date());
    const now = new Date();
    // ISO date for comparison key (language-neutral, matches Kotlin logic)
    const isoDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    try {
        MediaBridge.updateWidgetData({
            hijriDay: toArabicDigits(hijri.day),
            hijriMonth: hijri.monthName,
            hijriYear: toArabicDigits(hijri.year),
            gregorianDate: isoDate,
            hijriAdjustment: adjustment.toString()
        });
    } catch (e) {
        console.error('[HijriSync] Widget update failed', e);
    }
}
