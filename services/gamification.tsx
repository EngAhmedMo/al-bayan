import React from 'react';
import {
    Star, Flame, Zap, Medal, Award, Trophy, Target, Crown, Gem, Sparkles,
    Layers, PartyPopper
} from 'lucide-react';
import type { HifzState } from './HifzService';

export interface Achievement {
    id: string;
    icon: React.ReactNode;
    title: string;
    description: string;
    condition: (state: HifzState, streak: number) => boolean;
    color: string;
}

export const ACHIEVEMENTS: Achievement[] = [
    {
        id: 'first_step',
        icon: <Star size={20} />,
        title: 'بداية الغيث',
        description: 'أكملت أول يوم حفظ - الغيث أوله قطرة',
        condition: (s) => s.history.length >= 1,
        color: 'bg-gradient-to-br from-amber-400 to-orange-500'
    },
    {
        id: 'streak_3',
        icon: <Flame size={20} />,
        title: 'المرابط',
        description: '٣ أيام من الرباط مع القرآن',
        condition: (_, streak) => streak >= 3,
        color: 'bg-gradient-to-br from-orange-400 to-red-500'
    },
    {
        id: 'streak_7',
        icon: <Zap size={20} />,
        title: 'أسبوع من النور',
        description: '٧ أيام متتالية من الصحب',
        condition: (_, streak) => streak >= 7,
        color: 'bg-gradient-to-br from-yellow-400 to-amber-500'
    },
    {
        id: 'streak_30',
        icon: <Medal size={20} />,
        title: 'قمر البيان',
        description: '٣٠ يوم من الثبات',
        condition: (_, streak) => streak >= 30,
        color: 'bg-gradient-to-br from-purple-400 to-indigo-600'
    },
    {
        id: 'juz_1',
        icon: <Award size={20} />,
        title: 'الحامل لجزء',
        description: 'بداية الغيث قطرة',
        condition: (s) => (s.planType === 'pages' ? s.currentProgress >= 20 : s.currentProgress >= 200),
        color: 'bg-gradient-to-br from-emerald-400 to-teal-600'
    },
    {
        id: 'juz_5',
        icon: <Trophy size={20} />,
        title: 'خمسة من الزهور',
        description: 'ثبات وإنجاز',
        condition: (s) => (s.planType === 'pages' ? s.currentProgress >= 100 : s.currentProgress >= 1000),
        color: 'bg-gradient-to-br from-blue-400 to-cyan-600'
    },
    {
        id: 'juz_10',
        icon: <Target size={20} />,
        title: 'الحامل لثلث الكتاب',
        description: 'أتممت ثلث القرآن',
        condition: (s) => (s.planType === 'pages' ? s.currentProgress >= 200 : s.currentProgress >= 2000),
        color: 'bg-gradient-to-br from-cyan-400 to-blue-600'
    },
    {
        id: 'half_quran',
        icon: <Crown size={20} />,
        title: 'نصف القرآن',
        description: 'منتصف الطريق!',
        condition: (s) => (s.planType === 'pages' ? s.currentProgress >= 302 : s.currentProgress >= 3118),
        color: 'bg-gradient-to-br from-pink-400 to-rose-600'
    },
    {
        id: 'juz_20',
        icon: <Gem size={20} />,
        title: 'عشرون جزءاً',
        description: 'إنجاز عظيم، ٢٠ جزء!',
        condition: (s) => (s.planType === 'pages' ? s.currentProgress >= 400 : s.currentProgress >= 4000),
        color: 'bg-gradient-to-br from-violet-400 to-purple-600'
    },
    {
        id: 'juz_25',
        icon: <Sparkles size={20} />,
        title: 'على مشارف الختم',
        description: '٢٥ جزء، اقتربت!',
        condition: (s) => (s.planType === 'pages' ? s.currentProgress >= 500 : s.currentProgress >= 5000),
        color: 'bg-gradient-to-br from-rose-400 to-red-600'
    },
    {
        id: 'test_master',
        icon: <Medal size={20} />,
        title: 'المتقن',
        description: '١٠ اختبارات بدرجة كاملة',
        condition: (s) => (s.testStats?.perfectTestsCount || 0) >= 10,
        color: 'bg-gradient-to-br from-indigo-500 to-blue-700'
    },
    {
        id: 'reorder_king',
        icon: <Layers size={20} />,
        title: 'سيد الترتيب',
        description: 'إتقان ترتيب الكلمات مراراً',
        condition: (s) => (s.testStats?.reorderCount || 0) >= 5,
        color: 'bg-gradient-to-br from-teal-500 to-emerald-700'
    },
    {
        id: 'silent_teacher',
        icon: <Sparkles size={20} />,
        title: 'المعلم الصامت',
        description: 'استخدام المصحف المخفي ٥ مرات',
        condition: (s) => (s.testStats?.blankedMushafPages?.length || 0) >= 5,
        color: 'bg-gradient-to-br from-purple-500 to-pink-600'
    },
    {
        id: 'full_quran',
        icon: <PartyPopper size={20} />,
        title: 'ختمة القرآن',
        description: 'مبارك! أتممت حفظ الكتاب',
        condition: (s) => (s.planType === 'pages' ? s.currentProgress >= 604 : s.currentProgress >= 6236),
        color: 'bg-gradient-to-br from-gold-300 via-amber-500 to-gold-600 border border-white/20'
    },
];

export const evaluateAchievements = (state: HifzState, streak: number): string[] => {
    return ACHIEVEMENTS.filter(achievement => achievement.condition(state, streak)).map(a => a.id);
};
