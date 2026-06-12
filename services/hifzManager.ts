import { Ayah } from '../types';
import { fetchPageOffline } from './quranOfflineCache';
import { normalizeArabic } from './normalization';
import { getMetadataFromGlobalAyah, getApproxPageFromGlobalAyah, SURAH_NAMES_ARABIC } from './quranStaticData';

// --- Types ---

export type QuizDifficulty = 'easy' | 'medium' | 'hard';

export type QuizQuestionType =
  | 'first_word'
  | 'last_word'
  | 'reorder'
  | 'complete_next'
  | 'recite_reveal'
  | 'identify_surah'   // MCQ: which surah is this ayah from?
  | 'missing_word'     // MCQ: fill in the missing word
  | 'next_ayah_mcq'   // MCQ: which ayah comes next?
  | 'prev_ayah_mcq'   // MCQ: which ayah comes before?
  | 'identify_juz';    // MCQ: which juz is this ayah in?

/** Error record for Phase 2 (Ayah Reorder) — per slot */
export interface AyahSlotError {
  ayahNumber: number;
  preview: string;
  mistakes: number; // wrong taps before correct pick
}

/** Error record for Phase 3 (Word Reorder) — per ayah */
export interface AyahWordError {
  ayahIndex: number;
  preview: string;
  mistakes: number; // wrong word taps in this ayah
}

export interface QuizQuestion {
    id: string;
    type: QuizQuestionType;
    ayah: Ayah; // The TARGET ayah to be hidden/revealed/tested
    questionText: string;
    contextText?: string; // Additional visual context (e.g. previous verse end)
    options?: string[]; // For reorder or multiple choice
    correctAnswer: string | string[]; // String for text, array for order
    userAnswer?: any;
    bridgeSourceAyah?: Ayah; // If this is a bridge question, this is the visible cue
}

export interface QuizSessionResult {
    date: string;
    score: number; // 0-100
    passed: boolean; // Score >= 80% (Strict) or 50% (Normal)
    mistakes: {
        ayahId: string; // "surah:ayah"
        type: QuizQuestionType;
    }[];
}

export interface HifzTestResult {
    date: string;
    score: number;
    duration: number;
    totalItems: number;
    correctItems: number;
    mistakes: number;
    mistakeIds?: string[];
    type?: 'daily' | 'revision';
}


// --- Core Logic ---

/**
 * Generates a comprehensive daily quiz.
 * @param ayahs The full list of Ayahs in the daily wird.
 * @param strictMode If true, increases difficulty (more 'complete' questions).
 */
export const generateDailyQuiz = (ayahs: Ayah[], strictMode: boolean = false): QuizQuestion[] => {
    if (!ayahs || ayahs.length === 0) return [];

    // Daily Mode: 100% Coverage, Sequential Order
    // We strictly follow the ayahs order to simulate recitation flow.

    // Sort just in case passed array is unsorted
    const sortedAyahs = [...ayahs].sort((a, b) => a.number - b.number);

    const questions: QuizQuestion[] = [];

    for (let i = 0; i < sortedAyahs.length; i++) {
        const ayah = sortedAyahs[i];
        const prevAyah = i > 0 ? sortedAyahs[i - 1] : undefined;
        const nextAyah = i < sortedAyahs.length - 1 ? sortedAyahs[i + 1] : undefined;

        // Vary question types sequentially or randomly? 
        // Random type is better to keep user alert, but sequential ayah order.
        const rand = Math.random();
        let type: QuizQuestionType;

        // Smart Length Check
        const wordCount = (ayah.aya_text || ayah.text).split(/\s+/).length;
        const isShort = wordCount < 4;

        if (strictMode) {
            // Harder distribution
            if (isShort) {
                // Short ayahs: either recite whole or reorder
                type = rand < 0.4 ? 'reorder' : 'recite_reveal';
            } else {
                if (rand < 0.15) type = 'first_word';
                else if (rand < 0.3) type = 'reorder';
                else if (rand < 0.6) type = 'recite_reveal';
                else type = 'complete_next';
            }
        } else {
            if (isShort) {
                type = rand < 0.5 ? 'reorder' : 'recite_reveal';
            } else {
                if (rand < 0.25) type = 'first_word';
                else if (rand < 0.5) type = 'last_word';
                else if (rand < 0.75) type = 'reorder';
                else type = 'complete_next';
            }
        }

        // Every ayah is tested as an independent target, no Bridge logic.
        questions.push(createQuestion(ayah, type, i, prevAyah, nextAyah));
    }

    return questions;
};

