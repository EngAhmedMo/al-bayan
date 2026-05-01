import React, { useState, useEffect, useRef } from 'react';
import {
    RotateCcw, X, BookOpen, Play, CheckCircle2, PartyPopper,
    AlertTriangle, BrainCircuit, Sparkles, ArrowRight, Trophy
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

import { DailyQuizCard } from './QuizComponents';
import { SrsItem, SrsGrade, calculateNextReview } from '../../services/srsAlgorithm';
import { getAyahById } from '../../services/quranStaticData';
import { toArabicDigits } from '../../services/normalization';
import { useQuizFeedback } from '../../hooks/useQuizFeedback';
import { getApproxPageFromGlobalAyah } from '../../services/quranStaticData';

export interface RevisionTasks {
    start: number;
    end: number;
    riskItems: SrsItem[];
}

interface RevisionSessionModalProps {
    tasks: RevisionTasks;
    planType: 'pages' | 'ayahs';
    onClose: () => void;
    onComplete: (results: { updatedSrsItems: SrsItem[] }) => void;
}

export const RevisionSessionModal = ({ tasks, planType, onClose, onComplete }: RevisionSessionModalProps) => {
    const isFocusMode = tasks.start === 0 && tasks.end === 0;
    const [currentStep, setCurrentStep] = useState<'intro' | 'reading' | 'quiz'>(isFocusMode ? 'quiz' : 'intro');
    const [showRiskQuiz, setShowRiskQuiz] = useState(false);
    const [quizCompleted, setQuizCompleted] = useState(false);
    const [currentRiskIndex, setCurrentRiskIndex] = useState(0);
    const { playSound } = useQuizFeedback();
    const navigate = useNavigate();

    // New State for Data
    const [quizContent, setQuizContent] = useState<any[] | null>(null);
    const currentQuizResults = useRef<SrsItem[]>([]);

    // Load Data for Risk Items
    useEffect(() => {
        if (showRiskQuiz && tasks.riskItems.length > 0) {
            setQuizContent(null);
            currentQuizResults.current = [];

            const loadIds = async () => {
                const loaded = await Promise.all(tasks.riskItems.map(async (item: SrsItem) => {
                    const ayah = await getAyahById(item.id);
                    if (!ayah) return null;

                    return {
                        id: item.id,
                        type: 'recite_reveal',
                        questionText: `أكمل الآية (سورة ${ayah.surah?.name || '...'})`,
                        ayah: ayah,
                        correctAnswer: ayah.aya_text
                    };
                }));
                setQuizContent(loaded.filter(Boolean));
            };
            loadIds();
        }
    }, [showRiskQuiz, tasks]);

    if (!tasks) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-navy-950/90 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="relative w-full h-full md:h-auto md:max-h-[90vh] md:max-w-2xl bg-white dark:bg-navy-900 md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden">

                {/* Decorative Background */}
                <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-br from-purple-600 to-indigo-700 opacity-10 pointer-events-none"></div>
                <div className="absolute -top-20 -right-20 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>

                {/* Header */}
                <div className="relative z-10 p-5 md:p-6 border-b border-gray-100 dark:border-navy-800 flex justify-between items-center bg-white/80 dark:bg-navy-900/80 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
                            <RotateCcw size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-navy-900 dark:text-white text-lg">جلسة المراجعة</h3>
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${currentStep === 'intro' ? 'bg-purple-500' : 'bg-gray-300 dark:bg-navy-700'}`}></span>
                                <span className={`w-2 h-2 rounded-full ${currentStep === 'reading' ? 'bg-purple-500' : 'bg-gray-300 dark:bg-navy-700'}`}></span>
                                <span className={`w-2 h-2 rounded-full ${currentStep === 'quiz' ? 'bg-purple-500' : 'bg-gray-300 dark:bg-navy-700'}`}></span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-gray-100 dark:bg-navy-800 text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all flex items-center justify-center"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content Body */}
                <div className="flex-1 overflow-y-auto p-5 md:p-8 custom-scrollbar">
                    <AnimatePresence mode='wait'>
                        {currentStep === 'intro' && (
                            <motion.div
                                key="intro"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex flex-col items-center text-center space-y-8 pt-4"
                            >
                                <div className="relative group cursor-default">
                                    <div className="absolute inset-0 bg-purple-500/20 blur-[60px] rounded-full animate-pulse" />
                                    <div className="relative z-10 w-32 h-32 rounded-[2rem] bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-purple-500/30 transform group-hover:scale-105 transition-transform duration-500">
                                        <BookOpen size={64} className="text-white drop-shadow-lg" />
                                    </div>
                                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-white dark:bg-navy-800 px-4 py-1 rounded-full shadow-lg border border-purple-100 dark:border-purple-900/30 text-xs font-bold text-purple-600 dark:text-purple-400 whitespace-nowrap">
                                        نظام المراجعة الذكي
                                    </div>
                                </div>

                                <div className="space-y-3 max-w-sm">
                                    <h2 className="text-2xl md:text-3xl font-black text-navy-900 dark:text-white leading-tight">
                                        جاهز لمراجعة اليوم؟
                                    </h2>
                                    <p className="text-navy-500 dark:text-navy-300 text-sm md:text-base leading-relaxed">
                                        وردك اليومي يجمع بين التسلسل (الختمة) ومعالجة نقاط الضعف (SRS) لضمان تثبيت الحفظ.
                                    </p>
                                </div>

                                <div className="w-full max-w-sm space-y-3">
                                    <div className="bg-white dark:bg-navy-800 rounded-2xl p-4 border border-gray-100 dark:border-navy-700 shadow-sm flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                                <RotateCcw size={18} />
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-navy-400 font-bold">الورد المتسلسل</p>
                                                <p className="font-black text-navy-900 dark:text-white">
                                                    {planType === 'pages' ? 'صفحات' : 'آيات'} {toArabicDigits(tasks.start)} - {toArabicDigits(tasks.end)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {tasks.riskItems.length > 0 && (
                                        <div className="bg-white dark:bg-navy-800 rounded-2xl p-4 border border-gray-100 dark:border-navy-700 shadow-sm flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                                    <AlertTriangle size={18} />
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-navy-400 font-bold">نقاط التركيز</p>
                                                    <p className="font-black text-red-500">
                                                        {toArabicDigits(tasks.riskItems.length)} مواضع تحتاج مراجعة
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => setCurrentStep('reading')}
                                    className="w-full max-w-sm py-4 md:py-5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl font-bold shadow-xl shadow-purple-500/20 transition-all flex items-center justify-center gap-3 text-lg group"
                                >
                                    <span>ابدأ المراجعة</span>
                                    <ArrowRight className="group-hover:-translate-x-1 transition-transform" />
                                </button>
                            </motion.div>
                        )}

                        {currentStep === 'reading' && (
                            <motion.div
                                key="reading"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                <div className="text-center space-y-2">
                                    <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 rounded-full text-xs font-bold text-purple-600 dark:text-purple-400">
                                        الخطوة 1 من 2
                                    </span>
                                    <h3 className="text-2xl font-black text-navy-900 dark:text-white">قراءة الورد المتسلسل</h3>
                                </div>

                                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-navy-800 dark:to-navy-800/50 border border-purple-100 dark:border-purple-900/20 rounded-3xl p-8 text-center relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl"></div>

                                    <BookOpen size={48} className="mx-auto text-purple-500 mb-4 opacity-80" />
                                    <p className="text-lg font-quran text-navy-700 dark:text-navy-200 leading-loose">
                                        من {planType === 'pages' ? 'صفحة' : 'آية'} <span className="text-purple-600 dark:text-purple-400 font-bold text-2xl mx-1">{toArabicDigits(tasks.start)}</span> إلى <span className="text-purple-600 dark:text-purple-400 font-bold text-2xl mx-1">{toArabicDigits(tasks.end)}</span>
                                    </p>
                                    <p className="text-sm text-navy-400 mt-4 max-w-xs mx-auto">
                                        اقرأ هذا الورد قراءة متأنية من المصحف، وحاول استحضار المعاني.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <button
                                        onClick={() => {
                                            const page = planType === 'pages' ? tasks.start : getApproxPageFromGlobalAyah(tasks.start);
                                            navigate(`/reader?page=${page}`);
                                        }}
                                        className="p-5 bg-white dark:bg-navy-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-navy-700 flex items-center justify-center gap-3 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group"
                                    >
                                        <BookOpen size={24} className="text-gray-400 group-hover:text-purple-500 transition-colors" />
                                        <span className="font-bold text-navy-600 dark:text-navy-300 group-hover:text-purple-700 dark:group-hover:text-purple-300">فتح المصحف</span>
                                    </button>
                                    <button
                                        onClick={() => setCurrentStep('quiz')}
                                        className="p-5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-3 hover:shadow-xl hover:scale-[1.02] transition-all"
                                    >
                                        <CheckCircle2 size={24} />
                                        <span className="font-bold text-lg">أتممت القراءة</span>
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {currentStep === 'quiz' && (
                            <motion.div
                                key="quiz"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="space-y-8 text-center"
                            >
                                <div className="relative inline-block">
                                    <div className="absolute inset-0 bg-emerald-500/30 blur-2xl rounded-full animate-pulse"></div>
                                    <div className="relative z-10 w-24 h-24 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center mx-auto text-white shadow-xl shadow-emerald-500/30">
                                        <Trophy size={40} />
                                    </div>
                                    <div className="absolute -top-2 -right-2">
                                        <Sparkles className="text-yellow-400 animate-bounce" size={24} />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h3 className="text-3xl font-black text-navy-900 dark:text-white">أحسنت!</h3>
                                    <p className="text-navy-500 dark:text-navy-400 text-lg">
                                        تم تسجيل مراجعتك للورد المتسلسل بنجاح.
                                    </p>
                                </div>

                                {tasks.riskItems.length > 0 && !quizCompleted ? (
                                    <div className="max-w-md mx-auto bg-amber-50 dark:bg-amber-900/10 rounded-3xl p-6 border border-amber-100 dark:border-amber-800/30 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>

                                        <div className="relative z-10">
                                            <div className="flex items-center justify-center gap-2 mb-4">
                                                <BrainCircuit className="text-amber-500" size={24} />
                                                <h4 className="font-bold text-navy-900 dark:text-white text-lg">اختبار التركيز</h4>
                                            </div>

                                            <p className="text-navy-600 dark:text-navy-300 text-sm mb-6">
                                                لديك <span className="font-black text-amber-600">{toArabicDigits(tasks.riskItems.length)}</span> مواضع تحتاج إلى تثبيت (SRS). هل تريد اختبارها الآن؟
                                            </p>

                                            {!showRiskQuiz && (
                                                <button
                                                    onClick={() => setShowRiskQuiz(true)}
                                                    className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-2xl font-bold shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Play size={20} fill="currentColor" />
                                                    <span>ابدأ اختبار التركيز</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : quizCompleted && tasks.riskItems.length > 0 ? (
                                    <div className="bg-gray-50 dark:bg-navy-800/50 rounded-2xl border border-gray-100 dark:border-navy-700 p-4 max-w-sm mx-auto">
                                        <h4 className="font-bold text-navy-900 dark:text-white flex items-center justify-center gap-2 mb-4">
                                            <CheckCircle2 size={18} className="text-emerald-500" />
                                            نتائج الاختبار
                                        </h4>
                                        <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                            {currentQuizResults.current.map((item, i) => {
                                                const oldItem = tasks.riskItems.find(r => r.id === item.id);
                                                const oldInterval = oldItem?.interval || 0;
                                                const newInterval = item.interval;
                                                const isBetter = newInterval > oldInterval;

                                                return (
                                                    <div key={i} className="flex items-center justify-between text-xs p-3 bg-white dark:bg-navy-900 rounded-xl shadow-sm">
                                                        <span className="font-bold text-navy-700 dark:text-navy-300">موضع #{toArabicDigits(item.id.replace('ayah_', ''))}</span>
                                                        <div className="flex items-center gap-2 dir-ltr">
                                                            <span className="text-navy-400 line-through">{toArabicDigits(oldInterval)}</span>
                                                            <span className="text-navy-300">→</span>
                                                            <span className={`font-black ${isBetter ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                                {toArabicDigits(newInterval)} أيام
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    !isFocusMode && (
                                        <div className="p-4 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl text-emerald-700 dark:text-emerald-400 text-sm font-bold">
                                            ✨ رائع! لا توجد نقاط ضعف تحتاج لاختبار اليوم.
                                        </div>
                                    )
                                )}

                                {tasks.riskItems.length > 0 && showRiskQuiz && (
                                    <div className="fixed inset-0 z-[60] bg-navy-900/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                                        <div className="w-full max-w-lg bg-white dark:bg-navy-800 rounded-[2rem] p-6 shadow-2xl relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>

                                            <div className="flex justify-between items-center mb-6 relative z-10">
                                                <h4 className="font-bold text-xl text-navy-900 dark:text-white">اختبار نقاط التركيز</h4>
                                                <div className="px-3 py-1 bg-navy-100 dark:bg-navy-700 rounded-full text-xs font-bold text-navy-600 dark:text-navy-300">
                                                    {toArabicDigits(currentRiskIndex + 1)} / {toArabicDigits(tasks.riskItems.length)}
                                                </div>
                                            </div>

                                            <AnimatePresence mode="wait">
                                                {quizContent && quizContent[currentRiskIndex] && (
                                                    <motion.div
                                                        key={currentRiskIndex}
                                                        initial={{ opacity: 0, x: 50 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        exit={{ opacity: 0, x: -50 }}
                                                        transition={{ duration: 0.3 }}
                                                    >
                                                        <DailyQuizCard
                                                            question={quizContent[currentRiskIndex]}
                                                            onAnswer={(correct) => {
                                                                playSound(correct ? 'correct' : 'wrong');
                                                                const grade: SrsGrade = correct ? 3 : 1;
                                                                const currentItem = tasks.riskItems[currentRiskIndex];
                                                                if (currentItem) {
                                                                    const nextItem = calculateNextReview(currentItem, grade);
                                                                    currentQuizResults.current.push(nextItem);
                                                                }
                                                                if (currentRiskIndex < tasks.riskItems.length - 1) {
                                                                    setCurrentRiskIndex(prev => prev + 1);
                                                                } else {
                                                                    setShowRiskQuiz(false);
                                                                    setQuizCompleted(true);
                                                                }
                                                            }}
                                                        />
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            {(!quizContent || !quizContent[currentRiskIndex]) && (
                                                <div className="flex flex-col items-center justify-center py-12">
                                                    <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                                    <p className="text-navy-500 dark:text-navy-400 font-medium">جاري إعداد الاختبار...</p>
                                                </div>
                                            )}

                                            <button
                                                onClick={() => setShowRiskQuiz(false)}
                                                className="absolute top-4 left-4 p-2 text-gray-400 hover:text-red-500 transition-colors"
                                            >
                                                <X size={20} />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={() => {
                                        playSound('complete');
                                        onComplete({ updatedSrsItems: currentQuizResults.current });
                                    }}
                                    className="w-full max-w-sm mx-auto py-5 bg-navy-900 dark:bg-white dark:text-navy-900 text-white rounded-2xl font-bold shadow-xl transition-all hover:scale-105 active:scale-95"
                                >
                                    إغلاق وإتمام
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};
