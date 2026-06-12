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
import { ProgressShareCard } from '../ProgressShareCard';
import { AchievementsSection } from './AchievementsSection';
import { BlankedMushafOverlay } from './BlankedMushafOverlay';
import { ProgressCard } from './ProgressCard';
import { StreakCard } from './StreakCard';
import { EstimationCard } from './EstimationCard';
import { ActionCenter } from './ActionCenter';
import { HifzService } from '../../../services/HifzService';
import { useQuizFeedback } from '../../../hooks/useQuizFeedback';


// Services
import { cleanQuranText, toArabicDigits } from '../../../services/normalization';
import { getAyahsForDailyWird, HifzTestResult } from '../../../services/hifzManager';
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
    const [selectedDayDetails, setSelectedDayDetails] = useState<{ date: string, isDone: boolean, testResult?: HifzTestResult } | null>(null); // Heatmap Interaction
    const [achievementToast, setAchievementToast] = useState<import('../../../services/gamification').Achievement[] | null>(null); // For Toast Notification
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Blanked Mushaf State
    const [isBlankedMushafOpen, setIsBlankedMushafOpen] = useState(false);
    const [mushafPages, setMushafPages] = useState<{ page: number, ayahs: any[] }[]>([]);
    const [currentBlankedPageIndex, setCurrentBlankedPageIndex] = useState(0);
    const [revealedAyahs, setRevealedAyahs] = useState<Set<number>>(new Set());


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
        const total = state.endPoint ?? (state.planType === 'pages' ? 604 : 6236);
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
        const amount = state.amountPerDay;
        const planType = state.planType;

        if (state.planType === 'pages') {
            const page = Math.min(Math.max(targetLocation, 1), 604);
            navigate(`/reader?page=${page}&hifzMode=true&start=${targetLocation}&amount=${amount}&planType=${planType}`);
        } else {
            const globalAyah = Math.min(Math.max(targetLocation, 1), 6236);
            const meta = getMetadataFromGlobalAyah(globalAyah);
            const pageOfAyah = getApproxPageFromGlobalAyah(globalAyah);
            navigate(`/reader?surah=${meta.surahNumber}&ayah=${meta.ayahInSurah}&page=${pageOfAyah}&highlight=${meta.surahNumber}:${meta.ayahInSurah}&hifzMode=true&start=${targetLocation}&amount=${amount}&planType=${planType}`);
        }
    };

    const handleCompleteToday = () => {
        if (!state) return;

        if (!isTodayDone) {
            // New Flow: Navigate to QuranQuiz, where they can choose to skip
            navigate('/quiz?startDailyQuiz=true');
        } else {
            // If already done, maybe do nothing or show a message. It shouldn't be called if done.
        }
    };

    // --- Helper for Blanked Mushaf ---
    const handleOpenBlankedMushaf = async (startPage: number, pageCount: number) => {
        try {
            const pagesToLoad = Array.from({ length: pageCount }, (_, i) => startPage + i);
            const loaded = await Promise.all(
                pagesToLoad.map(async p => {
                    const ayahs = await getStaticPage(p);
                    return { page: p, ayahs };
                })
            );

            const validPages = loaded.filter(p => p.ayahs && p.ayahs.length > 0);

            if (validPages.length > 0) {
                setMushafPages(validPages as any);
                setIsBlankedMushafOpen(true);
            } else {
                alert('عذراً، لا يمكن تحميل الصفحة المطلوبة');
            }
        } catch (error) {
            alert('حدث خطأ أثناء تحميل الصفحة');
        }
    };

    // --- Backup Functions ---
    const handleExportBackup = async () => {
        if (!state) return;
        try {
            const dataStr = JSON.stringify(state, null, 2);
            await Filesystem.writeFile({
                path: 'albayan_backup.json',
                data: dataStr,
                directory: Directory.Documents,
                encoding: Encoding.UTF8
            });
            alert('تم تصدير النسخة الاحتياطية بنجاح إلى المستندات');
        } catch (e) {
            console.error('Export failed', e);
            alert('حدث خطأ أثناء تصدير البيانات');
        }
    };

    const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const dataStr = event.target?.result as string;
                const parsed = JSON.parse(dataStr);
                
                // Simple validation
                if (parsed && typeof parsed.startPoint === 'number') {
                    if (window.confirm('سيتم استبدال بياناتك الحالية بالبيانات المستوردة. هل أنت متأكد؟')) {
                        updateState(parsed);
                        alert('تمت استعادة البيانات بنجاح!');
                    }
                } else {
                    alert('ملف النسخة الاحتياطية غير صالح');
                }
            } catch (err) {
                console.error('Import failed', err);
                alert('حدث خطأ أثناء قراءة الملف');
            }
        };
        reader.readAsText(file);
        
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // --- Render ---
    if (!state) return null;

    const hasMistakes = !!(state.mistakeMap && Object.values(state.mistakeMap).some(v => v > 0));

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 pb-36 relative overflow-hidden font-sans">
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
                    {/* Hero Progress */}
                    <div className="sm:col-span-2 xl:col-span-2 h-full">
                        <ProgressCard
                            currentProgress={state.currentProgress}
                            planType={state.planType}
                            progressPercent={progressPercent}
                        />
                    </div>

                    {/* Streak */}
                    <div className="h-full">
                        <StreakCard
                            streak={streak}
                            history={state.history}
                        />
                    </div>

                    {/* Estimation */}
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

                    {/* Action Center */}
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
                            isQuizLoading={false}
                            contextInfo={contextInfo}
                            onCompleteToday={() => handleCompleteToday()}
                            onUndoCompletion={onUndoCompletion}
                            onGoToLocation={handleGoToLocation}
                            onStartDailyQuiz={() => navigate('/quiz?startDailyQuiz=true')}
                            onOpenBlankedMushaf={handleOpenBlankedMushaf}
                        />
                    </motion.div>
                </motion.div>

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
            </div>

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

            {/* Duplicate BlankedMushafOverlay removed - kept only one instance at line 759 */}
        </div >
    );
};