/**
 * Generates a Smart Revision Quiz.
 * - Prioritizes: Mistakes, Weak SRS Items, First Ayah of Surah, First Ayah of Page.
 * - Fills with random samples to ensure density.
 */
export const generateRevisionQuiz = (ayahs: Ayah[], mistakeIds: string[] = [], srsItems: any[] = []): QuizQuestion[] => {
    if (!ayahs || ayahs.length === 0) return [];

    // 1. Group by Surah to maintain coherence
    const ayahsBySurah: Record<number, Ayah[]> = {};
    const surahOrder: number[] = [];

    ayahs.forEach(a => {
        let s = a.surah?.number;
        if (!s) {
            // Fallback if surah object is missing on the ayah
            s = getMetadataFromGlobalAyah(a.number).surahNumber;
        }

        if (!ayahsBySurah[s]) {
            ayahsBySurah[s] = [];
            surahOrder.push(s);
        }
        ayahsBySurah[s].push(a);
    });

    const questions: QuizQuestion[] = [];
    let globalIndex = 0;

    // 2. Process each Surah group
    surahOrder.forEach(surahNum => {
        const surahAyahs = ayahsBySurah[surahNum].sort((a, b) => a.number - b.number);
        const selectedForSurah = new Set<Ayah>();

        // A. Priority: First Ayah of the Surah (if in range)
        const firstInSurah = surahAyahs.find(a => a.numberInSurah === 1);
        if (firstInSurah) selectedForSurah.add(firstInSurah);

        // B. Priority: First Ayah of Every Page
        const pageHeads = new Set<number>(); // page numbers
        surahAyahs.forEach(a => {
            if (!pageHeads.has(a.page)) {
                pageHeads.add(a.page);
                selectedForSurah.add(a);
            }
        });

        // C. Priority: Mistakes (Hot Issues)
        const mistakeSet = new Set(mistakeIds);

        // D. Priority: Weak SRS Items (Cold Issues)
        const weakAyahNumbers = new Set<number>();
        srsItems.forEach(item => {
            if (item.id.startsWith('ayah_') || !isNaN(Number(item.id))) {
                if (item.efactor < 2.2 || item.interval < 5) {
                    const idParts = item.id.split('_');
                    const num = idParts.length > 1 ? parseInt(idParts[idParts.length - 1]) : parseInt(item.id);
                    if (!isNaN(num)) weakAyahNumbers.add(num);
                }
            }
        });

        surahAyahs.forEach(a => {
            if (mistakeSet.has(a.number.toString()) || weakAyahNumbers.has(a.number)) {
                selectedForSurah.add(a);
            }
        });

        // E. Random Fill (Density)
        // Aim for ~30%
        const targetCount = Math.ceil(surahAyahs.length * 0.3);
        const remaining = surahAyahs.filter(a => !selectedForSurah.has(a));
        const shuffledRemaining = [...remaining].sort(() => 0.5 - Math.random());

        let needed = targetCount - selectedForSurah.size;
        for (let i = 0; i < needed && i < shuffledRemaining.length; i++) {
            selectedForSurah.add(shuffledRemaining[i]);
        }

        // 3. Convert Selection to Questions
        const finalSelection = Array.from(selectedForSurah);
        const shuffledSelection = finalSelection.sort(() => 0.5 - Math.random());

        shuffledSelection.forEach(ayah => {
            // Find neighbors for context
            // Note: In shuffled subset, we might not have immediate neighbors. 
            // We search in the full `surahAyahs` list.
            const idxInFull = surahAyahs.findIndex(a => a.number === ayah.number);
            const prevAyah = idxInFull > 0 ? surahAyahs[idxInFull - 1] : undefined;
            const nextAyah = idxInFull < surahAyahs.length - 1 ? surahAyahs[idxInFull + 1] : undefined;

            const isWeak = weakAyahNumbers.has(ayah.number) || mistakeSet.has(ayah.number.toString());

            let type: QuizQuestionType;
            if (isWeak) {
                type = Math.random() < 0.7 ? 'complete_next' : 'recite_reveal'; // Focus on recall
            } else {
                const r = Math.random();
                if (r < 0.2) type = 'first_word';
                else if (r < 0.4) type = 'reorder';
                else if (r < 0.7) type = 'recite_reveal';
                else type = 'complete_next';
            }

            questions.push(createQuestion(ayah, type, globalIndex++, prevAyah, nextAyah));
        });
    });

    return questions;
};

