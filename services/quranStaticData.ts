/**
 * Quran Static Data Service
 * 
 * 1. Provides 100% offline access to complete Quran text with Tajweed markers (bundled JSON).
 * 2. Provides static constants and utility functions for Quran navigation and structure.
 */

import { Ayah } from '../types';

// ==========================================
// PART 1: STATIC CONSTANTS & HELPER FUNCTIONS
// (Restored to fix build errors & added Surah Names)
// ==========================================

export const TOTAL_QURAN_AYAHS = 6236;

export const SURAH_AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
  54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
  29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
  11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6
];

export const SURAH_START_PAGES = [
  1, 2, 50, 77, 106, 128, 151, 177, 187, 208, 221, 235, 249, 255, 262, 267, 282, 293, 305, 312,
  322, 332, 342, 350, 359, 367, 377, 385, 396, 404, 411, 415, 418, 428, 434, 440, 446, 453, 458, 467,
  477, 483, 489, 496, 499, 502, 507, 511, 515, 518, 520, 523, 526, 528, 531, 534, 537, 542, 545, 549,
  551, 553, 554, 556, 558, 560, 562, 564, 566, 568, 570, 572, 574, 575, 577, 578, 580, 582, 583, 585,
  586, 587, 587, 589, 590, 591, 591, 592, 593, 594, 595, 595, 596, 596, 597, 597, 598, 598, 599, 599,
  600, 600, 601, 601, 601, 602, 602, 602, 603, 603, 603, 604, 604, 604
];

export const SURAH_NAMES_ARABIC = [
  "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس",
  "هود", "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل", "الإسراء", "الكهف", "مريم", "طه",
  "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم",
  "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر", "يس", "الصافات", "ص", "الزمر", "غافر",
  "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية", "الأحقاف", "محمد", "الفتح", "الحجرات", "ق",
  "الذاريات", "الطور", "النجم", "القمر", "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة",
  "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق", "التحريم", "الملك", "القلم", "الحاقة", "المعارج",
  "نوح", "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات", "النبأ", "النازعات", "عبس",
  "التكوير", "الانفطار", "المطففين", "الانشقاق", "البروج", "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد",
  "الشمس", "الليل", "الضحى", "الشرح", "التين", "العلق", "القدر", "البينة", "الزلزلة", "العاديات",
  "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل", "قريش", "الماعون", "الكوثر", "الكافرون", "النصر",
  "المسد", "الإخلاص", "الفلق", "الناس"
];

export const SURAH_NAMES_TASHKEEL = [
  "الْفَاتِحَة", "الْبَقَرَة", "آل عِمْرَان", "النِّسَاء", "الْمَائِدَة", "الْأَنْعَام", "الْأَعْرَاف", "الْأَنْفَال", "التَّوْبَة", "يُونُس",
  "هُود", "يُوسُف", "الرَّعْد", "إِبْرَاهِيم", "الْحِجْر", "النَّحْل", "الْإِسْرَاء", "الْكَهْف", "مَرْيَم", "طَه",
  "الْأَنْبِيَاء", "الْحَجّ", "الْمُؤْمِنُون", "النُّور", "الْفُرْقَان", "الشُّعَرَاء", "النَّمْل", "الْقَصَص", "الْعَنْكَبُوت", "الرُّوم",
  "لُقْمَان", "السَّجْدَة", "الْأَحْزَاب", "سَبَأ", "فَاطِر", "يس", "الصَّافَّات", "ص", "الزُّمَر", "غَافِر",
  "فُصِّلَت", "الشُّورَى", "الزُّخْرُف", "الدُّخَان", "الْجَاثِيَة", "الْأَحْقَاف", "مُحَمَّد", "الْفَتْح", "الْحُجُرَات", "ق",
  "الذَّارِيَات", "الطُّور", "النَّجْم", "الْقَمَر", "الرَّحْمَن", "الْوَاقِعَة", "الْحَدِيد", "الْمُجَادِلَة", "الْحَشْر", "الْمُمْتَحَنَة",
  "الصَّفّ", "الْجُمُعَة", "الْمُنَافِقُون", "التَّغَابُن", "الطَّلَاق", "التَّحْرِيم", "الْمُلْك", "الْقَلَم", "الْحَاقَّة", "الْمَعَارِج",
  "نُوح", "الْجِنّ", "الْمُزَّمِّل", "الْمُدَّثِّر", "الْقِيَامَة", "الْإِنْسَان", "الْمُرْسَلَات", "النَّبَأ", "النَّازِعَات", "عَبَس",
  "التَّكْوِير", "الْإِنْفِطَار", "الْمُطَفِّفِين", "الْإِنْشِقَاق", "الْبُرُوج", "الطَّارِق", "الْأَعْلَى", "الْغَاشِيَة", "الْفَجْر", "الْبَلَد",
  "الشَّمْس", "اللَّيْل", "الضُّحَى", "الشَّرْح", "التِّين", "الْعَلَق", "الْقَدْر", "الْبَيِّنَة", "الزَّلْزَلَة", "الْعَادِيَات",
  "الْقَارِعَة", "التَّكَاثُر", "الْعَصْر", "الْهُمَزَة", "الْفِيل", "قُرَيْش", "الْمَاعُون", "الْكَوْثَر", "الْكَافِرُون", "النَّصْر",
  "الْمَسَد", "الْإِخْلَاص", "الْفَلَق", "النَّاس"
];

