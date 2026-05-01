
import { AppNotification, AyahBookmark, Note, PageBookmark, Zekr, TasbihItem, PrayerData } from '../types';
import { Capacitor } from '@capacitor/core';

import { SALAWAT_DEFAULTS } from '../constants/defaults';

// Keys
const KEY_FAV_ADHKAR = 'favorites_adhkar';
const KEY_CUSTOM_ADHKAR = 'custom_adhkar';
const KEY_CUSTOM_TASBIH = 'custom_tasbih_items';
const KEY_BOOKMARKS_AYAH = 'bookmarks_ayah';
const KEY_BOOKMARKS_PAGE = 'bookmarks_page';
const KEY_BOOKMARKS_HADITH = 'bookmarks_hadith';
const KEY_NOTES = 'user_notes';
const KEY_NOTIFICATIONS = 'notifications_table';
const KEY_NOTIFICATION_SETTINGS = 'notification_settings_v1';
const KEY_SETTINGS_FONT = 'settings_font_size';
const KEY_SETTINGS_RECITER = 'settings_reciter';
const KEY_SETTINGS_AZHAN = 'settings_azhan_voice'; // New Key
const KEY_SETTINGS_AZHAN_SPECIFIC = 'settings_azhan_specific'; // New: Per-Prayer
const KEY_SETTINGS_TEXT_ALIGN = 'settings_text_align'; // Text Alignment Option
const KEY_BENEFIT_HISTORY = 'daily_benefit_history_ids';
const KEY_CURRENT_BENEFIT = 'daily_benefit_current';
const KEY_LAST_USED_CATEGORY = 'smart_last_category';
const KEY_LAST_USED_ZEKR_ID = 'smart_last_zekr_id';
const KEY_LAST_TASBIH_TARGET = 'smart_tasbih_target';
const KEY_CACHED_PRAYERS = 'cached_prayer_times_today';
const KEY_CACHED_PRAYERS_TOMORROW = 'cached_prayer_times_tomorrow';
const KEY_LAST_PRAYER_FETCH_DATE = 'last_prayer_fetch_date';
const KEY_SAVED_LOCATION = 'user_location_coords';
const KEY_CUSTOM_MUAZZINS = 'custom_muazzins'; // User-uploaded Azhan sounds

// --- Location Storage Interface ---
interface SavedLocation {
  lat: number;
  lng: number;
  savedAt: string; // ISO date string
}

// --- Location Storage Functions ---

export const saveLocation = (lat: number, lng: number): void => {
  const location: SavedLocation = {
    lat,
    lng,
    savedAt: new Date().toISOString()
  };
  localStorage.setItem(KEY_SAVED_LOCATION, JSON.stringify(location));
};

export const getSavedLocation = (): SavedLocation | null => {
  try {
    const stored = localStorage.getItem(KEY_SAVED_LOCATION);
    if (!stored) return null;
    return JSON.parse(stored) as SavedLocation;
  } catch {
    return null;
  }
};

export const clearSavedLocation = (): void => {
  localStorage.removeItem(KEY_SAVED_LOCATION);
};

// --- Prayer Times Global Storage ---
// CRITICAL: Store both today and tomorrow's prayer times to handle:
// 1. Midnight transition (12:00 AM - Fajr)
// 2. Morning adhkar scheduled based on Fajr time
// 3. Boot recovery after device restart

export const saveDailyPrayers = (data: PrayerData): void => {
  const today = new Date().toDateString();
  const payload = {
    date: today,
    data: data
  };
  localStorage.setItem(KEY_CACHED_PRAYERS, JSON.stringify(payload));
  localStorage.setItem(KEY_LAST_PRAYER_FETCH_DATE, today);
};

// Save tomorrow's prayers for reliable Fajr scheduling
export const saveTomorrowPrayers = (data: PrayerData): void => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const payload = {
    date: tomorrow.toDateString(),
    data: data
  };
  localStorage.setItem(KEY_CACHED_PRAYERS_TOMORROW, JSON.stringify(payload));
};

// Get today's prayers - handles midnight transition gracefully
export const getDailyPrayers = (): PrayerData | null => {
  try {
    const today = new Date().toDateString();
    const stored = localStorage.getItem(KEY_CACHED_PRAYERS);

    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.date === today) {
        return parsed.data;
      }
    }

    // Check if "tomorrow's" cache is now today (after midnight)
    const storedTomorrow = localStorage.getItem(KEY_CACHED_PRAYERS_TOMORROW);
    if (storedTomorrow) {
      const parsedTomorrow = JSON.parse(storedTomorrow);
      if (parsedTomorrow.date === today) {
        // Promote tomorrow's data to today's
        localStorage.setItem(KEY_CACHED_PRAYERS, storedTomorrow);
        localStorage.removeItem(KEY_CACHED_PRAYERS_TOMORROW);
        return parsedTomorrow.data;
      }
    }

    return null;
  } catch { return null; }
};

// Get prayers with fallback - for critical functions like Fajr/morning adhkar
// Returns yesterday's prayers if today's aren't available (for times before new fetch)
export const getDailyPrayersWithFallback = (): PrayerData | null => {
  // First try today's prayers
  const todayPrayers = getDailyPrayers();
  if (todayPrayers) return todayPrayers;

  // Fallback: use stored prayers even if date doesn't match
  // This is for the critical window between midnight and app opening
  try {
    const stored = localStorage.getItem(KEY_CACHED_PRAYERS);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.data; // Return data regardless of date - better than nothing!
    }
  } catch { /* ignore */ }

  return null;
};

// --- Smart Behavior Helpers ---

export const setLastUsedCategory = (category: string): void => {
  localStorage.setItem(KEY_LAST_USED_CATEGORY, category);
};

export const getLastUsedCategory = (): string | null => {
  return localStorage.getItem(KEY_LAST_USED_CATEGORY);
};

export const setLastUsedZekrId = (id: number): void => {
  localStorage.setItem(KEY_LAST_USED_ZEKR_ID, id.toString());
};

export const getLastUsedZekrId = (): number | null => {
  const val = localStorage.getItem(KEY_LAST_USED_ZEKR_ID);
  return val ? parseInt(val) : null;
};

export const setLastTasbihTarget = (target: number): void => {
  localStorage.setItem(KEY_LAST_TASBIH_TARGET, target.toString());
};

export const getLastTasbihTarget = (): number | null => {
  const val = localStorage.getItem(KEY_LAST_TASBIH_TARGET);
  return val ? parseInt(val) : null;
};

// --- Daily Benefit Logic ---

export interface StoredBenefit {
  date: string;
  data: any;
}

