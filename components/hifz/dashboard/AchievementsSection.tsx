import React from 'react';
import { Trophy, Lock, Star, Target, Crown } from 'lucide-react';
import { ACHIEVEMENTS } from '../../../services/gamification';
import { motion } from 'framer-motion';

interface AchievementsSectionProps {
    unlockedIds: string[];
}

export const AchievementsSection: React.FC<AchievementsSectionProps> = ({ unlockedIds = [] }) => {
    // Sort: Unlocked first, then locked
    const sortedAchievements = [...ACHIEVEMENTS].sort((a, b) => {
        const aUnlocked = unlockedIds.includes(a.id);
        const bUnlocked = unlockedIds.includes(b.id);
        if (aUnlocked && !bUnlocked) return -1;
        if (!aUnlocked && bUnlocked) return 1;
        return 0;
    });

    const unlockedCount = unlockedIds.length;
    const totalCount = ACHIEVEMENTS.length;
    const progress = (unlockedCount / totalCount) * 100;

    return (
        <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border border-gray-100 dark:border-navy-700 shadow-sm relative overflow-hidden group">

            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-amber-500/10 transition-colors duration-500"></div>

            <div className="flex items-center justify-between mb-8 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl text-white shadow-lg shadow-amber-500/30">
                        <Trophy size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-navy-900 dark:text-white text-lg">لوحة الشرف</h3>
                        <p className="text-xs text-gray-500 font-bold">رحلة إنجازاتك في حفظ القرآن</p>
                    </div>
                </div>

                {/* Level Badge */}
                <div className="flex flex-col items-end">
                    <span className="text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-wider">المستوى الحالي</span>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-navy-50 dark:bg-navy-800 rounded-lg border border-navy-100 dark:border-navy-700">
                        <Crown size={14} className="text-amber-500" />
                        <span className="text-sm font-black text-navy-800 dark:text-white">
                            {unlockedCount > 10 ? 'حافظ متقن' : unlockedCount > 5 ? 'قارئ مثابر' : 'مبتدئ طموح'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-8 relative z-10">
                <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="text-navy-600 dark:text-gray-400">التقدم الكلي</span>
                    <span className="text-amber-600 dark:text-amber-400">{unlockedCount} / {totalCount} وسام</span>
                </div>
                <div className="h-3 w-full bg-gray-100 dark:bg-navy-800 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                    />
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-4 relative z-10" dir="rtl">
                {sortedAchievements.map((achievement, idx) => {
                    const isUnlocked = unlockedIds.includes(achievement.id);

                    return (
                        <motion.div
                            key={achievement.id}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.05 }}
                            className="group/item relative flex flex-col items-center"
                        >
                            <div
                                className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center transition-all duration-300 relative overflow-hidden ${isUnlocked
                                    ? `bg-gradient-to-br ${achievement.color} text-white shadow-lg shadow-amber-500/20 scale-100 group-hover/item:scale-110 group-hover/item:-translate-y-1`
                                    : 'bg-gray-50 dark:bg-navy-800 border-2 border-dashed border-gray-200 dark:border-navy-700 text-gray-300 dark:text-navy-600 grayscale'
                                    }`}
                            >
                                {isUnlocked && (
                                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                                )}
                                {isUnlocked ? achievement.icon : <Lock size={24} />}

                                {isUnlocked && (
                                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-16 h-1 bg-white/50 blur-md rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity"></div>
                                )}
                            </div>

                            {/* Rich Tooltip */}
                            <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-navy-900 text-white p-3 rounded-2xl opacity-0 group-hover/item:opacity-100 transition-all duration-300 invisible group-hover/item:visible z-30 shadow-2xl min-w-[140px] text-center transform translate-y-2 group-hover/item:translate-y-0 pointer-events-none">
                                <div className="font-bold text-sm mb-1 text-amber-400">{achievement.title}</div>
                                <div className="text-[10px] leading-relaxed text-gray-300">{achievement.description}</div>
                                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-navy-900 rotate-45"></div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
};

