import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, RotateCcw, ChevronRight, Layers } from 'lucide-react';
import { AyahReorderQuestion, AyahSlotError } from '../../services/hifzManager';
import { Ayah } from '../../types';
import { toArabicDigits } from '../../services/normalization';
import { cleanTajweedTags } from '../TajweedText';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AyahReorderQuizProps {
    quiz: AyahReorderQuestion;
    onFinish: (
        correct: number,
        total: number,
        timeTakenMs: number,
        slotErrors: AyahSlotError[]
    ) => void;
    onClose: () => void;
    /** Chunk position for multi-chunk mode */
    chunkIndex?: number;
    totalChunks?: number;
}

type SelectionState = 'idle' | 'correct' | 'wrong';

// ── Component ─────────────────────────────────────────────────────────────────

export const AyahReorderQuiz: React.FC<AyahReorderQuizProps> = ({
    quiz,
    onFinish,
    onClose,
    chunkIndex = 0,
    totalChunks = 1,
}) => {
    const startTimeRef = useRef(Date.now());
    const [pool, setPool] = useState<Ayah[]>(() => [...quiz.shuffledAyahs]);
    const [placed, setPlaced] = useState<Ayah[]>([]);
    const [shakeIndex, setShakeIndex] = useState<number | null>(null);
    const [feedbackState, setFeedbackState] = useState<SelectionState>('idle');

    // Mistake tracking per slot
    const [wrongAttemptsForCurrentSlot, setWrongAttemptsForCurrentSlot] = useState(0);
    const [slotErrors, setSlotErrors] = useState<AyahSlotError[]>([]);

    // Auto-scroll ref for the placed ayahs container
    const placedScrollRef = useRef<HTMLDivElement>(null);

    const totalCount = quiz.ayahs.length;
    const progress = placed.length / totalCount;
    const isMultiChunk = totalChunks > 1;

    // Reset state when quiz/chunk changes
    useEffect(() => {
        setPool([...quiz.shuffledAyahs]);
        setPlaced([]);
        setFeedbackState('idle');
        setShakeIndex(null);
        setWrongAttemptsForCurrentSlot(0);
        setSlotErrors([]);
        startTimeRef.current = Date.now();
    }, [quiz.id]);

    // Auto-scroll placed section to bottom when a new ayah is added
    useEffect(() => {
        if (placed.length > 0 && placedScrollRef.current) {
            // Small delay to let the animation render first
            requestAnimationFrame(() => {
                if (placedScrollRef.current) {
                    placedScrollRef.current.scrollTo({
                        top: placedScrollRef.current.scrollHeight,
                        behavior: 'smooth',
                    });
                }
            });
        }
    }, [placed.length]);

    const getAyahPreview = (ayah: Ayah): string => {
        const raw = ayah.aya_text || cleanTajweedTags(ayah.text) || '';
        const words = raw.trim().split(/\s+/);
        return words.length <= 8 ? raw.trim() : words.slice(0, 8).join(' ') + '...';
    };

    // --- Pick an ayah from the pool ---
    const handlePick = useCallback((ayah: Ayah, poolIndex: number) => {
        const expectedGlobalId = quiz.correctOrder[placed.length];

        if (ayah.number === expectedGlobalId) {
            // ✅ Correct
            setFeedbackState('correct');
            setPool(prev => prev.filter((_, i) => i !== poolIndex));

            const newSlotErrors: AyahSlotError = {
                ayahNumber: ayah.number,
                preview: getAyahPreview(ayah),
                mistakes: wrongAttemptsForCurrentSlot,
            };
            const newSlotErrorsList = [...slotErrors, newSlotErrors];
            setSlotErrors(newSlotErrorsList);
            setWrongAttemptsForCurrentSlot(0);

            const newPlaced = [...placed, ayah];
            setPlaced(newPlaced);
            setTimeout(() => setFeedbackState('idle'), 350);

            if (newPlaced.length === totalCount) {
                const correct = newSlotErrorsList.filter(e => e.mistakes === 0).length;
                setTimeout(() => {
                    onFinish(correct, totalCount, Date.now() - startTimeRef.current, newSlotErrorsList);
                }, 600);
            }
        } else {
            // ❌ Wrong — shake card, record attempt
            setFeedbackState('wrong');
            setShakeIndex(poolIndex);
            setWrongAttemptsForCurrentSlot(prev => prev + 1);
            setTimeout(() => {
                setShakeIndex(null);
                setFeedbackState('idle');
            }, 550);
        }
    }, [placed, quiz.correctOrder, totalCount, wrongAttemptsForCurrentSlot, slotErrors, onFinish]);

    const handleUndo = useCallback(() => {
        if (placed.length === 0) return;
        const last = placed[placed.length - 1];
        setPlaced(prev => prev.slice(0, -1));
        setPool(prev => [last, ...prev]);
        // Remove the last slot error & restore its wrong attempts
        const lastError = slotErrors[slotErrors.length - 1];
        setSlotErrors(prev => prev.slice(0, -1));
        setWrongAttemptsForCurrentSlot(lastError?.mistakes ?? 0);
    }, [placed, slotErrors]);

    const handleReset = useCallback(() => {
        setPool([...quiz.shuffledAyahs]);
        setPlaced([]);
        setFeedbackState('idle');
        setWrongAttemptsForCurrentSlot(0);
        setSlotErrors([]);
    }, [quiz.shuffledAyahs]);

    return (
        <div className="flex flex-col gap-4 h-full" dir="rtl">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-navy-900 dark:text-white">
                            ترتيب الآيات
                        </h3>
                        {/* Chunk indicator */}
                        {isMultiChunk && (
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-violet-100 dark:bg-violet-900/30 rounded-full">
                                <Layers size={11} className="text-violet-600 dark:text-violet-400" />
                                <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400">
                                    {toArabicDigits(chunkIndex + 1)} / {toArabicDigits(totalChunks)}
                                </span>
                            </div>
                        )}
                    </div>
                    <p className="text-xs text-navy-500 dark:text-navy-400 mt-0.5">
                        اضغط على الآيات بالترتيب الصحيح
                        {wrongAttemptsForCurrentSlot > 0 && (
                            <span className="mr-2 text-amber-500 dark:text-amber-400">
                                ({toArabicDigits(wrongAttemptsForCurrentSlot)} {wrongAttemptsForCurrentSlot === 1 ? 'محاولة خاطئة' : 'محاولات خاطئة'})
                            </span>
                        )}
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-xl text-navy-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-navy-500 dark:text-navy-400">
                    <span>الآيات المرتّبة</span>
                    <span>
                        {toArabicDigits(placed.length)} / {toArabicDigits(totalCount)}
                    </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-navy-100 dark:bg-navy-800 overflow-hidden">
                    <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-600"
                        animate={{ width: `${progress * 100}%` }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                    />
                </div>
            </div>

            {/* Placed Ayahs (Ordered So Far) — auto-scrolls to latest */}
            {placed.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                            <Check size={14} />
                            الآيات المرتّبة
                        </p>
                        <button
                            onClick={handleUndo}
                            className="text-[11px] text-navy-400 hover:text-navy-700 dark:hover:text-white flex items-center gap-1 transition-colors"
                        >
                            <RotateCcw size={12} />
                            تراجع
                        </button>
                    </div>
                    <div
                        ref={placedScrollRef}
                        className="max-h-44 overflow-y-auto rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 p-2 space-y-1.5 custom-scrollbar scroll-smooth"
                    >
                        <AnimatePresence>
                            {placed.map((ayah, idx) => {
                                const err = slotErrors[idx];
                                return (
                                    <motion.div
                                        key={ayah.number}
                                        initial={{ opacity: 0, y: -8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex items-start gap-2 px-2 py-1.5 bg-white dark:bg-emerald-950/30 rounded-lg border border-emerald-100 dark:border-emerald-900/40"
                                    >
                                        <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                                            {toArabicDigits(idx + 1)}
                                        </span>
                                        <p className="font-quran text-sm text-navy-900 dark:text-white leading-relaxed line-clamp-2 flex-1">
                                            {getAyahPreview(ayah)}
                                        </p>
                                        {/* Easy mode: show ayah number */}
                                        {quiz.showNumbers && (
                                            <span className="shrink-0 text-[10px] text-navy-400 mt-1">
                                                ({toArabicDigits(ayah.numberInSurah)})
                                            </span>
                                        )}
                                        {/* Show mistakes badge */}
                                        {err && err.mistakes > 0 && (
                                            <span className="shrink-0 text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-bold mt-0.5">
                                                {toArabicDigits(err.mistakes)}×
                                            </span>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                </div>
            )}

            {/* Ayah Pool */}
            <div className="flex-1 space-y-2">
                <p className="text-xs font-bold text-navy-500 dark:text-navy-400">
                    {placed.length === 0
                        ? 'ابدأ بالآية الأولى:'
                        : `اختر الآية رقم ${toArabicDigits(placed.length + 1)}:`}
                </p>

                <div className="space-y-2 flex-1 overflow-y-auto min-h-[10rem] custom-scrollbar pb-1">
                    <AnimatePresence>
                        {pool.map((ayah, idx) => (
                            <motion.button
                                key={ayah.number}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{
                                    opacity: 1,
                                    scale: 1,
                                    x: shakeIndex === idx ? [0, -8, 8, -5, 5, 0] : 0,
                                }}
                                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                transition={{
                                    layout: { duration: 0.22 },
                                    x: shakeIndex === idx
                                        ? { duration: 0.48, times: [0, 0.2, 0.4, 0.6, 0.8, 1] }
                                        : { duration: 0.18 },
                                }}
                                onClick={() => handlePick(ayah, idx)}
                                className={`
                                    w-full flex items-start gap-3 px-4 py-3 rounded-2xl border
                                    bg-white dark:bg-navy-900 text-right
                                    transition-all duration-150
                                    ${shakeIndex === idx
                                        ? 'border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20 shadow-md shadow-red-500/20'
                                        : 'border-navy-100 dark:border-navy-800 hover:border-violet-400 dark:hover:border-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/20 hover:shadow-md hover:shadow-violet-500/10'
                                    }
                                `}
                            >
                                {/* Easy mode: show ayah number next to text */}
                                {quiz.showNumbers && (
                                    <span className="shrink-0 w-8 h-8 rounded-full border-2 border-violet-300 dark:border-violet-700 text-violet-600 dark:text-violet-400 text-xs font-bold flex items-center justify-center">
                                        {toArabicDigits(ayah.numberInSurah)}
                                    </span>
                                )}

                                <p className="font-quran text-base leading-loose text-navy-900 dark:text-white text-right flex-1">
                                    {getAyahPreview(ayah)}
                                </p>

                                <ChevronRight
                                    size={16}
                                    className="shrink-0 mt-1.5 text-navy-300 dark:text-navy-600 rotate-180"
                                />
                            </motion.button>
                        ))}
                    </AnimatePresence>
                </div>
            </div>

            {/* Reset button */}
            {placed.length > 0 && (
                <button
                    onClick={handleReset}
                    className="w-full py-2.5 rounded-xl border border-navy-200 dark:border-navy-700 text-sm font-bold text-navy-500 dark:text-navy-400 hover:bg-navy-100 dark:hover:bg-navy-800 transition-colors flex items-center justify-center gap-2"
                >
                    <RotateCcw size={15} />
                    إعادة البداية
                </button>
            )}
        </div>
    );
};
