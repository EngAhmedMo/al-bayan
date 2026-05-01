import React, { useState } from 'react';
import {
    BookOpen, Layers, Circle, CheckCircle2, BrainCircuit,
    ArrowUpRight, Sparkles, Target, RotateCcw,
    Undo2, PartyPopper
} from 'lucide-react';
import { toArabicDigits } from '../../../services/normalization';
import { getApproxPageFromGlobalAyah } from '../../../services/quranStaticData';

interface ActionCenterProps {
    planType: 'pages' | 'ayahs';
    amountPerDay: number;
    currentProgress: number; // 1-based index (e.g. Page 1, 2...)
    startPoint: number;
    isTodayDone: boolean;
    hasMistakes: boolean;
    isQuizLoading: boolean;
    contextInfo?: { rub: string, juz: number } | null;

    onCompleteToday: () => void;
    onUndoCompletion?: () => void; // New Prop
    onGoToLocation: () => void;
    onStartDailyQuiz: () => void;
    onStartSelfTest: () => void;
    onStartFocusSession: () => void;
    onOpenBlankedMushaf: (startPage: number, pageCount: number) => void;
    onOpenRevisionSetup: () => void;
}

export const ActionCenter: React.FC<ActionCenterProps> = ({
    planType,
    amountPerDay,
    currentProgress,
    startPoint,
    isTodayDone,
    hasMistakes,
    isQuizLoading,
    contextInfo,
    onCompleteToday,
    onUndoCompletion,
    onGoToLocation,
    onStartDailyQuiz,
    onStartSelfTest,
    onStartFocusSession,
    onOpenBlankedMushaf,
    onOpenRevisionSetup
}) => {
    const [showUndoConfirm, setShowUndoConfirm] = useState(false);

    // Determines the actual visual target number
    // progress is usually 0-based index or count. Let's assume startPoint + currentProgress logic matches usage
    const visualLoc = startPoint + currentProgress;

    const handleBlankedMushafClick = () => {
        const currentRaw = visualLoc;
        let startPage = 1;
        let pageCount = amountPerDay;

        if (planType === 'pages') {
            startPage = Math.min(Math.max(currentRaw, 1), 604);
        } else {
            startPage = getApproxPageFromGlobalAyah(currentRaw);
            const endRaw = currentRaw + amountPerDay - 1;
            const endPage = getApproxPageFromGlobalAyah(endRaw);
            pageCount = Math.max(1, endPage - startPage + 1);
        }

        onOpenBlankedMushaf(startPage, pageCount);
    };

    return (
        <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 rounded-[2.5rem] p-6 lg:p-8 text-white shadow-2xl shadow-navy-900/30 relative overflow-hidden border border-navy-700/50 group select-none">

            {/* Decorative Patterns */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gold-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none group-hover:bg-gold-500/20 transition-all duration-700"></div>
            <div className="absolute bottom-0 left-0 w-full h-full opacity-10 pointer-events-none" style={{ backgroundImage: 'url("/patterns/islamic-geometry.svg")', backgroundSize: '200px' }}></div>

            <div className="relative z-10">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gold-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-white transform group-hover:scale-110 transition-transform duration-300 shrink-0">
                        <BookOpen size={28} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">ورد اليوم</h2>
                        <p className="text-sm text-navy-200 mt-1 opacity-90 max-w-sm leading-relaxed">
                            {isTodayDone
                                ? 'أحسنت! أتممت وردك اليوم، جزاك الله خيراً.'
                                : `المطلوب: ${toArabicDigits(amountPerDay)} ${planType === 'pages' ? 'صفحات' : 'آيات'} من ${planType === 'pages' ? 'صفحة' : 'آية'} ${toArabicDigits(visualLoc)}`
                            }
                        </p>

                        {/* Context Info Badge */}
                        {!isTodayDone && contextInfo && (
                            <div className="flex items-center gap-2 mt-3 animate-in fade-in slide-in-from-top-1 duration-500 delay-100">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-navy-800/80 backdrop-blur text-xs font-bold text-navy-100 border border-white/10 shadow-sm">
                                    <Layers size={12} className="text-gold-400" />
                                    الجزء {toArabicDigits(contextInfo.juz)}
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-navy-800/80 backdrop-blur text-xs font-bold text-navy-100 border border-white/10 shadow-sm">
                                    <Circle size={10} className="text-gold-400" />
                                    {contextInfo.rub}
                                </span>
                            </div>
                        )}
                    </div>

                    {isTodayDone && (
                        <div className="mr-auto animate-in zoom-in duration-300">
                            <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/30 backdrop-blur-md shadow-lg shadow-emerald-500/10">
                                <CheckCircle2 size={14} />
                                مكتمل
                            </span>
                        </div>
                    )}
                </div>

                {/* Flashcard Tool Shortcut - HIDES when done */}
                {!isTodayDone && (
                    <div className="absolute top-6 left-6 animate-in fade-in duration-300">
                        <button
                            onClick={handleBlankedMushafClick}
                            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-navy-200 hover:text-emerald-400 transition-all border border-white/5 hover:border-emerald-500/30 shadow-sm"
                            title="المصحف المخفي"
                        >
                            <BrainCircuit size={20} />
                        </button>
                    </div>
                )}
            </div>

            {/* Action Grid */}
            {!isTodayDone ? (
                <div className="space-y-4">
                    {/* Primary: Start Quiz (To Complete) */}
                    {/* Logic Change: Main Button triggers QUIZ if smart test is the gatekeeper */}
                    <button
                        onClick={onStartDailyQuiz}
                        disabled={isQuizLoading}
                        className="w-full py-4 bg-white text-navy-900 font-bold rounded-2xl shadow-xl hover:shadow-2xl hover:bg-gold-50 transition-all active:scale-[0.98] flex items-center justify-center gap-3 group/btn relative overflow-hidden disabled:opacity-70"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-1000"></div>
                        {isQuizLoading ? (
                            <div className="w-5 h-5 border-2 border-navy-900 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <div className="w-6 h-6 rounded-full border-2 border-navy-900 group-hover/btn:bg-navy-900/10 transition-colors flex items-center justify-center">
                                {/* Empty circle implies 'To Do' */}
                            </div>
                        )}
                        <span className="text-lg">ابدأ الاختبار لتسجيل الحفظ</span>
                    </button>

                    {/* Secondary Actions Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={onGoToLocation}
                            className="bg-white/10 hover:bg-white/20 text-white font-bold py-3.5 rounded-xl backdrop-blur-sm border border-white/10 flex items-center justify-center gap-2.5 transition-all text-sm group/sub"
                        >
                            <ArrowUpRight size={18} className="group-hover/sub:-translate-y-0.5 group-hover/sub:translate-x-0.5 transition-transform" />
                            <span>الذهاب للورد</span>
                        </button>

                        <button

                            // User request: "Button records completion... prevent it unless test passed".
                            // So let's make the MAIN button the ONLY way, which starts quiz. But we need a fallback for manual read?
                            // Let's keep a "Manual Complete" hidden or small? 
                            // No, let's keep it simple. The Main Button STARTS QUIZ. Quiz Success -> Calls onCompleteToday.
                            // But what if user just wants to mark done? 
                            // Let's provide a small "Mark Done Manually" option? 
                            // For now, let's assume 'onStartDailyQuiz' handles the flow (Quiz -> Success -> Mark Done).
                            // But we need to use the space.

                            // Let's use this slot for "Self Test" or "Listen".
                            onClick={onStartSelfTest}
                            className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 hover:text-white font-bold py-3.5 rounded-xl backdrop-blur-sm border border-emerald-500/30 flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-emerald-500/5 text-sm group/sub"
                        >
                            <Sparkles size={18} className="text-emerald-400 group-hover/sub:animate-pulse" />
                            <span>اختبار حر</span>
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">

                    {/* Done State - Clickable for Undo */}
                    {!showUndoConfirm ? (
                        <button
                            onClick={() => setShowUndoConfirm(true)}
                            className="w-full p-4 bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 text-emerald-100 font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-3 hover:bg-emerald-500/30 transition-all active:scale-98 group"
                        >
                            <div className="p-1 bg-emerald-500 rounded-full text-white shadow-sm group-hover:scale-110 transition-transform">
                                <CheckCircle2 size={20} />
                            </div>
                            <span className="text-lg">تم الانتهاء بحمد الله</span>
                        </button>
                    ) : (
                        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 animate-in zoom-in duration-200">
                            <div className="text-center mb-4">
                                <PartyPopper className="mx-auto text-gold-400 mb-2" size={32} />
                                <p className="font-bold text-white">مبارك إتمام الورد!</p>
                                <p className="text-xs text-navy-200 mt-1">هل ترغب في التراجع عن التسجيل؟</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowUndoConfirm(false)} // Cancel Undo
                                    className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold text-sm transition-colors"
                                >
                                    إغلاق
                                </button>
                                <button
                                    onClick={() => {
                                        setShowUndoConfirm(false);
                                        onUndoCompletion?.();
                                    }}
                                    className="flex-1 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 hover:text-white border border-red-500/30 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                                >
                                    <Undo2 size={16} />
                                    تراجع
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <button
                            onClick={onOpenRevisionSetup}
                            className="w-full py-4 bg-white text-navy-900 font-bold rounded-xl shadow-lg hover:bg-gold-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <RotateCcw size={20} className="text-purple-600" />
                            مراجعة وتقوية
                        </button>

                        {/* Focus Session for Revision too */}
                        {hasMistakes && (
                            <button
                                onClick={onStartFocusSession}
                                disabled={isQuizLoading}
                                className="w-full py-4 bg-red-500/20 hover:bg-red-500/30 text-red-100 hover:text-white font-bold rounded-xl hover:shadow-lg hover:shadow-red-900/20 backdrop-blur-sm border border-red-500/30 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isQuizLoading ? (
                                    <div className="w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Target size={20} className="text-red-400" />
                                )}
                                <span>علاج الأخطاء</span>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
