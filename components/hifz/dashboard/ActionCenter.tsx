import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BookOpen, Layers, Circle, CheckCircle2, BrainCircuit,
    ArrowUpRight, Sparkles, Target, RotateCcw,
    Undo2, PartyPopper, ChevronRight
} from 'lucide-react';
import { toArabicDigits } from '../../../services/normalization';
import { getApproxPageFromGlobalAyah, getMetadataFromGlobalAyah } from '../../../services/quranStaticData';

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
    onUndoCompletion?: () => void;
    onGoToLocation: () => void;
    onStartDailyQuiz: () => void;
    onOpenBlankedMushaf: (startPage: number, pageCount: number) => void;
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
    onOpenBlankedMushaf
}) => {
    const navigate = useNavigate();
    const [showUndoConfirm, setShowUndoConfirm] = useState(false);
    const [selectedExtraAmount, setSelectedExtraAmount] = useState<number | null>(null);

    const handleGoToExtraLocation = (amount: number) => {
        const targetLocation = visualLoc;
        const page = planType === 'pages' ? Math.min(Math.max(Math.floor(targetLocation), 1), 604) : getApproxPageFromGlobalAyah(targetLocation);
        
        if (planType === 'pages') {
            navigate(`/reader?page=${page}&hifzMode=true&start=${targetLocation}&amount=${amount}&planType=${planType}`);
        } else {
            const meta = getMetadataFromGlobalAyah(targetLocation);
            navigate(`/reader?surah=${meta.surahNumber}&ayah=${meta.ayahInSurah}&page=${page}&highlight=${meta.surahNumber}:${meta.ayahInSurah}&hifzMode=true&start=${targetLocation}&amount=${amount}&planType=${planType}`);
        }
    };

    const handleStartExtraQuiz = (amount: number) => {
        navigate(`/quiz?startDailyQuiz=true&extraAmount=${amount}`);
    };

    const isPages = planType === 'pages';

    const showHalfOption = isPages ? true : (Math.round(amountPerDay / 2) >= 1 && Math.round(amountPerDay / 2) < amountPerDay);
    const showQuarterOption = isPages ? true : (Math.round(amountPerDay / 4) >= 1 && Math.round(amountPerDay / 4) < Math.round(amountPerDay / 2));

    const fullAmount = amountPerDay;
    const halfAmount = isPages ? (amountPerDay / 2) : Math.round(amountPerDay / 2);
    const quarterAmount = isPages ? (amountPerDay / 4) : Math.round(amountPerDay / 4);

    // Determines the actual visual target number
    // progress is usually 0-based index or count. Let's assume startPoint + currentProgress logic matches usage
    const visualLoc = startPoint + currentProgress;

    const handleBlankedMushafClick = () => {
        const currentRaw = visualLoc;
        let startPage = 1;
        let pageCount = amountPerDay;

        if (planType === 'pages') {
            startPage = Math.min(Math.max(Math.floor(currentRaw), 1), 604);
            pageCount = Math.max(1, Math.ceil(amountPerDay));
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
                            onClick={handleBlankedMushafClick}
                            className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 hover:text-white font-bold py-3.5 rounded-xl backdrop-blur-sm border border-emerald-500/30 flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-emerald-500/5 text-sm group/sub"
                        >
                            <BrainCircuit size={18} className="text-emerald-400 group-hover/sub:animate-pulse" />
                            <span>المصحف المخفي</span>
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">

                    {/* Done State - Clickable for Undo */}
                    {!showUndoConfirm ? (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <button
                                onClick={() => setShowUndoConfirm(true)}
                                className="w-full p-4 bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 text-emerald-100 font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-3 hover:bg-emerald-500/30 transition-all active:scale-98 group"
                            >
                                <div className="p-1 bg-emerald-500 rounded-full text-white shadow-sm group-hover:scale-110 transition-transform">
                                    <CheckCircle2 size={20} />
                                </div>
                                <span className="text-lg">تم الانتهاء بحمد الله</span>
                            </button>

                            {/* قسم الورد الإضافي */}
                            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 mt-4 animate-in fade-in duration-300">
                                <div className="flex items-center gap-2 mb-3">
                                    <Sparkles size={16} className="text-gold-400 animate-pulse" />
                                    <span className="text-sm font-bold text-gold-400">هل تشعر بالهمة؟ افتح ورداً إضافياً</span>
                                </div>
                                <div className={`grid gap-3 ${
                                    (1 + (showHalfOption ? 1 : 0) + (showQuarterOption ? 1 : 0)) === 3
                                        ? 'grid-cols-3'
                                        : (1 + (showHalfOption ? 1 : 0) + (showQuarterOption ? 1 : 0)) === 2
                                        ? 'grid-cols-2'
                                        : 'grid-cols-1'
                                }`}>
                                    <button
                                        onClick={() => setSelectedExtraAmount(fullAmount)}
                                        className={`p-3 rounded-xl border transition-all text-right flex flex-col justify-between ${
                                            selectedExtraAmount === fullAmount
                                                ? 'bg-gold-500/20 border-gold-500 text-white'
                                                : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-300'
                                        }`}
                                    >
                                        <span className="text-xs font-medium text-gray-400">ورد كامل</span>
                                        <span className="text-sm font-bold mt-1">
                                            {toArabicDigits(fullAmount)} {planType === 'pages' ? 'صفحة' : 'آية'}
                                        </span>
                                    </button>

                                    {showHalfOption && (
                                        <button
                                            onClick={() => setSelectedExtraAmount(halfAmount)}
                                            className={`p-3 rounded-xl border transition-all text-right flex flex-col justify-between ${
                                                selectedExtraAmount === halfAmount
                                                    ? 'bg-gold-500/20 border-gold-500 text-white'
                                                    : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-300'
                                            }`}
                                        >
                                            <span className="text-xs font-medium text-gray-400">نصف ورد</span>
                                            <span className="text-sm font-bold mt-1">
                                                {toArabicDigits(halfAmount)} {planType === 'pages' ? 'صفحة' : 'آية'}
                                            </span>
                                        </button>
                                    )}

                                    {showQuarterOption && (
                                        <button
                                            onClick={() => setSelectedExtraAmount(quarterAmount)}
                                            className={`p-3 rounded-xl border transition-all text-right flex flex-col justify-between ${
                                                selectedExtraAmount === quarterAmount
                                                    ? 'bg-gold-500/20 border-gold-500 text-white'
                                                    : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-300'
                                            }`}
                                        >
                                            <span className="text-xs font-medium text-gray-400">ربع ورد</span>
                                            <span className="text-sm font-bold mt-1">
                                                {toArabicDigits(quarterAmount)} {planType === 'pages' ? 'صفحة' : 'آية'}
                                            </span>
                                        </button>
                                    )}
                                </div>

                                {selectedExtraAmount !== null && (
                                    <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/5 animate-in slide-in-from-top-2 duration-300">
                                        <button
                                            onClick={() => handleGoToExtraLocation(selectedExtraAmount)}
                                            className="py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl border border-white/10 flex items-center justify-center gap-2 transition-all text-xs"
                                        >
                                            <ArrowUpRight size={16} className="text-gold-400" />
                                            <span>الذهاب للورد</span>
                                        </button>
                                        <button
                                            onClick={() => handleStartExtraQuiz(selectedExtraAmount)}
                                            className="py-3 bg-gradient-to-br from-gold-400 to-amber-500 hover:from-gold-500 hover:to-amber-600 text-navy-950 font-bold rounded-xl flex items-center justify-center gap-2 transition-all text-xs shadow-lg shadow-gold-500/20"
                                        >
                                            <Target size={16} />
                                            <span>ابدأ اختبار الورد</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
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
                </div>
            )}
        </div>
    );
};
