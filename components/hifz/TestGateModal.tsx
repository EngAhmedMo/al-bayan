import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertTriangle, BookOpen, BrainCircuit, Play, RefreshCcw } from 'lucide-react';
import { toArabicDigits } from '../../services/normalization';
import { getAyahsForDailyWird, generateDailyQuiz, QuizQuestion } from '../../services/hifzManager';
import { DailyQuizCard } from './QuizComponents';
import { Ayah } from '../../types';

// Event Detail Type (Must match what we dispatched in HifzContext)
interface TestRequestDetail {
    page: number;
    onSuccess: () => void;
    onFailure: () => void;
    onCancel: () => void;
}

export const TestGateModal: React.FC = () => {
    const [request, setRequest] = useState<TestRequestDetail | null>(null);
    const [step, setStep] = useState<'intro' | 'loading' | 'test' | 'success' | 'failure'>('intro');

    // Quiz State
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, boolean>>({});

    // Listen for events
    useEffect(() => {
        const handleRequest = (e: CustomEvent<TestRequestDetail>) => {
            const req = e.detail;
            setRequest(req);
            setStep('intro');
            setQuestions([]);
            setCurrentIndex(0);
            setAnswers({});
        };

        window.addEventListener('hifz-test-request', handleRequest as EventListener);
        return () => window.removeEventListener('hifz-test-request', handleRequest as EventListener);
    }, []);

    const handleStartTest = async () => {
        if (!request) return;
        setStep('loading');

        try {
            // Intelligent Generation:
            // Fetch Ayahs for the specific PAGE requested
            const ayahs = await getAyahsForDailyWird('pages', request.page, 1);

            if (ayahs && ayahs.length > 0) {
                // Generate a mix of questions (Strict Mode = True for higher quality gate)
                // We ask logic to generate quiz for THIS page specifically
                const generatedQuestions = generateDailyQuiz(ayahs, true);

                // Limit to 3 questions for a "Quick Gate" to avoid fatigue
                // Ensure we have at least one test.
                const verificationQuestions = generatedQuestions.slice(0, 3);

                if (verificationQuestions.length > 0) {
                    setQuestions(verificationQuestions);
                    setStep('test');
                } else {
                    // Fallback if generator returns empty (rare)
                    console.warn("Quiz generator returned 0 questions. Auto-passing.");
                    handleSuccess();
                }
            } else {
                console.error("No ayahs found for page " + request.page);
                setStep('failure');
            }
        } catch (e) {
            console.error("Test Load Failed", e);
            setStep('failure');
        }
    };

    const handleAnswer = (isCorrect: boolean) => {
        const currentQ = questions[currentIndex];
        if (!currentQ) return;

        // Record Answer
        const newAnswers = { ...answers, [currentQ.id]: isCorrect };
        setAnswers(newAnswers);

        // Feedback Logic
        if (!isCorrect) {
            // Strict Gate: Failure moves to 'failure' screen after delay
            setTimeout(() => {
                setStep('failure');
            }, 1000);
        } else {
            // Correct! Move to next or finish
            if (currentIndex < questions.length - 1) {
                setTimeout(() => {
                    setCurrentIndex(prev => prev + 1);
                }, 800);
            } else {
                handleSuccess();
            }
        }
    };

    const handleSuccess = () => {
        setStep('success');
        setTimeout(() => {
            request?.onSuccess();
            setTimeout(() => setRequest(null), 2500);
        }, 1500);
    };

    const handleClose = () => {
        request?.onCancel();
        setRequest(null);
    };

    if (!request) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={handleClose}
                    className="absolute inset-0 bg-navy-950/90 backdrop-blur-md"
                />

                {/* Modal Content */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="relative w-full max-w-2xl bg-white dark:bg-navy-900 rounded-3xl shadow-2xl border border-gold-500/20 overflow-hidden max-h-[90vh] overflow-y-auto"
                >
                    {/* Header Bar */}
                    <div className="flex items-center justify-between p-4 border-b border-gold-100 dark:border-navy-800 bg-gradient-to-b from-navy-50 to-white dark:from-navy-900 dark:to-navy-950">
                        <div className="w-8"></div>
                        <h3 className="font-bold text-lg text-navy-900 dark:text-white">بوابة الحفظ</h3>
                        <button onClick={handleClose} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors text-navy-400 hover:text-red-500">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-6 md:p-8 text-center min-h-[400px] flex flex-col items-center justify-center">

                        <AnimatePresence mode="wait">
                            {step === 'intro' && (
                                <motion.div
                                    key="intro"
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                    className="space-y-6 max-w-md mx-auto"
                                >
                                    <div className="w-24 h-24 mx-auto bg-gold-400/10 rounded-full flex items-center justify-center mb-6 relative group">
                                        <BrainCircuit size={48} className="text-gold-500 group-hover:scale-110 transition-transform duration-500" />
                                        <div className="absolute inset-0 border-2 border-gold-500/20 rounded-full animate-ping-slow"></div>
                                    </div>

                                    <div>
                                        <h2 className="text-3xl font-bold text-navy-900 dark:text-white mb-3">
                                            اختبار الجودة
                                        </h2>
                                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-lg">
                                            لنسجل الصفحة <span className="font-bold text-gold-600 mx-1">{toArabicDigits(request.page)}</span> كـ "محفوظة"،<br />
                                            يجب أن تجتاز اختباراً سريعاً من <span className="font-bold text-navy-800 dark:text-white">3 أسئلة</span>.
                                        </p>
                                    </div>

                                    <button
                                        onClick={handleStartTest}
                                        className="w-full py-4 bg-navy-900 dark:bg-gold-500 hover:bg-navy-800 text-white dark:text-navy-900 font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all transform active:scale-95 flex items-center justify-center gap-3 text-lg mt-4"
                                    >
                                        <Play size={24} fill="currentColor" />
                                        <span>بدء التحدي</span>
                                    </button>
                                </motion.div>
                            )}

                            {step === 'loading' && (
                                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                    <div className="flex flex-col items-center gap-4">
                                        <RefreshCcw size={40} className="text-gold-500 animate-spin" />
                                        <p className="text-navy-600 dark:text-gray-400 font-bold">جاري إعداد الأسئلة بذكاء...</p>
                                    </div>
                                </motion.div>
                            )}

                            {step === 'test' && questions.length > 0 && (
                                <motion.div
                                    key={`q-${currentIndex}`}
                                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                                    className="w-full"
                                >
                                    {/* Progress Bar */}
                                    <div className="w-full h-2 bg-gray-100 dark:bg-navy-800 rounded-full mb-8 overflow-hidden">
                                        <motion.div
                                            className="h-full bg-gold-500"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                                        />
                                    </div>

                                    {/* Reusing The Robust Card */}
                                    <DailyQuizCard
                                        question={questions[currentIndex]}
                                        onAnswer={handleAnswer}
                                    />

                                    <p className="mt-8 text-xs text-gray-400 font-bold">
                                        السؤال {toArabicDigits(currentIndex + 1)} من {toArabicDigits(questions.length)}
                                    </p>
                                </motion.div>
                            )}

                            {step === 'success' && (
                                <motion.div
                                    key="success"
                                    initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                    className="space-y-6"
                                >
                                    <div className="w-32 h-32 mx-auto bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4">
                                        <CheckCircle2 size={64} className="text-emerald-500" />
                                    </div>
                                    <h2 className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                                        ما شاء الله!
                                    </h2>
                                    <p className="text-xl text-navy-600 dark:text-gray-300">
                                        حفظ متقن. تم تسجيل الصفحة بنجاح.
                                    </p>
                                </motion.div>
                            )}

                            {step === 'failure' && (
                                <motion.div
                                    key="failure"
                                    initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                    className="space-y-6"
                                >
                                    <div className="w-24 h-24 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                                        <AlertTriangle size={48} className="text-red-500" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">
                                        تحتاج للمزيد من التكرار
                                    </h2>
                                    <p className="text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs mx-auto">
                                        لم تجتز الاختبار بنسبة 100%.<br />
                                        نحن نحرص على جودة حفظك. راجع الصفحة ثم حاول مرة أخرى.
                                    </p>
                                    <div className="flex gap-4 justify-center mt-6">
                                        <button
                                            onClick={handleClose}
                                            className="px-8 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-navy-800 dark:text-gray-300 rounded-xl font-bold transition-colors"
                                        >
                                            سأراجع الآن
                                        </button>
                                        <button
                                            onClick={handleStartTest}
                                            className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-red-500/20"
                                        >
                                            محاولة أخرى
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
