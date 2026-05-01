import React, { useState, useEffect } from 'react';
import { Play, Check, X, HelpCircle, Eye, EyeOff, RotateCcw, GripHorizontal, Sparkles } from 'lucide-react';
import { cleanQuranText, toArabicDigits } from '../../services/normalization';
import { motion, AnimatePresence } from 'framer-motion';

// --- Design System ---
const GLASS_PANEL = "bg-white dark:bg-navy-800 rounded-[2rem] border border-gray-100 dark:border-navy-700 shadow-xl";
const QURAN_FONT = "font-quran font-normal leading-[2.5] text-3xl md:text-5xl text-center";

export const InteractiveWordReorder = ({ words, onComplete }: { words: string[], onComplete: (correct: boolean) => void }) => {
    const [availableWords, setAvailableWords] = useState<{ id: number, text: string }[]>([]);
    const [selectedWords, setSelectedWords] = useState<{ id: number, text: string }[]>([]);
    const [isWrong, setIsWrong] = useState(false);

    useEffect(() => {
        const shuffled = words
            .map((w, i) => ({ id: i, text: w }))
            .sort(() => Math.random() - 0.5);
        setAvailableWords(shuffled);
        setSelectedWords([]);
        setIsWrong(false);
    }, [words]);

    const handleSelect = (word: { id: number, text: string }) => {
        if (isWrong) return;
        setSelectedWords(prev => [...prev, word]);
        setAvailableWords(prev => prev.filter(w => w.id !== word.id));
    };

    const handleRemove = (word: { id: number, text: string }) => {
        if (isWrong) return;
        setAvailableWords(prev => [...prev, word]);
        setSelectedWords(prev => prev.filter(w => w.id !== word.id));
    };

    const checkResult = () => {
        const userText = selectedWords.map(w => w.text).join(' ');
        const correctText = words.join(' ');
        const isCorrect = userText.trim() === correctText.trim();

        if (isCorrect) {
            onComplete(true);
        } else {
            setIsWrong(true);
            if (navigator.vibrate) navigator.vibrate(200);
            setTimeout(() => setIsWrong(false), 1000);
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full">
            {/* Drop Zone */}
            <motion.div
                animate={isWrong ? { x: [-10, 10, -10, 10, 0] } : {}}
                className={`min-h-[160px] p-6 rounded-3xl transition-all duration-300 flex flex-wrap justify-center items-center gap-3 relative overflow-hidden ${isWrong
                    ? 'bg-red-50 dark:bg-red-900/10 border-2 border-red-500/50'
                    : 'bg-gray-50 dark:bg-navy-900/50 border-2 border-dashed border-gray-200 dark:border-navy-700'}`}
                dir="rtl"
            >
                {selectedWords.length === 0 && (
                    <div className="flex flex-col items-center gap-3 text-gray-400 absolute inset-0 justify-center pointer-events-none">
                        <div className="p-4 bg-white dark:bg-navy-800 rounded-full shadow-sm">
                            <GripHorizontal size={24} className="opacity-50" />
                        </div>
                        <span className="text-sm font-bold opacity-70">رتب الكلمات لتكوين الآية الكريمة</span>
                    </div>
                )}
                <AnimatePresence mode="popLayout">
                    {selectedWords.map((w) => (
                        <motion.button
                            layoutId={`word-${w.id}`}
                            key={`sel_${w.id}`}
                            onClick={() => handleRemove(w)}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="px-5 py-3 bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 rounded-2xl text-xl md:text-2xl font-quran hover:scale-105 active:scale-95 transition-transform"
                        >
                            {w.text}
                        </motion.button>
                    ))}
                </AnimatePresence>
            </motion.div>

            {/* Word Bank */}
            <div className="flex flex-wrap justify-center gap-3 bg-white dark:bg-navy-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-navy-700" dir="rtl">
                <AnimatePresence mode="popLayout">
                    {availableWords.map((w) => (
                        <motion.button
                            layoutId={`word-${w.id}`}
                            key={`av_${w.id}`}
                            onClick={() => handleSelect(w)}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="px-5 py-3 bg-gray-50 dark:bg-navy-700 hover:bg-gray-100 dark:hover:bg-navy-600 text-navy-800 dark:text-gray-200 border border-gray-200 dark:border-navy-600 rounded-2xl text-xl md:text-2xl font-quran active:scale-95 transition-all shadow-sm"
                        >
                            {w.text}
                        </motion.button>
                    ))}
                </AnimatePresence>
                {availableWords.length === 0 && (
                    <div className="text-gray-400 text-sm font-bold py-2">
                        تم استخدام جميع الكلمات
                    </div>
                )}
            </div>

            {/* Check Button */}
            <AnimatePresence>
                {availableWords.length === 0 && selectedWords.length > 0 && (
                    <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={checkResult}
                        className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                    >
                        <Check size={20} />
                        تثبيت الإجابة
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
};

export const DailyQuizCard = ({ question, onAnswer }: { question: any, onAnswer: (correct: boolean) => void }) => {
    const [revealed, setRevealed] = useState(false);
    const [revealedWords, setRevealedWords] = useState<number[]>([]);
    // MCQ state
    const [mcqSelected, setMcqSelected] = useState<string | null>(null);
    const [mcqAnswered, setMcqAnswered] = useState(false);

    useEffect(() => {
        setRevealed(false);
        setRevealedWords([]);
        setMcqSelected(null);
        setMcqAnswered(false);
    }, [question?.id]);

    if (!question) return null;

    const words = cleanQuranText(question.ayah.aya_text || question.ayah.text).split(/\s+/).filter((w: string) => w.length > 0);
    const isRevealMode = question.type === 'recite_reveal' || question.type === 'complete_next';
    const isInteractiveReorder = question.type === 'reorder';
    const MCQ_TYPES = ['identify_surah', 'missing_word', 'next_ayah_mcq', 'identify_juz'];
    const isMCQ = MCQ_TYPES.includes(question.type) && Array.isArray(question.options);

    const handleMCQPick = (option: string) => {
        if (mcqAnswered) return;
        setMcqSelected(option);
        setMcqAnswered(true);
        const normalise = (s: string) => s.trim().replace(/\s+/g, ' ');
        const isCorrect = normalise(option) === normalise(String(question.correctAnswer));
        setTimeout(() => onAnswer(isCorrect), 700);
    };

    const toggleWord = (idx: number) => {
        if (revealedWords.includes(idx)) {
            setRevealedWords(prev => prev.filter(i => i !== idx));
        } else {
            setRevealedWords(prev => [...prev, idx]);
        }
    };

    return (
        <div className={`flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full`}>
            <div className="flex justify-center">
                <span className="px-4 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-full shadow-sm border border-indigo-100 dark:border-indigo-800/30">
                    {question.type === 'first_word' ? 'بداية الآية' :
                        question.type === 'last_word' ? 'خاتمة الآية' :
                            question.type === 'reorder' ? 'ترتيب الكلمات' :
                                question.type === 'identify_surah' ? 'تحديد السورة' :
                                    question.type === 'missing_word' ? 'الكلمة الناقصة' :
                                        question.type === 'next_ayah_mcq' ? 'الآية التالية' :
                                            question.type === 'identify_juz' ? 'تحديد الجزء' :
                                                'تسميع غيبي'}
                </span>
            </div>

            {/* Question Card */}
            <div className={`${GLASS_PANEL} p-8 md:p-10 text-center relative overflow-hidden group`}>
                {/* Background Glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gold-400/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none group-hover:bg-gold-400/10 transition-all duration-700"></div>

                <h4 className="text-xl md:text-2xl text-navy-800 dark:text-gray-100 font-bold leading-relaxed mb-8 opacity-90 relative z-10" dir="rtl">
                    {/* Parse and render mixed text (Instruction + Quran) */}
                    {question.questionText.split(/(".*?"|“.*?”)/g).map((part: string, i: number) => {
                        // Detect if this part is a quote (Quranic Text)
                        const isQuote = part.startsWith('"') || part.startsWith('“');
                        if (isQuote) {
                            // Strip quotes for cleaner look or keep them? User asked for "Quote Style".
                            // Usage: <span className="font-quran text-3xl mx-2 text-indigo-700 dark:text-indigo-300 relative top-1">
                            return (
                                <span key={i} className={`font-quran font-normal text-3xl md:text-4xl mx-2 text-navy-900 dark:text-gold-400 inline-block leading-normal ${part.length > 20 ? 'block mt-2' : ''}`}>
                                    {part.replace(/["“]/g, '').replace(/["”]/g, '')}
                                </span>
                            );
                        }
                        return <span key={i}>{part}</span>;
                    })}
                </h4>

                {/* Interactive Area */}
                <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-4 min-h-[120px] relative z-10" dir="rtl">

                    {isMCQ ? (
                        /* ── MCQ: Multiple Choice Question ──────────────────── */
                        <div className="flex flex-col gap-4 w-full" dir="rtl">
                            {/* Context: ayah preview */}
                            <div className="p-4 bg-gold-50 dark:bg-navy-900/60 rounded-2xl border border-gold-100 dark:border-navy-700">
                                <p className="font-quran text-2xl md:text-3xl text-navy-900 dark:text-gold-400 leading-relaxed text-center">
                                    {question.contextText || cleanQuranText(question.ayah.aya_text || question.ayah.text)}
                                </p>
                            </div>
                            {/* 4 option buttons */}
                            <div className="grid grid-cols-1 gap-2.5">
                                {question.options.map((option: string, idx: number) => {
                                    const normalise = (s: string) => s.trim().replace(/\s+/g, ' ');
                                    const isCorrectOption = normalise(option) === normalise(String(question.correctAnswer));
                                    const isSelected = mcqSelected === option;

                                    let btnClass = 'bg-white dark:bg-navy-800 border-gray-200 dark:border-navy-700 text-navy-900 dark:text-white hover:border-gold-400 dark:hover:border-gold-600 hover:bg-gold-50 dark:hover:bg-gold-950/20';
                                    if (mcqAnswered) {
                                        if (isCorrectOption) {
                                            btnClass = 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-400 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300';
                                        } else if (isSelected) {
                                            btnClass = 'bg-red-50 dark:bg-red-950/20 border-red-400 dark:border-red-600 text-red-600 dark:text-red-400';
                                        } else {
                                            btnClass = 'bg-white dark:bg-navy-800 border-gray-200 dark:border-navy-700 text-navy-400 dark:text-navy-500 opacity-60';
                                        }
                                    }

                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => handleMCQPick(option)}
                                            disabled={mcqAnswered}
                                            className={`w-full py-3 px-4 rounded-xl border-2 font-bold text-right transition-all duration-150 ${btnClass} ${mcqAnswered ? 'cursor-default' : 'active:scale-[0.98]'}`}
                                        >
                                            <span className="font-quran text-xl leading-relaxed">{option}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : isInteractiveReorder && !revealed ? (
                        <InteractiveWordReorder words={words} onComplete={() => setRevealed(true)} />
                    ) : isRevealMode ? (

                        words.map((word: string, i: number) => {
                            const isPrompt = question.type === 'complete_next' && i < Math.max(2, Math.floor(words.length / 2));
                            const isWordRevealed = revealed || revealedWords.includes(i) || isPrompt;

                            return (
                                <button
                                    key={i}
                                    onClick={() => toggleWord(i)}
                                    className={`relative transition-all duration-300 rounded-xl p-2 ${isWordRevealed
                                        ? 'text-navy-900 dark:text-white scale-100'
                                        : 'text-transparent bg-gray-100 dark:bg-white/5 hover:bg-indigo-50 dark:hover:bg-white/10 scale-95'}`}
                                >
                                    <span className={`font-quran text-2xl md:text-4xl ${!isWordRevealed && 'blur-sm select-none'}`}>
                                        {word}
                                    </span>
                                    {/* Reveal Icon overlay for unrevealed words */}
                                    {!isWordRevealed && (
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                            <Eye size={20} className="text-indigo-400" />
                                        </div>
                                    )}
                                </button>
                            );
                        })
                    ) : (
                        // Standard Question Display
                        !revealed ? (
                            <div className="flex flex-col items-center gap-6 py-8">
                                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center animate-pulse shadow-lg shadow-indigo-500/20">
                                    <HelpCircle size={48} className="text-white" />
                                </div>
                                <p className="text-gray-400 text-sm font-bold bg-white dark:bg-navy-900 px-4 py-2 rounded-full shadow-sm">
                                    حاول التذكر قبل كشف الإجابة
                                </p>
                            </div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="w-full p-6 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-3xl border border-emerald-100 dark:border-emerald-800/30"
                            >
                                <p className={`text-navy-900 dark:text-gold-400 ${QURAN_FONT}`}>
                                    {cleanQuranText(typeof question.correctAnswer === 'string' ? question.correctAnswer : question.correctAnswer.join(' '))}
                                </p>
                            </motion.div>
                        )
                    )}
                </div>

                {/* Hint Text */}
                {isRevealMode && !revealed && (
                    <div className="mt-8 flex items-center justify-center gap-2 text-xs font-bold text-gray-400">
                        <EyeOff size={14} />
                        <span>اضغط على الكلمات المخفية لكشفها عند الحاجة</span>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="w-full">
                {!revealed ? (
                    isInteractiveReorder ? null : ( // Interactive Reorder has its own submit button
                        <button
                            onClick={() => setRevealed(true)}
                            className="w-full py-5 bg-navy-900 dark:bg-white text-white dark:text-navy-900 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center justify-center gap-3"
                        >
                            <Play size={24} fill="currentColor" />
                            إظهار الإجابة
                        </button>
                    )
                ) : (
                    <div className="animate-in slide-in-from-bottom-4 fade-in duration-300 flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => onAnswer(false)}
                                className="group py-5 bg-white dark:bg-navy-800 border-2 border-red-100 dark:border-red-900/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl font-bold text-lg transition-all flex flex-col items-center justify-center gap-2 hover:border-red-500"
                            >
                                <X size={32} className="group-hover:scale-110 transition-transform" />
                                <span>أخطأت</span>
                            </button>

                            <button
                                onClick={() => onAnswer(true)}
                                className="group py-5 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl font-bold text-lg transition-all flex flex-col items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 hover:scale-[1.02] hover:shadow-xl"
                            >
                                <Check size={32} className="group-hover:scale-110 transition-transform" />
                                <span>أجبت صحيحاً</span>
                            </button>
                        </div>
                        <p className="text-center text-xs font-bold text-gray-400">
                            تقييمك الذاتي يساعدنا في تحديد موعد المراجعة القادمة
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