const createQuestion = (
    ayah: Ayah,
    type: QuizQuestionType,
    index: number,
    prevAyah?: Ayah, // The ayah BEFORE the target
    nextAyah?: Ayah, // The ayah AFTER the target
    isBridge: boolean = false
): QuizQuestion => {
    // Use Uthmani text (aya_text) if available
    const displayText = ayah.aya_text || ayah.text;
    const words = displayText.split(/\s+/).filter(w => w.length > 0);
    const id = `q_${ayah.number}_${index}`;
    const ayahNum = ayah.numberInSurah;

    // --- Bridge (Connection) Logic ---
    if (isBridge && prevAyah) {
        // Here, 'ayah' is the TARGET (Hidden). 'prevAyah' is the CUE (Visible).
        // Wait, the caller passed `createQuestion(nextAyah, ..., prevAyah=currentAyah, isBridge=true)`
        // So 'ayah' = Next, 'prevAyah' = Current.

        // We want to show "Complete the ayah following: [Current]"
        // The card will contain 'ayah' (Next), hidden.
        const prevText = prevAyah.aya_text || prevAyah.text;

        return {
            id,
            type: 'complete_next',
            ayah: ayah, // Hidden Target
            bridgeSourceAyah: prevAyah, // Store source for UI handling if needed
            questionText: `أكمل الآية التي تلي قوله تعالى: "${prevText}"...`,
            // Answer is the START of the target ayah
            correctAnswer: normalizeArabic(words.slice(0, Math.min(4, words.length)).join(' '))
        };
    }

    switch (type) {
        case 'first_word': {
            // Smart Context
            let context = '';
            // If ayah is very short, context is mandatory
            if (words.length < 5 || Math.random() < 0.5) {
                if (prevAyah) {
                    const prevWords = (prevAyah.aya_text || prevAyah.text).split(/\s+/);
                    const tail = prevWords.slice(-3).join(' ');
                    context = ` (بعد: "...${tail}")`;
                } else if (ayah.surah) {
                    context = ` (بداية سورة ${ayah.surah.name})`;
                }
            }

            return {
                id,
                type,
                ayah,
                questionText: `ما هي الكلمة الأولى في الآية رقم ${ayahNum}؟${context}`,
                correctAnswer: normalizeArabic(words[0]),
            };
        }

        case 'last_word': {
            let lastContext = '';
            if (words.length < 5 || Math.random() < 0.5) {
                if (prevAyah) {
                    const prevWords = (prevAyah.aya_text || prevAyah.text).split(/\s+/);
                    const tail = prevWords.slice(-3).join(' ');
                    lastContext = ` (سياق: "...${tail}")`;
                }
            }

            return {
                id,
                type,
                ayah,
                questionText: `ما هي الكلمة الأخيرة في الآية رقم ${ayahNum}؟${lastContext}`,
                correctAnswer: normalizeArabic(words[words.length - 1]),
            };
        }

        case 'reorder':
            // Robust Shuffle: Ensure it's not same as original
            let options = [...words].sort(() => 0.5 - Math.random());
            // Retry shuffle if identical (simple check)
            if (words.length > 1 && options.join(' ') === words.join(' ')) {
                options = options.sort(() => 0.5 - Math.random());
            }

            return {
                id,
                type,
                ayah,
                questionText: 'رتب كلمات الآية التالية لتكتمل بشكل صحيح:',
                correctAnswer: words,
                options: options
            };

        case 'complete_next': {
            // Standard Cut (Cloze)
            // Ensure we have enough words
            if (words.length < 4) {
                // Too short for cut, convert to recite_reveral
                return createQuestion(ayah, 'recite_reveal', index, prevAyah, nextAyah);
            }

            // Intelligent Cutting: Middle or Pause
            const targetIndex = Math.floor(words.length / 2);
            let cutIndex = targetIndex;
            const waqfSigns = /[\u06D6\u06D7\u06D8\u06D9\u06DA\u06DB\u06DC\u06DD\u06DE\u06DF]/;

            for (let offset = 0; offset <= 3; offset++) {
                if (targetIndex + offset < words.length - 2 && waqfSigns.test(words[targetIndex + offset])) {
                    cutIndex = targetIndex + offset + 1;
                    break;
                }
                if (targetIndex - offset > 2 && waqfSigns.test(words[targetIndex - offset])) {
                    cutIndex = targetIndex - offset + 1;
                    break;
                }
            }

            const safeCutPoint = Math.max(2, Math.min(words.length - 2, cutIndex));
            const prompt = words.slice(0, safeCutPoint).join(' ');
            const missing = words.slice(safeCutPoint).join(' ');

            return {
                id,
                type,
                ayah,
                questionText: `أكمل الآية: "${prompt}..."`,
                correctAnswer: normalizeArabic(missing)
            };
        }

        case 'recite_reveal':
            // Contextual Recite
            let recitePrompt = 'اقرأ الآية التالية غيباً ثم تحقق:';
            let contextCue = '';

            if (prevAyah) {
                const prevWords = (prevAyah.aya_text || prevAyah.text).split(/\s+/);
                // Get last 3-4 words of previous ayah
                const tail = prevWords.slice(-Math.min(4, prevWords.length)).join(' ');
                contextCue = `أكمل بعد قوله تعالى: "...${tail}"`;
                recitePrompt = contextCue;
            } else if (ayah.surah && ayah.numberInSurah === 1) {
                recitePrompt = `اقرأ بداية سورة ${ayah.surah.name}`;
            } else {
                // Fallback (Rare): Just number based
                recitePrompt = `اقرأ الآية رقم ${ayahNum} من سورة ${ayah.surah?.name || ''}`;
            }

            return {
                id,
                type,
                ayah,
                questionText: recitePrompt,
                correctAnswer: words.join(' ')
            };

        default:
            return { id, type: 'reorder', ayah, questionText: 'Error', correctAnswer: '' };
    }
};

