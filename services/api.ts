
import { Surah, Ayah, TafsirResponse, QuranSearchResult, Reciter, PrayerData } from '../types';
import { normalizeArabic, stripDiacriticsAndPrefixes, toArabicDigits } from './normalization';
import { getBenefitHistory, addToBenefitHistory, clearBenefitHistory } from './storage';
import { SURAH_AYAH_COUNTS, TOTAL_QURAN_AYAHS, getMetadataFromGlobalAyah, OFFLINE_SURAHS } from './quranStaticData';
import { loadSingleAyahTafsir } from './tafsirService';

// --- Quran Service ---

const API_BASE = 'https://api.alquran.cloud/v1';
const surahCache: Surah[] = [];
// Updated page cache to include reciter ID in key to avoid stale audio
const pageCache: Record<string, Ayah[]> = {};

// Cache for full Quran text to enable fuzzy search client-side
let fullQuranCache: { surah: Surah; ayah: Ayah }[] | null = null;

// Extended Reciter Interface
export interface ReciterWithImage extends Reciter {
  image?: string;
  source: 'islamic-network' | 'everyayah' | 'mp3quran'; // Support multiple backends
  folder?: string; // For EveryAyah backend
  baseUrl?: string; // For MP3Quran backend
  bitrate?: number; // For Islamic Network backend
}

