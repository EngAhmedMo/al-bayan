
// Quran Types
export interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

export interface Ayah {
  number: number;
  text: string; // Uthmani or Tajweed-encoded text
  numberInSurah: number;
  juz: number;
  manzil: number;
  page: number;
  ruku: number;
  hizbQuarter: number;
  sajda: boolean | { id: number; recommended: boolean; obligatory: boolean };
  audio?: string; // Audio URL
  audioSecondary?: string[];
  // New fields for Mushaf V2
  line_start?: number;
  line_end?: number;
  aya_text?: string; // Enhanced Uthmani text
  aya_text_emlaey?: string; // Simple text for search
  qcf_text?: string; // QCF encoded text for the Mushaf rendering
  // Optional surah info (from static data)
  surah?: {
    number: number;
    name: string;
    englishName: string;
    englishNameTranslation: string;
    revelationType: string;
  };
}

export interface QuranSearchResult {
  surah: Surah;
  ayah: Ayah;
  matchType: 'exact' | 'partial';
}

export interface TafsirResponse {
  text: string;
  edition: {
    identifier: string;
    language: string;
    name: string;
    englishName: string;
  };
  surah: {
    number: number;
  };
  numberInSurah: number;
}

// --- Tafsir Library Types (New) ---
export interface TafsirChapter {
  Chapter_number: number;
  Chapter_name: string;
}

export interface TafsirPart {
  parts_number: string;
  Chapter_names: TafsirChapter[];
}

export interface TafsirBook {
  bookNumber: number;
  bookName: string;
  bookFullName: string;
  aboutBook: string;
  hasChapters: boolean;
  parts_count: number;
  Chapter_count: number;
  parts: TafsirPart[];
  PageTotle?: number;
  apiSlug?: string; // For external API (e.g., spa5k/tafsir_api)
}
// ----------------------------------

// Hifz Types
export interface HifzPlan {
  type: 'pages' | 'ayahs';
  amountPerSession: number;
  daysPerWeek: number; // 2-7
  selectedDays?: number[]; // 0=Sun, 1=Mon...
  startDate: string;
}

export interface HifzProgress {
  plan: HifzPlan;
  completedSessions: number;
  lastSessionDate: string | null;
}

// Hadith Types
export enum HadithBook {
  ALL = 'all',
  NAWAWI = 'nawawi',
  BUKHARI = 'bukhari',
  MUSLIM = 'muslim',
  RIYAD = 'riyad'
}

export interface Hadith {
  id: string;
  text: string;
  book: HadithBook; // Internal ID for filtering
  sourceName: string; // Display name like "صحيح البخاري"
  chapter?: string; // e.g. "كتاب الإيمان"
  number?: number;
  explanation?: string; // Sharh
}

// Tasbih Types
export interface TasbihItem {
  id: string;
  label: string;
  count: number;
  target: number;
  virtue?: string;
  hadithSource?: string; // Full hadith text and source
  sequenceMode?: boolean; // If true, this item cycles through multiple sub-items automatically
}

// Adhkar Types
export interface Zekr {
  id: number;
  category: string;
  count: string;
  description: string;
  reference: string;
  zekr: string;
}

// Events Types
export interface EventHadith {
  hadith: string;
  bookInfo: string;
}

export interface IslamicEvent {
  id: number;
  title: string; // Key for translation
  month: number;
  day: number[];
  isReminder: boolean;
  hadith: EventHadith[];
}

// Radio Types (Updated for Multi-source)
export interface RadioStation {
  id: string;
  name: string;
  url: string[]; // Changed from string to string[] for fallback support
  img?: string;
  category: 'quran' | 'cairo' | 'reciters' | 'other';
}

// User Data / Bookmarks

// 1. Ayah Bookmark (Matches BookmarksAyah Table)
export interface AyahBookmark {
  id: string; // Unique ID
  surahName: string;
  surahNumber: number;
  ayahNumber: number;
  pageNumber: number;
  timestamp: number; // Represents 'lastRead'
}

// 2. Page Bookmark (Matches Bookmarks Table)
export interface PageBookmark {
  id: string; // Unique ID
  surahName: string; // Name of the first surah on page or main surah
  pageNumber: number;
  timestamp: number; // Represents 'lastRead'
  label?: string; // Optional user label (e.g., "Ward")
}

// 3. Notifications (Matches NotificationDatabaseHelper)
export interface AppNotification {
  id: string;
  title: string;
  content: string; // was 'content' or body
  timestamp: number;
  isRead: boolean;
  type?: 'event' | 'system' | 'reminder';
  deepLink?: string; // Navigation route when notification is clicked (e.g., '/adhkar?category=أذكار%20الصباح')
}

// 4. Hadith Bookmark
export interface HadithBookmark {
  id: string; // Unique ID (e.g., bookId_hadithId)
  bookId: string; // For filtering
  hadithId: string; // Internal id
  bookName: string; // Display Name
  chapterName?: string;
  textSnippet: string; // First few words to display
  timestamp: number;
}

// 5. Notes (New Feature)
export interface Note {
  id: string;
  surahName: string;
  surahNumber: number;
  ayahNumber: number;
  pageNumber: number;
  text: string;
  timestamp: number;
}

// 5. Settings
export interface Reciter {
  id: string; // e.g., 'ar.alafasy'
  name: string; // e.g., 'مشاري العفاسي'
}

// 6. Prayer Times (New)
export interface PrayerTimes {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
  [key: string]: string; // Index signature
}

export interface PrayerData {
  timings: PrayerTimes;
  date: {
    readable: string;
    object: Date; // Added for easier scheduling
    hijri: {
      date: string;
      month: { ar: string };
      weekday: { ar: string };
    };
  };
  meta: {
    timezone: string;
  };
}
