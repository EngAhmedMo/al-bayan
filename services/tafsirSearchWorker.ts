// Web Worker for searching Tafsir books in the background.
// Uses the chunked file architecture (114 small files per book) instead of one large 15MB file.
// This prevents the main thread from freezing and avoids serving a massive JSON to the browser.

let cachedTafsirData: { surahs: any[] } | null = null;
let cachedQuranData: any[] | null = null;
let currentSlug: string | null = null;

// Arabic text normalization (identical to the main thread for consistent results)
const normalizeArabic = (text: string) => {
    if (!text) return '';
    return text
        .replace(/[\u064B-\u065F\u0670]/g, '') // Remove all diacritics (Harakat)
        .replace(/[إأآا]/g, 'ا')               // Normalize Alif variants
        .replace(/ة/g, 'ه')                    // Normalize Taa Marbuta
        .replace(/ى/g, 'ي')                    // Normalize Alif Maqsura
        .replace(/ؤ/g, 'و')                    // Normalize Waw Hamza
        .replace(/ئ/g, 'ي');                   // Normalize Yaa Hamza
};


const ARABIC_PREFIXES = [
  'ال', 'و', 'ف', 'ب', 'ك', 'ل', 'لل',
  'وال', 'فال', 'كال', 'بال', 'ول', 'فل', 'وب', 'وك', 'فس', 'وس', 'أف', 'أو'
];

const ARABIC_SUFFIXES = [
  'ة', 'ه', 'ها', 'هم', 'هما', 'هن', 
  'ك', 'كم', 'كما', 'كن', 
  'نا', 'ي', 'ني', 
  'ون', 'ين', 'ان', 'ات', 
  'وا', 'تم', 'تما', 'تن', 
  'ت'
];

const isStrictMatch = (ayahWord: string, queryTerm: string): boolean => {
  const normAyah = normalizeArabic(ayahWord);
  const normQuery = normalizeArabic(queryTerm);

  if (normAyah === normQuery) return true;

  let strippedAyah = normAyah;
  const sortedPrefixes = [...ARABIC_PREFIXES].sort((a, b) => b.length - a.length);

  for (const prefix of sortedPrefixes) {
    if (strippedAyah.startsWith(prefix)) {
      strippedAyah = strippedAyah.slice(prefix.length);
      break; 
    }
  }

  if (strippedAyah === normQuery) return true;

  if (strippedAyah.startsWith(normQuery)) {
    const remainder = strippedAyah.slice(normQuery.length);
    if (remainder.length === 0) return true;
    const sortedSuffixes = [...ARABIC_SUFFIXES].sort((a, b) => b.length - a.length);
    return sortedSuffixes.some(s => s === remainder);
  }

  return false;
};

// Resolve the URL-friendly slug to the folder name used in chunked files
const resolveSlugToFolder = (slug: string): string => {
    if (slug === 'ar-tafsir-ibn-kathir') return 'ar.ibn-kathir';
    return slug;
};

// Load all 114 chunked surah files in parallel for the given book
const loadAllChunks = async (folderName: string): Promise<{ surahs: any[] }> => {
    const TOTAL_SURAHS = 114;

    // Fetch all 114 chunks simultaneously
    const surahPromises = Array.from({ length: TOTAL_SURAHS }, (_, i) =>
        fetch(`${import.meta.env.BASE_URL}data/tafsir/${folderName}/${i + 1}.json`).then(r => {
            if (!r.ok) throw new Error(`Failed chunk ${i + 1} for ${folderName}`);
            return r.json();
        })
    );

    const surahChunks = await Promise.all(surahPromises);

    // Merge all chunks into a unified structure
    const surahs = surahChunks.map((chunk, i) => ({
        number: i + 1,
        name: chunk.name || chunk.englishName || `Surah ${i + 1}`,
        ayahs: chunk.ayahs || []
    }));

    return { surahs };
};

self.onmessage = async (e: MessageEvent) => {
    const { query, slug, id } = e.data;

    if (!query || !slug) {
        self.postMessage({ id, results: [], error: 'Invalid query or slug' });
        return;
    }

    try {
        const folderName = resolveSlugToFolder(slug);

        // Load and cache data — only re-fetches when the book changes
        if (currentSlug !== slug || !cachedTafsirData || !cachedQuranData) {
            // Post a "loading" status so the UI can show a progress indicator
            self.postMessage({ id, status: 'loading', results: [] });

            const quranPromise = cachedQuranData 
                ? Promise.resolve(cachedQuranData) 
                : fetch(`${import.meta.env.BASE_URL}data/quran/hafsData_v2-0.json`).then(r => r.json());

            const [tafsirData, quranData] = await Promise.all([
                loadAllChunks(folderName),
                quranPromise
            ]);

            cachedTafsirData = tafsirData;
            cachedQuranData = quranData;
            currentSlug = slug;
        }

        const normalizedQuery = normalizeArabic(query);
        const queryTerms = normalizedQuery.split(/\s+/).filter(t => t.length > 1);

        if (queryTerms.length === 0) {
            self.postMessage({ id, results: [], status: 'success' });
            return;
        }

        const results: any[] = [];
        let matchCount = 0;
        const MAX_RESULTS = 100;

        for (const surah of cachedTafsirData.surahs) {
            if (matchCount >= MAX_RESULTS) break;

            for (const ayah of surah.ayahs) {
                const tafsirText: string = ayah.text || '';
                const normTafsir = normalizeArabic(tafsirText);

                // Hybrid approach: Strict morphological match OR exact phrase substring match
                const isMatch = queryTerms.every(qTerm => {
                    // Try strict match on words
                    const tafsirWords = tafsirText.split(/\s+/);
                    const hasStrictMatch = tafsirWords.some(word => isStrictMatch(word, qTerm));
                    if (hasStrictMatch) return true;

                    // Fallback to substring
                    return normTafsir.includes(qTerm);
                });

                if (isMatch) {
                    const isExactPhrase = normTafsir.includes(normalizedQuery);
                    
                    const firstTermIndex = normTafsir.indexOf(queryTerms[0]);
                    let snippet = tafsirText;

                    if (firstTermIndex > -1 && tafsirText.length > 160) {
                        const start = Math.max(0, firstTermIndex - 60);
                        const end = Math.min(tafsirText.length, firstTermIndex + 120);
                        snippet =
                            (start > 0 ? '... ' : '') +
                            tafsirText.substring(start, end) +
                            (end < tafsirText.length ? ' ...' : '');
                    } else if (tafsirText.length > 160) {
                        snippet = tafsirText.substring(0, 160) + '...';
                    }

                    const quranAyah = cachedQuranData?.find(
                        (a: any) => a.sura_no === surah.number && a.aya_no === ayah.numberInSurah
                    );
                    const quranText = quranAyah?.aya_text_emlaey || quranAyah?.aya_text || '';

                    results.push({
                        surah: {
                            number: surah.number,
                            name: surah.name
                        },
                        ayah: {
                            numberInSurah: ayah.numberInSurah,
                            text: quranText
                        },
                        snippet,
                        matchType: isExactPhrase ? 'exact' : 'partial'
                    });

                    matchCount++;
                    if (matchCount >= MAX_RESULTS) break;
                }
            }
        }
        
        // Sort results: exact matches first
        results.sort((a, b) => {
            if (a.matchType === 'exact' && b.matchType !== 'exact') return -1;
            if (b.matchType === 'exact' && a.matchType !== 'exact') return 1;
            return 0;
        });

        self.postMessage({ id, results, status: 'success' });

    } catch (error: any) {
        self.postMessage({ id, results: [], error: error.message });
    }
};