// FIXED: Replaced broken Khalid Al-Jaleel with Mishary Alafasy (Stable Source)
// ADDED: 9 New Reciters as requested
export const RECITERS: ReciterWithImage[] = [
  {
    id: 'ar.minshawi_murattal',
    name: 'المنشاوي (مرتل)',
    image: 'https://static.qurancentral.com/authors/muhammad-siddiq-al-minshawi.jpg',
    source: 'everyayah',
    folder: 'Minshawy_Murattal_128kbps'
  },
  {
    id: 'ar.minshawi',
    name: 'المنشاوي (مجود)',
    image: 'https://static.qurancentral.com/authors/muhammad-siddiq-al-minshawi.jpg',
    source: 'everyayah',
    folder: 'Minshawy_Mujawwad_192kbps'
  },
  {
    id: 'ar.yasseraddosari',
    name: 'ياسر الدوسري',
    image: 'https://static.qurancentral.com/authors/yasser-al-dosari.jpg',
    source: 'everyayah',
    folder: 'Yasser_Ad-Dussary_128kbps'
  },
  {
    id: 'ar.faresabbad',
    name: 'فارس عباد',
    image: 'https://static.qurancentral.com/authors/fares-abbad.jpg',
    source: 'everyayah',
    folder: 'Fares_Abbad_64kbps'
  },
  {
    id: 'ar.ghamdi',
    name: 'سعد الغامدي',
    image: 'https://static.qurancentral.com/authors/saad-al-ghamdi.jpg',
    source: 'everyayah',
    folder: 'Ghamadi_40kbps'
  },
  {
    id: 'ar.abdulbasitmurattal',
    name: 'عبد الباسط (مرتل)',
    image: 'https://static.qurancentral.com/authors/abdul-basit-abdus-samad.jpg',
    source: 'everyayah',
    folder: 'Abdul_Basit_Murattal_192kbps'
  },
  {
    id: 'ar.abdulbasit_mujawwad',
    name: 'عبد الباسط (مجود)',
    image: 'https://static.qurancentral.com/authors/abdul-basit-abdus-samad.jpg',
    source: 'everyayah',
    folder: 'Abdul_Basit_Mujawwad_128kbps'
  },
  {
    id: 'ar.husary',
    name: 'محمود خليل الحصري',
    image: 'https://static.qurancentral.com/authors/mahmoud-khalil-al-hussary.jpg',
    source: 'everyayah',
    folder: 'Husary_128kbps'
  },
  {
    id: 'ar.husary_mujawwad',
    name: 'الحصري (مجود)',
    image: 'https://static.qurancentral.com/authors/mahmoud-khalil-al-hussary.jpg',
    source: 'everyayah',
    folder: 'Husary_Mujawwad_64kbps'
  },
  {
    id: 'ar.abdulrahmansudais',
    name: 'عبدالرحمن السديس',
    image: 'https://static.qurancentral.com/authors/abdul-rahman-al-sudais.jpg',
    source: 'everyayah',
    folder: 'Abdurrahmaan_As-Sudais_192kbps'
  },
  {
    id: 'ar.hudhaify',
    name: 'علي الحذيفي',
    image: 'https://static.qurancentral.com/authors/ali-al-huthaify.jpg',
    source: 'everyayah',
    folder: 'Hudhaify_128kbps'
  },
  {
    id: 'ar.mahermuaiqly',
    name: 'ماهر المعيقلي',
    image: 'https://static.qurancentral.com/authors/maher-al-mueaqly.jpg',
    source: 'everyayah',
    folder: 'MaherAlMuaiqly128kbps'
  },
  {
    id: 'ar.banna',
    name: 'محمود علي البنا',
    image: 'https://static.qurancentral.com/authors/mahmoud-ali-al-banna.jpg',
    source: 'everyayah',
    folder: 'mahmoud_ali_al_banna_32kbps'
  },
  {
    id: 'ar.tablawi',
    name: 'محمد الطبلاوي',
    image: 'https://static.qurancentral.com/authors/mohamed-tablawi.jpg',
    source: 'everyayah',
    folder: 'Mohammad_al_Tablaway_128kbps'
  },
  {
    id: 'ar.jibreel',
    name: 'محمد جبريل',
    image: 'https://static.qurancentral.com/authors/muhammad-jibreel.jpg',
    source: 'everyayah',
    folder: 'Muhammad_Jibreel_128kbps'
  },
  {
    id: 'ar.ayyoub',
    name: 'محمد أيوب',
    image: 'https://static.qurancentral.com/authors/muhammad-ayyoub.jpg',
    source: 'everyayah',
    folder: 'Muhammad_Ayyoub_128kbps'
  },
  {
    id: 'ar.naina',
    name: 'أحمد نعينع',
    image: 'https://static.qurancentral.com/authors/ahmed-neana.jpg',
    source: 'everyayah',
    folder: 'Ahmed_Neana_128kbps'
  },
  {
    id: 'ar.juhany',
    name: 'عبدالله الجهني',
    image: 'https://static.qurancentral.com/authors/adbullah-awad-al-juhany.jpg',
    source: 'everyayah',
    folder: 'Abdullaah_3awwaad_Al-Juhaynee_128kbps'
  },
  {
    id: 'ar.alijaber',
    name: 'علي جابر',
    image: 'https://static.qurancentral.com/authors/ali-jaber.jpg',
    source: 'everyayah',
    folder: 'Ali_Jaber_64kbps'
  },
  {
    id: 'ar.saudshuraim',
    name: 'سعود الشريم',
    image: 'https://static.qurancentral.com/authors/saud-al-shuraim.jpg',
    source: 'everyayah',
    folder: 'Saood_ash-Shuraym_128kbps'
  },
  {
    id: 'ar.ahmedajamy',
    name: 'أحمد العجمي',
    image: 'https://static.qurancentral.com/authors/ahmed-al-ajmi.jpg',
    source: 'everyayah',
    folder: 'Ahmed_ibn_Ali_al-Ajamy_128kbps_ketaballah.net'
  },
  {
    id: 'ar.shaatree',
    name: 'أبو بكر الشاطري',
    image: 'https://static.qurancentral.com/authors/abu-bakr-al-shatri.jpg',
    source: 'everyayah',
    folder: 'Abu_Bakr_Ash-Shaatree_128kbps'
  }
];

