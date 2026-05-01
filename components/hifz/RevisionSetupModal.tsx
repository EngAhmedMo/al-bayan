
import React, { useState } from 'react';
import { Layers, AlertTriangle, Calendar, Play, X, Settings2 } from 'lucide-react';
import { toArabicDigits } from '../../services/normalization';
import { SrsItem } from '../../services/srsAlgorithm';

interface RevisionSetupModalProps {
    onClose: () => void;
    onStart: (settings: { start: number; end: number; includeRisks: boolean }) => void;
    currentProgress: number;
    planType: 'pages' | 'ayahs';
    riskItemsCount: number;
}

export const RevisionSetupModal: React.FC<RevisionSetupModalProps> = ({
    onClose,
    onStart,
    currentProgress,
    planType,
    riskItemsCount
}) => {
    const [mode, setMode] = useState<'recent' | 'risk' | 'custom'>('recent');
    const [amount, setAmount] = useState(5);

    const getRange = () => {
        const total = currentProgress;
        const safeAmount = Math.max(1, amount);

        if (mode === 'recent') {
            const end = total;
            const start = Math.max(1, total - safeAmount + 1);
            return { start, end };
        }

        if (mode === 'risk') {
            return { start: 0, end: 0 };
        }

        return { start: 0, end: 0 };
    };

    const handleStart = () => {
        const { start, end } = getRange();
        onStart({
            start,
            end,
            includeRisks: true
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-navy-900 rounded-3xl w-full max-w-md overflow-hidden relative border border-gray-200 dark:border-navy-700 shadow-2xl animate-in zoom-in slide-in-from-bottom-4 duration-300">

                {/* Decorative background */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                {/* Header */}
                <div className="relative p-6 border-b border-gray-100 dark:border-navy-800 flex justify-between items-center bg-gradient-to-br from-gray-50/80 to-white/50 dark:from-navy-800/80 dark:to-navy-900/50 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-lg shadow-indigo-500/20">
                            <Settings2 size={22} />
                        </div>
                        <h3 className="font-bold text-navy-900 dark:text-white text-lg md:text-xl">إعداد جلسة المراجعة</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 rounded-xl transition-all hover:scale-110"
                    >
                        <X size={22} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6 relative">

                    {/* Mode Selection */}
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => setMode('recent')}
                            className={`p-5 md:p-4 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center gap-3 text-center ${mode === 'recent'
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 shadow-lg shadow-indigo-500/20 scale-105'
                                    : 'border-gray-200 dark:border-navy-700 hover:border-indigo-300 dark:hover:border-navy-600 hover:scale-102'
                                }`}
                        >
                            <Calendar size={28} className={mode === 'recent' ? 'text-indigo-500' : 'text-gray-400'} />
                            <span className="font-bold text-sm md:text-base">أحدث المحفوظات</span>
                        </button>

                        <button
                            onClick={() => setMode('risk')}
                            disabled={riskItemsCount === 0}
                            className={`p-5 md:p-4 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center gap-3 text-center ${mode === 'risk'
                                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 shadow-lg shadow-amber-500/20 scale-105'
                                    : riskItemsCount === 0
                                        ? 'border-gray-200 dark:border-navy-800 opacity-50 cursor-not-allowed'
                                        : 'border-gray-200 dark:border-navy-700 hover:border-amber-300 dark:hover:border-navy-600 hover:scale-102'
                                }`}
                        >
                            <AlertTriangle size={28} className={mode === 'risk' ? 'text-amber-500' : 'text-gray-400'} />
                            <span className="font-bold text-sm md:text-base">نقاط الضعف</span>
                            {riskItemsCount > 0 && (
                                <span className="text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 px-3 py-1 rounded-full font-bold">
                                    {toArabicDigits(riskItemsCount)}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Settings for Recent Mode */}
                    {mode === 'recent' && (
                        <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-navy-800/50 dark:to-navy-900/30 rounded-2xl p-5 border border-gray-200 dark:border-navy-700 animate-in slide-in-from-top-2 duration-300">
                            <label className="text-sm font-bold text-navy-700 dark:text-navy-300 mb-3 block">
                                عدد {planType === 'pages' ? 'الصفحات' : 'الآيات'} للمراجعة:
                            </label>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setAmount(Math.max(1, amount - 1))}
                                    className="w-12 h-12 md:w-11 md:h-11 rounded-xl bg-white dark:bg-navy-700 shadow-md border-2 border-gray-200 dark:border-navy-600 flex items-center justify-center font-bold text-xl hover:bg-gray-50 dark:hover:bg-navy-600 transition-all hover:scale-110 active:scale-95"
                                >
                                    -
                                </button>
                                <div className="flex-1 text-center font-black text-3xl md:text-4xl text-indigo-600 dark:text-indigo-400 drop-shadow-sm">
                                    {toArabicDigits(amount)}
                                </div>
                                <button
                                    onClick={() => setAmount(amount + 1)}
                                    className="w-12 h-12 md:w-11 md:h-11 rounded-xl bg-white dark:bg-navy-700 shadow-md border-2 border-gray-200 dark:border-navy-600 flex items-center justify-center font-bold text-xl hover:bg-gray-50 dark:hover:bg-navy-600 transition-all hover:scale-110 active:scale-95"
                                >
                                    +
                                </button>
                            </div>
                            <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-3 font-medium">
                                سيتم مراجعة آخر {toArabicDigits(amount)} {planType === 'pages' ? 'صفحات' : 'آيات'} تم حفظها.
                            </p>
                        </div>
                    )}

                    {/* Start Button */}
                    <button
                        onClick={handleStart}
                        className="w-full py-4 md:py-5 bg-gradient-to-r from-navy-900 to-navy-800 hover:from-navy-800 hover:to-navy-700 dark:from-indigo-600 dark:to-purple-600 dark:hover:from-indigo-500 dark:hover:to-purple-500 text-white rounded-2xl font-bold shadow-xl shadow-navy-900/30 dark:shadow-indigo-500/30 transition-all flex items-center justify-center gap-3 text-lg hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <Play size={22} fill="currentColor" />
                        ابدأ الجلسة
                    </button>

                </div>
            </div>
        </div>
    );
};
