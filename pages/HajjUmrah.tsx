import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Landmark, Footprints, Map, ChevronDown, ChevronUp, Quote, Check, Info, HeartHandshake, Sparkles } from 'lucide-react';
import { HAJJ_DATA } from '../src/data/hajjUmrahData';
import { TopBar } from '../components/TopBar';

export const HajjUmrah: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'hajj' | 'umrah' | 'ziyarah'>('hajj');
    const [expandedStep, setExpandedStep] = useState<string | null>(null);

    const toggleStep = (id: string) => {
        setExpandedStep(expandedStep === id ? null : id);
    };

    const tabs = [
        { id: 'hajj', label: 'مناسك الحج', icon: <Landmark size={18} /> },
        { id: 'umrah', label: 'العمرة', icon: <Footprints size={18} /> },
        { id: 'ziyarah', label: 'الزيارة', icon: <Map size={18} /> },
    ];

    const currentSteps = HAJJ_DATA[activeTab];

    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-gold-50 via-white to-gold-50/50 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 font-sans relative overflow-hidden">
            {/* Background Decorative Elements */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-400/10 dark:bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                <div className="absolute bottom-1/3 left-0 w-72 h-72 bg-gold-400/10 dark:bg-gold-500/5 rounded-full blur-3xl -translate-x-1/2"></div>
            </div>

            <TopBar title="دليل الحج والعمرة" />

            <div className="flex-1 overflow-y-auto pb-24 px-4 pt-4 relative z-10">

                {/* Header Banner - Enhanced */}
                <header className="mb-6 text-center bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 dark:from-emerald-700 dark:via-emerald-800 dark:to-emerald-900 p-6 sm:p-8 rounded-3xl shadow-2xl shadow-emerald-500/20 dark:shadow-emerald-950/50 border border-emerald-500/20 relative overflow-hidden">
                    {/* Islamic Pattern Overlay */}
                    <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/arabesque.png')]"></div>

                    {/* Decorative Glow */}
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-12 -mt-12 blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-gold-400/20 rounded-full -ml-8 -mb-8 blur-2xl"></div>

                    <div className="relative z-10">
                        <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/20 mb-4">
                            <Sparkles size={14} className="text-gold-300" />
                            <span className="text-xs font-bold text-white/90 uppercase tracking-widest">دليل ميسر</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3 font-quran drop-shadow-lg">
                            {activeTab === 'hajj' ? 'لبيك اللهم حجاً' : activeTab === 'umrah' ? 'لبيك اللهم عمرة' : 'زيارة المدينة المنورة'}
                        </h1>
                        <p className="text-emerald-100/80 text-sm sm:text-base max-w-md mx-auto">
                            خطوات تفصيلية لأداء النسك على هدي النبي ﷺ
                        </p>
                    </div>
                </header>

                {/* Tabs - Enhanced */}
                <div className="flex justify-center mb-6 bg-white/95 dark:bg-navy-800/95 backdrop-blur-xl rounded-2xl p-1.5 sm:p-2 shadow-xl shadow-gold-500/5 dark:shadow-navy-950/50 border border-gold-200/50 dark:border-navy-700 mx-auto max-w-lg">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id as any); setExpandedStep(null); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all duration-300 text-sm font-bold ${activeTab === tab.id
                                ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                                : 'text-navy-500 dark:text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-700'
                                }`}
                        >
                            {tab.icon}
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Timeline Content - Enhanced */}
                <div className="max-w-3xl mx-auto space-y-4">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {currentSteps.map((step, index) => {
                                const isExpanded = expandedStep === step.id;
                                return (
                                    <motion.div
                                        key={step.id}
                                        layout
                                        className={`bg-white/95 dark:bg-navy-800/95 backdrop-blur-xl rounded-2xl shadow-lg border transition-all duration-300 overflow-hidden mb-4 ${isExpanded
                                            ? 'border-emerald-400 dark:border-emerald-500/50 shadow-xl shadow-emerald-500/10'
                                            : 'border-gold-100 dark:border-navy-700 hover:border-emerald-300 dark:hover:border-emerald-600/50 hover:shadow-xl hover:-translate-y-0.5'
                                            }`}
                                    >
                                        <div
                                            className="p-4 sm:p-5 flex items-center gap-4 cursor-pointer select-none"
                                            onClick={() => toggleStep(step.id)}
                                        >
                                            {/* Step Number */}
                                            <div className={`flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center font-black text-xl font-sans transition-all shadow-lg ${isExpanded
                                                ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-emerald-500/30'
                                                : 'bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                                                }`}>
                                                {index + 1}
                                            </div>

                                            {/* Step Title */}
                                            <div className="flex-1 min-w-0">
                                                <h3 className={`font-bold text-base sm:text-lg truncate ${isExpanded ? 'text-emerald-700 dark:text-emerald-400' : 'text-navy-900 dark:text-white'}`}>
                                                    {step.title}
                                                </h3>
                                                {!isExpanded && (
                                                    <p className="text-xs text-navy-500 dark:text-navy-400 mt-1 line-clamp-1">
                                                        {step.description}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Chevron */}
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isExpanded ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-navy-50 dark:bg-navy-700'}`}>
                                                {isExpanded ? <ChevronUp className="text-emerald-500" size={20} /> : <ChevronDown className="text-navy-400" size={20} />}
                                            </div>
                                        </div>

                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="border-t border-emerald-100 dark:border-navy-700 bg-gradient-to-b from-emerald-50/50 to-white dark:from-navy-900/50 dark:to-navy-950/30"
                                                >
                                                    <div className="p-5 sm:p-6 space-y-5 text-navy-700 dark:text-navy-200">

                                                        {/* Description & Details */}
                                                        <div className="bg-white dark:bg-navy-800 p-4 rounded-xl border border-emerald-100 dark:border-navy-700 shadow-sm">
                                                            <p className="font-bold text-emerald-700 dark:text-emerald-400 mb-2 text-sm flex items-center gap-2">
                                                                <Info size={14} />
                                                                شرح الخطوة:
                                                            </p>
                                                            <p className="leading-relaxed text-sm dark:text-gray-300">{step.details}</p>
                                                        </div>

                                                        {/* Evidence */}
                                                        {step.evidence && (
                                                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/10 p-4 sm:p-5 rounded-2xl border border-amber-200/50 dark:border-amber-700/30 shadow-lg shadow-amber-500/5">
                                                                <div className="flex gap-3">
                                                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
                                                                        <Quote className="text-white" size={16} />
                                                                    </div>
                                                                    <p className="text-sm font-serif italic text-amber-900 dark:text-amber-100 leading-relaxed text-right flex-1">
                                                                        {step.evidence}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Duas */}
                                                        {step.duas && step.duas.length > 0 && (
                                                            <div>
                                                                <p className="font-bold text-emerald-700 dark:text-emerald-400 mb-3 text-sm flex items-center gap-2">
                                                                    <HeartHandshake size={16} />
                                                                    أدعية مستحبة:
                                                                </p>
                                                                <ul className="space-y-2">
                                                                    {step.duas.map((dua, i) => (
                                                                        <li key={i} className="flex gap-3 items-start bg-white dark:bg-navy-800 p-4 rounded-xl text-sm shadow-lg shadow-gold-500/5 dark:shadow-navy-950/50 border border-gold-100 dark:border-navy-700">
                                                                            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shrink-0 mt-1">
                                                                                <span className="text-white text-xs font-bold">{i + 1}</span>
                                                                            </div>
                                                                            <span className="font-quran leading-loose flex-1">{dua}</span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}

                                                        {/* Tips */}
                                                        {step.tips && step.tips.length > 0 && (
                                                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/10 p-4 sm:p-5 rounded-2xl border border-blue-200/50 dark:border-blue-700/30 shadow-lg shadow-blue-500/5 text-sm">
                                                                <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
                                                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                                                                        <Check className="text-white" size={14} />
                                                                    </div>
                                                                    نصائح عملية:
                                                                </h4>
                                                                <ul className="space-y-2 text-blue-700 dark:text-blue-200">
                                                                    {step.tips.map((tip, i) => (
                                                                        <li key={i} className="flex items-start gap-2">
                                                                            <span className="text-blue-500 mt-1">•</span>
                                                                            <span>{tip}</span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                );
                            })}
                        </motion.div>
                    </AnimatePresence>

                    {/* Footer Note - Enhanced */}
                    <div className="mt-8 mb-4 text-center">
                        <div className="inline-flex items-center gap-2 bg-white/80 dark:bg-navy-800/80 backdrop-blur-xl px-5 py-3 rounded-2xl border border-gold-200/50 dark:border-navy-700 shadow-lg">
                            <Sparkles size={14} className="text-gold-500" />
                            <p className="text-sm font-medium text-navy-600 dark:text-navy-300">تقبل الله منا ومنكم صالح الأعمال</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


