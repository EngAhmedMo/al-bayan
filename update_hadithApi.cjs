const fs = require('fs');
let code = fs.readFileSync('services/hadithApi.ts', 'utf8');

// 1. Add _normalizedArabic to Hadith interface
code = code.replace(
    'chapter?: string;\n}',
    'chapter?: string;\n    _normalizedArabic?: string;\n}'
);

// 2. Update fetchHadiths to pre-compute _normalizedArabic
const fetchHadithsStart = code.indexOf('        hadiths = hadiths.map((h: any, idx: number) => ({');
const fetchHadithsEnd = code.indexOf('        }));\n\n        processedCache.set(bookId, hadiths);');

if (fetchHadithsStart !== -1 && fetchHadithsEnd !== -1) {
    const oldFetchMap = code.substring(fetchHadithsStart, fetchHadithsEnd + 12);
    const newFetchMap = `        hadiths = hadiths.map((h: any, idx: number) => {
            const arabic = h.arabic || h.text || '';
            return {
                id: h.id || idx + 1,
                hadithnumber: h.hadithnumber || h.id || idx + 1,
                arabic: arabic,
                text: arabic,
                _normalizedArabic: normalizeArabic(arabic),
                chapterId: h.chapterId,
                bookId: Number(h.bookId) || 0,
                english: h.english,
                grades: h.grades,
                reference: h.reference,
                chapter: h.chapter
            };
        });`;
    code = code.replace(oldFetchMap, newFetchMap);
}

// 3. Update calculateMatchScore signature and logic
const matchScoreStart = code.indexOf('const calculateMatchScore = (text: string, query: string):');
const matchScoreEnd = code.indexOf('export const searchAllHadiths = async');

if (matchScoreStart !== -1 && matchScoreEnd !== -1) {
    const oldMatchScore = code.substring(matchScoreStart, matchScoreEnd);
    const newMatchScore = `const calculateMatchScore = (normText: string, normQuery: string): { score: number; type: 'exact' | 'partial' | 'fuzzy' } => {
    if (normText.includes(normQuery)) {
        return { score: 100, type: 'exact' };
    }

    const queryWords = normQuery.split(/\\s+/).filter(w => w.length > 0);
    const textWords = normText.split(/\\s+/).filter(w => w.length > 0);

    if (queryWords.length === 0) return { score: 0, type: 'fuzzy' };

    let consecutiveMatch = true;
    let lastFoundIndex = -1;

    for (const qWord of queryWords) {
        let found = false;
        for (let i = lastFoundIndex + 1; i < textWords.length; i++) {
            if (isStrictMatch(textWords[i], qWord)) {
                lastFoundIndex = i;
                found = true;
                break;
            }
        }
        if (!found) {
            consecutiveMatch = false;
            break;
        }
    }

    if (consecutiveMatch) {
        return { score: 90, type: 'exact' };
    }

    let matchedWords = 0;
    const matchedIndices: number[] = [];

    for (const qWord of queryWords) {
        for (let i = 0; i < textWords.length; i++) {
            if (isStrictMatch(textWords[i], qWord) && !matchedIndices.includes(i)) {
                matchedWords++;
                matchedIndices.push(i);
                break;
            }
        }
    }

    if (matchedWords === queryWords.length) {
        if (matchedIndices.length > 1) {
            const spread = Math.max(...matchedIndices) - Math.min(...matchedIndices);
            const proximityBonus = Math.max(0, 5 - Math.floor(spread / 3));
            return { score: 80 + proximityBonus, type: 'partial' };
        }
        return { score: 80, type: 'partial' };
    }

    if (matchedWords > 0 && (matchedWords === queryWords.length || (queryWords.length >= 3 && matchedWords >= queryWords.length - 1))) {
        const matchRatio = matchedWords / queryWords.length;
        return { score: 50 + Math.floor(matchRatio * 29), type: 'fuzzy' };
    }

    return { score: 0, type: 'fuzzy' };
};

`;
    code = code.replace(oldMatchScore, newMatchScore);
}

// 4. Update searchAllHadiths to use concurrent fetching and normalized text
const searchAllStart = code.indexOf('export const searchAllHadiths = async');
const searchAllEnd = code.indexOf('return results\n        .sort');

if (searchAllStart !== -1 && searchAllEnd !== -1) {
    const oldSearchAll = code.substring(searchAllStart, searchAllEnd);
    const newSearchAll = `export const searchAllHadiths = async (query: string, maxResults: number = 50): Promise<SearchResult[]> => {
    if (!query || query.trim().length < 2) return [];

    const results: SearchResult[] = [];
    const books = Object.entries(BOOK_MAP).sort((a, b) => a[1].priority - b[1].priority);
    const normQuery = normalizeArabic(query);

    const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

    // Start fetching all books concurrently
    const fetchPromises = books.map(async ([bookId, book]) => {
        try {
            const hadiths = await fetchHadiths(bookId);
            return { bookId, book, hadiths };
        } catch (e) {
            console.error(\`Error fetching book \${bookId}:\`, e);
            return null;
        }
    });

    for (const promise of fetchPromises) {
        const result = await promise;
        if (!result) continue;
        
        const { bookId, book, hadiths } = result;
        let checkCount = 0;

        for (const hadith of hadiths) {
            const normText = hadith._normalizedArabic || normalizeArabic(hadith.arabic || hadith.text || '');
            const { score, type } = calculateMatchScore(normText, normQuery);

            if (score > 0) {
                results.push({
                    hadith,
                    bookId,
                    bookName: book.name,
                    matchScore: score,
                    matchType: type
                });
            }
            
            checkCount++;
            if (checkCount % 1000 === 0) {
                await yieldToMain();
            }
        }
    }

    `;
    code = code.replace(oldSearchAll, newSearchAll);
}

fs.writeFileSync('services/hadithApi.ts', code);
console.log('Successfully updated hadithApi.ts');