export const getBenefitHistory = (): string[] => {
  try {
    const stored = localStorage.getItem(KEY_BENEFIT_HISTORY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
};

export const addToBenefitHistory = (id: string): void => {
  const history = getBenefitHistory();
  if (!history.includes(id)) {
    history.push(id);
    localStorage.setItem(KEY_BENEFIT_HISTORY, JSON.stringify(history));
  }
};

export const clearBenefitHistory = (): void => {
  localStorage.removeItem(KEY_BENEFIT_HISTORY);
};

export const getStoredBenefit = (): StoredBenefit | null => {
  try {
    const stored = localStorage.getItem(KEY_CURRENT_BENEFIT);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
};

export const setStoredBenefit = (data: any): void => {
  const today = new Date().toISOString().split('T')[0];
  const obj: StoredBenefit = { date: today, data };
  localStorage.setItem(KEY_CURRENT_BENEFIT, JSON.stringify(obj));
};

// --- Adhkar Favorites Helper ---

export const getFavoriteAdhkarIds = (): number[] => {
  try {
    const stored = localStorage.getItem(KEY_FAV_ADHKAR);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
};

export const toggleFavoriteAdhkar = (id: number): boolean => {
  const ids = getFavoriteAdhkarIds();
  const exists = ids.includes(id);

  let newIds;
  if (exists) {
    newIds = ids.filter(i => i !== id);
  } else {
    newIds = [...ids, id];
  }

  localStorage.setItem(KEY_FAV_ADHKAR, JSON.stringify(newIds));
  return !exists;
};

export const isAdhkarFavorite = (id: number): boolean => {
  return getFavoriteAdhkarIds().includes(id);
};

// --- Custom Adhkar Helper ---

export const getCustomAdhkar = (): Zekr[] => {
  try {
    const stored = localStorage.getItem(KEY_CUSTOM_ADHKAR);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
};

export const addCustomAdhkar = (zekr: Omit<Zekr, 'id'>): void => {
  const list = getCustomAdhkar();
  const newZekr: Zekr = {
    ...zekr,
    id: Date.now(),
  };
  const newList = [newZekr, ...list];
  localStorage.setItem(KEY_CUSTOM_ADHKAR, JSON.stringify(newList));
};

export const updateCustomAdhkar = (id: number, updatedZekr: Partial<Omit<Zekr, 'id'>>): void => {
  const list = getCustomAdhkar();
  const index = list.findIndex(z => z.id === id);
  if (index !== -1) {
    list[index] = { ...list[index], ...updatedZekr };
    localStorage.setItem(KEY_CUSTOM_ADHKAR, JSON.stringify(list));
  }
};

export const deleteCustomAdhkar = (id: number): void => {
  const list = getCustomAdhkar();
  const newList = list.filter(z => z.id !== id);
  localStorage.setItem(KEY_CUSTOM_ADHKAR, JSON.stringify(newList));
};

// --- Custom Tasbih Helper ---

export const getCustomTasbihs = (): TasbihItem[] => {
  try {
    const stored = localStorage.getItem(KEY_CUSTOM_TASBIH);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
};

export const addCustomTasbih = (item: Omit<TasbihItem, 'id'>): void => {
  const list = getCustomTasbihs();
  const newItem: TasbihItem = {
    ...item,
    id: Date.now().toString(),
  };
  const newList = [newItem, ...list];
  localStorage.setItem(KEY_CUSTOM_TASBIH, JSON.stringify(newList));
};

export const deleteCustomTasbih = (id: string): void => {
  const list = getCustomTasbihs();
  const newList = list.filter(t => t.id !== id);
  localStorage.setItem(KEY_CUSTOM_TASBIH, JSON.stringify(newList));
};

// --- Tasbih State Persistence ---
const KEY_TASBIH_STATE = 'tasbih_current_state';

export interface TasbihState {
  count: number;
  rounds: number;
  totalCount: number;
  currentIndex: number;
  target: number;
}

export const getTasbihState = (): TasbihState | null => {
  try {
    const stored = localStorage.getItem(KEY_TASBIH_STATE);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
};

export const saveTasbihState = (state: TasbihState): void => {
  localStorage.setItem(KEY_TASBIH_STATE, JSON.stringify(state));
};

export const clearTasbihState = (): void => {
  localStorage.removeItem(KEY_TASBIH_STATE);
};

// --- Lifetime Tasbih Total ---
const KEY_LIFETIME_TASBIH_TOTAL = 'tasbih_lifetime_total';

export const getLifetimeTasbihTotal = (): number => {
  try {
    const stored = localStorage.getItem(KEY_LIFETIME_TASBIH_TOTAL);
    return stored ? parseInt(stored, 10) : 0;
  } catch { return 0; }
};

export const addLifetimeTasbihTotal = (amount: number = 1): void => {
  const current = getLifetimeTasbihTotal();
  localStorage.setItem(KEY_LIFETIME_TASBIH_TOTAL, (current + amount).toString());
};


// --- Ayah Bookmarks Helper ---

export const getAyahBookmarks = (): AyahBookmark[] => {
  try {
    const stored = localStorage.getItem(KEY_BOOKMARKS_AYAH);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
};

export const toggleAyahBookmark = (bookmark: Omit<AyahBookmark, 'id'>): boolean => {
  const list = getAyahBookmarks();
  const index = list.findIndex(b => b.surahNumber === bookmark.surahNumber && b.ayahNumber === bookmark.ayahNumber);

  let newList;
  const wasAdded = index === -1;

  if (wasAdded) {
    const newBookmark: AyahBookmark = { ...bookmark, id: Date.now().toString() };
    newList = [newBookmark, ...list];
  } else {
    newList = list.filter((_, i) => i !== index);
  }

  localStorage.setItem(KEY_BOOKMARKS_AYAH, JSON.stringify(newList));
  return wasAdded;
};

export const isAyahBookmarked = (surahNumber: number, ayahNumber: number): boolean => {
  const list = getAyahBookmarks();
  return list.some(b => b.surahNumber === surahNumber && b.ayahNumber === ayahNumber);
};

export const deleteAyahBookmark = (id: string) => {
  const list = getAyahBookmarks();
  const newList = list.filter(b => b.id !== id);
  localStorage.setItem(KEY_BOOKMARKS_AYAH, JSON.stringify(newList));
};

// --- Page Bookmarks Helper ---

export const getPageBookmarks = (): PageBookmark[] => {
  try {
    const stored = localStorage.getItem(KEY_BOOKMARKS_PAGE);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
};

export const addPageBookmark = (surahName: string, pageNumber: number): void => {
  const list = getPageBookmarks();
  const existingIndex = list.findIndex(b => b.pageNumber === pageNumber);

  let newList = [...list];
  if (existingIndex !== -1) {
    newList.splice(existingIndex, 1);
  }

  const newBookmark: PageBookmark = {
    id: Date.now().toString(),
    surahName,
    pageNumber,
    timestamp: Date.now()
  };

  newList = [newBookmark, ...newList];
  localStorage.setItem(KEY_BOOKMARKS_PAGE, JSON.stringify(newList));
};

export const removePageBookmark = (pageNumber: number): void => {
  const list = getPageBookmarks();
  const newList = list.filter(b => b.pageNumber !== pageNumber);
  localStorage.setItem(KEY_BOOKMARKS_PAGE, JSON.stringify(newList));
};

export const isPageBookmarked = (pageNumber: number): boolean => {
  const list = getPageBookmarks();
  return list.some(b => b.pageNumber === pageNumber);
};

// --- Notes Helper ---

export const getNotes = (): Note[] => {
  try {
    const stored = localStorage.getItem(KEY_NOTES);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
};

export const saveNote = (note: Omit<Note, 'id'>): void => {
  const list = getNotes();
  const existingIndex = list.findIndex(n => n.surahNumber === note.surahNumber && n.ayahNumber === note.ayahNumber);

  let newList = [...list];
  if (existingIndex !== -1) {
    newList[existingIndex] = { ...newList[existingIndex], text: note.text, timestamp: Date.now() };
  } else {
    const newNote: Note = { ...note, id: Date.now().toString(), timestamp: Date.now() };
    newList = [newNote, ...newList];
  }

  localStorage.setItem(KEY_NOTES, JSON.stringify(newList));
};

export const deleteNote = (id: string): void => {
  const list = getNotes();
  const newList = list.filter(n => n.id !== id);
  localStorage.setItem(KEY_NOTES, JSON.stringify(newList));
};

export const getNoteForAyah = (surahNumber: number, ayahNumber: number): string | null => {
  const list = getNotes();
  const note = list.find(n => n.surahNumber === surahNumber && n.ayahNumber === ayahNumber);
  return note ? note.text : null;
};

// --- Hadith Bookmarks Helper ---
import { HadithBookmark } from '../types';

export const getHadithBookmarks = (): HadithBookmark[] => {
  try {
    const stored = localStorage.getItem(KEY_BOOKMARKS_HADITH);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
};

export const toggleHadithBookmark = (bookmark: Omit<HadithBookmark, 'id'>): boolean => {
  const list = getHadithBookmarks();
  const index = list.findIndex(b => b.bookId === bookmark.bookId && b.hadithId === bookmark.hadithId);

  let newList;
  const wasAdded = index === -1;

  if (wasAdded) {
    const newBookmark: HadithBookmark = { ...bookmark, id: `${bookmark.bookId}_${bookmark.hadithId}` };
    newList = [newBookmark, ...list];
  } else {
    newList = list.filter((_, i) => i !== index);
  }

  localStorage.setItem(KEY_BOOKMARKS_HADITH, JSON.stringify(newList));
  return wasAdded;
};

export const isHadithBookmarked = (bookId: string, hadithId: string): boolean => {
  const list = getHadithBookmarks();
  return list.some(b => b.bookId === bookId && b.hadithId === hadithId);
};

export const deleteHadithBookmark = (id: string): void => {
  const list = getHadithBookmarks();
  const newList = list.filter(b => b.id !== id);
  localStorage.setItem(KEY_BOOKMARKS_HADITH, JSON.stringify(newList));
};

// --- Hadith Reading Position ---
const KEY_HADITH_READING_POS = 'hadith_reading_position';

export interface HadithReadingPosition {
  bookId: string;
  hadithId?: string;
  scrollPos?: number;
  displayCount?: number;
}

export const saveHadithReadingPosition = (pos: HadithReadingPosition): void => {
  localStorage.setItem(KEY_HADITH_READING_POS, JSON.stringify(pos));
};

export const getHadithReadingPosition = (): HadithReadingPosition | null => {
  try {
    const stored = localStorage.getItem(KEY_HADITH_READING_POS);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
};

// --- Settings Helpers ---

export const getStoredFontSize = (): number => {
  const size = localStorage.getItem(KEY_SETTINGS_FONT);
  return size ? parseInt(size) : 28;
};

export const setStoredFontSize = (size: number): void => {
  localStorage.setItem(KEY_SETTINGS_FONT, size.toString());
};

export type TextAlignMode = 'right' | 'center' | 'justify';

export const getStoredTextAlign = (): TextAlignMode => {
  const align = localStorage.getItem(KEY_SETTINGS_TEXT_ALIGN);
  return (align as TextAlignMode) || 'center'; // strict Uthmani defaults to center
};

export const setStoredTextAlign = (align: TextAlignMode): void => {
  localStorage.setItem(KEY_SETTINGS_TEXT_ALIGN, align);
};

export const getStoredReciter = (): string => {
  return localStorage.getItem(KEY_SETTINGS_RECITER) || 'ar.minshawi_murattal';
};

export const setStoredReciter = (id: string): void => {
  localStorage.setItem(KEY_SETTINGS_RECITER, id);
};

export const getStoredAzhan = (): string => {
  return localStorage.getItem(KEY_SETTINGS_AZHAN) || 'egy_abdulbasit'; // Default to Abdul Basit
};

export const setStoredAzhan = (id: string): void => {
  localStorage.setItem(KEY_SETTINGS_AZHAN, id);
  window.dispatchEvent(new CustomEvent('azhan-changed', { detail: id }));
};

// --- Per-Prayer Azhan Logic ---

export interface SpecificAzhanSettings {
  [key: string]: { id: string | null; volume?: number } | string | null | undefined;
}

export const getStoredAzhanForPrayer = (prayerName: string): string => {
  // CRITICAL FIX: If Per-Prayer Customization is disabled, ALWAYS return the global setting.
  // This prevents "Zombie Settings" where old specific settings override the global selection.
  if (!isPerPrayerMuazzinEnabled()) {
    return getStoredAzhan();
  }

  let result = getStoredAzhan(); // Default to global setting

  try {
    const specificJson = localStorage.getItem(KEY_SETTINGS_AZHAN_SPECIFIC);

    if (specificJson) {
      const specific = JSON.parse(specificJson) as SpecificAzhanSettings;

      // Standardize prayer names to keys - handle both Arabic and English inputs
      let key: keyof SpecificAzhanSettings | undefined;
      const lower = prayerName.toLowerCase();
      if (prayerName.includes('الفجر') || lower.includes('fajr')) key = 'fajr';
      else if (prayerName.includes('الظهر') || prayerName.includes('الجمعة') || lower.includes('dhuhr')) key = 'dhuhr';
      else if (prayerName.includes('العصر') || lower.includes('asr')) key = 'asr';
      else if (prayerName.includes('المغرب') || lower.includes('maghrib')) key = 'maghrib';
      else if (prayerName.includes('العشاء') || lower.includes('isha')) key = 'isha';

      if (key && specific[key]) {
        const val = specific[key];
        // If val is a string (legacy) or object with ID, use it.
        if (typeof val === 'string') {
          result = val;
        } else if (val && typeof val === 'object' && val.id) {
          result = val.id;
        }
      }
    }
  } catch (e) {
    // Silent fail - fallback to global azhan
  }

  return result;
};

export const getStoredVolumeForPrayer = (prayerName: string): number | undefined => {
  try {
    const specificJson = localStorage.getItem(KEY_SETTINGS_AZHAN_SPECIFIC);
    if (specificJson) {
      const specific = JSON.parse(specificJson) as SpecificAzhanSettings;
      let key: string | undefined;
      const lower = prayerName.toLowerCase();
      if (prayerName.includes('الفجر') || lower.includes('fajr')) key = 'fajr';
      else if (prayerName.includes('الظهر') || prayerName.includes('الجمعة') || lower.includes('dhuhr')) key = 'dhuhr';
      else if (prayerName.includes('العصر') || lower.includes('asr')) key = 'asr';
      else if (prayerName.includes('المغرب') || lower.includes('maghrib')) key = 'maghrib';
      else if (prayerName.includes('العشاء') || lower.includes('isha')) key = 'isha';

      if (key && specific[key]) {
        const val = specific[key];
        if (val && typeof val === 'object' && val.volume !== undefined) {
          return val.volume;
        }
      }
    }
  } catch (e) { }
  return undefined;
};

export const setStoredAzhanForPrayer = (prayerName: string, azhanId: string | null, volume?: number) => {
  try {
    const specificJson = localStorage.getItem(KEY_SETTINGS_AZHAN_SPECIFIC);
    let specific: SpecificAzhanSettings = specificJson ? JSON.parse(specificJson) : {};

    let key: string | undefined;
    const lower = prayerName.toLowerCase();
    if (prayerName.includes('الفجر') || lower.includes('fajr')) key = 'fajr';
    else if (prayerName.includes('الظهر') || prayerName.includes('الجمعة') || lower.includes('dhuhr')) key = 'dhuhr';
    else if (prayerName.includes('العصر') || lower.includes('asr')) key = 'asr';
    else if (prayerName.includes('المغرب') || lower.includes('maghrib')) key = 'maghrib';
    else if (prayerName.includes('العشاء') || lower.includes('isha')) key = 'isha';

    if (key) {
      if (azhanId === null && volume === undefined) {
        delete specific[key];
      } else {
        const existing = specific[key];
        const existingId = (existing && typeof existing === 'object') ? existing.id : (typeof existing === 'string' ? existing : null);
        const existingVolume = (existing && typeof existing === 'object') ? existing.volume : undefined;

        specific[key] = {
          id: azhanId !== undefined ? azhanId : existingId,
          volume: volume !== undefined ? volume : existingVolume
        };
      }
      localStorage.setItem(KEY_SETTINGS_AZHAN_SPECIFIC, JSON.stringify(specific));
    }
  } catch (e) {
    // Silent fail
  }
};

/**
 * CLEANUP: Removes a deleted Muazzin ID from all settings (Global & Per-Prayer).
 * This prevents "Phantom Settings" where a deleted file is still selected.
 * @param deletedId The ID of the muazzin being deleted
 */
export const cleanupAzhanSettings = (deletedId: string): void => {
  // 1. Check Global Setting
  const currentGlobal = getStoredAzhan();
  if (currentGlobal === deletedId) {
    setStoredAzhan('egy_abdulbasit'); // Revert to default
  }

  // 2. Check Per-Prayer Settings
  try {
    const specificJson = localStorage.getItem(KEY_SETTINGS_AZHAN_SPECIFIC);
    if (specificJson) {
      const specific = JSON.parse(specificJson) as SpecificAzhanSettings;
      let changed = false;

      // Iterate all keys (fajr, dhuhr, etc.)
      Object.keys(specific).forEach(key => {
        const val = specific[key];
        let currentId: string | null = null;

        if (typeof val === 'string') currentId = val;
        else if (val && typeof val === 'object') currentId = val.id;

        if (currentId === deletedId) {
          delete specific[key]; // Remove this specific setting (reverts to global)
          changed = true;
        }
      });

      if (changed) {
        localStorage.setItem(KEY_SETTINGS_AZHAN_SPECIFIC, JSON.stringify(specific));
      }
    }
  } catch (e) {
    console.error("[Storage] Failed to cleanup specific settings", e);
  }
};

// --- Per-Prayer Muazzin Feature Control ---
const KEY_PER_PRAYER_MUAZZIN_ENABLED = 'per_prayer_muazzin_enabled';

/**
 * Check if per-prayer muazzin customization is enabled
 * @returns true if feature is enabled, false otherwise (defaults to false for new users)
 */
export const isPerPrayerMuazzinEnabled = (): boolean => {
  return localStorage.getItem(KEY_PER_PRAYER_MUAZZIN_ENABLED) === 'true';
};

/**
 * Enable or disable per-prayer muazzin customization
 * When disabled, clears all specific settings so global muazzin is used for all prayers
 */
export const setPerPrayerMuazzinEnabled = (enabled: boolean): void => {
  localStorage.setItem(KEY_PER_PRAYER_MUAZZIN_ENABLED, enabled ? 'true' : 'false');

  // If disabling, clear all specific settings
  if (!enabled) {
    clearAzhanSpecificSettings();
  }

  // Dispatch event so UI can react instantly (e.g. Layout Settings Modal)
  window.dispatchEvent(new CustomEvent('per-prayer-changed', { detail: enabled }));
};

/**
 * Clear all per-prayer specific settings
 * After clearing, all prayers will use the global muazzin
 */
export const clearAzhanSpecificSettings = (): void => {
  localStorage.removeItem(KEY_SETTINGS_AZHAN_SPECIFIC);
};

/**
 * Check if any per-prayer specific settings exist
 */
export const hasAnySpecificAzhanSettings = (): boolean => {
  try {
    const specificJson = localStorage.getItem(KEY_SETTINGS_AZHAN_SPECIFIC);
    if (specificJson) {
      const specific = JSON.parse(specificJson);
      return Object.keys(specific).length > 0;
    }
  } catch (e) { }
  return false;
};

// --- Notifications Helper ---

export const getNotifications = (): AppNotification[] => {
  try {
    const stored = localStorage.getItem(KEY_NOTIFICATIONS);
    if (!stored) return [];

    const list: AppNotification[] = JSON.parse(stored);
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    // Auto-clear notifications older than 24 hours
    const filteredList = list.filter(n => (now - n.timestamp) < TWENTY_FOUR_HOURS);

    // Sort by timestamp descending (newest first)
    const sortedList = filteredList.sort((a, b) => b.timestamp - a.timestamp);

    // Save filtered list if any were removed
    if (filteredList.length !== list.length) {
      localStorage.setItem(KEY_NOTIFICATIONS, JSON.stringify(sortedList));
    }

    return sortedList;
  } catch { return []; }
};

export const addNotification = (
  title: string,
  content: string,
  type: AppNotification['type'] = 'system',
  deepLink?: string
): void => {
  addNotificationWithTimestamp(title, content, type, deepLink, Date.now());
};

/**
 * Add notification with a custom timestamp - for accurate scheduled time display
 */
export const addNotificationWithTimestamp = (
  title: string,
  content: string,
  type: AppNotification['type'] = 'system',
  deepLink?: string,
  timestamp?: number
): void => {
  const list = getNotifications();

  const today = new Date().toDateString();
  const isDuplicate = list.some(n =>
    n.title === title &&
    new Date(n.timestamp).toDateString() === today &&
    (type !== 'reminder' || n.content === content)
  );

  if (isDuplicate) return;

  const newNote: AppNotification = {
    id: Date.now().toString(),
    title,
    content,
    timestamp: timestamp || Date.now(),
    isRead: false,
    type,
    deepLink
  };

  const newList = [newNote, ...list].slice(0, 50);
  localStorage.setItem(KEY_NOTIFICATIONS, JSON.stringify(newList));
  window.dispatchEvent(new Event('notifications-updated'));
};

export const markNotificationsRead = (): void => {
  const list = getNotifications();
  const newList = list.map(n => ({ ...n, isRead: true }));
  localStorage.setItem(KEY_NOTIFICATIONS, JSON.stringify(newList));
  window.dispatchEvent(new Event('notifications-updated'));
};

export const clearNotifications = (): void => {
  localStorage.setItem(KEY_NOTIFICATIONS, JSON.stringify([]));
  window.dispatchEvent(new Event('notifications-updated'));
};

export const getUnreadCount = (): number => {
  return getNotifications().filter(n => !n.isRead).length;
};

// --- Notification Settings ---

export interface NotificationSettings {
  salah: {
    enabled: boolean;
    preNotification: boolean;
    preNotificationMinutes: number; // 5, 10, 15
    azhanVolume: number; // 0-100, default 80
    preNotificationSoundEnabled?: boolean;
    preNotificationSound?: string;
  };
  adhkar: {
    morning: { enabled: boolean };
    evening: { enabled: boolean };
    sleep: { enabled: boolean; time: string }; // "22:30"
    afterPrayer: {
      enabled: boolean;
      delayMinutes: {
        fajr: number;      // 1-30 minutes
        dhuhr: number;
        asr: number;
        maghrib: number;
        isha: number;
      };
      fridayDhuhrDelay: number;  // Special timing for Friday Jumu'ah (can be different)
    };
  };
  qiyam: {
    enabled: boolean;
    minutesBeforeFajr: number; // 30, 45, 60
  };
  friday: {
    kahfReminder: { enabled: boolean; time: string }; // time format: "09:00"
    duaHour: { enabled: boolean };
  };
  salawat: {
    enabled: boolean;
    mode: 'hourly' | 'daily';           // NEW: repetition mode
    timesPerHour: number;               // NEW: 1-4 for hourly mode
    timesPerDay: number;                // 1-10 for daily mode
    soundEnabled: boolean;
    selectedSound: string;              // 'salawat_one', 'salawat_two', 'salawat_three'
    avoidPrayerTimes: boolean;          // NEW: smart conflict avoidance
    startTime: string;                  // NEW: Start time for notifications (default 08:00)
    endTime: string;                    // NEW: End time for notifications (default 22:00)
  };
  // 🌙 Ramadan Special Notifications
  ramadan: {
    suhoorReminder: { enabled: boolean; minutesBefore: number };  // 60-90 minutes before Fajr
    iftarReminder: { enabled: boolean; minutesBefore: number };   // 10-15 minutes before Maghrib
    lastTenNights: { enabled: boolean };                          // Special reminders for last 10 nights
  };
  // Per-Device State (Not stored in JSON, runtime only)
  overlayGranted?: boolean;
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  salah: {
    enabled: true,
    preNotification: true,
    preNotificationMinutes: 10,
    azhanVolume: 80
  },
  adhkar: {
    morning: { enabled: true },
    evening: { enabled: true },
    sleep: { enabled: true, time: '22:30' },
    afterPrayer: {
      enabled: true,
      delayMinutes: {
        fajr: 15,
        dhuhr: 15,
        asr: 15,
        maghrib: 15,
        isha: 15
      },
      fridayDhuhrDelay: 75  // Special timing for Friday Jumu'ah
    }
  },
  qiyam: {
    enabled: true,
    minutesBeforeFajr: 45
  },
  friday: {
    kahfReminder: { enabled: true, time: '10:00' }, // Friday 10 AM default
    duaHour: { enabled: true }
  },
  salawat: {
    enabled: false, // Opt-in feature
    mode: 'daily',
    timesPerHour: 1,
    timesPerDay: 3,
    soundEnabled: true,
    selectedSound: 'salawat_one',
    avoidPrayerTimes: true,
    startTime: '08:00', // Default start: 8 AM
    endTime: '22:00'    // Default end: 10 PM
  },
  // 🌙 Ramadan defaults - opt-in, only active during Ramadan
  ramadan: {
    suhoorReminder: { enabled: false, minutesBefore: 60 },  // 60 min before Fajr
    iftarReminder: { enabled: false, minutesBefore: 10 },   // 10 min before Maghrib
    lastTenNights: { enabled: false }                        // Disabled by default
  }
};

export const getNotificationSettings = (): NotificationSettings => {
  try {
    const stored = localStorage.getItem(KEY_NOTIFICATION_SETTINGS);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Robust Deep Merge to prevent crashes with old/partial settings
      return {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...parsed,
        salah: {
          ...DEFAULT_NOTIFICATION_SETTINGS.salah,
          ...(parsed.salah || {})
        },
        adhkar: {
          ...DEFAULT_NOTIFICATION_SETTINGS.adhkar,
          ...(parsed.adhkar || {}),
          morning: { ...DEFAULT_NOTIFICATION_SETTINGS.adhkar.morning, ...(parsed.adhkar?.morning || {}) },
          evening: { ...DEFAULT_NOTIFICATION_SETTINGS.adhkar.evening, ...(parsed.adhkar?.evening || {}) },
          sleep: { ...DEFAULT_NOTIFICATION_SETTINGS.adhkar.sleep, ...(parsed.adhkar?.sleep || {}) },
          afterPrayer: {
            ...DEFAULT_NOTIFICATION_SETTINGS.adhkar.afterPrayer,
            ...(parsed.adhkar?.afterPrayer || {}),
            delayMinutes: {
              ...DEFAULT_NOTIFICATION_SETTINGS.adhkar.afterPrayer.delayMinutes,
              ...(parsed.adhkar?.afterPrayer?.delayMinutes || {})
            }
          }
        },
        qiyam: {
          ...DEFAULT_NOTIFICATION_SETTINGS.qiyam,
          ...(parsed.qiyam || {})
        },
        friday: {
          ...DEFAULT_NOTIFICATION_SETTINGS.friday,
          ...(parsed.friday || {}),
          kahfReminder: { ...DEFAULT_NOTIFICATION_SETTINGS.friday.kahfReminder, ...(parsed.friday?.kahfReminder || {}) },
          duaHour: { ...DEFAULT_NOTIFICATION_SETTINGS.friday.duaHour, ...(parsed.friday?.duaHour || {}) }
        },
        salawat: {
          ...DEFAULT_NOTIFICATION_SETTINGS.salawat,
          ...(parsed.salawat || {})
        },
        ramadan: {
          ...DEFAULT_NOTIFICATION_SETTINGS.ramadan,
          ...(parsed.ramadan || {}),
          suhoorReminder: { ...DEFAULT_NOTIFICATION_SETTINGS.ramadan.suhoorReminder, ...(parsed.ramadan?.suhoorReminder || {}) },
          iftarReminder: { ...DEFAULT_NOTIFICATION_SETTINGS.ramadan.iftarReminder, ...(parsed.ramadan?.iftarReminder || {}) },
          lastTenNights: { ...DEFAULT_NOTIFICATION_SETTINGS.ramadan.lastTenNights, ...(parsed.ramadan?.lastTenNights || {}) }
        }
      };
    }
    return DEFAULT_NOTIFICATION_SETTINGS;
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
};

export const setNotificationSettings = (settings: Partial<NotificationSettings>): void => {
  const current = getNotificationSettings();
  const merged = { ...current, ...settings };
  console.log('[Storage] 💾 Settings Updated:', JSON.stringify(settings));
  localStorage.setItem(KEY_NOTIFICATION_SETTINGS, JSON.stringify(merged));

  // EVENT BUS: Dispatch Global Update Event
  // This allows UI components (Sidebar, Downloads, Settings) to sync instantly
  window.dispatchEvent(new CustomEvent('notification-settings-updated', {
    detail: { settings: merged }
  }));

  // NATIVE SYNC: Update Android System Volume Immediately
  // If azhanVolume changed, tell MediaBridge
  if (settings.salah && settings.salah.azhanVolume !== undefined) {
    if (Capacitor.isNativePlatform()) {
      import('./mediaBridge').then(({ MediaBridge }) => {
        MediaBridge.setAzhanVolume({ volume: settings.salah!.azhanVolume! })
          .then(() => console.log(`[Storage] 🔊 Native Volume Updated: ${settings.salah!.azhanVolume}`))
          .catch(err => console.error("[Storage] Failed to update native volume", err));
      });
    }
  } else if (settings.salah && settings.salah.azhanVolume === undefined) {
    // Sometimes we update full object? check manual diff or just force update if simple
  }
};

export const updateSalahSettings = (salah: Partial<NotificationSettings['salah']>): void => {
  const current = getNotificationSettings();
  setNotificationSettings({ ...current, salah: { ...current.salah, ...salah } });
};

export const updateAdhkarSettings = (adhkar: Partial<NotificationSettings['adhkar']>): void => {
  const current = getNotificationSettings();
  setNotificationSettings({ ...current, adhkar: { ...current.adhkar, ...adhkar } });
};

export const updateQiyamSettings = (qiyam: Partial<NotificationSettings['qiyam']>): void => {
  const current = getNotificationSettings();
  setNotificationSettings({ ...current, qiyam: { ...current.qiyam, ...qiyam } });
};

export const updateFridaySettings = (friday: Partial<NotificationSettings['friday']>): void => {
  const current = getNotificationSettings();
  setNotificationSettings({ ...current, friday: { ...current.friday, ...friday } });
};

export const updateSalawatSettings = (salawat: Partial<NotificationSettings['salawat']>): void => {
  const current = getNotificationSettings();
  setNotificationSettings({ ...current, salawat: { ...current.salawat, ...salawat } });
};

// 🌙 Ramadan Settings Helper
export const updateRamadanSettings = (ramadan: Partial<NotificationSettings['ramadan']>): void => {
  const current = getNotificationSettings();
  setNotificationSettings({ ...current, ramadan: { ...current.ramadan, ...ramadan } });
};

// --- Prayer Tracking System ---

// --- Prayer History System (New v2) ---

const KEY_PRAYER_HISTORY = 'prayer_history_v1';

export interface PrayerHistoryDay {
  date: string; // YYYY-MM-DD
  completedCount: number; // 0-5
  allCompleted: boolean;
}

export const getPrayerHistory = (): Record<string, PrayerHistoryDay> => {
  try {
    const stored = localStorage.getItem(KEY_PRAYER_HISTORY);
    return stored ? JSON.parse(stored) : {};
  } catch { return {}; }
};

export const updatePrayerHistory = (date: string, count: number): void => {
  const history = getPrayerHistory();
  history[date] = {
    date,
    completedCount: count,
    allCompleted: count >= 5
  };
  localStorage.setItem(KEY_PRAYER_HISTORY, JSON.stringify(history));
};

export const getCurrentStreak = (): number => {
  const history = getPrayerHistory();
  const today = new Date();
  let streak = 0;

  // Check today first
  const todayStr = today.toISOString().split('T')[0];
  if (history[todayStr]?.allCompleted) {
    streak++;
  }

  // Iterate backwards
  for (let i = 1; i < 365; i++) { // Check up to a year back
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    if (history[dateStr]?.allCompleted) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
};

export const getWeeklyCompletion = (): { date: string, status: 'full' | 'partial' | 'none' }[] => {
  const history = getPrayerHistory();
  const result = [];

  // Get today's date
  const today = new Date();
  const todayDayIndex = today.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday

  // Calculate how many days back to Saturday (start of Arabic week)
  // If today is Saturday (6), go back 0 days
  // If today is Sunday (0), go back 1 day
  // If today is Friday (5), go back 6 days (full week shown)
  const daysBackToSaturday = (todayDayIndex + 1) % 7; // Days back to the most recent Saturday

  // Start from Saturday and build the 7-day week
  const saturday = new Date(today);
  saturday.setDate(today.getDate() - daysBackToSaturday);

  for (let i = 0; i < 7; i++) {
    const d = new Date(saturday);
    d.setDate(saturday.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const entry = history[dateStr];

    let status: 'full' | 'partial' | 'none' = 'none';

    // Only show status for days up to and including today
    if (d <= today) {
      if (entry) {
        if (entry.allCompleted) status = 'full';
        else if (entry.completedCount > 0) status = 'partial';
      }
    } else {
      // Future days - show as 'none' (not started yet)
      status = 'none';
    }

    result.push({ date: dateStr, status });
  }

  return result; // [Saturday, Sunday, Monday, Tuesday, Wednesday, Thursday, Friday]
};

// Arabic day names in correct order (Saturday first)
export const ARABIC_DAY_NAMES = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];


export const getTotalPrayersCount = (): number => {
  const history = getPrayerHistory();
  return Object.values(history).reduce((sum, day) => sum + day.completedCount, 0);
};

const KEY_PRAYER_TRACKING = 'prayer_tracking_today';

export interface PrayerTracking {
  date: string; // YYYY-MM-DD format
  prayers: {
    fajr: boolean;
    dhuhr: boolean;
    asr: boolean;
    maghrib: boolean;
    isha: boolean;
  };
}

const DEFAULT_PRAYER_TRACKING: PrayerTracking = {
  date: new Date().toISOString().split('T')[0],
  prayers: {
    fajr: false,
    dhuhr: false,
    asr: false,
    maghrib: false,
    isha: false
  }
};

export const getPrayerTracking = (): PrayerTracking => {
  try {
    const stored = localStorage.getItem(KEY_PRAYER_TRACKING);
    if (!stored) return { ...DEFAULT_PRAYER_TRACKING, date: new Date().toISOString().split('T')[0] };

    const parsed: PrayerTracking = JSON.parse(stored);
    const today = new Date().toISOString().split('T')[0];

    // Reset if it's a new day
    if (parsed.date !== today) {
      const newTracking = { ...DEFAULT_PRAYER_TRACKING, date: today };
      localStorage.setItem(KEY_PRAYER_TRACKING, JSON.stringify(newTracking));
      return newTracking;
    }

    return parsed;
  } catch {
    return { ...DEFAULT_PRAYER_TRACKING, date: new Date().toISOString().split('T')[0] };
  }
};

export const markPrayerCompleted = (prayerKey: keyof PrayerTracking['prayers']): void => {
  const tracking = getPrayerTracking();
  tracking.prayers[prayerKey] = true;
  localStorage.setItem(KEY_PRAYER_TRACKING, JSON.stringify(tracking));

  // Sync with History
  const count = Object.values(tracking.prayers).filter(v => v).length;
  updatePrayerHistory(tracking.date, count);
};

export const undoPrayerCompletion = (prayerKey: keyof PrayerTracking['prayers']): void => {
  const tracking = getPrayerTracking();
  tracking.prayers[prayerKey] = false;
  localStorage.setItem(KEY_PRAYER_TRACKING, JSON.stringify(tracking));

  // Sync with History
  const count = Object.values(tracking.prayers).filter(v => v).length;
  updatePrayerHistory(tracking.date, count);
};

export const resetDailyPrayers = (): void => {
  const settings = getPrayerTracking();
  const newTracking: PrayerTracking = {
    ...settings,
    prayers: {
      fajr: false,
      dhuhr: false,
      asr: false,
      maghrib: false,
      isha: false
    }
  };
  localStorage.setItem(KEY_PRAYER_TRACKING, JSON.stringify(newTracking));

  // Update History
  updatePrayerHistory(newTracking.date, 0);
};

export const getPrayerCount = (): number => {
  const tracking = getPrayerTracking();
  return Object.values(tracking.prayers).filter(v => v).length;
};

// Motivational messages for each prayer
export const PRAYER_MESSAGES: Record<string, { title: string; message: string; hadith: string }> = {
  fajr: {
    title: '🌅 صلاة الفجر',
    message: 'أحسنت! بدأت يومك بالنور',
    hadith: '«ركعتا الفجر خير من الدنيا وما فيها» رواه مسلم'
  },
  dhuhr: {
    title: '☀️ صلاة الظهر',
    message: 'بارك الله فيك! نصف اليوم بطاعة',
    hadith: '«من حافظ على الصلوات الخمس كانت له نورًا وبرهانًا» رواه أحمد'
  },
  asr: {
    title: '🌤️ صلاة العصر',
    message: 'ماشاء الله! الصلاة الوسطى',
    hadith: '«حافظوا على الصلوات والصلاة الوسطى» البقرة ٢٣٨'
  },
  maghrib: {
    title: '🌅 صلاة المغرب',
    message: 'تبارك الله! ختمت نهارك بالصلاة',
    hadith: '«من صلى البردين دخل الجنة» متفق عليه'
  },
  isha: {
    title: '🌙 صلاة العشاء',
    message: 'أحسنت! ختمت يومك بخير الأعمال',
    hadith: '«من صلى العشاء في جماعة فكأنما قام نصف الليل» رواه مسلم'
  }
};

// --- Hifz Plan Helpers ---
// Used by notification manager to send smart reminders

const KEY_HIFZ_PLAN = 'albayan_hifz_plan_v1';

/**
 * Check if user has created a Hifz (memorization) plan
 */
export const hasHifzPlan = (): boolean => {
  try {
    const stored = localStorage.getItem(KEY_HIFZ_PLAN);
    if (!stored) return false;
    const plan = JSON.parse(stored);
    return plan?.isSetup === true;
  } catch {
    return false;
  }
};

/**
 * Get user's current Hifz streak (consecutive days)
 */
export const getHifzStreak = (): number => {
  try {
    const stored = localStorage.getItem(KEY_HIFZ_PLAN);
    if (!stored) return 0;
    const plan = JSON.parse(stored);
    if (!plan?.history || plan.history.length === 0) return 0;

    // Calculate streak from history
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    let streak = 0;
    let checkDate = new Date(today);

    // Check if completed today or yesterday (allow for late night completion)
    const sortedHistory = [...plan.history].sort().reverse();

    for (const dateStr of sortedHistory) {
      const checkStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;

      if (dateStr === checkStr) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        // Allow one day gap for yesterday
        const yesterday = new Date(checkDate);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

        if (dateStr === yesterdayStr) {
          streak++;
          checkDate = yesterday;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    return streak;
  } catch {
    return 0;
  }
};

// ==================== DATA EXPORT/IMPORT ====================
// Backup and restore all user data

interface ExportData {
  version: string;
  exportDate: string;
  data: {
    bookmarks: {
      ayah: AyahBookmark[];
      page: PageBookmark[];
    };
    notes: Note[];
    adhkar: {
      favorites: number[];
      custom: Zekr[];
    };
    tasbih: TasbihItem[];
    hifzPlan: any;
    settings: {
      fontSize: number;
      reciter: string;
      azhan: string;
      notifications: any;
    };
    location: SavedLocation | null;
  };
}

/**
 * Export all user data as a JSON string
 * Can be saved as a file for backup
 */
export const exportUserData = (): string => {
  const exportData: ExportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    data: {
      bookmarks: {
        ayah: getAyahBookmarks(),
        page: getPageBookmarks(),
      },
      notes: getNotes(),
      adhkar: {
        favorites: (() => {
          try {
            const stored = localStorage.getItem('favorites_adhkar');
            return stored ? JSON.parse(stored) : [];
          } catch { return []; }
        })(),
        custom: (() => {
          try {
            const stored = localStorage.getItem('custom_adhkar');
            return stored ? JSON.parse(stored) : [];
          } catch { return []; }
        })(),
      },
      tasbih: (() => {
        try {
          const stored = localStorage.getItem('custom_tasbih_items');
          return stored ? JSON.parse(stored) : [];
        } catch { return []; }
      })(),
      hifzPlan: (() => {
        try {
          const stored = localStorage.getItem('albayan_hifz_plan_v1');
          return stored ? JSON.parse(stored) : null;
        } catch { return null; }
      })(),
      settings: {
        fontSize: getStoredFontSize(),
        reciter: getStoredReciter(),
        azhan: getStoredAzhan(),
        notifications: getNotificationSettings(),
      },
      location: getSavedLocation(),
    },
  };

  return JSON.stringify(exportData, null, 2);
};

/**
 * Import user data from a JSON string
 * Returns success status and message
 */
export const importUserData = (jsonString: string): { success: boolean; message: string } => {
  try {
    const importData: ExportData = JSON.parse(jsonString);

    // Validate structure
    if (!importData.version || !importData.data) {
      return { success: false, message: 'ملف غير صالح: بنية البيانات غير صحيحة' };
    }

    const { data } = importData;

    // Import bookmarks
    if (data.bookmarks?.ayah?.length > 0) {
      localStorage.setItem(KEY_BOOKMARKS_AYAH, JSON.stringify(data.bookmarks.ayah));
    }
    if (data.bookmarks?.page?.length > 0) {
      localStorage.setItem(KEY_BOOKMARKS_PAGE, JSON.stringify(data.bookmarks.page));
    }

    // Import notes
    if (data.notes?.length > 0) {
      localStorage.setItem(KEY_NOTES, JSON.stringify(data.notes));
    }

    // Import adhkar
    if (data.adhkar?.favorites?.length > 0) {
      localStorage.setItem(KEY_FAV_ADHKAR, JSON.stringify(data.adhkar.favorites));
    }
    if (data.adhkar?.custom?.length > 0) {
      localStorage.setItem(KEY_CUSTOM_ADHKAR, JSON.stringify(data.adhkar.custom));
    }

    // Import tasbih
    if (data.tasbih?.length > 0) {
      localStorage.setItem(KEY_CUSTOM_TASBIH, JSON.stringify(data.tasbih));
    }

    // Import Hifz plan
    if (data.hifzPlan) {
      localStorage.setItem('albayan_hifz_plan_v1', JSON.stringify(data.hifzPlan));
    }

    // Import settings
    if (data.settings) {
      if (data.settings.fontSize) setStoredFontSize(data.settings.fontSize);
      if (data.settings.reciter) setStoredReciter(data.settings.reciter);
      if (data.settings.azhan) setStoredAzhan(data.settings.azhan);
      if (data.settings.notifications) {
        localStorage.setItem(KEY_NOTIFICATION_SETTINGS, JSON.stringify(data.settings.notifications));
      }
    }

    // Import location
    if (data.location) {
      localStorage.setItem(KEY_SAVED_LOCATION, JSON.stringify(data.location));
    }

    const stats = {
      bookmarks: (data.bookmarks?.ayah?.length || 0) + (data.bookmarks?.page?.length || 0),
      notes: data.notes?.length || 0,
      adhkar: (data.adhkar?.favorites?.length || 0) + (data.adhkar?.custom?.length || 0),
      tasbih: data.tasbih?.length || 0,
    };

    return {
      success: true,
      message: `تم استيراد البيانات بنجاح!\n${stats.bookmarks} علامة - ${stats.notes} ملاحظة - ${stats.adhkar} ذكر - ${stats.tasbih} تسبيح`,
    };
  } catch (e) {
    console.error('Import error:', e);
    return { success: false, message: 'فشل استيراد البيانات: ملف غير صالح' };
  }
};

/**
 * Download exported data as a JSON file
 */
export const downloadExportFile = (): void => {
  const data = exportUserData();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `albayan-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Clear all user data (factory reset)
 */
export const clearAllUserData = (): void => {
  const keysToKeep = ['theme']; // Keep theme preference

  const allKeys = Object.keys(localStorage);
  for (const key of allKeys) {
    if (!keysToKeep.includes(key)) {
      localStorage.removeItem(key);
    }
  }
};

// --- Custom Muazzin (User-Uploaded Azhan) ---

/**
 * Custom Muazzin uploaded by user
 * Uses UUID-based safe filename to avoid Arabic encoding issues
 */
export interface CustomMuazzin {
  id: string;           // custom_uuid (safe filename)
  displayName: string;  // Arabic name for display (e.g., "أذان الحرم المكي")
  filePath: string;     // azhan/custom_uuid.mp3
  addedAt: number;      // timestamp when added
  sizeBytes: number;    // file size for display
}

/**
 * Get all custom muazzins uploaded by user
 */
export const getCustomMuazzins = (): CustomMuazzin[] => {
  try {
    const json = localStorage.getItem(KEY_CUSTOM_MUAZZINS);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
};

/**
 * Add a new custom muazzin
 */
export const addCustomMuazzin = (muazzin: CustomMuazzin): void => {
  const list = getCustomMuazzins();

  // Prevent duplicates by ID
  const existingIndex = list.findIndex(m => m.id === muazzin.id);
  if (existingIndex >= 0) {
    list[existingIndex] = muazzin; // Update existing
  } else {
    list.push(muazzin);
  }

  localStorage.setItem(KEY_CUSTOM_MUAZZINS, JSON.stringify(list));
};

/**
 * Delete a custom muazzin by ID
 * Note: Does NOT delete the file - caller must handle file deletion
 */
export const deleteCustomMuazzin = (id: string): void => {
  const list = getCustomMuazzins().filter(m => m.id !== id);
  localStorage.setItem(KEY_CUSTOM_MUAZZINS, JSON.stringify(list));

  // Also clear any prayer-specific settings that use this muazzin
  try {
    const specificJson = localStorage.getItem(KEY_SETTINGS_AZHAN_SPECIFIC);
    if (specificJson) {
      const specific = JSON.parse(specificJson);
      let changed = false;
      for (const key of Object.keys(specific)) {
        const val = specific[key];
        if (val && typeof val === 'object' && val.id === id) {
          delete specific[key];
          changed = true;
        } else if (val === id) {
          delete specific[key];
          changed = true;
        }
      }
      if (changed) {
        localStorage.setItem(KEY_SETTINGS_AZHAN_SPECIFIC, JSON.stringify(specific));
      }
    }

    // Clear global azhan if it matches
    if (localStorage.getItem(KEY_SETTINGS_AZHAN) === id) {
      localStorage.setItem(KEY_SETTINGS_AZHAN, 'egy_abdulbasit');
    }
  } catch (e) {
    console.warn('Failed to clean up azhan settings for deleted custom muazzin:', e);
  }
};

/**
 * Get a custom muazzin by ID
 */
export const getCustomMuazzinById = (id: string): CustomMuazzin | null => {
  return getCustomMuazzins().find(m => m.id === id) || null;
};

// --- Search History Helper ---
const KEY_SEARCH_HISTORY_QURAN = 'search_history_quran';
const KEY_SEARCH_HISTORY_HADITH = 'search_history_hadith';

export const getSearchHistory = (type: 'quran' | 'hadith'): string[] => {
  try {
    const key = type === 'quran' ? KEY_SEARCH_HISTORY_QURAN : KEY_SEARCH_HISTORY_HADITH;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const saveSearchQuery = (query: string, type: 'quran' | 'hadith'): void => {
  if (!query || query.trim().length === 0) return;
  const list = getSearchHistory(type);
  const normalizedQuery = query.trim();
  
  // Remove if it already exists to put it at the top
  const filteredList = list.filter(q => q !== normalizedQuery);
  const newList = [normalizedQuery, ...filteredList].slice(0, 15); // Keep top 15
  
  const key = type === 'quran' ? KEY_SEARCH_HISTORY_QURAN : KEY_SEARCH_HISTORY_HADITH;
  localStorage.setItem(key, JSON.stringify(newList));
};

export const removeSearchQuery = (query: string, type: 'quran' | 'hadith'): void => {
  const list = getSearchHistory(type);
  const newList = list.filter(q => q !== query);
  const key = type === 'quran' ? KEY_SEARCH_HISTORY_QURAN : KEY_SEARCH_HISTORY_HADITH;
  localStorage.setItem(key, JSON.stringify(newList));
};

export const clearSearchHistory = (type: 'quran' | 'hadith'): void => {
  const key = type === 'quran' ? KEY_SEARCH_HISTORY_QURAN : KEY_SEARCH_HISTORY_HADITH;
  localStorage.removeItem(key);
};
