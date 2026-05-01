import React from 'react';
import { ScrollText, Trophy, Sparkles } from 'lucide-react';
import { toArabicDigits } from '../../../services/normalization';

interface ProgressCardProps {
    currentProgress: number;
    planType: 'pages' | 'ayahs';
    progressPercent: number;
}

export const ProgressCard: React.FC<ProgressCardProps> = ({ currentProgress, planType, progressPercent }) => {
    // Circle Config - Increased size
    const radius = 56;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

    return (
        <div className="relative overflow-hidden rounded-[2rem] md:rounded-[2.5rem] bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 p-6 md:p-8 text-white shadow-2xl shadow-emerald-500/30 flex items-center justify-between group h-full min-h-[180px] md:min-h-[200px]">

            {/* Background Texture/Decorations */}
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none select-none">
                <ScrollText size={220} className="absolute -top-12 -left-12 rotate-12 group-hover:rotate-[15deg] transition-transform duration-700" />
                <div className="absolute bottom-0 right-0 w-72 h-72 bg-white blur-[120px] opacity-20 group-hover:opacity-30 transition-opacity duration-500"></div>
            </div>

            {/* Animated particles */}
            <div className="absolute inset-0 opacity-30">
                <Sparkles className="absolute top-8 right-12 text-yellow-300 animate-pulse" size={16} />
                <Sparkles className="absolute bottom-12 left-16 text-emerald-200 animate-pulse delay-150" size={12} />
                <Sparkles className="absolute top-1/2 left-8 text-white animate-pulse delay-300" size={14} />
            </div>

            <div className="relative z-10 flex flex-col justify-center h-full">
                <div className="flex items-center gap-2 mb-3 opacity-90">
                    <Trophy size={18} className="text-yellow-300 drop-shadow-lg" />
                    <span className="text-sm md:text-base font-bold tracking-wide">الإنجاز الكلي</span>
                </div>

                <h3 className="text-5xl md:text-6xl font-black tracking-tight mb-3 drop-shadow-lg">
                    {toArabicDigits(currentProgress)}
                    <span className="text-xl md:text-2xl font-medium opacity-80 mr-2">{planType === 'pages' ? 'صفحة' : 'آية'}</span>
                </h3>

                <p className="text-emerald-100/90 text-xs md:text-sm font-medium max-w-[180px] leading-relaxed">
                    استمر في التقدم، كل آية تقربك أكثر إلى الختمة المباركة.
                </p>
            </div>

            {/* Circular Progress */}
            <div className="relative z-10 w-36 h-36 md:w-40 md:h-40 flex items-center justify-center shrink-0 select-none">
                {/* Outer Glow with pulse */}
                <div className="absolute inset-0 bg-emerald-400/30 blur-2xl rounded-full animate-pulse"></div>

                <svg className="w-full h-full transform -rotate-90 drop-shadow-2xl">
                    {/* Track */}
                    <circle
                        cx="50%" cy="50%" r={radius}
                        stroke="currentColor"
                        strokeWidth="10"
                        fill="transparent"
                        className="text-black/10"
                    />
                    {/* Indicator */}
                    <circle
                        cx="50%" cy="50%" r={radius}
                        stroke="currentColor"
                        strokeWidth="10"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        className="text-white transition-all duration-1000 ease-out drop-shadow-lg"
                        style={{
                            filter: 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.6))'
                        }}
                    />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl md:text-4xl font-black drop-shadow-lg">{toArabicDigits(progressPercent)}%</span>
                    <span className="text-[10px] font-bold opacity-90 uppercase tracking-widest mt-1">مكتمل</span>
                </div>
            </div>
        </div>
    );
};