export const SURAH_ENGLISH_NAMES = [
  "Al-Fatihah", "Al-Baqarah", "Aal-e-Imran", "An-Nisa", "Al-Ma'idah", "Al-An'am", "Al-A'raf", "Al-Anfal", "At-Tawbah", "Yunus",
  "Hud", "Yusuf", "Ar-Ra'd", "Ibrahim", "Al-Hijr", "An-Nahl", "Al-Isra", "Al-Kahf", "Maryam", "Taha",
  "Al-Anbiya", "Al-Hajj", "Al-Mu'minun", "An-Nur", "Al-Furqan", "Ash-Shu'ara", "An-Naml", "Al-Qasas", "Al-Ankabut", "Ar-Rum",
  "Luqman", "As-Sajdah", "Al-Ahzab", "Saba", "Fatir", "Ya-Sin", "As-Saffat", "Sad", "Az-Zumar", "Ghafir",
  "Fussilat", "Ash-Shura", "Az-Zukhruf", "Ad-Dukhan", "Al-Jathiyah", "Al-Ahqaf", "Muhammad", "Al-Fath", "Al-Hujurat", "Qaf",
  "Ad-Dhariyat", "At-Tur", "An-Najm", "Al-Qamar", "Ar-Rahman", "Al-Waqi'ah", "Al-Hadid", "Al-Mujadila", "Al-Hashr", "Al-Mumtahanah",
  "As-Saff", "Al-Jumu'ah", "Al-Munafiqun", "At-Taghabun", "At-Talaq", "At-Tahrim", "Al-Mulk", "Al-Qalam", "Al-Haqqah", "Al-Ma'arij",
  "Nuh", "Al-Jinn", "Al-Muzzammil", "Al-Muddaththir", "Al-Qiyamah", "Al-Insan", "Al-Mursalat", "An-Naba", "An-Nazi'at", "Abasa",
  "At-Takwir", "Al-Infitar", "Al-Mutaffifin", "Al-Inshiqaq", "Al-Buruj", "At-Tariq", "Al-A'la", "Al-Ghashiyah", "Al-Fajr", "Al-Balad",
  "Ash-Shams", "Al-Lail", "Ad-Duhaa", "Ash-Sharh", "At-Tin", "Al-Alaq", "Al-Qadr", "Al-Bayyinah", "Az-Zalzalah", "Al-Adiyat",
  "Al-Qari'ah", "At-Takathur", "Al-Asr", "Al-Humazah", "Al-Fil", "Quraish", "Al-Ma'un", "Al-Kawthar", "Al-Kafirun", "An-Nasr",
  "Al-Masad", "Al-Ikhlas", "Al-Falaq", "An-Nas"
];

// 1 = Meccan, 0 = Medinan
export const SURAH_IS_MECCAN = [
  1, 0, 0, 0, 0, 1, 1, 0, 0, 1,
  1, 1, 0, 1, 1, 1, 1, 1, 1, 1,
  1, 0, 1, 0, 1, 1, 1, 1, 1, 1,
  1, 1, 0, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 0, 0, 0, 1,
  1, 1, 1, 1, 0, 1, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 0, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 0, 0, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 0,
  1, 1, 1, 1
];

export const OFFLINE_SURAHS: any[] = SURAH_NAMES_ARABIC.map((name, index) => ({
  number: index + 1,
  name,
  englishName: SURAH_ENGLISH_NAMES[index],
  englishNameTranslation: SURAH_ENGLISH_NAMES[index],
  numberOfAyahs: SURAH_AYAH_COUNTS[index],
  revelationType: SURAH_IS_MECCAN[index] ? 'Meccan' : 'Medinan'
}));

