// Hadith API Service - Using Local JSON Files + Professional Arabic Search
// Source: AhmedBaset/hadith-json (https://github.com/AhmedBaset/hadith-json)
// Total: 50,884 hadiths from 17 books - OFFLINE READY

import { normalizeArabic } from './normalization';

// ==================== TYPES ====================

export interface Hadith {
    id: number;
    hadithnumber?: number;
    arabicnumber?: number;
    chapterId?: number;
    bookId?: number;
    arabic: string;
    text?: string;
    english?: { narrator: string; text: string; };
    grades?: { name: string; grade: string; }[];
    reference?: { book: number; hadith: number; };
    chapter?: string;
}

export interface HadithBook {
    id: string;
    name: string;
    arabicName: string;
    count: number;
    author?: string;
    description?: string;
}

export interface SearchResult {
    hadith: Hadith;
    bookId: string;
    bookName: string;
    matchScore: number;
    matchType: 'exact' | 'partial' | 'fuzzy';
}

// ==================== ARABIC SEARCH CONSTANTS ====================
// Same as Quran search for consistency

const ARABIC_PREFIXES = [
    // 3-char compound prefixes (must come first — longest match first)
    'وال', 'فال', 'بال', 'كال',
    // 2-char prefixes
    'لل', 'ول', 'فل', 'وب', 'وك', 'فس', 'وس',
    // 1-char prefixes
    'ال', 'و', 'ف', 'ب', 'ك', 'ل', 'س'
];

const ARABIC_SUFFIXES = [
    'ون', 'ين', 'ان', 'ات', 'وا', 'ها', 'هم', 'هن', 'كم', 'كن', 'نا',
    'ة', 'ه', 'ي', 'ا', 'ك', 'ت', 'ن'
];

// ==================== BOOK CONFIGURATION ====================

interface BookConfig {
    url: string; // Changed from 'data' to 'url'
    name: string;
    arabicName: string;
    count: number;
    author: string;
    description: string;
    priority: number; // Search priority (lower = searched first)
}