/**
 * Fetches the actual Ayah objects for a specific Plan range.
 */
export const getAyahsForDailyWird = async (
    planType: 'pages' | 'ayahs',
    startPoint: number,
    amount: number
): Promise<Ayah[]> => {
    const ayahs: Ayah[] = [];

    if (planType === 'pages') {
        const startPage = Math.floor(startPoint);
        const endPage = Math.min(604, Math.max(startPage, Math.floor(startPoint + amount - 0.001)));
        for (let p = startPage; p <= endPage; p++) {
            try {
                const pageAyahs = await fetchPageOffline(p);
                ayahs.push(...pageAyahs);
            } catch (e) {
                console.error(`Failed to fetch page ${p} for quiz`, e);
            }
        }
    } else {
        const startGlobal = startPoint;
        const endGlobal = startPoint + amount - 1;
        const startPage = getApproxPageFromGlobalAyah(startGlobal);
        const endPage = Math.min(604, getApproxPageFromGlobalAyah(endGlobal) + 1);

        for (let p = Math.max(1, startPage - 1); p <= endPage; p++) {
            const pageAyahs = await fetchPageOffline(p);
            const relevant = pageAyahs.filter(a => a.number >= startGlobal && a.number <= endGlobal);
            ayahs.push(...relevant);
        }
    }

    return ayahs;
};

// --- Phase 2: Ayah Reorder Types ---

export interface AyahReorderQuestion {
    id: string;
    ayahs: Ayah[];              // All ayahs of the page/range, sorted correctly
    shuffledAyahs: Ayah[];      // Same ayahs, shuffled for display
    correctOrder: number[];     // globalIds in correct order
    showNumbers?: boolean;      // Easy mode: show ayah number on card
}

// --- Phase 3: Word Reorder Types ---

export interface WordReorderQuestion {
    id: string;
    ayahs: {
        ayah: Ayah;
        shuffledWords: string[];
        correctWords: string[];
    }[];
}

// ── MCQ helpers ──────────────────────────────────────────────────────────────

const shuffleArr = <T>(arr: T[]): T[] => [...arr].sort(() => 0.5 - Math.random());

const getAyahPreviewWords = (text: string, maxWords = 7): string => {
    const words = text.trim().split(/\s+/);
    return words.length <= maxWords ? text.trim() : words.slice(0, maxWords).join(' ') + '...';
};

