import React, { useState } from 'react';
import { X, Play, Settings, BookOpen, Hash, AlignJustify, Target, Sparkles, Check, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toArabicDigits } from '../../services/normalization';

interface SelfTestSettings {
    type: 'pages' | 'surah';
    start: number;
    end: number;
    questionCount: number;
    mode: 'classic' | 'interactive';
}

interface SelfTestModalProps {
    onClose: () => void;
    onStart: (settings: SelfTestSettings) => void;
    maxPage: number; // usually 604
}

export const SelfTestModal = ({ onClose, onStart, maxPage = 604 }: SelfTestModalProps) => {
    const [type, setType] = useState<'pages' | 'surah'>('pages');
    const [range, setRange] = useState({ start: 1, end: 10 });
    const [questionCount, setQuestionCount] = useState(5);
    const [mode, setMode] = useState<'classic' | 'interactive'>('interactive');

    const handleStart = () => {
        onStart({
            type,
            start: range.start,
            end: range.end,
            questionCount,
            mode
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md animate-in fade-in duration-300">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-white dark:bg-navy-900 w-full max-w-lg overflow-hidden relative rounded-[2rem] shadow-2xl border border-white/20 dark:border-navy-700"
            >
                {/* Decorative gradients */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

                {/* Header */}
                <div className="p-6 md:p-8 flex justify-between items-start relative z-10 bg-gradient-to-b from-white/50 to-transparent dark:from-navy-800/50">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30 text-white rounded-2xl rotate-3">
                            <Settings size={26} />
                        </div>
                        <div>
                            <h3 className="font-bold text-2xl text-navy-900 dark:text-white mb-1">اختبار حر</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">صمم اختبارك وتحدى نفسك</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2.5 bg-gray-100 dark:bg-navy-800 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all hover:scale-105 shadow-sm"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 md:px-8 pb-8 space-y-8 relative z-10">

                    {/* Test Type Selector */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm uppercase tracking-wider">
                            <BookOpen size={16} />
                            <span>نطاق الاختبار</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setType('pages')}
                                className={`group relative p-4 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-2 overflow-hidden ${type === 'pages'
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 shadow-md shadow-indigo-500/10'
                                    : 'border-gray-100 dark:border-navy-800 bg-gray-50/50 dark:bg-navy-800/50 text-gray-400 dark:text-gray-500 hover:border-gray-200 dark:hover:border-navy-700'
                                    }`}
                            >
                                <div className={`p-2 rounded-full ${type === 'pages' ? 'bg-indigo-200 dark:bg-indigo-500/20' : 'bg-gray-200 dark:bg-navy-700'}`}>
                                    <BookOpen size={20} />
                                </div>
                                <span className="font-bold">بالصفحات</span>
                                {type === 'pages' && <div className="absolute top-2 right-2 text-indigo-500"><Check size={16} /></div>}
                            </button>
                            <button
                                disabled
                                className="p-4 rounded-2xl border-2 border-dashed border-gray-200 dark:border-navy-700 text-gray-300 dark:text-gray-600 flex flex-col items-center justify-center gap-2 cursor-not-allowed opacity-70"
                            >
                                <div className="p-2 rounded-full bg-gray-100 dark:bg-navy-800">
                                    <AlignJustify size={20} />
                                </div>
                                <span className="font-bold">بالسورة (قريباً)</span>
                            </button>
                        </div>
                    </div>

                    {/* Range Inputs */}
                    <div className="p-5 bg-gray-50 dark:bg-navy-800/50 rounded-2xl border border-gray-100 dark:border-navy-700/50 space-y-4 shadow-inner">
                        <div className="flex items-center justify-between text-sm font-bold text-gray-500 dark:text-gray-400">
                            <span>حدد النطاق (من - إلى)</span>
                            <span className="text-xs px-2 py-1 bg-white dark:bg-navy-700 rounded-md shadow-sm border border-gray-100 dark:border-navy-600">
                                الحد الأقصى: {toArabicDigits(maxPage)}
                            </span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex-1 relative">
                                <input
                                    type="number"
                                    min={1}
                                    max={maxPage}
                                    value={range.start}
                                    onChange={(e) => setRange({ ...range, start: Math.max(1, Math.min(Number(e.target.value), range.end)) })}
                                    className="w-full text-center font-bold text-xl py-3 rounded-xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-600 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                                />
                                <span className="absolute -top-2.5 right-3 text-[10px] bg-white dark:bg-navy-900 px-1 text-gray-400 font-bold">من</span>
                            </div>
                            <ChevronRight className="text-gray-300 transform rotate-180" />
                            <div className="flex-1 relative">
                                <input
                                    type="number"
                                    min={1}
                                    max={maxPage}
                                    value={range.end}
                                    onChange={(e) => setRange({ ...range, end: Math.min(maxPage, Math.max(Number(e.target.value), range.start)) })}
                                    className="w-full text-center font-bold text-xl py-3 rounded-xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-600 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                                />
                                <span className="absolute -top-2.5 right-3 text-[10px] bg-white dark:bg-navy-900 px-1 text-gray-400 font-bold">إلى</span>
                            </div>
                        </div>
                    </div>

                    {/* Question Count & Mode */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm uppercase tracking-wider">
                                <Target size={16} />
                                <span>عدد الأسئلة</span>
                            </div>
                            <div className="flex rounded-xl bg-gray-100 dark:bg-navy-800 p-1">
                                {[3, 5, 10].map(num => (
                                    <button
                                        key={num}
                                        onClick={() => setQuestionCount(num)}
                                        className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${questionCount === num
                                            ? 'bg-white dark:bg-navy-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                            : 'text-gray-400'
                                            }`}
                                    >
                                        {toArabicDigits(num)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm uppercase tracking-wider">
                                <Sparkles size={16} />
                                <span>النمط</span>
                            </div>
                            <div className="flex rounded-xl bg-gray-100 dark:bg-navy-800 p-1">
                                <button
                                    onClick={() => setMode('interactive')}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'interactive'
                                        ? 'bg-white dark:bg-navy-700 text-emerald-600 shadow-sm'
                                        : 'text-gray-400'
                                        }`}
                                >
                                    تفاعلي
                                </button>
                                <button
                                    onClick={() => setMode('classic')}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'classic'
                                        ? 'bg-white dark:bg-navy-700 text-amber-600 shadow-sm'
                                        : 'text-gray-400'
                                        }`}
                                >
                                    كلاسيك
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Start Button */}
                    <button
                        onClick={handleStart}
                        className="w-full py-5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-600/20 active:scale-[0.98] hover:shadow-2xl hover:shadow-indigo-600/30 transition-all flex items-center justify-center gap-3 relative overflow-hidden group"
                    >
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                        <Play size={24} fill="currentColor" className="text-indigo-100" />
                        <span className="relative z-10">ابدأ الاختبار الآن</span>
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

