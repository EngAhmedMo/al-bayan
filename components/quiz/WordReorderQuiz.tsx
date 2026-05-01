import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, RotateCcw, ChevronLeft } from 'lucide-react';
import { WordReorderQuestion, AyahWordError } from '../../services/hifzManager';
import { toArabicDigits } from '../../services/normalization';

// ── Types ────────────────────────────────────────────────────────────────────

interface PoolWord {
    word: string;
    id: number;       // unique stable id (index within this ayah's shuffle)
    used: boolean;    // marked used → stays in place, greyed out
}

interface WordReorderQuizProps {
    quiz: WordReorderQuestion;
    onFinish: (
        correct: number,
        total: number,
        timeTakenMs: number,
        ayahErrors: AyahWordError[]
    ) => void;
    onClose: () => void;
}

// ── Helper ────────────────────────────────────────────────────────────────────

const buildPool = (shuffledWords: string[]): PoolWord[] =>
    shuffledWords.map((word, i) => ({ word, id: i, used: false }));

const getPreview = (text: string) =>
    text.trim().split(/\s+/).slice(0, 5).join(' ');

// ── Component ─────────────────────────────────────────────────────────────────

export const WordReorderQuiz: React.FC<WordReorderQuizProps> = ({
    quiz,
    onFinish,
    onClose,
}) => {
    const totalAyahs = quiz.ayahs.length;
    const startTimeRef = useRef(Date.now());

    // ── State ──
    const [ayahIndex, setAyahIndex] = useState(0);
    // Pool: stable positions — words are never removed, only marked "used"
    const [pool, setPool] = useState<PoolWord[]>(() =>
        buildPool(quiz.ayahs[0].shuffledWords)
    );
    // Placed words (in the answer tray)
    const [placed, setPlaced] = useState<string[]>([]);
    // Shake animation: track which pool word id is shaking
    const [shakeId, setShakeId] = useState<number | null>(null);
    // Current ayah's mistake count
    const [currentMistakes, setCurrentMistakes] = useState(0);
    // Accumulated results per ayah
    const [ayahResults, setAyahResults] = useState<AyahWordError[]>([]);
    // Completion animation
    const [showSuccess, setShowSuccess] = useState(false);

    const currentData = quiz.ayahs[ayahIndex];

    // Reset state when ayah changes
    useEffect(() => {
        const data = quiz.ayahs[ayahIndex];
        if (!data) return;
        setPool(buildPool(data.shuffledWords));
        setPlaced([]);
        setCurrentMistakes(0);
        setShakeId(null);
        setShowSuccess(false);
    }, [ayahIndex, quiz.ayahs]);

    // ── Handlers ──

    const handlePick = useCallback((poolWord: PoolWord) => {
        if (poolWord.used || showSuccess) return;

        const expected = currentData.correctWords[placed.length];

        if (poolWord.word === expected) {
            // ✅ Correct — mark as used (NO removal, NO layout shift)
            setPool(prev =>
                prev.map(p => p.id === poolWord.id ? { ...p, used: true } : p)
            );
            const newPlaced = [...placed, poolWord.word];
            setPlaced(newPlaced);

            if (newPlaced.length === currentData.correctWords.length) {
                // Ayah completed
                setShowSuccess(true);
                const record: AyahWordError = {
                    ayahIndex,
                    preview: getPreview(currentData.correctWords.join(' ')),
                    mistakes: currentMistakes,
                };
                const newResults = [...ayahResults, record];

                setTimeout(() => {
                    if (ayahIndex + 1 < totalAyahs) {
                        setAyahResults(newResults);
                        setAyahIndex(prev => prev + 1);
                    } else {
                        // All done
                        const correctCount = newResults.filter(r => r.mistakes === 0).length;
                        onFinish(
                            correctCount,
                            totalAyahs,
                            Date.now() - startTimeRef.current,
                            newResults
                        );
                    }
                }, 700);
            }
        } else {
            // ❌ Wrong — shake the tapped word in place, no layout change
            setShakeId(poolWord.id);
            setCurrentMistakes(prev => prev + 1);
            setTimeout(() => setShakeId(null), 500);
        }
    }, [
        placed, currentData, ayahIndex, totalAyahs,
        currentMistakes, ayahResults, onFinish, showSuccess,
    ]);

    const handleUndo = useCallback(() => {
        if (placed.length === 0 || showSuccess) return;
        const lastWord = placed[placed.length - 1];
        setPlaced(prev => prev.slice(0, -1));
        // Un-mark the last used word with this text
        setPool(prev => {
            const idx = [...prev].reverse().findIndex(p => p.used && p.word === lastWord);
            if (idx === -1) return prev;
            const realIdx = prev.length - 1 - idx;
            return prev.map((p, i) => i === realIdx ? { ...p, used: false } : p);
        });
    }, [placed, showSuccess]);

    const progress = ayahIndex / totalAyahs;

    if (!currentData) return null;

    return (
        <div className="flex flex-col gap-5" dir="rtl">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-navy-900 dark:text-white truncate">
                        {currentData.ayah.surah?.name
                            ? `سورة ${currentData.ayah.surah.name}`
                            : 'ترتيب الكلمات'}
                    </h3>
                    <p className="text-xs text-navy-400 dark:text-navy-500 mt-0.5">
                        اضغط على الكلمات بترتيبها الصحيح
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-xl text-navy-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors flex-shrink-0"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Ayah progress bar */}
            <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-navy-400 dark:text-navy-500">
                    <span>الآيات</span>
                    <span>
                        {toArabicDigits(ayahIndex + 1)} / {toArabicDigits(totalAyahs)}
                    </span>
                </div>
                <div className="w-full h-2 rounded-full bg-navy-100 dark:bg-navy-800 overflow-hidden">
                    <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-blue-400 to-indigo-500"
                        animate={{ width: `${progress * 100}%` }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                    />
                </div>
            </div>

            {/* Answer tray — placed words */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <Check size={13} />
                        الكلمات المرتّبة
                    </p>
                    <button
                        onClick={handleUndo}
                        disabled={placed.length === 0 || showSuccess}
                        className="flex items-center gap-1 text-[11px] text-navy-400 hover:text-navy-700 dark:hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    >
                        <RotateCcw size={11} />
                        تراجع
                    </button>
                </div>

                <div
                    className={`
                        min-h-[5.5rem] rounded-2xl p-3 
                        border-2 transition-colors duration-200
                        flex flex-wrap gap-2 content-start justify-end
                        ${showSuccess
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700'
                            : 'bg-navy-50/50 dark:bg-navy-900/30 border-navy-100 dark:border-navy-800 border-dashed'
                        }
                    `}
                >
                    <AnimatePresence mode="popLayout">
                        {placed.map((word, idx) => (
                            <motion.div
                                key={`placed-${idx}-${word}`}
                                initial={{ opacity: 0, scale: 0.7 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                className="px-3 py-2 bg-white dark:bg-navy-800 rounded-xl border border-emerald-200 dark:border-emerald-800/60 text-navy-900 dark:text-white font-quran text-xl leading-none shadow-sm"
                            >
                                {word}
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {placed.length === 0 && (
                        <p className="text-xs text-navy-300 dark:text-navy-600 self-center w-full text-center select-none">
                            ابدأ بالضغط على الكلمة الأولى في الآية
                        </p>
                    )}

                    {showSuccess && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        >
                            <span className="text-3xl">✅</span>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Word pool — FIXED GRID, never shifts */}
            <div className="space-y-2">
                <p className="text-xs font-bold text-navy-500 dark:text-navy-400">
                    اختر الكلمة التالية:
                    {currentMistakes > 0 && (
                        <span className="mr-2 text-amber-500 dark:text-amber-400">
                            ({toArabicDigits(currentMistakes)} {currentMistakes === 1 ? 'خطأ' : 'أخطاء'})
                        </span>
                    )}
                </p>

                <div className="p-3 rounded-2xl bg-white dark:bg-navy-900 border border-navy-100 dark:border-navy-800 shadow-inner-sm">
                    {/*
                        KEY DESIGN DECISION:
                        Words never leave the DOM — "used" words are greyed out in-place.
                        This eliminates ALL layout shifts and prevents accidental misclicks.
                        The grid uses justify-end for proper RTL right-to-left alignment.
                    */}
                    <div className="flex flex-wrap gap-2 justify-end content-start">
                        {pool.map((poolWord) => {
                            const isShaking = shakeId === poolWord.id;

                            return (
                                <motion.button
                                    key={poolWord.id}
                                    animate={{
                                        // Shake in place (RTL-aware: shake horizontally)
                                        x: isShaking ? [0, 6, -6, 4, -4, 0] : 0,
                                        scale: isShaking ? [1, 1.05, 0.97, 1] : 1,
                                    }}
                                    transition={
                                        isShaking
                                            ? { duration: 0.45, times: [0, 0.2, 0.5, 0.75, 0.9, 1] }
                                            : { duration: 0.12 }
                                    }
                                    onClick={() => handlePick(poolWord)}
                                    disabled={poolWord.used || !!showSuccess}
                                    aria-label={poolWord.used ? `كلمة مستخدمة: ${poolWord.word}` : poolWord.word}
                                    className={`
                                        px-4 py-3 rounded-xl border font-quran text-xl leading-none
                                        select-none transition-colors duration-150
                                        ${poolWord.used
                                            ? 'bg-navy-50 dark:bg-navy-800/40 border-navy-100 dark:border-navy-800 text-navy-300 dark:text-navy-700 cursor-default'
                                            : isShaking
                                                ? 'bg-red-50 dark:bg-red-950/20 border-red-400 dark:border-red-700 text-red-600 dark:text-red-400'
                                                : 'bg-white dark:bg-navy-800 border-navy-200 dark:border-navy-700 text-navy-900 dark:text-white shadow-sm hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 active:scale-95'
                                        }
                                    `}
                                >
                                    {poolWord.word}
                                </motion.button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Navigate between ayahs (prev only) */}
            {ayahIndex > 0 && (
                <button
                    onClick={() => {
                        setAyahResults(prev => prev.slice(0, -1));
                        setAyahIndex(prev => prev - 1);
                    }}
                    className="flex items-center gap-1.5 text-xs text-navy-400 hover:text-navy-700 dark:hover:text-white transition-colors self-end"
                >
                    <ChevronLeft size={14} />
                    الآية السابقة
                </button>
            )}
        </div>
    );
};
