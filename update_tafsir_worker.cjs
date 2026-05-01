const fs = require('fs');
let code = fs.readFileSync('services/tafsirSearchWorker.ts', 'utf8');

const strictMatchLogic = `
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
`;

code = code.replace(
  '// Resolve the URL-friendly slug to the folder name used in chunked files',
  strictMatchLogic + '\n// Resolve the URL-friendly slug to the folder name used in chunked files'
);

const searchLoopOldStart = code.indexOf('        for (const surah of cachedTafsirData.surahs) {');
const searchLoopOldEnd = code.indexOf('        self.postMessage({ id, results, status: \'success\' });');
const oldSearchLoop = code.substring(searchLoopOldStart, searchLoopOldEnd);

const newSearchLoop = `        for (const surah of cachedTafsirData.surahs) {
            if (matchCount >= MAX_RESULTS) break;

            for (const ayah of surah.ayahs) {
                const tafsirText: string = ayah.text || '';
                const normTafsir = normalizeArabic(tafsirText);

                // Hybrid approach: Strict morphological match OR exact phrase substring match
                const isMatch = queryTerms.every(qTerm => {
                    // Try strict match on words
                    const tafsirWords = tafsirText.split(/\\s+/);
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

`;

code = code.replace(oldSearchLoop, newSearchLoop);

fs.writeFileSync('services/tafsirSearchWorker.ts', code);
console.log('Successfully updated tafsirSearchWorker.ts');