/** 2.1 — Identify which Surah this ayah is from (MCQ) */
export const createIdentifySurahQuestion = (ayah: Ayah, index: number): QuizQuestion => {
    const id = `q_${ayah.number}_${index}`;
    const displayText = ayah.aya_text || ayah.text;
    const surahNum = ayah.surah?.number ?? getMetadataFromGlobalAyah(ayah.number).surahNumber;
    const correctName = SURAH_NAMES_ARABIC[surahNum - 1];

    const wrongOptions = shuffleArr(
        SURAH_NAMES_ARABIC
            .map((name, i) => ({ name, num: i + 1 }))
            .filter(s => s.num !== surahNum)
    ).slice(0, 3).map(s => s.name);

    return {
        id,
        type: 'identify_surah',
        ayah,
        questionText: 'في أيِّ سورة وردت هذه الآية؟',
        contextText: getAyahPreviewWords(displayText, 8),
        options: shuffleArr([correctName, ...wrongOptions]),
        correctAnswer: correctName,
    };
};

/** 2.2 — Fill in the missing word (MCQ) */
export const createMissingWordQuestion = (
    ayah: Ayah,
    index: number,
    allAyahs?: Ayah[]
): QuizQuestion => {
    const id = `q_${ayah.number}_${index}`;
    const displayText = ayah.aya_text || ayah.text;
    const words = displayText.trim().split(/\s+/);

    // Need at least 4 words
    if (words.length < 4) {
        return {
            id, type: 'first_word', ayah,
            questionText: `ما هي الكلمة الأولى في الآية رقم ${ayah.numberInSurah}؟`,
            correctAnswer: normalizeArabic(words[0]),
        };
    }

    // Pick a middle word to hide (not first or last)
    const hiddenIdx = Math.floor(Math.random() * (words.length - 2)) + 1;
    const hiddenWord = words[hiddenIdx];
    const normalizedCorrect = normalizeArabic(hiddenWord);

    // Build display with blank
    const displayedWithBlank = words.map((w, i) => i === hiddenIdx ? '___' : w).join(' ');

    // Candidates pool: other ayahs in the same surah
    let candidates: string[] = [];
    if (allAyahs && allAyahs.length > 0) {
        const surahNum = ayah.surah?.number || getMetadataFromGlobalAyah(ayah.number)?.surahNumber || 1;
        const otherAyahsInSurah = allAyahs.filter(a => {
            const aSurah = a.surah?.number || getMetadataFromGlobalAyah(a.number)?.surahNumber || 1;
            return aSurah === surahNum && a.number !== ayah.number;
        });

        // Extract words from other ayahs in the same surah
        const surahWords = otherAyahsInSurah
            .map(a => (a.aya_text || a.text).trim().split(/\s+/))
            .flat()
            .map(w => normalizeArabic(w))
            .filter(w => w !== normalizedCorrect && w.length > 1);

        candidates = shuffleArr(Array.from(new Set(surahWords))).slice(0, 3);
    }

    // If we don't have enough candidates from other ayahs, fall back to words in the same ayah
    if (candidates.length < 3) {
        const localCandidates = words
            .filter((_, i) => i !== hiddenIdx)
            .map(w => normalizeArabic(w))
            .filter(w => w !== normalizedCorrect && w.length > 1 && !candidates.includes(w));
        
        candidates = [...candidates, ...shuffleArr(localCandidates)].slice(0, 3);
    }

    // Pad with standard Arabic grammatical words if still needed
    const fallbacks = ['وَ', 'إِنَّ', 'مِن', 'عَلَى', 'إِلَى'];
    let fi = 0;
    while (candidates.length < 3) {
        const fWord = fallbacks[fi++ % fallbacks.length];
        if (!candidates.includes(fWord) && fWord !== normalizedCorrect) {
            candidates.push(fWord);
        }
    }

    return {
        id,
        type: 'missing_word',
        ayah,
        questionText: 'أكمل الكلمة الناقصة:',
        contextText: displayedWithBlank,
        options: shuffleArr([normalizedCorrect, ...candidates]),
        correctAnswer: normalizedCorrect,
    };
};