// Start pages for each of the 240 Rub al-Hizbs (0-indexed array, so index 0 = Rub 1)
// Data derived from standard Madani Mushaf page mapping.
export const HIZB_QUARTER_START_PAGES = [
  1, 4, 6, 9, 11, 14, 16, 19, // Juz 1
  22, 24, 27, 29, 32, 34, 37, 39, // Juz 2
  42, 44, 47, 49, 53, 55, 58, 60, // Juz 3
  62, 64, 67, 69, 72, 74, 77, 79, // Juz 4
  82, 84, 87, 89, 92, 94, 97, 99, // Juz 5
  102, 104, 106, 109, 111, 114, 116, 119, // Juz 6
  121, 124, 127, 129, 132, 134, 137, 139, // Juz 7
  142, 144, 147, 149, 151, 153, 156, 159, // Juz 8
  162, 164, 167, 169, 172, 174, 177, 179, // Juz 9
  182, 184, 187, 189, 192, 194, 197, 199, // Juz 10
  201, 203, 206, 208, 211, 213, 216, 218, // Juz 11
  221, 223, 226, 228, 231, 233, 236, 238, // Juz 12
  241, 243, 246, 249, 251, 253, 256, 258, // Juz 13
  262, 264, 267, 269, 272, 274, 277, 279, // Juz 14
  282, 284, 287, 289, 292, 294, 297, 299, // Juz 15
  302, 304, 307, 309, 312, 314, 317, 319, // Juz 16
  322, 324, 327, 329, 332, 334, 337, 339, // Juz 17
  342, 344, 347, 349, 352, 354, 357, 359, // Juz 18
  362, 364, 367, 369, 372, 374, 377, 379, // Juz 19
  382, 384, 387, 389, 392, 394, 397, 399, // Juz 20
  402, 404, 407, 409, 411, 413, 415, 418, // Juz 21
  422, 424, 427, 429, 431, 433, 436, 438, // Juz 22
  442, 444, 447, 449, 451, 453, 456, 458, // Juz 23
  462, 464, 467, 469, 472, 474, 477, 479, // Juz 24
  482, 484, 487, 489, 492, 494, 497, 499, // Juz 25
  502, 504, 507, 509, 513, 515, 518, 520, // Juz 26
  522, 524, 526, 528, 531, 534, 537, 539, // Juz 27
  542, 544, 547, 549, 553, 554, 556, 558, // Juz 28
  562, 564, 566, 568, 572, 574, 576, 578, // Juz 29
  582, 583, 585, 586, 587, 589, 591, 593  // Juz 30 (Approximate starts)
];

export const getGlobalAyahNumber = (surah: number, ayah: number): number => {
  let count = 0;
  for (let i = 0; i < surah - 1; i++) {
    count += SURAH_AYAH_COUNTS[i];
  }
  return count + ayah;
};

/**
 * Gets the first and last global ayah number for a given surah (1-114)
 */
export const getSurahGlobalAyahRange = (surahNum: number): { firstGlobal: number, lastGlobal: number } => {
  let firstGlobal = 1;
  for (let i = 0; i < surahNum - 1; i++) {
    firstGlobal += SURAH_AYAH_COUNTS[i];
  }
  const lastGlobal = firstGlobal + SURAH_AYAH_COUNTS[surahNum - 1] - 1;
  return { firstGlobal, lastGlobal };
};

/**
 * Gets approximate page number from global ayah number
 * (Simple approximation, not 100% precise but good for progress bars)
 */
export const getApproxPageFromGlobalAyah = (globalAyah: number): number => {
  if (pageIndex !== null && pageIndex.size > 0) {
    for (const [pageNum, ayahs] of pageIndex.entries()) {
      const first = ayahs[0].number;
      const last = ayahs[ayahs.length - 1].number;
      if (globalAyah >= first && globalAyah <= last) {
        return pageNum;
      }
    }
  }
  
  // Better Fallback using Surah boundaries
  let remaining = globalAyah;
  let sNum = 1;
  let aInSurah = 1;
  for (let i = 0; i < 114; i++) {
    if (remaining <= SURAH_AYAH_COUNTS[i]) {
      sNum = i + 1;
      aInSurah = remaining;
      break;
    }
    remaining -= SURAH_AYAH_COUNTS[i];
  }

  const startPage = SURAH_START_PAGES[sNum - 1] || 1;
  const nextSurahStartPage = sNum < 114 ? (SURAH_START_PAGES[sNum] || 604) : 604;
  
  if (startPage === nextSurahStartPage) {
    return startPage;
  }
  
  const totalAyahs = SURAH_AYAH_COUNTS[sNum - 1];
  const pageSpan = nextSurahStartPage - startPage;
  const estimatedPage = startPage + Math.floor(((aInSurah - 1) / totalAyahs) * pageSpan);
  return Math.min(604, Math.max(1, estimatedPage));
};