const BOOK_MAP: Record<string, BookConfig> = {
    'nawawi40': {
        url: '/data/hadith/by_book/forties/nawawi40.json',
        name: 'الأربعون النووية',
        arabicName: 'الأربعون النووية',
        count: 42,
        author: 'الإمام النووي',
        description: 'مجموعة منتقاة من جوامع الكلم النبوي، تمثل أصولًا كبرى في الدين.',
        priority: 1
    },
    'qudsi40': {
        url: '/data/hadith/by_book/forties/qudsi40.json',
        name: 'الأربعون القدسية',
        arabicName: 'الأربعون القدسية',
        count: 40,
        author: 'متون مختلفة',
        description: 'أحاديث قدسية مختارة يرويها النبي ﷺ عن ربه عز وجل.',
        priority: 2
    },
    'riyad': {
        url: '/data/hadith/by_book/other_books/riyad_assalihin.json',
        name: 'رياض الصالحين',
        arabicName: 'رياض الصالحين',
        count: 1896,
        author: 'الإمام النووي',
        description: 'كتاب تربوي جامع للأحاديث الصحيحة والحسنة في الأخلاق والعبادات والمعاملات.',
        priority: 3
    },
    'bukhari': {
        url: '/data/hadith/by_book/the_9_books/bukhari.json',
        name: 'صحيح البخاري',
        arabicName: 'صحيح البخاري',
        count: 7563,
        author: 'الإمام البخاري',
        description: 'أصح كتاب في الحديث النبوي، جمع فيه الإمام البخاري الأحاديث الصحيحة بشروط شديدة في السند والمتن.',
        priority: 4
    },
    'muslim': {
        url: '/data/hadith/by_book/the_9_books/muslim.json',
        name: 'صحيح مسلم',
        arabicName: 'صحيح مسلم',
        count: 3033,
        author: 'الإمام مسلم',
        description: 'ثاني أصح كتب السنة، امتاز بجمع طرق الحديث في موضع واحد، مع دقة عالية في ترتيب الأسانيد.',
        priority: 5
    },
    'tirmidhi': {
        url: '/data/hadith/by_book/the_9_books/tirmidhi.json',
        name: 'جامع الترمذي',
        arabicName: 'جامع الترمذي',
        count: 3956,
        author: 'الإمام الترمذي',
        description: 'من كتب السنن الجامعة، ويتميّز ببيان درجة الحديث (صحيح – حسن – ضعيف) وذكر أقوال الفقهاء.',
        priority: 6
    },
    'abudawud': {
        url: '/data/hadith/by_book/the_9_books/abudawud.json',
        name: 'سنن أبي داود',
        arabicName: 'سنن أبي داود',
        count: 5274,
        author: 'الإمام أبو داود',
        description: 'من أهم كتب أحاديث الأحكام، وقد صرّح مؤلفه أن ما سكت عنه فهو صالح للاحتجاج عنده.',
        priority: 7
    },
    'nasai': {
        url: '/data/hadith/by_book/the_9_books/nasai.json',
        name: 'سنن النسائي',
        arabicName: 'سنن النسائي',
        count: 5758,
        author: 'الإمام النسائي',
        description: 'من أدق كتب السنن من حيث نقد الأسانيد، ويُعد من أقلها احتواءً على الأحاديث الضعيفة.',
        priority: 8
    },
    'ibnmajah': {
        url: '/data/hadith/by_book/the_9_books/ibnmajah.json',
        name: 'سنن ابن ماجه',
        arabicName: 'سنن ابن ماجه',
        count: 4341,
        author: 'الإمام ابن ماجه',
        description: 'أتمّ به العلماء الكتب الستة، ويحتوي على عدد من الأحاديث الزائدة.',
        priority: 9
    },
    'malik': {
        url: '/data/hadith/by_book/the_9_books/malik.json',
        name: 'موطأ مالك',
        arabicName: 'موطأ مالك',
        count: 1720,
        author: 'الإمام مالك',
        description: 'من أقدم كتب السنة، يجمع بين الحديث النبوي وآثار الصحابة والتابعين، مع فقه الإمام مالك.',
        priority: 10
    },
    'shamail': {
        url: '/data/hadith/by_book/other_books/shamail_muhammadiyah.json',
        name: 'الشمائل المحمدية',
        arabicName: 'الشمائل المحمدية',
        count: 415,
        author: 'الإمام الترمذي',
        description: 'كتاب يصف صفات النبي ﷺ الخَلقية والخُلقية وسيرته.',
        priority: 11
    },
    'adab': {
        url: '/data/hadith/by_book/other_books/aladab_almufrad.json',
        name: 'الأدب المفرد',
        arabicName: 'الأدب المفرد',
        count: 1322,
        author: 'الإمام البخاري',
        description: 'كتاب خاص بآداب المسلم وأخلاقه من تأليف الإمام البخاري.',
        priority: 12
    },
    'bulugh': {
        url: '/data/hadith/by_book/other_books/bulugh_almaram.json',
        name: 'بلوغ المرام',
        arabicName: 'بلوغ المرام',
        count: 1596,
        author: 'الحافظ ابن حجر',
        description: 'كتاب أحاديث الأحكام، جمعه ابن حجر العسقلاني.',
        priority: 13
    },
    'mishkat': {
        url: '/data/hadith/by_book/other_books/mishkat_almasabih.json',
        name: 'مشكاة المصابيح',
        arabicName: 'مشكاة المصابيح',
        count: 6285,
        author: 'الخطيب التبريزي',
        description: 'موسوعة حديثية تضم أحاديث من مختلف المصادر مرتبة على الأبواب الفقهية.',
        priority: 14
    },
    'darimi': {
        url: '/data/hadith/by_book/the_9_books/darimi.json',
        name: 'سنن الدارمي',
        arabicName: 'سنن الدارمي',
        count: 3367,
        author: 'الإمام الدارمي',
        description: 'من كتب السنن المعتبرة، يجمع بين الأحاديث والآثار.',
        priority: 15
    },
    'ahmad': {
        url: '/data/hadith/by_book/the_9_books/ahmed.json',
        name: 'مسند أحمد',
        arabicName: 'مسند أحمد',
        count: 1374,
        author: 'الإمام أحمد بن حنبل',
        description: 'من أكبر كتب الحديث، يضم أحاديث مرتبة على أسماء الصحابة رواة الحديث.',
        priority: 16 // Last due to size
    }
};

// ==================== CACHE ====================

const processedCache: Map<string, Hadith[]> = new Map();

// ==================== HELPER: GET ACTUAL COUNT ====================

