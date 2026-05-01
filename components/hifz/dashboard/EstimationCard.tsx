import React from 'react';
import { Calendar, TrendingUp } from 'lucide-react';
import { toArabicDigits } from '../../../services/normalization';

interface EstimationCardProps {
    currentProgress: number;
    totalTarget: number;
    startPoint: number;
    amountPerDay: number;
    daysPerWeek: number;
    progressPercent: number;
    onClick?: () => void;
}

export const EstimationCard: React.FC<EstimationCardProps> = ({
    currentProgress,
    totalTarget,
    startPoint,
    amountPerDay,
    daysPerWeek,
    progressPercent,
    onClick
}) => {

    const getEstimation = () => {
        const remainingUnits = Math.max(0, totalTarget - (startPoint - 1) - currentProgress);

        if (remainingUnits <= 0) return { date: 'مكتمل', remainingDays: 0, weeklySpeed: 0 };

        const weeklySpeed = amountPerDay * daysPerWeek;
        if (weeklySpeed === 0) return { date: 'غير محدد', remainingDays: 0, weeklySpeed: 0 };

        const weeksLeft = remainingUnits / weeklySpeed;
        const daysLeft = weeksLeft * 7;
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + daysLeft);

        return {
            date: targetDate.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }),
            remainingDays: Math.ceil(daysLeft),
            weeklySpeed
        };
    };

    const estimation = getEstimation();

    return (
        <div
            onClick={onClick}
            className="group rounded-3xl bg-white/80 dark:bg-navy-900/90 backdrop-blur-xl border border-white/30 dark:border-white/5 shadow-lg hover:shadow-xl transition-all duration-300 p-5 md:p-6 flex flex-col justify-between h-full min-h-[160px] cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
        >

            {/* Ambient Glow */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2 group-hover:bg-blue-500/20 transition-all duration-500"></div>

            <div className="flex items-center justify-between mb-4 relative z-10">
                <span className="text-xs md:text-sm font-bold text-navy-400 dark:text-navy-300 uppercase tracking-wider">موعد الختم</span>
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center text-blue-500 shadow-md border border-blue-500/20 group-hover:scale-110 transition-transform duration-300">
                    <Calendar size={20} className="group-hover:rotate-12 transition-transform duration-300" />
                </div>
            </div>

            <div className="flex-1 flex flex-col justify-end relative z-10">
                <h4 className="text-2xl md:text-3xl font-black text-navy-900 dark:text-white leading-tight mb-2 drop-shadow-sm" dir="rtl">
                    {estimation.date}
                </h4>
                <p className="text-xs text-navy-500 dark:text-navy-400 font-medium mb-3">
                    {estimation.remainingDays > 0 ? `باقي ${toArabicDigits(estimation.remainingDays)} يوم تقريباً` : 'مبروك الختم!'}
                </p>

                {/* Weekly Speed */}
                {estimation.weeklySpeed > 0 && (
                    <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 font-bold">
                        <TrendingUp size={14} />
                        <span>{toArabicDigits(estimation.weeklySpeed)} في الأسبوع</span>
                    </div>
                )}
            </div>

            {/* Linear Progress Bar - Enhanced */}
            <div className="mt-4 w-full h-2 bg-navy-50 dark:bg-navy-800 rounded-full overflow-hidden relative z-10">
                <div
                    className="h-full bg-gradient-to-r from-blue-400 via-indigo-500 to-blue-600 rounded-full transition-all duration-1000 ease-out relative shadow-lg"
                    style={{ width: `${progressPercent}%` }}
                >
                    <div className="absolute right-0 top-0 bottom-0 w-3 bg-white/60 blur-sm"></div>
                    <div className="absolute inset-0 bg-white/10 animate-pulse"></div>
                </div>
            </div>

        </div>
    );
};
