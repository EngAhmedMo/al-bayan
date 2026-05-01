import React from 'react';
import { Zap, Layers, AlignJustify, ChevronRight, Brain, Shuffle, ChevronLeft, Type, Feather, Flame } from 'lucide-react';
import { motion } from 'framer-motion';
import { toArabicDigits } from '../../services/normalization';
import { QuizDifficulty } from '../../services/hifzManager';

interface QuizPhaseSelectorProps {
  rangeLabel: string;
  ayahCount: number;
  difficulty: QuizDifficulty;
  onDifficultyChange: (d: QuizDifficulty) => void;
  onPhase1: () => void;
  onPhase2: () => void;
  onPhase3: () => void;
  onClose: () => void;
}

const DIFFICULTY_OPTIONS: { value: QuizDifficulty; label: string; icon: React.ReactNode; color: string }[] = [
  {
    value: 'easy',
    label: 'سهل',
    icon: <Feather size={14} />,
    color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800',
  },
  {
    value: 'medium',
    label: 'متوسط',
    icon: <Brain size={14} />,
    color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
  },
  {
    value: 'hard',
    label: 'صعب',
    icon: <Flame size={14} />,
    color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
  },
];

const DIFFICULTY_DESCRIPTION: Record<QuizDifficulty, string> = {
  easy: 'تلميحات مساعدة ومتسع من الوقت',
  medium: 'توازن بين الأنواع والصعوبة',
  hard: 'أسئلة MCQ متقدمة بلا تلميحات',
};

export const QuizPhaseSelector: React.FC<QuizPhaseSelectorProps> = ({
  rangeLabel,
  ayahCount,
  difficulty,
  onDifficultyChange,
  onPhase1,
  onPhase2,
  onPhase3,
  onClose,
}) => {
  const phases = [
    {
      id: 1,
      icon: Brain,
      gradientFrom: 'from-emerald-500',
      gradientTo: 'to-teal-600',
      glowColor: 'shadow-emerald-500/30',
      borderColor: 'border-emerald-200 dark:border-emerald-900/60',
      hoverBg: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/30',
      badgeBg: 'bg-emerald-100 dark:bg-emerald-900/40',
      badgeText: 'text-emerald-700 dark:text-emerald-300',
      title: 'المرحلة الأولى',
      subtitle: 'أسئلة ذكية',
      description: 'أول كلمة، آخر كلمة، إكمال الآية، تسميع غيبي',
      tag: 'متعدد الأنواع',
      handler: onPhase1,
    },
    {
      id: 2,
      icon: Shuffle,
      gradientFrom: 'from-violet-500',
      gradientTo: 'to-purple-600',
      glowColor: 'shadow-violet-500/30',
      borderColor: 'border-violet-200 dark:border-violet-900/60',
      hoverBg: 'hover:bg-violet-50 dark:hover:bg-violet-950/30',
      badgeBg: 'bg-violet-100 dark:bg-violet-900/40',
      badgeText: 'text-violet-700 dark:text-violet-300',
      title: 'المرحلة الثانية',
      subtitle: 'ترتيب الآيات',
      description: `رتّب ${ayahCount ? toArabicDigits(ayahCount) + ' آيات' : 'جميع آيات'} الصفحة بالترتيب الصحيح`,
      tag: 'ترتيب شامل',
      handler: onPhase2,
    },
    {
      id: 3,
      icon: Type,
      gradientFrom: 'from-blue-500',
      gradientTo: 'to-indigo-600',
      glowColor: 'shadow-blue-500/30',
      borderColor: 'border-blue-200 dark:border-blue-900/60',
      hoverBg: 'hover:bg-blue-50 dark:hover:bg-blue-950/30',
      badgeBg: 'bg-blue-100 dark:bg-blue-900/40',
      badgeText: 'text-blue-700 dark:text-blue-300',
      title: 'المرحلة الثالثة',
      subtitle: 'ترتيب الكلمات',
      description: `رتّب كلمات كل آية بالترتيب الصحيح وبدون إظهار رقمها`,
      tag: 'دقة الحفظ',
      handler: onPhase3,
    },
  ];

  return (
    <div className="flex flex-col gap-5 py-2">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-gold-400 to-amber-500 shadow-lg shadow-gold-500/25">
          <span className="text-white text-2xl">📖</span>
        </div>
        <h2 className="text-xl font-bold text-navy-900 dark:text-white">
          اختبار {rangeLabel}
        </h2>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          {toArabicDigits(ayahCount)} آية — اختر نوع الاختبار
        </p>
      </div>

      {/* Difficulty Selector */}
      <div className="space-y-3">
        <p className="text-xs font-bold text-navy-500 dark:text-navy-400 uppercase tracking-wider">مستوى الصعوبة</p>
        <div className="grid grid-cols-3 gap-2">
          {DIFFICULTY_OPTIONS.map(opt => {
            const isSelected = difficulty === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onDifficultyChange(opt.value)}
                className={`
                  relative flex flex-col items-center gap-1.5 py-3 px-2
                  rounded-xl border-2 transition-all duration-200
                  ${isSelected
                    ? opt.color + ' shadow-sm'
                    : 'border-navy-100 dark:border-navy-800 text-navy-500 dark:text-navy-400 hover:border-navy-200 dark:hover:border-navy-700'
                  }
                `}
              >
                {opt.icon}
                <span className="text-xs font-bold">{opt.label}</span>
                {isSelected && (
                  <motion.div
                    layoutId="difficulty-indicator"
                    className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-current opacity-60"
                  />
                )}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-center text-navy-400 dark:text-navy-500">
          {DIFFICULTY_DESCRIPTION[difficulty]}
        </p>
      </div>

      <div className="border-t border-gray-100 dark:border-navy-800" />

      {/* Phase cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {phases.map((phase) => {
          const Icon = phase.icon;
          return (
            <motion.button
              key={phase.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={phase.handler}
              className={`
                group relative flex flex-col items-start gap-3 p-5 rounded-2xl border
                bg-white dark:bg-navy-900
                ${phase.borderColor} ${phase.hoverBg}
                transition-all duration-200 text-right shadow-sm hover:shadow-md
              `}
            >
              {/* Badge */}
              <span className={`absolute top-3 left-3 text-[10px] font-bold px-2 py-0.5 rounded-full ${phase.badgeBg} ${phase.badgeText}`}>
                {phase.tag}
              </span>

              {/* Icon */}
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${phase.gradientFrom} ${phase.gradientTo} flex items-center justify-center shadow-lg ${phase.glowColor}`}>
                <Icon size={22} className="text-white" />
              </div>

              {/* Text */}
              <div className="flex-1">
                <p className="text-[11px] font-bold text-navy-400 dark:text-navy-500 mb-0.5">{phase.title}</p>
                <h3 className="text-base font-bold text-navy-900 dark:text-white mb-1">{phase.subtitle}</h3>
                <p className="text-xs text-navy-500 dark:text-navy-400 leading-relaxed">{phase.description}</p>
              </div>

              {/* Arrow */}
              <ChevronLeft
                size={18}
                className="absolute bottom-4 left-4 text-navy-300 dark:text-navy-600 group-hover:text-navy-600 dark:group-hover:text-navy-300 transition-colors"
              />
            </motion.button>
          );
        })}
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        className="w-full py-3 rounded-xl text-sm font-bold text-navy-500 dark:text-navy-400 hover:bg-navy-100 dark:hover:bg-navy-800 transition-colors"
      >
        إغلاق
      </button>
    </div>
  );
};