/**
 * Returns the count of hadiths.
 * Since data is loaded asynchronously, we rely on the hardcoded count in configuration.
 * When data is loaded, we could update this, but for UI consistency the hardcoded value is safest.
 */
const getActualCount = (bookId: string): number => {
    const bookConfig = BOOK_MAP[bookId];
    return bookConfig ? bookConfig.count : 0;
};

// ==================== CORE FUNCTIONS ====================

export const getBooks = (): HadithBook[] => {
    return Object.entries(BOOK_MAP)
        .sort((a, b) => a[1].priority - b[1].priority)
        .map(([id, book]) => ({
            id,
            name: book.name,
            arabicName: book.arabicName,
            count: book.count,
            author: book.author,
            description: book.description
        }));
};

export const getBookInfo = (bookId: string): HadithBook | null => {
    const book = BOOK_MAP[bookId];
    if (!book) return null;
    return {
        id: bookId,
        name: book.name,
        arabicName: book.arabicName,
        count: book.count,
        author: book.author,
        description: book.description
    };
};

// History management constants
const HISTORY_KEY = 'viewed_daily_hadiths';
const MAX_HISTORY = 500;

export const fetchRandomHadith = async (): Promise<{ hadith: Hadith, bookId: string, bookName: string } | null> => {
    try {
        const ALL_BOOKS = Object.keys(BOOK_MAP);
        
        // Load history
        let history = [];
        try {
            const stored = localStorage.getItem(HISTORY_KEY);
            if (stored) history = JSON.parse(stored);
        } catch (e) {}
        const historySet = new Set(history);

        // Try up to 10 times to find a unique hadith
        for (let attempts = 0; attempts < 10; attempts++) {
            const randomBookId = ALL_BOOKS[Math.floor(Math.random() * ALL_BOOKS.length)];
            const book = BOOK_MAP[randomBookId];
            
            const hadiths = await fetchHadiths(randomBookId);
            if (!hadiths || hadiths.length === 0) continue;
            
            const randomIndex = Math.floor(Math.random() * hadiths.length);
            const selectedHadith = hadiths[randomIndex];
            
            // Unique ID for the hadith
            const uniqueId = `${randomBookId}_${selectedHadith.id || selectedHadith.hadithnumber || randomIndex}`;
            
            if (!historySet.has(uniqueId)) {
                // Found a unique one! Save to history
                history.push(uniqueId);
                if (history.length > MAX_HISTORY) {
                    history.shift(); // Remove oldest
                }
                try {
                    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
                } catch (e) {}
                
                return {
                    hadith: selectedHadith,
                    bookId: randomBookId,
                    bookName: book.name
                };
            }
        }
        
        // Fallback: If after 10 attempts we still hit duplicates, just return a random one
        const fallbackBookId = ALL_BOOKS[Math.floor(Math.random() * ALL_BOOKS.length)];
        const book = BOOK_MAP[fallbackBookId];
        const hadiths = await fetchHadiths(fallbackBookId);
        if (hadiths && hadiths.length > 0) {
            const randomIndex = Math.floor(Math.random() * hadiths.length);
            return {
                hadith: hadiths[randomIndex],
                bookId: fallbackBookId,
                bookName: book.name
            };
        }

        return null;
    } catch (e) {
        console.error("Failed to fetch random hadith", e);
        return null;
    }
};

export const fetchHadiths = async (bookId: string): Promise<Hadith[]> => {
    if (processedCache.has(bookId)) {
        return processedCache.get(bookId)!;
    }

    const bookConfig = BOOK_MAP[bookId];
    if (!bookConfig) {
        console.error(`Book not found: ${bookId}`);
        return [];
    }

    try {
        console.log(`Fetching book ${bookId} from ${bookConfig.url}...`);
        const response = await fetch(bookConfig.url);
        if (!response.ok) {
            throw new Error(`Failed to load book data: ${response.statusText}`);
        }

        const data = await response.json();
        let hadiths: Hadith[] = [];

        if (Array.isArray(data)) {
            hadiths = data;
        } else if (data.hadiths && Array.isArray(data.hadiths)) {
            hadiths = data.hadiths;
        } else if (typeof data === 'object') {
            hadiths = Object.values(data);
        }

        hadiths = hadiths.map((h: any, idx: number) => ({
            id: h.id || idx + 1,
            hadithnumber: h.hadithnumber || h.id || idx + 1,
            arabic: h.arabic || h.text || '',
            text: h.arabic || h.text || '',
            chapterId: h.chapterId,
            bookId: Number(h.bookId) || 0, // Ensure number
            english: h.english,
            grades: h.grades,
            reference: h.reference,
            chapter: h.chapter
        }));

        processedCache.set(bookId, hadiths);
        console.log(`Loaded ${hadiths.length} hadiths from ${bookConfig.name}`);
        return hadiths;

    } catch (error) {
        console.error(`Failed to load hadiths for ${bookId}:`, error);
        return [];
    }
};