/** 2.7 — What comes before? (MCQ with 4 ayah previews) */
export const createPrevAyahMCQQuestion = (
    ayah: Ayah,
    prevAyah: Ayah,
    allAyahs: Ayah[],
    index: number
): QuizQuestion => {
    const id = `q_${ayah.number}_${index}`;
    const displayText = ayah.aya_text || ayah.text;
    const correctPreview = getAyahPreviewWords(prevAyah.aya_text || prevAyah.text, 6);

    // Filter candidates from the same Surah to avoid obvious distractors
    const surahNum = ayah.surah?.number || getMetadataFromGlobalAyah(ayah.number)?.surahNumber || 1;
    const sameSurahAyahs = allAyahs.filter(a => {
        const aSurah = a.surah?.number || getMetadataFromGlobalAyah(a.number)?.surahNumber || 1;
        return aSurah === surahNum;
    });

    const candidatePool = sameSurahAyahs.length >= 4 ? sameSurahAyahs : allAyahs;

    const wrongCandidates = shuffleArr(
        candidatePool.filter(a => a.number !== ayah.number && a.number !== prevAyah.number)
    ).slice(0, 3).map(a => getAyahPreviewWords(a.aya_text || a.text, 6));

    while (wrongCandidates.length < 3) wrongCandidates.push('...');

    return {
        id,
        type: 'prev_ayah_mcq',
        ayah,
        questionText: 'ما الآية السابقة لقوله تعالى:',
        contextText: getAyahPreviewWords(displayText, 8),
        options: shuffleArr([correctPreview, ...wrongCandidates]),
        correctAnswer: correctPreview,
    };
};

/**
 * Groups a list of Ayahs by their surah number.
 * Assumes the input is sorted, but sorts just in case.
 */
export const groupAyahsBySurah = (ayahs: Ayah[]): Ayah[][] => {
    if (!ayahs || ayahs.length === 0) return [];
    
    // Sort ayahs sequentially first
    const sorted = [...ayahs].sort((a, b) => a.number - b.number);
    
    const groups: Ayah[][] = [];
    let currentSurahNum = -1;
    let currentGroup: Ayah[] = [];
    
    for (const ayah of sorted) {
        const surahNum = ayah.surah?.number || getMetadataFromGlobalAyah(ayah.number)?.surahNumber || 1;
        if (currentSurahNum === -1 || surahNum !== currentSurahNum) {
            if (currentGroup.length > 0) {
                groups.push(currentGroup);
            }
            currentGroup = [ayah];
            currentSurahNum = surahNum;
        } else {
            currentGroup.push(ayah);
        }
    }
    if (currentGroup.length > 0) {
        groups.push(currentGroup);
    }
    
    return groups;
};

/**
 * Phase 1 Quiz: Multiple Choice Questions (MCQ) testing verse recognition and sequence.
 * Takes ayahs of a SINGLE surah (as grouped by groupAyahsBySurah).
 * Excludes 'identify_surah' and 'identify_juz' as requested by the user, and integrates 'prev_ayah_mcq'.
 */
export const generatePhase1Quiz = (
    ayahs: Ayah[],
    difficulty: QuizDifficulty = 'medium'
): QuizQuestion[] => {
    if (!ayahs || ayahs.length === 0) return [];

    const sortedAyahs = [...ayahs].sort((a, b) => a.number - b.number);
    const questions: QuizQuestion[] = [];

    for (let i = 0; i < sortedAyahs.length; i++) {
        const ayah = sortedAyahs[i];
        const prevAyah = i > 0 ? sortedAyahs[i - 1] : undefined;
        const nextAyah = i < sortedAyahs.length - 1 ? sortedAyahs[i + 1] : undefined;

        const rand = Math.random();
        let type: QuizQuestionType;

        const wordCount = (ayah.aya_text || ayah.text).split(/\s+/).length;
        const isShort = wordCount < 4;

        if (difficulty === 'easy') {
            if (isShort) {
                type = rand < 0.5 && prevAyah ? 'prev_ayah_mcq' : 'next_ayah_mcq';
            } else {
                type = rand < 0.6 ? 'missing_word' : (prevAyah && rand < 0.8 ? 'prev_ayah_mcq' : 'next_ayah_mcq');
            }
        } else if (difficulty === 'hard') {
            if (isShort) {
                type = rand < 0.5 && prevAyah ? 'prev_ayah_mcq' : 'next_ayah_mcq';
            } else {
                if (rand < 0.35) type = 'missing_word';
                else if (rand < 0.68 && prevAyah) type = 'prev_ayah_mcq';
                else type = 'next_ayah_mcq';
            }
        } else {
            if (isShort) {
                type = rand < 0.5 && prevAyah ? 'prev_ayah_mcq' : 'next_ayah_mcq';
            } else {
                if (rand < 0.45) type = 'missing_word';
                else if (rand < 0.72 && prevAyah) type = 'prev_ayah_mcq';
                else type = 'next_ayah_mcq';
            }
        }

        if (type === 'missing_word') {
            questions.push(createMissingWordQuestion(ayah, i, sortedAyahs));
        } else if (type === 'prev_ayah_mcq' && prevAyah) {
            questions.push(createPrevAyahMCQQuestion(ayah, prevAyah, sortedAyahs, i));
        } else {
            if (nextAyah) {
                questions.push(createNextAyahMCQQuestion(ayah, nextAyah, sortedAyahs, i));
            } else if (prevAyah) {
                questions.push(createPrevAyahMCQQuestion(ayah, prevAyah, sortedAyahs, i));
            } else {
                questions.push(createMissingWordQuestion(ayah, i, sortedAyahs));
            }
        }
    }

    return shuffleArr(questions);
};