// Helper to construct Audio URL based on reciter config
export const getAudioUrl = (reciterId: string, globalAyahNumber: number): string => {
  // Ensure we have a valid ID, default to Minshawi Murattal
  const targetId = reciterId || 'ar.minshawi_murattal';

  const reciter = RECITERS.find(r => r.id === targetId);
  const activeReciter = reciter || RECITERS[0];

  if (activeReciter.source === 'everyayah' && activeReciter.folder) {
    // EveryAyah logic: requires padded Surah (001) and Ayah (001) numbers
    const { surahNumber, ayahInSurah } = getMetadataFromGlobalAyah(globalAyahNumber);
    const s = surahNumber.toString().padStart(3, '0');
    const a = ayahInSurah.toString().padStart(3, '0');
    return `https://everyayah.com/data/${activeReciter.folder}/${s}${a}.mp3`;
  } else if (activeReciter.source === 'mp3quran' && activeReciter.baseUrl) {
    // MP3Quran Logic: Full Surah Files (001.mp3)
    // NOTE: This plays the WHOLE Surah. Verse-seeking requires advanced logic not supported by simple URL.
    const { surahNumber } = getMetadataFromGlobalAyah(globalAyahNumber);
    const s = surahNumber.toString().padStart(3, '0');
    return `${activeReciter.baseUrl}/${s}.mp3`;
  } else {
    // Islamic Network logic fallback (if any reciter uses it)
    const bitrate = activeReciter.bitrate || 64;
    return `https://cdn.islamic.network/quran/audio/${bitrate}/${activeReciter.id}/${globalAyahNumber}.mp3`;
  }
};

export const fetchSurahs = async (): Promise<Surah[]> => {
  if (surahCache.length === 0) {
    surahCache.push(...OFFLINE_SURAHS as Surah[]);
  }
  return surahCache;
};

export const fetchPage = async (pageNumber: number, reciterId: string = 'ar.minshawi_murattal'): Promise<Ayah[]> => {
  // Memory cache check first (fastest)
  const cacheKey = `${pageNumber}-${reciterId}`;
  if (pageCache[cacheKey]) return pageCache[cacheKey];

  // Dynamic import to avoid circular dependency
  const { fetchPageOffline } = await import('./quranOfflineCache');

  try {
    // Use offline-first cache (IndexedDB -> API)
    const ayahs = await fetchPageOffline(pageNumber, reciterId);
    if (ayahs.length > 0) {
      pageCache[cacheKey] = ayahs; // Also keep in memory
      return ayahs;
    }
  } catch (e) {
    console.error(`Failed to fetch page ${pageNumber}`, e);
  }

  return [];
};

export const fetchTafsir = async (surahNumber: number, ayahNumberInSurah: number): Promise<TafsirResponse | null> => {
  try {
    const text = await loadSingleAyahTafsir('ar.muyassar', surahNumber, ayahNumberInSurah);
    if (!text) return null;

    return {
      text,
      edition: { identifier: 'ar.muyassar', name: 'التفسير الميسر', englishName: 'ar.muyassar', language: 'ar' },
      surah: { number: surahNumber },
      numberInSurah: ayahNumberInSurah
    };
  } catch (e) {
    console.error("Failed to fetch Tafsir", e);
    return null;
  }
};

export const fetchPrayerTimes = async (lat: number, lng: number): Promise<PrayerData | null> => {
  try {
    const date = Math.floor(Date.now() / 1000);
    const res = await fetch(`https://api.aladhan.com/v1/timings/${date}?latitude=${lat}&longitude=${lng}&method=5`);
    const json = await res.json();

    if (json.code === 200 && json.data) {
      return json.data;
    }
  } catch (e) {
    console.error("Failed to fetch prayer times", e);
  }
  return null;
};

// Fetch tomorrow's prayer times for reliable Fajr scheduling
// This is critical because between midnight and app opening, we need tomorrow's Fajr time
export const fetchTomorrowPrayerTimes = async (lat: number, lng: number): Promise<PrayerData | null> => {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowTimestamp = Math.floor(tomorrow.getTime() / 1000);
    const res = await fetch(`https://api.aladhan.com/v1/timings/${tomorrowTimestamp}?latitude=${lat}&longitude=${lng}&method=5`);
    const json = await res.json();

    if (json.code === 200 && json.data) {
      return json.data;
    }
  } catch (e) {
    console.error("Failed to fetch tomorrow's prayer times", e);
  }
  return null;
};

// --- Daily Benefit Logic ---
export interface DailyBenefit {
  ayah: Ayah;
  tafsir: string;
  surahName: string;
  id: string; // Unique ID (surah:ayah)
}