/**
 * Gets approximate global ayah number from page number
 * (Inverse of getApproxPageFromGlobalAyah)
 */
export const getApproxGlobalAyahFromPage = (page: number): number => {
  // 604 pages, 6236 ayahs => ~10.3 ayahs per page
  return Math.max(1, Math.min(6236, Math.floor((page - 1) * 10.3) + 1));
};

/**
 * Gets the exact first and last global ayah number for a specific page.
 * Relies on the loaded memory cache (pageIndex).
 */
export const getPageGlobalAyahRangeSync = (pageNum: number): { firstGlobal: number, lastGlobal: number } | null => {
  if (pageIndex !== null && pageIndex.size > 0) {
    const ayahs = pageIndex.get(pageNum);
    if (ayahs && ayahs.length > 0) {
      return {
        firstGlobal: ayahs[0].number,
        lastGlobal: ayahs[ayahs.length - 1].number
      };
    }
  }
  return null;
};

/**
 * Gets metadata (Surah/Ayah) from global ayah number
 * Returns { surahNumber, ayahInSurah, surahName } used by Layout/Hifz
 */
export const getMetadataFromGlobalAyah = (globalAyah: number): { surahNumber: number, ayahInSurah: number, surahName: string } => {
  let remaining = globalAyah;
  for (let i = 0; i < 114; i++) {
    if (remaining <= SURAH_AYAH_COUNTS[i]) {
      return {
        surahNumber: i + 1,
        ayahInSurah: remaining,
        surahName: SURAH_NAMES_ARABIC[i]
      };
    }
    remaining -= SURAH_AYAH_COUNTS[i];
  }
  return {
    surahNumber: 114,
    ayahInSurah: SURAH_AYAH_COUNTS[113],
    surahName: SURAH_NAMES_ARABIC[113]
  };
};

// ==========================================
// PART 1.5: OFFLINE CONTEXT HELPERS
// ==========================================

/**
 * Returns Rub info for a given page using static map.
 * This is 100% offline and instant.
 */
export const getOfflinePageContext = (page: number): { hizbQuarter: number, juz: number } => {
  // 1. Find the Hizb Quarter (Rub) that covers this page
  // We search the HIZB_QUARTER_START_PAGES array
  let rubIndex = 0;
  for (let i = 0; i < HIZB_QUARTER_START_PAGES.length; i++) {
    if (page >= HIZB_QUARTER_START_PAGES[i]) {
      rubIndex = i;
    } else {
      break;
    }
  }
  const hizbQuarter = rubIndex + 1; // 1-240

  // 2. Find Juz
  // Simple approx: each Juz is 20 pages
  // Precise: Use SURAH_START_PAGES or custom logic, but calculation is enough for display
  let juz = Math.ceil(page / 20);
  // Correction for specific boundaries (Juz 1 ends p21, Juz 30 starts p582) if needed
  if (page > 604) juz = 30; // Clamp

  return { hizbQuarter, juz };
};

/**
 * Helper to display "Rub 1, Hizb 1" in Arabic
 */
export const formatOfflineRubInfo = (hizbQuarter: number): string => {
  const hizb = Math.ceil(hizbQuarter / 4);
  const rubInHizb = (hizbQuarter - 1) % 4; // 0=Start, 1=Second, 2=Half, 3=ThreeQ

  const parts = [
    `الحزب ${hizb}`, // Digits conversion handles later
  ];

  if (rubInHizb === 0) parts.unshift('بداية');
  else if (rubInHizb === 1) parts.unshift('ربع');
  else if (rubInHizb === 2) parts.unshift('نصف');
  else if (rubInHizb === 3) parts.unshift('ثلاثة أرباع');

  return parts.join(' ');
};

// ==========================================
// PART 2: STATIC OFFLINE DATA LOADING
// (New implementation for quran-tajweed.json)
// ==========================================

// Cached data structures
let allAyahs: Ayah[] | null = null;
let pageIndex: Map<number, Ayah[]> | null = null;
let isLoading = false;
let loadPromise: Promise<void> | null = null;

// Path to bundled Quran data
const HAFS_V2_DATA_PATH = '/data/quran/hafsData_v2-0.json';

// Type for the new Hafs Data V2 items
interface HafsDataV2Item {
  id: number;
  jozz: number;
  page: number;
  sura_no: number;
  sura_name_en: string;
  sura_name_ar: string;
  line_start: number;
  line_end: number;
  aya_no: number;
  aya_text: string;
  aya_text_emlaey: string;
}

