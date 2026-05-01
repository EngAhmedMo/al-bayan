
import React, { forwardRef } from 'react';
import { Trophy, Flame, Target, BookOpen, Sparkles, ScrollText, Award } from 'lucide-react';
import { toArabicDigits } from '../../services/normalization';
import { Achievement } from '../../services/gamification';

// Local constants
const TOTAL_PAGES = 604;
const TOTAL_AYAHS = 6236;

interface HifzState {
    planType: 'pages' | 'ayahs';
    currentProgress: number;
    history: string[];
}

interface ProgressShareCardProps {
    state: HifzState;
    userName?: string;
    latestAchievement?: Achievement;
}

export const ProgressShareCard = forwardRef<HTMLDivElement, ProgressShareCardProps>(({ state, userName, latestAchievement }, ref) => {

    const total = state.planType === 'pages' ? TOTAL_PAGES : TOTAL_AYAHS;
    const safeTotal = total > 0 ? total : 1;
    const rawProgress = state.currentProgress || 0;
    const validProgress = Math.min(Math.max(rawProgress, 0), safeTotal);

    const percent = Math.round((validProgress / safeTotal) * 100);
    const remaining = Math.max(safeTotal - validProgress, 0);
    const unit = state.planType === 'pages' ? 'صفحة' : 'آية';
    const daysActive = state.history?.length || 0;

    return (
        <div ref={ref} className="w-[1080px] h-[1920px] bg-[#FDFBF7] text-navy-900 flex flex-col justify-between relative overflow-hidden font-quran" dir="rtl">

            {/* Background Texture & Decoration */}
            <div className="absolute inset-0 z-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#D4AF37 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>

            <div className="absolute top-0 w-full h-[600px] bg-gradient-to-b from-emerald-900/10 to-transparent pointer-events-none"></div>
            <div className="absolute bottom-0 w-full h-[400px] bg-gradient-to-t from-[#D4AF37]/10 to-transparent pointer-events-none"></div>

            {/* Top Frame Decoration */}
            <div className="absolute top-10 left-10 right-10 h-[1840px] border-2 border-[#D4AF37]/30 rounded-[3rem] pointer-events-none flex items-center justify-center">
                <div className="w-[98%] h-[99%] border border-[#D4AF37]/20 rounded-[2.8rem]"></div>
            </div>

            {/* Achievement Badge (Watermark) */}
            {latestAchievement && (
                <div className="absolute top-[20%] left-1/2 -translate-x-1/2 opacity-[0.03] scale-[3] pointer-events-none text-emerald-900">
                    <Trophy size={500} />
                </div>
            )}

            {/* Content Container */}
            <div className="relative z-10 flex flex-col h-full p-24">

                {/* Header */}
                {/* Header: One clean row */}
                <div className="flex justify-between items-center mb-10">
                    {/* Brand (Right) */}
                    <div className="flex items-center gap-5">
                        <div className="w-20 h-20 rounded-2xl bg-emerald-700 flex items-center justify-center shadow-lg border border-emerald-600/40">
                            <BookOpen size={44} className="text-white" />
                        </div>
                        <h1 className="text-7xl font-extrabold text-emerald-800 leading-none font-sans">
                            البيان
                        </h1>
                    </div>

                    {/* Date (Left) */}
                    <span className="text-3xl font-bold text-gray-500 font-sans leading-none whitespace-nowrap">
                        {toArabicDigits(new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }))}
                    </span>
                </div>

                {/* User pill below header (optional) */}
                {userName && (
                    <div className="flex justify-start mb-10">
                        <div className="px-6 py-2 bg-emerald-50 rounded-full border border-emerald-100">
                            <span className="text-2xl text-emerald-800 font-bold">{userName}</span>
                        </div>
                    </div>
                )}

                {/* Main Stats Block */}
                <div className="flex-1 flex flex-col items-center justify-center gap-16 -mt-20">

                    {/* Ring Progress */}
                    <div className="relative w-96 h-96 flex items-center justify-center scale-125">
                        {/* Outer Glow */}
                        <div className="absolute inset-0 bg-emerald-500/5 rounded-full blur-3xl"></div>

                        <svg className="w-full h-full -rotate-90">
                            {/* Track */}
                            <circle cx="50%" cy="50%" r="170" stroke="#E5E7EB" strokeWidth="24" fill="transparent" />
                            {/* Progress */}
                            <circle
                                cx="50%" cy="50%" r="170" stroke="#059669" strokeWidth="24" fill="transparent"
                                strokeDasharray={2 * Math.PI * 170}
                                strokeDashoffset={2 * Math.PI * 170 * (1 - percent / 100)}
                                strokeLinecap="round"
                                className="drop-shadow-2xl"
                            />
                        </svg>

                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-[8rem] font-bold text-emerald-900 leading-none font-sans">
                                {toArabicDigits(percent)}<span className="text-4xl text-emerald-600">%</span>
                            </span>
                            <span className="text-2xl text-gray-500 font-bold mt-2">نسبة إتمام الحفظ</span>
                        </div>
                    </div>

                    {/* Achievement Card */}
                    {latestAchievement ? (
                        <div className="w-full max-w-3xl bg-white p-10 rounded-[3rem] shadow-2xl border border-gray-100 flex items-center gap-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/10 rounded-bl-[100px]"></div>

                            <div className={`w-32 h-32 shrink-0 ${latestAchievement.color} rounded-full flex items-center justify-center text-white shadow-lg`}>
                                {React.cloneElement(latestAchievement.icon as React.ReactElement, { size: 64 })}
                            </div>

                            <div className="flex flex-col flex-1">
                                <span className="text-xl text-[#D4AF37] font-bold mb-2">إنجاز جديد!</span>
                                <h2 className="text-5xl font-bold text-navy-900 mb-3">{latestAchievement.title}</h2>
                                <p className="text-2xl text-gray-500 leading-relaxed max-w-lg">
                                    {latestAchievement.description}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center px-10">
                            <p className="text-5xl leading-[1.8] text-navy-800/80">
                                "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ"
                            </p>
                        </div>
                    )}

                    {/* Grid Stats */}
                    <div className="grid grid-cols-3 gap-8 w-full max-w-4xl">
                        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-lg flex flex-col items-center gap-4">
                            <Flame size={48} className="text-orange-500" />
                            <span className="text-5xl font-bold text-navy-900 font-sans">{toArabicDigits(daysActive)}</span>
                            <span className="text-xl text-gray-400 font-bold">أيام التفاعل</span>
                        </div>
                        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-lg flex flex-col items-center gap-4">
                            <Target size={48} className="text-blue-500" />
                            <span className="text-5xl font-bold text-navy-900 font-sans">{toArabicDigits(remaining)}</span>
                            <span className="text-xl text-gray-400 font-bold">المتبقي ({unit})</span>
                        </div>
                        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-lg flex flex-col items-center gap-4">
                            <BookOpen size={48} className="text-emerald-500" />
                            <span className="text-5xl font-bold text-navy-900 font-sans">{toArabicDigits(validProgress)}</span>
                            <span className="text-xl text-gray-400 font-bold">{unit} محفوظة</span>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="mt-auto flex justify-center items-center gap-4 opacity-60">
                    <span className="text-xl font-bold text-navy-700">تم الإنشاء عبر تطبيق البيان</span>
                    <Sparkles size={24} className="text-[#D4AF37]" />
                </div>
            </div>
        </div>
    );
});

ProgressShareCard.displayName = 'ProgressShareCard';