const FALLBACK_BENEFITS: DailyBenefit[] = [
  {
    id: "39:53",
    ayah: { number: 1, text: "قُلْ يَا عِبَادِيَ الَّذِينَ أَسْرَفُوا عَلَى أَنفُسِهِمْ لَا تَقْنَطُوا مِن رَّحْمَةِ اللَّهِ ۚ إِنَّ اللَّهَ يَغْفِرُ الذُّنُوبَ جَمِيعًا ۚ إِنَّهُ هُوَ الْغَفُورُ الرَّحِيمُ", numberInSurah: 53, juz: 24, manzil: 6, page: 464, ruku: 4, hizbQuarter: 3, sajda: false },
    surahName: "سورة الزمر",
    tafsir: "قل -أيها الرسول- لعبادي الذين تمادَوا في المعاصي، وأسرفوا على أنفسهم بإتيان ما يوبقها: لا تيأسوا من رحمة الله؛ لكثرة ذنوبكم، إن الله يغفر الذنوب جميعًا لمن تاب منها ورجع عنها مهما كانت، إنه هو الغفور لذنوب التائبين من عباده، الرحيم بهم."
  },
];

const getUniqueRandomCoordinate = (): { surah: number, ayah: number } | null => {
  const history = getBenefitHistory();
  if (history.length >= TOTAL_QURAN_AYAHS) {
    clearBenefitHistory();
  }
  for (let i = 0; i < 50; i++) {
    const surah = Math.floor(Math.random() * 114) + 1;
    const maxAyah = SURAH_AYAH_COUNTS[surah - 1] || 1;
    const ayah = Math.floor(Math.random() * maxAyah) + 1;
    const id = `${surah}:${ayah}`;
    if (!history.includes(id)) return { surah, ayah };
  }
  return { surah: 1, ayah: 1 };
};

export const fetchRandomBenefit = async (): Promise<DailyBenefit> => {
  try {
    const coords = getUniqueRandomCoordinate();
    if (!coords) throw new Error("No unique verses available");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const ayahRes = await fetch(`${API_BASE}/ayah/${coords.surah}:${coords.ayah}/quran-uthmani`, { signal: controller.signal });
    const ayahJson = await ayahRes.json();

    if (ayahJson.code !== 200 || !ayahJson.data) throw new Error('API Error fetching Ayah');
    const ayahData = ayahJson.data;

    const tafsirRes = await fetch(`${API_BASE}/ayah/${coords.surah}:${coords.ayah}/ar.muyassar`, { signal: controller.signal });
    const tafsirJson = await tafsirRes.json();

    clearTimeout(timeoutId);

    const tafsirText = (tafsirJson.code === 200 && tafsirJson.data)
      ? (tafsirJson.data.text || tafsirJson.data[0]?.text || 'التفسير غير متاح حالياً')
      : 'التفسير غير متاح حالياً';

    const benefit: DailyBenefit = {
      id: `${coords.surah}:${coords.ayah}`,
      ayah: ayahData,
      surahName: ayahData.surah.name,
      tafsir: tafsirText
    };

    addToBenefitHistory(benefit.id);
    return benefit;

  } catch (e) {
    const randomIndex = Math.floor(Math.random() * FALLBACK_BENEFITS.length);
    return FALLBACK_BENEFITS[randomIndex];
  }
};

/**
 * STRICT SEARCH ALGORITHM
 * 
 * Rules:
 * 1. Match Exact Word.
 * 2. Match Word with standard Prefix (Wa, Fa, Al...).
 * 3. Match Word with standard Suffix (Plural markers, pronouns).
 * 4. REJECT substring matches in the middle of words (e.g. "amn" in "qawwamuna").
 */

// Common Arabic Prefixes that attach to words
const ARABIC_PREFIXES = [
  'ال', 'و', 'ف', 'ب', 'ك', 'ل', 'لل',
  'وال', 'فال', 'كال', 'بال', 'ول', 'فل', 'وب', 'وك', 'فس', 'وس', 'أف', 'أو'
];

// Common Arabic Suffixes (Pronouns, Plurals, Taa Marbuta)
const ARABIC_SUFFIXES = [
  'ة', 'ه', 'ها', 'هم', 'هما', 'هن', // Pronouns / Taa Marbuta
  'ك', 'كم', 'كما', 'كن', // Pronouns (Ka)
  'نا', 'ي', 'ني', // Pronouns (We, Me)
  'ون', 'ين', 'ان', 'ات', // Plurals / Duals
  'وا', 'تم', 'تما', 'تن', // Verbs
  'ت'
];