// ==================== PROFESSIONAL ARABIC SEARCH ====================

/**
 * Checks if a hadith word matches the query term using strict morphological rules.
 * Same logic as Quran search for consistency.
 */
export const isStrictMatch = (hadithWord: string, queryTerm: string): boolean => {
    const normHadith = normalizeArabic(hadithWord);
    const normQuery = normalizeArabic(queryTerm);

    if (!normQuery || !normHadith) return false;
    if (normHadith === normQuery) return true;

    let strippedWord = normHadith;
    const sortedPrefixes = [...ARABIC_PREFIXES].sort((a, b) => b.length - a.length);

    for (const prefix of sortedPrefixes) {
        if (strippedWord.startsWith(prefix)) {
            strippedWord = strippedWord.slice(prefix.length);
            break;
        }
    }

    if (strippedWord === normQuery) return true;

    if (strippedWord.startsWith(normQuery)) {
        const remainder = strippedWord.slice(normQuery.length);
        if (remainder.length === 0) return true;

        const sortedSuffixes = [...ARABIC_SUFFIXES].sort((a, b) => b.length - a.length);
        return sortedSuffixes.some(s => s === remainder || remainder.startsWith(s));
    }

    return false;
};

const calculateMatchScore = (normText: string, normQuery: string): { score: number; type: 'exact' | 'partial' | 'fuzzy' } => {
    if (normText.includes(normQuery)) {
        return { score: 100, type: 'exact' };
    }

    const queryWords = normQuery.split(/\s+/).filter(w => w.length > 0);
    const textWords = normText.split(/\s+/).filter(w => w.length > 0);

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

export const searchAllHadiths = async (query: string, maxResults: number = 50): Promise<SearchResult[]> => {
    if (!query || query.trim().length < 2) return [];

    const results: SearchResult[] = [];
    const books = Object.entries(BOOK_MAP).sort((a, b) => a[1].priority - b[1].priority);

    const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

    for (const [bookId, book] of books) {
        try {
            const hadiths = await fetchHadiths(bookId);
            let checkCount = 0;

            for (const hadith of hadiths) {
                const text = hadith.arabic || hadith.text || '';
                const { score, type } = calculateMatchScore(text, query);

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
        } catch (e) {
            console.error(`Error searching book ${bookId}:`, e);
        }
    }

    return results
        .sort((a, b) => {
            if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
            const typeOrder = { exact: 0, partial: 1, fuzzy: 2 };
            return typeOrder[a.matchType] - typeOrder[b.matchType];
        })
        .slice(0, maxResults);
};

/**
 * Highlight matching text in search results
 */
export const getMatchSnippet = (text: string, query: string, maxLength: number = 200): string => {
    const normText = normalizeArabic(text);
    const normQuery = normalizeArabic(query);

    const matchIndex = normText.indexOf(normQuery);

    if (matchIndex === -1) {
        // Find first matching word
        const queryWords = normQuery.split(/\s+/).filter(w => w.length > 0);
        const textWords = text.split(/\s+/);

        for (let i = 0; i < textWords.length; i++) {
            if (queryWords.some(qw => isStrictMatch(textWords[i], qw))) {
                const start = Math.max(0, text.indexOf(textWords[i]) - 50);
                const end = Math.min(text.length, start + maxLength);
                return (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
            }
        }

        return text.slice(0, maxLength) + (text.length > maxLength ? '...' : '');
    }

    const start = Math.max(0, matchIndex - 50);
    const end = Math.min(text.length, matchIndex + maxLength);

    return (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
};

// ==================== UTILITY FUNCTIONS ====================

export const preloadBooks = async (bookIds: string[]): Promise<void> => {
    await Promise.all(bookIds.map(id => fetchHadiths(id)));
};

export const clearCache = (): void => {
    processedCache.clear();
};

// Re-export normalizeArabic for use in Hadith.tsx
export { normalizeArabic };
