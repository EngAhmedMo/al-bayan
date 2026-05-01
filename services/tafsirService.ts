
import { SURAH_NAMES_ARABIC } from './quranStaticData';

export const TAFSIR_TITLES: Record<string, string> = {
    'ar.ibn-kathir': 'تفسير ابن كثير',
    'ar.jalalayn': 'تفسير الجلالين',
    'ar.muyassar': 'التفسير الميسر'
};

export const getTafsirTitle = (slug: string) => TAFSIR_TITLES[slug] || 'التفسير';

/**
 * Available Tafsir Sources
 */
export const TAFSIR_SOURCES = {
    muyassar: {
        id: 'muyassar',
        name: 'التفسير الميسر',
        description: 'تفسير مختصر وسهل للمبتدئين',
        apiEdition: 'ar.muyassar'
    },
    ibnKathir: {
        id: 'ibn-kathir',
        name: 'تفسير ابن كثير',
        description: 'من أشهر كتب التفسير بالمأثور',
        apiEdition: 'ar.ibn-kathir'
    },
    jalalayn: {
        id: 'jalalayn',
        name: 'تفسير الجلالين',
        description: 'تفسير موجز ومختصر',
        apiEdition: 'ar.jalalayn'
    }
} as const;

export type TafsirSourceId = keyof typeof TAFSIR_SOURCES;

// Optimized cache: stores surahs individually
const tafsirSurahCache: Record<string, Record<number, any>> = {};

// Load Tafsir content from chunked files
export const loadTafsirSurah = async (slug: string, surahNumber: number) => {
    // Normalizing slug to folder name
    let folderName = slug;
    if (slug === 'ar-tafsir-ibn-kathir') folderName = 'ar.ibn-kathir';

    // Initialize cache for this book if not exists
    if (!tafsirSurahCache[folderName]) {
        tafsirSurahCache[folderName] = {};
    }

    // Check if surah is already in cache
    if (!tafsirSurahCache[folderName][surahNumber]) {
        try {
            // Fetch individual surah JSON
            const response = await fetch(`/data/tafsir/${folderName}/${surahNumber}.json`);
            if (!response.ok) throw new Error('Failed to load tafsir');
            
            const surahData = await response.json();
            tafsirSurahCache[folderName][surahNumber] = surahData;
            console.log(`[TafsirService] Loaded chunk: ${folderName}/${surahNumber}.json`);
        } catch (e) {
            console.error(`Failed to load chunk ${surahNumber} for ${folderName}`, e);
            return null;
        }
    }

    const surahData = tafsirSurahCache[folderName][surahNumber];

    // Standardize return structure
    return surahData ? {
        ...surahData,
        // Fallback to static Arabic name if JSON name is missing
        name: surahData.name || SURAH_NAMES_ARABIC[surahNumber - 1] || `Surah ${surahNumber}`
    } : null;
};

// Load a single ayah tafsir from chunked files
export const loadSingleAyahTafsir = async (slug: string, surahNumber: number, ayahNumber: number): Promise<string | null> => {
    const surahData = await loadTafsirSurah(slug, surahNumber);
    if (!surahData || !surahData.ayahs) return null;

    const ayah = surahData.ayahs.find((a: any) => a.numberInSurah === ayahNumber);
    if (!ayah) return null;

    return ayah.text || null;
};