/** 2.3 — What comes next? (MCQ with 4 ayah previews) */
export const createNextAyahMCQQuestion = (
    ayah: Ayah,
    nextAyah: Ayah,
    allAyahs: Ayah[],
    index: number
): QuizQuestion => {
    const id = `q_${ayah.number}_${index}`;
    const displayText = ayah.aya_text || ayah.text;
    const correctPreview = getAyahPreviewWords(nextAyah.aya_text || nextAyah.text, 6);

    const wrongCandidates = shuffleArr(
        allAyahs.filter(a => a.number !== ayah.number && a.number !== nextAyah.number)
    ).slice(0, 3).map(a => getAyahPreviewWords(a.aya_text || a.text, 6));

    while (wrongCandidates.length < 3) wrongCandidates.push('...');

    return {
        id,
        type: 'next_ayah_mcq',
        ayah,
        questionText: 'ما الآية التي تلي قوله تعالى:',
        contextText: getAyahPreviewWords(displayText, 8),
        options: shuffleArr([correctPreview, ...wrongCandidates]),
        correctAnswer: correctPreview,
    };
};

/** 2.4 — Identify which Juz (MCQ) */
export const createIdentifyJuzQuestion = (ayah: Ayah, index: number): QuizQuestion => {
    const id = `q_${ayah.number}_${index}`;
    const displayText = ayah.aya_text || ayah.text;
    const correctJuz = ayah.juz;

    const wrongJuzs = shuffleArr(
        Array.from({ length: 30 }, (_, i) => i + 1).filter(j => j !== correctJuz)
    ).slice(0, 3);

    const toOption = (j: number) => `الجزء ${j}`;

    return {
        id,
        type: 'identify_juz',
        ayah,
        questionText: 'في أيِّ جزء وردت هذه الآية؟',
        contextText: getAyahPreviewWords(displayText, 8),
        options: shuffleArr([correctJuz, ...wrongJuzs]).map(toOption),
        correctAnswer: toOption(correctJuz),
    };
};



/**
 * Phase 2: Generates a SINGLE Ayah reorder chunk.
 * Internal helper used by generatePhase2QuizChunked.
 */
const buildReorderChunk = (chunk: Ayah[], chunkIdx: number, showNumbers: boolean): AyahReorderQuestion => {
    const correctOrder = chunk.map(a => a.number);

    let shuffled = [...chunk].sort(() => 0.5 - Math.random());
    let attempts = 0;
    while (
        attempts < 10 &&
        shuffled.length > 1 &&
        shuffled.every((a, i) => a.number === chunk[i].number)
    ) {
        shuffled = [...chunk].sort(() => 0.5 - Math.random());
        attempts++;
    }

    return {
        id: `phase2_chunk${chunkIdx}_${Date.now()}`,
        ayahs: chunk,
        shuffledAyahs: shuffled,
        correctOrder,
        showNumbers,
    };
};

/**
 * Phase 2: Generates Ayah reorder challenges, split into chunks of `chunkSize`.
 * Easy mode shows ayah numbers on each card.
 * Always returns at least one chunk.
 */
export const generatePhase2QuizChunked = (
    ayahs: Ayah[],
    difficulty: QuizDifficulty = 'medium'
): AyahReorderQuestion[] => {
    const sortedAyahs = [...ayahs].sort((a, b) => a.number - b.number);
    // Hide numbers in Medium and Hard difficulties to make it a real test.
    const showNumbers = difficulty === 'easy';

    // Dynamic Chunk Sizing based on difficulty
    let dynamicChunkSize = 10; // Default Medium
    if (difficulty === 'easy') dynamicChunkSize = 5;
    if (difficulty === 'hard') dynamicChunkSize = 15;

    if (sortedAyahs.length === 0) return [];

    const chunks: AyahReorderQuestion[] = [];
    for (let i = 0; i < sortedAyahs.length; i += dynamicChunkSize) {
        chunks.push(buildReorderChunk(sortedAyahs.slice(i, i + dynamicChunkSize), chunks.length, showNumbers));
    }
    return chunks;
};

