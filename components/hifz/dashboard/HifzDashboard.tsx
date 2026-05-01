import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHifz } from '../../../contexts/HifzContext';
import {
    BookOpen, Calendar, ChevronRight, RotateCcw, Save, Trash2,
    TrendingUp, Award, Share2, Edit2, Play, Pause, Square,
    Settings, Volume2, AlertTriangle, X, Flame, CheckCircle2,
    BrainCircuit, ArrowUpRight, Check, Layers,
    Circle, Trophy, ArrowLeft, ScrollText, Target, History as HistoryIcon,
    Clock, ArrowLeftRight, HelpCircle, Bell, BellOff, Star,
    Medal, Crown, Zap, Download, Sparkles, Gem, PartyPopper
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

// Components
import { TopBar } from '../../TopBar';
import { RevisionSessionModal, RevisionTasks } from '../RevisionSessionModal';
import { RevisionSetupModal } from '../RevisionSetupModal';
import { DailyQuizCard } from '../QuizComponents';
// Charts moved to lazy loaded component
// import { ReviewForecast, MistakeHistoryChart, AccuracyTrendChart, ConsistencyHeatmap, SRSStrengthChart } from '../HifzAnalytics';
import { ProgressShareCard } from '../ProgressShareCard';
import { AchievementsSection } from './AchievementsSection';
import { SelfTestModal } from '../SelfTestModal';
import { BlankedMushafOverlay } from './BlankedMushafOverlay';
import { ProgressCard } from './ProgressCard';
import { StreakCard } from './StreakCard';
import { EstimationCard } from './EstimationCard';
import { ActionCenter } from './ActionCenter';
import { HifzService } from '../../../services/HifzService';
import { useQuizFeedback } from '../../../hooks/useQuizFeedback';

// Lazy Load Charts for Fluidity
const HifzChartsSection = React.lazy(() => import('./HifzChartsSection').then(m => ({ default: m.HifzChartsSection })));

// Services
import { cleanQuranText, toArabicDigits } from '../../../services/normalization';
import { generateDailyQuiz, evaluateQuiz, getAyahsForDailyWird, generateRevisionQuiz, HifzTestResult, QuizQuestion, fetchAyahsByGlobalIds } from '../../../services/hifzManager';
import { calculateNextReview, createNewSrsItem, SrsItem, SrsGrade, getDueItems } from '../../../services/srsAlgorithm';
import {
    getMetadataFromGlobalAyah,
    getApproxGlobalAyahFromPage,
    getApproxPageFromGlobalAyah,
    getStaticPage,
    SURAH_NAMES_ARABIC,
    getOfflinePageContext,
    formatOfflineRubInfo
} from '../../../services/quranStaticData';
import { ACHIEVEMENTS } from '../../../services/gamification';

// Types
interface HifzDashboardProps {
    onEditPlan: () => void;
    onShowCalendar: () => void;
    onUndoCompletion: () => void; // Added Prop
}

export const HifzDashboard: React.FC<HifzDashboardProps> = ({ onEditPlan, onShowCalendar, onUndoCompletion }) => {
    const { state, updateState, streak, totalTarget, progressPercent, markPageAsMemorized, resetPlan } = useHifz();
    const navigate = useNavigate();
    const { playSound } = useQuizFeedback(); // Restored Audio Hook

    // Local UI State
    const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
    const [dailyQuizQuestions, setDailyQuizQuestions] = useState<QuizQuestion[]>([]);
    const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
    const [quizAnswers, setQuizAnswers] = useState<Record<string, boolean>>({});
    const [isQuizFinished, setIsQuizFinished] = useState(false);
    const [showMistakesReview, setShowMistakesReview] = useState(false); // New State
    const [selectedDayDetails, setSelectedDayDetails] = useState<{ date: string, isDone: boolean, testResult?: HifzTestResult } | null>(null); // Heatmap Interaction
    const [consecutiveFails, setConsecutiveFails] = useState(0);
    const [achievementToast, setAchievementToast] = useState<import('../../../services/gamification').Achievement[] | null>(null); // For Toast Notification
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [testStartTime, setTestStartTime] = useState<number>(0);
    const [activeQuizType, setActiveQuizType] = useState<'daily' | 'revision'>('daily');
    const [isQuizLoading, setIsQuizLoading] = useState(false);

    // Blanked Mushaf State
    const [isBlankedMushafOpen, setIsBlankedMushafOpen] = useState(false);
    const [mushafPages, setMushafPages] = useState<{ page: number, ayahs: any[] }[]>([]);
    const [currentBlankedPageIndex, setCurrentBlankedPageIndex] = useState(0);
    const [revealedAyahs, setRevealedAyahs] = useState<Set<number>>(new Set());

    // Revision Session State - NOW USING CONTEXT
    const {
        activeSession, setActiveSession,
        revisionTasks: ctxRevisionTasks, setRevisionTasks: setCtxRevisionTasks
    } = useHifz();

    // Local fallback for setup modal visibility (Setup is transient)
    const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);

    // Sync local derived state
    const showRevisionSession = activeSession === 'revision';

    // Context Data State
    const [contextInfo, setContextInfo] = useState<{ rub: string, juz: number } | null>(null);

    // Fetch Context Data
    React.useEffect(() => {
        if (!state) return;
        const targetLoc = state.startPoint + state.currentProgress;
        let targetPage = 1;

        if (state.planType === 'pages') {
            targetPage = Math.min(Math.max(targetLoc, 1), 604);
        } else {
            targetPage = getApproxPageFromGlobalAyah(targetLoc);
        }

        // Offline Calculation
        const data = getOfflinePageContext(targetPage);
        setContextInfo({
            rub: formatOfflineRubInfo(data.hizbQuarter),
            juz: data.juz
        });
    }, [state?.currentProgress, state?.startPoint, state?.planType]);

    // Delayed loading for heavy charts to allow smooth navigation animation first
    const [showCharts, setShowCharts] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => {
            setShowCharts(true);
        }, 800); // Wait for page transition to finish
        return () => clearTimeout(timer);
    }, []);

    const shareCardRef = useRef<HTMLDivElement>(null);
    const [isGeneratingShare, setIsGeneratingShare] = useState(false);

    // --- Actions ---
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const handleDeleteClick = () => {
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = () => {
        resetPlan();
        setIsDeleteModalOpen(false);
    };

    const dashboardActions = (
        <div className="flex items-center gap-1">
            <button
                onClick={onEditPlan}
                className="w-10 h-10 rounded-xl bg-white/80 dark:bg-navy-900/40 backdrop-blur-sm border border-navy-100 dark:border-gold-500/50 text-navy-600 dark:text-gold-400 hover:border-gold-400 hover:text-gold-600 dark:hover:text-gold-300 hover:bg-gold-50/50 dark:hover:bg-gold-500/10 shadow-sm transition-all duration-200 active:scale-95 flex items-center justify-center"
                title="تعديل الخطة"
            >
                <Edit2 size={20} />
            </button>
            <button
                onClick={() => setIsGeneratingShare(true)}
                disabled={isGeneratingShare}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/80 dark:bg-navy-900/40 backdrop-blur-sm border border-navy-100 dark:border-gold-500/50 text-navy-600 dark:text-gold-400 hover:border-gold-400 hover:text-gold-600 dark:hover:text-gold-300 hover:bg-gold-50/50 dark:hover:bg-gold-500/10 shadow-sm transition-all duration-200 active:scale-95 disabled:opacity-50"
                title="مشاركة التقدم"
            >
                <Share2 size={20} />
            </button>
            <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1"></div>
            <button
                onClick={handleDeleteClick}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/80 dark:bg-navy-900/40 backdrop-blur-sm border border-red-100 dark:border-red-900/30 text-red-500 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 shadow-sm transition-all duration-200 active:scale-95"
                title="حذف الخطة"
            >
                <Trash2 size={20} />
            </button>
        </div>
    );

    // Share Logic
    React.useEffect(() => {
        if (isGeneratingShare && shareCardRef.current) {
            const generateAndShare = async () => {
                try {
                    // Capture
                    const canvas = await html2canvas(shareCardRef.current!, {
                        scale: 2,
                        backgroundColor: '#1e1b4b', // Match card bg
                        useCORS: true
                    } as any);

                    const base64 = canvas.toDataURL('image/jpeg', 0.8);
                    const fileName = `hifz_progress_${Date.now()}.jpg`;

                    // Save to FS
                    const savedFile = await Filesystem.writeFile({
                        path: fileName,
                        data: base64,
                        directory: Directory.Cache
                    });

                    // Share
                    await Share.share({
                        title: 'تقدمي في حفظ القرآن',
                        text: `الحمد لله، أتممت حفظ ${state?.currentProgress} ${state?.planType === 'pages' ? 'صفحة' : 'آية'} من كتاب الله!`,
                        url: savedFile.uri,
                        dialogTitle: 'شارك إنجازك'
                    });

                } catch (e) {
                    console.error('Share failed', e);
                } finally {
                    setIsGeneratingShare(false);
                }
            };
            generateAndShare();
        }
    }, [isGeneratingShare, state?.currentProgress, state?.planType]);

    // Self Test State
    const [showSelfTest, setShowSelfTest] = useState(false);
    const [adaptiveAlert, setAdaptiveAlert] = useState<string | null>(null);
    const [testAyahs, setTestAyahs] = useState<Array<{ text: string; surah: string; ayahNum: number; surahNum: number; srsId?: string }>>([]);
    const [currentTestIndex, setCurrentTestIndex] = useState(0);
    const [showAnswer, setShowAnswer] = useState(false);
    const [testScore, setTestScore] = useState({ correct: 0, total: 0 });
    const [sessionGrades, setSessionGrades] = useState<{ index: number; grade: number }[]>([]);


    // --- Helpers provided by Hifz.tsx originally, now derived from context ---
    const getLocalTodayString = (): string => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const isTodayDone = state?.lastCompletedDate === getLocalTodayString();


    const getEstimation = () => {
        if (!state) return { date: '', remainingDays: 0 };
        const total = state.planType === 'pages' ? 604 : 6236;
        const progress = state.currentProgress;
        const remainingUnits = Math.max(0, total - (state.startPoint - 1) - progress);

        if (remainingUnits <= 0) return { date: 'مكتمل', remainingDays: 0 };

        const weeklySpeed = state.amountPerDay * state.daysPerWeek;
        if (weeklySpeed === 0) return { date: 'غير محدد', remainingDays: 0 };

        const weeksLeft = remainingUnits / weeklySpeed;
        const daysLeft = weeksLeft * 7;
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + daysLeft);

        return {
            date: targetDate.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }),
            remainingDays: Math.ceil(daysLeft)
        };
    };

    const estimation = getEstimation();

    // --- Actions ---

    const handleGoToLocation = () => {
        if (!state) return;
        const targetLocation = state.startPoint + state.currentProgress;

        if (state.planType === 'pages') {
            const page = Math.min(Math.max(targetLocation, 1), 604);
            navigate(`/reader?page=${page}`);
        } else {
            const globalAyah = Math.min(Math.max(targetLocation, 1), 6236);
            const meta = getMetadataFromGlobalAyah(globalAyah);
            const pageOfAyah = getApproxPageFromGlobalAyah(globalAyah);
            navigate(`/reader?surah=${meta.surahNumber}&ayah=${meta.ayahInSurah}&page=${pageOfAyah}&highlight=${meta.surahNumber}:${meta.ayahInSurah}`);
        }
    };

    const handleCompleteToday = (skipQuiz = false) => {
        if (!state) return;

        if (!skipQuiz && !isTodayDone) {
            setTestStartTime(Date.now());
            setActiveQuizType('daily');
            handleStartDailyQuiz();
            return;
        }

        const newState = HifzService.completeDailyWird(state);
        updateState(newState);

        if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
    };



    const handleStartFocusSession = async () => {
        if (!state) return;
        const mistakeIds = HifzService.getTopMistakes(state, 20);
        if (mistakeIds.length === 0) return;

        setIsQuizLoading(true);
        try {
            const ayahs = await fetchAyahsByGlobalIds(mistakeIds);
            const questions = generateDailyQuiz(ayahs, true); // Strict Mode logic
            setDailyQuizQuestions(questions);
            setCurrentQuizIndex(0);
            setQuizAnswers({});
            setIsQuizFinished(false);
            setActiveQuizType('revision'); // Reuse revision type
            setIsQuizModalOpen(true);
            setTestStartTime(Date.now());
        } catch (e) {
            console.error("Focus session gen failed", e);
        } finally {
            setIsQuizLoading(false);
        }
    };

    const handleStartDailyQuiz = async () => {
        if (!state) return;
        const startLoc = state.startPoint + state.currentProgress;

        setIsQuizLoading(true);
        try {
            const ayahs = await getAyahsForDailyWird(state.planType, startLoc, state.amountPerDay);
            if (ayahs.length === 0) {
                handleCompleteToday(true);
                return;
            }
            const questions = generateDailyQuiz(ayahs, true);
            setDailyQuizQuestions(questions);
            setCurrentQuizIndex(0);
            setQuizAnswers({});
            setIsQuizFinished(false);
            setTestStartTime(Date.now()); // Start timer
            setIsQuizModalOpen(true);
        } catch (e) {
            console.error("Quiz gen failed", e);
            handleCompleteToday(true);
        } finally {
            setIsQuizLoading(false);
        }
    };

    const handleQuizAnswer = (correct: boolean) => {
        const q = dailyQuizQuestions[currentQuizIndex];
        setQuizAnswers(prev => ({ ...prev, [q.id]: correct }));

        if (!correct) {
            playSound('wrong'); // Audio Feedback
            const newFails = consecutiveFails + 1;
            setConsecutiveFails(newFails);

            if (newFails >= 3) {
                const newQs = [...dailyQuizQuestions];
            }
        } else {
            setConsecutiveFails(0);
        }

        if (currentQuizIndex < dailyQuizQuestions.length - 1) {
            setCurrentQuizIndex(prev => prev + 1);
        } else {
            finishQuiz();
        }
    };

    const finishQuiz = () => {
        setIsQuizFinished(true);
        if (!state) return;

        const result = evaluateQuiz(dailyQuizQuestions, quizAnswers);
        const testResult: HifzTestResult = {
            date: HifzService.getTodayString(),
            score: result.score,
            duration: (Date.now() - testStartTime) / 1000,
            totalItems: dailyQuizQuestions.length,
            correctItems: Object.values(quizAnswers).filter(Boolean).length,
            mistakes: dailyQuizQuestions.length - Object.values(quizAnswers).filter(Boolean).length,
            type: activeQuizType
        };

        const { newState, alerts } = HifzService.processQuizResult(
            state,
            testResult,
            { questions: dailyQuizQuestions, answers: quizAnswers }
        );

        if (alerts.includes('adaptive_reorder')) {
            setAdaptiveAlert('يبدو أنك تواجه بعض الصعوبات في الاختبارات الأخيرة. هل تود أن نقترح عليك تخفيف الكمية اليومية أو تغيير نمط الاختبار؟');
        }

        if (result.passed) {
            playSound('complete'); // Audio Feedback
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

            // Commit State
            updateState(newState);

            // Check Achievements
            const { newState: achievementsState, newAchievements } = HifzService.checkAndUnlockAchievements(newState);
            if (newAchievements.length > 0) {
                updateState(achievementsState);
                // Toast handled via event listener
            }

            if (activeQuizType === 'daily') {
                handleCompleteToday(true);
            }
        } else {
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            updateState(newState);
        }
    };

    // --- Helper for Blanked Mushaf ---
    const handleOpenBlankedMushaf = async (startPage: number, pageCount: number) => {
        // FIX: Load data FIRST, then open overlay (prevents white screen race condition)
        try {
            const pagesToLoad = Array.from({ length: pageCount }, (_, i) => startPage + i);
            console.log(`[HifzDashboard] Loading ${pagesToLoad.length} pages for Blanked Mushaf...`);

            const loaded = await Promise.all(
                pagesToLoad.map(async p => {
                    const ayahs = await getStaticPage(p);
                    return { page: p, ayahs };
                })
            );

            // Filter out any pages with no ayahs
            const validPages = loaded.filter(p => p.ayahs && p.ayahs.length > 0);

            // Only open if we have valid data
            if (validPages.length > 0) {
                setMushafPages(validPages as any);
                setIsBlankedMushafOpen(true);  // Open AFTER data is ready
                console.log(`[HifzDashboard] Loaded ${validPages.length} pages successfully`);
            } else {
                console.error('[HifzDashboard] No valid pages found');
                alert('عذراً، لا يمكن تحميل الصفحة المطلوبة');
            }
        } catch (error) {
            console.error('[HifzDashboard] Failed to load Blanked Mushaf pages:', error);
            alert('حدث خطأ أثناء تحميل الصفحة');
        }
    };

    const startSelfTest = () => {
        setShowSelfTest(true);
    };

    const handleStartRevision = (settings: { start: number; end: number; includeRisks: boolean }) => {
        if (!state) return;

        // Get due risks
        const dueRisks = getDueItems(state.srsItems || [], 20);

        const tasks = {
            start: settings.start,
            end: settings.end,
            riskItems: dueRisks
        };

        // Save to Context
        setCtxRevisionTasks(tasks);
        setActiveSession('revision');
        setIsSetupModalOpen(false);
    };

    const handleCloseRevision = () => {
        if (confirm('هل أنت متأكد من إلغاء جلسة المراجعة؟ سيتم فقدان التقدم الحالي.')) {
            setActiveSession(null);
            setCtxRevisionTasks(null);
        }
    };

    const handleCompleteRevision = (results: { updatedSrsItems: any[] }) => {
        // Update SRS Items in global state
        if (state) {
            const newSrsItems = HifzService.mergeSrsItems(state.srsItems || [], results.updatedSrsItems);
            updateState({
                ...state,
                srsItems: newSrsItems
            });
        }

        // Reset Session
        setActiveSession(null);
        setCtxRevisionTasks(null);

        // Feedback
        if (navigator.vibrate) navigator.vibrate([50, 50, 100]);
        playSound('complete');
    };

    const handleDayClick = (date: string, isDone: boolean) => {
        // Find test result for this date
        const testResult = state?.testHistory?.find(h => h.date === date);
        setSelectedDayDetails({ date, isDone, testResult });
    };

    // --- Backup & Restore Logic ---
    const handleExportBackup = async () => {
        if (!state) return;

        try {
            const json = HifzService.createBackup(state);
            const fileName = `albayan_backup_${new Date().toISOString().slice(0, 10)}.json`;

            // Check Platform using Capacitor helper or window
            const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform();

            if (isNative) {
                // --- Mobile: Save to Cache & Share ---
                try {
                    // 1. Write file
                    const result = await Filesystem.writeFile({
                        path: fileName,
                        data: json,
                        directory: Directory.Cache,
                        encoding: Encoding.UTF8
                    });

                    // 2. Share file
                    await Share.share({
                        title: 'النسخة الاحتياطية - البيان',
                        text: 'ملف النسخة الاحتياطية لتقدم الحفظ في تطبيق البيان',
                        url: result.uri,
                        dialogTitle: 'حفظ النسخة الاحتياطية'
                    });
                } catch (err) {
                    console.error('Native export failed', err);
                    alert('عذراً، حدث خطأ أثناء تصدير الملف على الهاتف.');
                }
            } else {
                // --- Web: Download Blob ---
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 1000); // Cleanup
            }
        } catch (e) {
            console.error('Export Generation Failed', e);
            alert('حدث خطأ غير متوقع أثناء إنشاء النسخة الاحتياطية.');
        }
    };

    const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset input so same file can be selected again if needed
        e.target.value = '';

        if (!file.name.endsWith('.json')) {
            alert('عذراً، يجب اختيار ملف بصيغة .json');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                const restoredState = HifzService.validateAndRestore(content);

                // Safety confirm
                if (confirm(`تم قراءة النسخة الاحتياطية بنجاح.\nعدد السجلات: ${restoredState.history.length}\nهل تريد استبدال البيانات الحالية؟`)) {
                    updateState(restoredState);
                    alert('تم استعادة النسخة الاحتياطية بنجاح! سيتم تحديث الصفحة.');
                    // Optional: window.location.reload() if deep state reset is needed, 
                    // but React state update should be sufficient.
                }
            } catch (err: any) {
                console.error('Import Error:', err);
                alert(`فشل الاستعادة: ${err.message}`);
            }
        };
        reader.onerror = () => alert('عذراً، حدث خطأ أثناء قراءة الملف.');
        reader.readAsText(file);
    };

    // REMOVED: useEffect that was causing race condition with handleOpenBlankedMushaf
    // Data is now loaded directly in handleOpenBlankedMushaf before opening the overlay

    // Listen for Achievements
    React.useEffect(() => {
        const handleAchievement = (e: any) => {
            const newUnlock = e.detail as import('../../../services/gamification').Achievement[];
            if (newUnlock && newUnlock.length > 0) {
                setAchievementToast(newUnlock);
                playSound('complete');
                // Auto dismiss after 5 seconds
                setTimeout(() => setAchievementToast(null), 5000);
            }
        };

        window.addEventListener('hifz-achievement-unlocked', handleAchievement);
        return () => window.removeEventListener('hifz-achievement-unlocked', handleAchievement);
    }, []);

    // --- Render ---
    if (!state) return null;

    const hasMistakes = !!(state.mistakeMap && Object.values(state.mistakeMap).some(v => v > 0));

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 pb-24 lg:pb-0 relative overflow-hidden font-sans">
            {/* Background Decorative Elements */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 right-0 w-80 h-80 bg-gold-400/10 dark:bg-gold-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                <div className="absolute bottom-1/4 left-0 w-64 h-64 bg-amber-400/10 dark:bg-amber-500/5 rounded-full blur-3xl -translate-x-1/2"></div>
            </div>

            <TopBar showBack={true} title="ورد الحفظ" extra={dashboardActions} />

            <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 relative z-10 transition-opacity duration-300 ${isBlankedMushafOpen ? 'opacity-0 pointer-events-none hidden' : 'opacity-100'}`}>
                {/* Bento Grid Layout - Animated Entrance */}
                <motion.div
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 lg:gap-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, staggerChildren: 0.1 }}
                >
                    {/* Hero Progress - Responsive spanning */}
                    <div className="sm:col-span-2 xl:col-span-2 h-full">
                        <ProgressCard
                            currentProgress={state.currentProgress}
                            planType={state.planType}
                            progressPercent={progressPercent}
                        />
                    </div>

                    {/* Streak - Spans 1 col */}
                    <div className="h-full">
                        <StreakCard
                            streak={streak}
                            history={state.history}
                        />
                    </div>

                    {/* Estimation - Spans 1 col */}
                    <div className="h-full">
                        <EstimationCard
                            currentProgress={state.currentProgress}
                            totalTarget={totalTarget}
                            startPoint={state.startPoint}
                            amountPerDay={state.amountPerDay}
                            daysPerWeek={state.daysPerWeek}
                            progressPercent={progressPercent}
                            onClick={onShowCalendar}
                        />
                    </div>

                    {/* Action Center - Full width */}
                    <motion.div
                        className="col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4 mt-2"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3, duration: 0.4 }}
                    >
                        <ActionCenter
                            planType={state.planType}
                            amountPerDay={state.amountPerDay}
                            currentProgress={state.currentProgress}
                            startPoint={state.startPoint}
                            isTodayDone={isTodayDone}
                            hasMistakes={hasMistakes}
                            isQuizLoading={isQuizLoading}
                            contextInfo={contextInfo}
                            onCompleteToday={() => handleCompleteToday()}
                            onUndoCompletion={onUndoCompletion}
                            onGoToLocation={handleGoToLocation}
                            onStartDailyQuiz={handleStartDailyQuiz}
                            onStartSelfTest={startSelfTest}
                            onStartFocusSession={handleStartFocusSession}
                            onOpenBlankedMushaf={handleOpenBlankedMushaf}
                            onOpenRevisionSetup={() => setIsSetupModalOpen(true)}
                        />
                    </motion.div>
                </motion.div>
            </div>

            {/* Charts & Analytics - Lazy Loaded */}
            {showCharts && (
                <React.Suspense fallback={<div className="h-96 w-full animate-pulse bg-gray-100 dark:bg-navy-800 rounded-3xl"></div>}>
                    <HifzChartsSection
                        srsItems={state.srsItems}
                        mistakeMap={state.mistakeMap || {}}
                        history={state.history}
                        testHistory={state.testHistory || []}
                        onDayClick={handleDayClick}
                    />
                </React.Suspense>
            )}

            {/* Achievements Section */}
            <AchievementsSection unlockedIds={state.unlockedAchievements || []} />

            {/* Data Safety / Admin Section */}
            <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border border-gray-100 dark:border-navy-700 shadow-sm mt-6">
                <div className="flex items-center gap-2 mb-4">
                    <Save className="text-blue-500" size={20} />
                    <h3 className="text-lg font-bold text-navy-900 dark:text-white">النسخ الاحتياطي والأمان</h3>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={handleExportBackup}
                        className="flex-1 py-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors border border-blue-200"
                    >
                        <Download size={18} />
                        <span>تصدير البيانات</span>
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 py-3 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors border border-gray-200"
                    >
                        <Zap size={18} />
                        <span>استعادة نسخة</span>
                    </button>
                    {/* Hidden Input */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImportBackup}
                        accept=".json"
                        className="hidden"
                    />
                </div>
                <p className="text-xs text-gray-400 mt-2 text-center">
                    قم بتصدير بياناتك بانتظام لتجنب فقدانها. الملف يتم حفظه باسم albayan_backup.json
                </p>
            </div>

            {/* Hidden Share Card */}
            <div className="absolute -left-[9999px] top-0 pointer-events-none">
                <ProgressShareCard
                    ref={shareCardRef}
                    state={state!}
                    latestAchievement={state.unlockedAchievements && state.unlockedAchievements.length > 0
                        ? ACHIEVEMENTS.find(a => a.id === state.unlockedAchievements![state.unlockedAchievements!.length - 1])
                        : undefined}
                />
            </div>

            {/* Modals will go here (QuizModal, etc.) - Simplified for V1 extraction */}
            {
                isSetupModalOpen && state && (
                    <RevisionSetupModal
                        onClose={() => setIsSetupModalOpen(false)}
                        onStart={handleStartRevision}
                        currentProgress={state!.startPoint + state!.currentProgress}
                        planType={state!.planType}
                        riskItemsCount={getDueItems(state!.srsItems || [], 100).length}
                    />
                )
            }

            {
                showRevisionSession && ctxRevisionTasks && state && (
                    <RevisionSessionModal
                        tasks={ctxRevisionTasks}
                        planType={state.planType}
                        onClose={handleCloseRevision}
                        onComplete={handleCompleteRevision}
                    />
                )
            }

            {isBlankedMushafOpen && (
                <BlankedMushafOverlay
                    isOpen={isBlankedMushafOpen}
                    onClose={() => setIsBlankedMushafOpen(false)}
                    mushafPages={mushafPages}
                    currentBlankedPageIndex={currentBlankedPageIndex}
                    revealedAyahs={revealedAyahs}
                    setRevealedAyahs={setRevealedAyahs}
                />
            )}

            {
                showSelfTest && (
                    <SelfTestModal
                        onClose={() => setShowSelfTest(false)}
                        maxPage={604}
                        onStart={async (settings) => {
                            setShowSelfTest(false);
                            if (!state) return;

                            // Generate Custom Quiz
                            try {
                                const testPlanType = 'pages'; // SelfTest currently only supports pages
                                const startLoc = settings.start;

                                const ayahs = await getAyahsForDailyWird(testPlanType, startLoc, settings.questionCount * 2);
                                if (ayahs.length > 0) {
                                    const questions = generateDailyQuiz(ayahs, true).slice(0, settings.questionCount);
                                    setDailyQuizQuestions(questions);
                                    setCurrentQuizIndex(0);
                                    setQuizAnswers({});
                                    setIsQuizFinished(false);
                                    setActiveQuizType('revision');
                                    setTestStartTime(Date.now()); // Start timer for self test
                                    setIsQuizModalOpen(true);
                                }
                            } catch (e) {
                                console.error('Failed to start self test', e);
                            }
                        }}
                    />
                )
            }

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-red-100 dark:border-red-900/30 transform transition-all scale-100 animate-in zoom-in-95 duration-200">
                        <div className="text-center space-y-4">
                            <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-2 ring-8 ring-red-50/50 dark:ring-red-900/10">
                                <AlertTriangle size={40} className="text-red-500 dark:text-red-400" />
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold text-navy-900 dark:text-white">
                                    حذف خطة الحفظ؟
                                </h3>
                                <p className="text-sm text-navy-500 dark:text-navy-300 leading-relaxed px-4">
                                    هل أنت متأكد من رغبتك في حذف الخطة الحالية نهائياً؟
                                    <br />
                                    <span className="text-red-500 dark:text-red-400 font-bold text-xs mt-1 block">
                                        سيؤدي هذا الإجراء إلى فقدان جميع السجلات ولا يمكن التراجع عنه.
                                    </span>
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-4">
                                <button
                                    onClick={() => setIsDeleteModalOpen(false)}
                                    className="py-3.5 px-4 bg-gray-100 dark:bg-navy-800 text-navy-700 dark:text-navy-200 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-navy-700 transition-colors"
                                >
                                    تراجع
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="py-3.5 px-4 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-500/20 transition-all active:scale-95"
                                >
                                    نعم، حذف الخطة
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Adaptive Alert Modal */}
            {/* Day Details Modal (Heatmap) */}
            {selectedDayDetails && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-navy-900 rounded-2xl p-6 max-w-xs w-full shadow-2xl border border-gray-100 dark:border-navy-700 animate-in zoom-in-95 duration-200 relative">
                        <button
                            onClick={() => setSelectedDayDetails(null)}
                            className="absolute top-3 left-3 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                            <X size={20} />
                        </button>

                        <div className="text-center space-y-4">
                            <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center bg-gray-50 dark:bg-navy-800 text-navy-600 dark:text-gray-300 font-bold text-lg border border-gray-100 dark:border-navy-700">
                                {new Date(selectedDayDetails.date).getDate()}
                            </div>

                            <div>
                                <h3 className="font-bold text-lg text-navy-900 dark:text-white">
                                    {new Date(selectedDayDetails.date).toLocaleDateString('ar-EG', { weekday: 'long', month: 'long', year: 'numeric' })}
                                </h3>
                                <p className={`text-sm font-bold ${selectedDayDetails.isDone ? 'text-emerald-500' : 'text-red-400'}`}>
                                    {selectedDayDetails.isDone ? 'تم إنجاز الورد' : 'لم يتم التسجيل'}
                                </p>
                            </div>

                            {selectedDayDetails.testResult && (
                                <div className="bg-gray-50 dark:bg-navy-800/50 rounded-xl p-3 text-sm space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">نتيجة الاختبار:</span>
                                        <span className={`font-bold ${selectedDayDetails.testResult.score >= 50 ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {toArabicDigits(selectedDayDetails.testResult.score)}%
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">الأخطاء:</span>
                                        <span className="font-bold text-navy-700 dark:text-white">
                                            {toArabicDigits(selectedDayDetails.testResult.mistakes)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {!selectedDayDetails.isDone && !selectedDayDetails.testResult && (
                                <p className="text-xs text-gray-400">لا توجد بيانات نشاط لهذا اليوم.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Achievement Toast */}
            <AnimatePresence>
                {achievementToast && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.8 }}
                        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[80] flex flex-col items-center gap-2 w-full max-w-sm px-4 pointer-events-none"
                    >
                        {achievementToast.map((ach) => (
                            <div key={ach.id} className="bg-navy-900/95 text-white backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-gold-500/50 flex items-center gap-4 w-full pointer-events-auto">
                                <div className={`p-3 rounded-full ${ach.color} text-white shadow-lg`}>
                                    {ach.icon}
                                </div>
                                <div className="flex-1 text-right">
                                    <h4 className="font-bold text-gold-400 text-sm">إنجاز جديد!</h4>
                                    <p className="font-bold text-lg">{ach.title}</p>
                                    <p className="text-xs text-gray-300">{ach.description}</p>
                                </div>
                                <button onClick={() => setAchievementToast(null)} className="p-1 hover:bg-white/10 rounded-full">
                                    <X size={16} />
                                </button>
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {adaptiveAlert && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-navy-900/80 backdrop-blur-sm">
                    <div className="bg-white dark:bg-navy-900 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl border border-gold-500/20 animate-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-500/20 rounded-full flex items-center justify-center mx-auto text-amber-500">
                            <BrainCircuit size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-navy-900 dark:text-white">اقتراح ذكي</h3>
                        <p className="text-sm text-navy-500 dark:text-navy-300 leading-relaxed">
                            {adaptiveAlert}
                        </p>
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => {
                                    setAdaptiveAlert(null);
                                    onEditPlan(); // Redirect to edit settings
                                }}
                                className="flex-1 py-3 bg-gold-500 hover:bg-gold-600 text-white rounded-xl font-bold transition-colors"
                            >
                                تعديل الخطة
                            </button>
                            <button
                                onClick={() => setAdaptiveAlert(null)}
                                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold transition-colors"
                            >
                                حسناً، سأحاول
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {
                isQuizModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/80 backdrop-blur-sm">
                        <div className="bg-white dark:bg-navy-900 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 relative">
                            <button onClick={() => setIsQuizModalOpen(false)} className="absolute top-4 left-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                <X size={24} />
                            </button>

                            {isQuizFinished ? (
                                <div className="text-center py-8 space-y-6">
                                    {/* Score Card */}
                                    <div className="relative inline-block">
                                        <div className="text-5xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">
                                            {toArabicDigits(Math.round((evaluateQuiz(dailyQuizQuestions, quizAnswers).score)))}%
                                        </div>
                                        {evaluateQuiz(dailyQuizQuestions, quizAnswers).score === 100 && (
                                            <motion.div
                                                initial={{ scale: 0 }} animate={{ scale: 1 }}
                                                className="absolute -top-6 -right-6 text-yellow-500"
                                            >
                                                <Trophy size={40} fill="currentColor" />
                                            </motion.div>
                                        )}
                                    </div>

                                    <h2 className="text-2xl font-bold text-navy-900 dark:text-white">
                                        {evaluateQuiz(dailyQuizQuestions, quizAnswers).passed ? 'ما شاء الله! فتح الله عليك' : 'تحتاج لمزيد من التثبيت'}
                                    </h2>

                                    {/* Action Buttons */}
                                    <div className="flex flex-col gap-3 max-w-xs mx-auto">
                                        {!evaluateQuiz(dailyQuizQuestions, quizAnswers).passed || evaluateQuiz(dailyQuizQuestions, quizAnswers).score < 100 ? (
                                            <button
                                                onClick={() => setShowMistakesReview(!showMistakesReview)}
                                                className="flex items-center justify-center gap-2 py-3 px-6 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-colors font-bold"
                                            >
                                                {showMistakesReview ? 'إخفاء الأخطاء' : 'مراجعة الأخطاء وتصحيحها'}
                                                <AlertTriangle size={18} />
                                            </button>
                                        ) : null}

                                        <button
                                            onClick={() => setIsQuizModalOpen(false)}
                                            className="py-3 px-6 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors font-bold shadow-lg shadow-emerald-500/20"
                                        >
                                            متابعة
                                        </button>
                                    </div>

                                    {/* Mistakes Review Panel */}
                                    {showMistakesReview && (
                                        <div className="mt-8 text-right bg-gray-50 dark:bg-navy-800 rounded-2xl p-4 border border-gray-100 dark:border-navy-700 animate-in slide-in-from-top-4">
                                            <h3 className="font-bold mb-4 text-red-500 flex items-center gap-2">
                                                <X size={18} />
                                                الأخطاء المسجلة ({toArabicDigits(evaluateQuiz(dailyQuizQuestions, quizAnswers).mistakes.length)})
                                            </h3>
                                            <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                                {evaluateQuiz(dailyQuizQuestions, quizAnswers).mistakes.map((m, idx) => {
                                                    // Find original question
                                                    const failedQs = dailyQuizQuestions.filter(q => quizAnswers[q.id] === false);
                                                    const q = failedQs[idx];
                                                    if (!q) return null;

                                                    return (
                                                        <div key={idx} className="p-3 bg-white dark:bg-navy-900 rounded-xl border border-red-100 dark:border-red-900/30">
                                                            <p className="text-sm text-gray-500 mb-2">سؤال: {q.questionText}</p>
                                                            <div className="flex justify-between items-end">
                                                                <span className="font-quran text-lg text-navy-900 dark:text-white">
                                                                    {Array.isArray(q.correctAnswer) ? q.correctAnswer.join(' ') : q.correctAnswer}
                                                                </span>
                                                                <button
                                                                    onClick={() => {
                                                                        // Open Blanked Mushaf for this page
                                                                        setIsQuizModalOpen(false);
                                                                        const page = q.ayah ? getApproxPageFromGlobalAyah(q.ayah.number) : state!.startPoint;
                                                                        handleOpenBlankedMushaf(page, 1);
                                                                    }}
                                                                    className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg hover:bg-indigo-100"
                                                                >
                                                                    اختبرني فيها (مصحف مخفي)
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                dailyQuizQuestions.length > 0 && (
                                    <DailyQuizCard
                                        question={dailyQuizQuestions[currentQuizIndex]}
                                        onAnswer={handleQuizAnswer}
                                    />
                                )
                            )}
                        </div>
                    </div>
                )
            }

            {/* Duplicate BlankedMushafOverlay removed - kept only one instance at line 759 */}
        </div >
    );
};