/**
 * Load the bundled Quran JSON and build page index
 * This is called once and cached for the session
 */
const loadQuranData = async (): Promise<void> => {
  // Already loaded
  if (pageIndex !== null) return;

  // Already loading - wait for it
  if (isLoading && loadPromise) {
    await loadPromise;
    return;
  }

  isLoading = true;

  loadPromise = (async () => {
    try {
      console.log('[QuranStaticData] Loading bundled Quran data (Hafs V2)...');

      const response = await fetch(HAFS_V2_DATA_PATH);

      if (!response.ok) throw new Error(`Failed to load Hafs data: ${response.status}`);

      const hafsData: HafsDataV2Item[] = await response.json();

      // Build complete Ayah objects using Hafs V2 as the sole source
      const mergedAyahs: Ayah[] = hafsData.map(item => {
        // CLEANUP: Remove the last character (custom ayah marker) from the text
        const rawText = item.aya_text || '';
        const cleanText = rawText.trim().length > 1 ? rawText.trim().slice(0, -1) : rawText;

        return {
          // IDs and numbering
          number: item.id, // Global ID
          numberInSurah: item.aya_no,
          juz: item.jozz,

          // Visuals
          page: item.page,
          text: item.aya_text_emlaey, // Use Simple Text for "text" field to avoid Distortion/Codes
          aya_text: cleanText, // The visual Uthmani text (CLEANED)
          aya_text_emlaey: item.aya_text_emlaey,

          // Layout info
          line_start: item.line_start,
          line_end: item.line_end,

          // Metadata (Defaulting to 0/false as legacy data is removed)
          manzil: 0,
          ruku: 0,
          hizbQuarter: 0,
          sajda: false,

          // Structure
          surah: {
            number: item.sura_no,
            name: item.sura_name_ar,
            englishName: item.sura_name_en,
            englishNameTranslation: item.sura_name_en, // Fallback
            revelationType: 'Meccan', // Fallback
            numberOfAyahs: 0 // Placeholder
          }
        };
      });

      allAyahs = mergedAyahs;

      // Build page index
      pageIndex = new Map<number, Ayah[]>();
      for (const ayah of mergedAyahs) {
        const pageNum = ayah.page;
        if (!pageIndex.has(pageNum)) {
          pageIndex.set(pageNum, []);
        }
        pageIndex.get(pageNum)!.push(ayah);
      }

      console.log(`[QuranStaticData] Loaded ${mergedAyahs.length} ayahs across ${pageIndex.size} pages`);

    } catch (error) {
      console.error('[QuranStaticData] Failed to load:', error);
      // Reset state so it can be retried
      allAyahs = null;
      pageIndex = null;
    } finally {
      isLoading = false;
    }
  })();

  await loadPromise;
};

/**
 * Get a specific page from the static bundled data
 * @param pageNumber Page number (1-604)
 * @returns Array of Ayahs for that page, or null if not available
 */
export const getStaticPage = async (pageNumber: number): Promise<Ayah[] | null> => {
  await loadQuranData();

  if (!pageIndex) {
    return null;
  }

  const page = pageIndex.get(pageNumber);
  return page || null;
};

/**
 * Get all ayahs (for search functionality)
 */
export const getAllAyahs = async (): Promise<Ayah[]> => {
  await loadQuranData();
  return allAyahs || [];
};

/**
 * Retrieve a specific Ayah object by its SRS ID string (e.g., "ayah_2_255" or "2:255")
 */
export const getAyahById = async (id: string): Promise<Ayah | null> => {
  await loadQuranData();
  if (!allAyahs) return null;

  const cleanId = id.replace(/^(ayah_|page_)/, '');
  const parts = cleanId.split(/[:_]/).map(Number);

  if (parts.length < 2) return null;

  const [surah, ayah] = parts;
  if (surah < 1 || surah > 114) return null;

  const globalIndex = getGlobalAyahNumber(surah, ayah);
  if (globalIndex < 1 || globalIndex > allAyahs.length) return null;

  return allAyahs[globalIndex - 1];
};


/**
 * Get total page count
 */
export const getTotalPages = async (): Promise<number> => {
  await loadQuranData();
  return pageIndex?.size || 604;
};

/**
 * Check if static data is available
 */
export const isStaticDataLoaded = (): boolean => {
  return pageIndex !== null && pageIndex.size > 0;
};

/**
 * Preload the data (call on app startup for faster initial load)
 */
export const preloadQuranData = (): void => {
  loadQuranData().catch(console.error);
};