/**
 * Phase 2 legacy: single-chunk (kept for backward compat).
 */
export const generatePhase2Quiz = (ayahs: Ayah[]): AyahReorderQuestion => {
    return buildReorderChunk([...ayahs].sort((a, b) => a.number - b.number), 0, false);
};

/**
 * Phase 3: Generates a Word reorder challenge.
 * For each ayah, its words are extracted and shuffled. User restores the correct order.
 */
export const generatePhase3Quiz = (ayahs: Ayah[], difficulty: QuizDifficulty = 'medium'): WordReorderQuestion => {
    let processAyahs = [...ayahs].sort((a, b) => a.number - b.number);
    
    // User requested: "يعني عدد الأسئلة يكون على عدد الآيات"
    // So we process ALL ayahs in the page/surah without slicing.
    if (difficulty === 'medium' || difficulty === 'hard') {
        processAyahs = processAyahs.sort(() => 0.5 - Math.random());
    }

    const questionsAyahs = processAyahs.map(ayah => {
        // Simple function to clean basic tajweed, but ideally we use the plain text
        const rawText = ayah.aya_text || ayah.text;
        const cleanText = rawText.replace(/[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g, ''); // fall back cleanup if needed
        const correctWords = rawText.trim().split(/\s+/).filter(w => w.length > 0);
        
        let shuffledWords = [...correctWords];
        if (correctWords.length > 1) {
            let attempts = 0;
            // Robust Fisher-Yates shuffle that guarantees a different arrangement
            while (attempts < 20) {
                for (let i = shuffledWords.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffledWords[i], shuffledWords[j]] = [shuffledWords[j], shuffledWords[i]];
                }
                
                // If it's different from the correct order, break.
                // For 2 words, it will swap them and break immediately.
                if (!shuffledWords.every((w, i) => w === correctWords[i])) {
                    break;
                }
                attempts++;
            }
            
            // Fallback for 2-word ayahs just in case the randomizer fails
            if (correctWords.length === 2 && shuffledWords[0] === correctWords[0]) {
                shuffledWords = [correctWords[1], correctWords[0]];
            }
        }

        return {
            ayah,
            shuffledWords,
            correctWords
        };
    });

    return {
        id: `phase3_${Date.now()}`,
        ayahs: questionsAyahs
    };
};

/**
 * Calculates the score and determines pass/fail status.
 */
export const evaluateQuiz = (questions: QuizQuestion[], answers: Record<string, boolean>): QuizSessionResult => {
    let correctCount = 0;
    const mistakes: QuizSessionResult['mistakes'] = [];

    questions.forEach(q => {
        const isCorrect = answers[q.id] === true;
        if (isCorrect) {
            correctCount++;
        } else {
            mistakes.push({
                ayahId: `${q.ayah.number}`,
                type: q.type
            });
        }
    });

    const total = questions.length;
    const score = total === 0 ? 0 : Math.round((correctCount / total) * 100);

    return {
        date: new Date().toISOString().split('T')[0],
        score,
        passed: score >= 70,
        mistakes
    };
};

/**
 * Fetches specific Ayahs by their global IDs.
 */
export const fetchAyahsByGlobalIds = async (ids: number[]): Promise<Ayah[]> => {
    if (!ids || ids.length === 0) return [];

    const pageMap = new Map<number, Set<number>>();

    ids.forEach(id => {
        const page = getApproxPageFromGlobalAyah(id);
        if (!pageMap.has(page)) pageMap.set(page, new Set());
        pageMap.get(page)!.add(id);
    });

    const result: Ayah[] = [];

    for (const page of Array.from(pageMap.keys())) {
        try {
            const pageAyahs = await fetchPageOffline(page);
            const neededIds = pageMap.get(page)!;
            const matches = pageAyahs.filter(a => neededIds.has(a.number));
            result.push(...matches);
        } catch (e) {
            console.error(`Failed to fetch page ${page} for focus session`, e);
        }
    }

    return result.sort((a, b) => a.number - b.number);
};