/**
 * Checks if a word from the Ayah matches the Query Term using strict morphological rules.
 */
export const isStrictMatch = (ayahWord: string, queryTerm: string): boolean => {
  const normAyah = normalizeArabic(ayahWord);
  const normQuery = normalizeArabic(queryTerm);

  // 1. Exact Match
  if (normAyah === normQuery) return true;

  // 2. Remove Prefixes from Ayah Word and check if it STARTS with query
  // This prevents "Amn" matching inside "Qawwamuna" (middle match)
  let strippedAyah = normAyah;

  // Try to strip one valid prefix (longest match first)
  // We iterate prefixes sorted by length desc to catch "wal" before "w"
  const sortedPrefixes = [...ARABIC_PREFIXES].sort((a, b) => b.length - a.length);

  for (const prefix of sortedPrefixes) {
    if (strippedAyah.startsWith(prefix)) {
      strippedAyah = strippedAyah.slice(prefix.length);
      break; // Only strip the first valid prefix group found
    }
  }

  // After stripping prefix, does it match exactly?
  if (strippedAyah === normQuery) return true;

  // Does it START with the query? (e.g. Ayah: "Amanu", Query: "Amn")
  if (strippedAyah.startsWith(normQuery)) {
    // If it starts with the query, the REMAINDER must be a valid suffix.
    // This prevents "Jinn" matching "Jannah" (unless Taa Marbuta is considered a suffix, which is acceptable).
    const remainder = strippedAyah.slice(normQuery.length);

    // If remainder is empty, it's a match (already covered above).
    if (remainder.length === 0) return true;

    // Check if remainder is a valid suffix
    // We sort suffixes by length desc to match complex suffixes first if needed
    const sortedSuffixes = [...ARABIC_SUFFIXES].sort((a, b) => b.length - a.length);
    const isValidSuffix = sortedSuffixes.some(s => s === remainder);

    return isValidSuffix;
  }

  return false;
};

export const searchQuranText = async (query: string): Promise<QuranSearchResult[]> => {
  const normalizedQuery = normalizeArabic(query);
  if (!normalizedQuery) return [];

  // Split query into distinct terms
  const queryTerms = normalizedQuery.split(/\s+/).filter(t => t.length > 0);

  if (!fullQuranCache) {
    try {
      const res = await fetch(`/data/quran/hafsData_v2-0.json`);
      const data = await res.json();
      if (data && Array.isArray(data)) {
        fullQuranCache = [];
        data.forEach((ayahData: any) => {
          const surahMeta = { 
            number: ayahData.sura_no, 
            name: ayahData.sura_name_ar, 
            englishName: ayahData.sura_name_en 
          };
          
          fullQuranCache!.push({
            surah: surahMeta as any,
            ayah: { 
              number: ayahData.id,
              numberInSurah: ayahData.aya_no,
              text: ayahData.aya_text_emlaey,
              page: ayahData.page || -1 
            } as any
          });
        });
      }
    } catch (e) { console.error("Failed to load local full quran for search", e); }
  }

  if (fullQuranCache) {
    const results: QuranSearchResult[] = [];

    for (const item of fullQuranCache) {
      const normalizedAyah = normalizeArabic(item.ayah.text);

      // Check: Are ALL query terms present?
      // We use a hybrid approach: Strict Morphological Match OR Simple Substring Match
      const isMatch = queryTerms.every(qTerm => {
        // 1. Try Strict Match on Words (Preferred)
        const ayahWords = item.ayah.text.split(/\s+/);
        const hasStrictMatch = ayahWords.some(ayahWord => isStrictMatch(ayahWord, qTerm));
        if (hasStrictMatch) return true;

        // 2. Fallback: Simple Substring Match (e.g. user searches part of a word)
        return normalizedAyah.includes(qTerm);
      });

      if (isMatch) {
        // Determine Match Type for UI Highlighting/Ranking
        const isExactPhrase = normalizedAyah.includes(normalizedQuery);

        results.push({
          surah: item.surah,
          ayah: item.ayah,
          matchType: isExactPhrase ? 'exact' : 'partial'
        });
      }
    }
    return results;
  }
  return [];
};
