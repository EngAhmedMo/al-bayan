import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, AlertTriangle, RotateCcw, X, CheckCircle, Target } from 'lucide-react';
import { toArabicDigits } from '../../services/normalization';

export interface AyahMistakeSummary {
  preview: string;
  errorCount: number;
}

interface QuizResultScreenProps {
  score: number;           // 0-100
  correctCount: number;
  totalCount: number;
  timeTakenMs?: number;
  phase: 1 | 2 | 3;
  mistakes?: { questionText: string; correctAnswer: string | string[] }[];
  ayahMistakes?: AyahMistakeSummary[];   // Phase 2 & 3 detailed errors
  onRetry: () => void;
  onClose: () => void;
}

export const QuizResultScreen: React.FC<QuizResultScreenProps> = ({
  score,
  correctCount,
  totalCount,
  timeTakenMs,
  phase,
  mistakes = [],
  ayahMistakes = [],
  onRetry,
  onClose,
}) => {
  const passed = score >= 70;
  const isPerfect = score === 100;

  const formatTime = (ms: number): string => {
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const remainSecs = secs % 60;
    if (mins > 0) return `${toArabicDigits(mins)}:${toArabicDigits(remainSecs.toString().padStart(2, '0'))}`;
    return `${toArabicDigits(remainSecs)} ث`;
  };

  const getScoreColor = () => {
    if (score >= 90) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 70) return 'text-gold-600 dark:text-gold-400';
    return 'text-red-500 dark:text-red-400';
  };

  const getScoreRing = () => {
    if (score >= 90) return 'from-emerald-400 to-teal-500';
    if (score >= 70) return 'from-gold-400 to-amber-500';
    return 'from-red-400 to-rose-500';
  };

  const getFeedbackText = () => {
    if (isPerfect) return 'ممتاز! أتقنت الصفحة كاملاً 🌟';
    if (score >= 90) return 'أحسنت! أداء متميز جداً';
    if (score >= 70) return 'جيد! يمكنك الأفضل بمزيد من التثبيت';
    return 'تحتاج لمزيد من المراجعة والتثبيت';
  };

  const circumference = 2 * Math.PI * 44; // r=44
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col gap-5 py-2" dir="rtl">

      {/* Header with close */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-navy-900 dark:text-white">
          نتيجة {phase === 1 ? 'المرحلة الأولى' : phase === 2 ? 'ترتيب الآيات' : 'ترتيب الكلمات'}
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-navy-400 hover:text-navy-700 dark:hover:text-white hover:bg-navy-100 dark:hover:bg-navy-800 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Score Ring */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          {/* Glow */}
          <div
            className={`absolute inset-0 rounded-full blur-2xl opacity-30 bg-gradient-to-br ${getScoreRing()}`}
            style={{ transform: 'scale(1.1)' }}
          />

          <svg width="120" height="120" viewBox="0 0 120 120" className="relative">
            {/* Background circle */}
            <circle
              cx="60" cy="60" r="44"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-navy-100 dark:text-navy-800"
            />
            {/* Progress circle */}
            <motion.circle
              cx="60" cy="60" r="44"
              fill="none"
              stroke="url(#scoreGradient)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
              transform="rotate(-90 60 60)"
            />
            <defs>
              <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={score >= 90 ? '#10b981' : score >= 70 ? '#f59e0b' : '#ef4444'} />
                <stop offset="100%" stopColor={score >= 90 ? '#0d9488' : score >= 70 ? '#f97316' : '#f43f5e'} />
              </linearGradient>
            </defs>

            {/* Score text */}
            <text
              x="60" y="55"
              textAnchor="middle"
              dominantBaseline="middle"
              className={`font-bold ${getScoreColor()}`}
              style={{ fontSize: '22px', fontFamily: 'inherit', fill: 'currentColor' }}
            >
              {toArabicDigits(score)}%
            </text>
            <text
              x="60" y="72"
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fontSize: '10px', fill: '#94a3b8', fontFamily: 'inherit' }}
            >
              النتيجة
            </text>
          </svg>

          {/* Trophy for perfect score */}
          {isPerfect && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 1.2, type: 'spring', bounce: 0.5 }}
              className="absolute -top-4 -right-4 text-gold-500"
            >
              <Trophy size={32} fill="currentColor" className="drop-shadow-lg" />
            </motion.div>
          )}
        </div>

        {/* Feedback text */}
        <div className="text-center">
          <p className="text-base font-bold text-navy-900 dark:text-white">{getFeedbackText()}</p>
          {passed ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1 mt-1">
              <CheckCircle size={13} />
              اجتزت الاختبار بنجاح
            </p>
          ) : (
            <p className="text-xs text-red-500 dark:text-red-400 flex items-center justify-center gap-1 mt-1">
              <AlertTriangle size={13} />
              لم تحقق الحد الأدنى (٧٠٪)
            </p>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          {
            label: 'صحيح',
            value: toArabicDigits(correctCount),
            color: 'text-emerald-600 dark:text-emerald-400',
            bg: 'bg-emerald-50 dark:bg-emerald-950/30',
          },
          {
            label: 'خطأ',
            value: toArabicDigits(totalCount - correctCount),
            color: 'text-red-500 dark:text-red-400',
            bg: 'bg-red-50 dark:bg-red-950/20',
          },
          ...(timeTakenMs != null
            ? [{
                label: 'الوقت',
                value: formatTime(timeTakenMs),
                color: 'text-navy-700 dark:text-navy-300',
                bg: 'bg-navy-50 dark:bg-navy-800/50',
              }]
            : [{
                label: 'إجمالي',
                value: toArabicDigits(totalCount),
                color: 'text-navy-700 dark:text-navy-300',
                bg: 'bg-navy-50 dark:bg-navy-800/50',
              }]),
        ].map((stat, i) => (
          <div
            key={i}
            className={`flex flex-col items-center gap-0.5 py-3 rounded-xl ${stat.bg}`}
          >
            <span className={`text-xl font-bold ${stat.color}`}>{stat.value}</span>
            <span className="text-[10px] font-bold text-navy-400 dark:text-navy-500">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Phase 1: Mistakes panel */}
      {phase === 1 && mistakes.length > 0 && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-red-100/60 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/40">
            <AlertTriangle size={14} className="text-red-500 dark:text-red-400" />
            <p className="text-xs font-bold text-red-600 dark:text-red-400">
              الأسئلة التي أخطأت فيها ({toArabicDigits(mistakes.length)})
            </p>
          </div>
          <div className="p-3 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
            {mistakes.map((m, i) => (
              <div key={i} className="p-3 bg-white dark:bg-navy-900 rounded-xl border border-red-100 dark:border-red-900/30 space-y-1">
                <p className="text-[11px] text-navy-400 dark:text-navy-500">{m.questionText}</p>
                <p className="font-quran text-sm text-navy-900 dark:text-white text-right leading-relaxed">
                  {Array.isArray(m.correctAnswer) ? m.correctAnswer.join(' ') : m.correctAnswer}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase 2 & 3: Ayah-level mistake panel */}
      {(phase === 2 || phase === 3) && ayahMistakes.length > 0 && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-100/60 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-900/40">
            <Target size={14} className="text-amber-600 dark:text-amber-400" />
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
              آيات تحتاج مزيداً من التثبيت ({toArabicDigits(ayahMistakes.length)})
            </p>
          </div>
          <div className="p-3 space-y-2 max-h-48 overflow-y-auto custom-scrollbar" dir="rtl">
            {ayahMistakes.map((m, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 bg-white dark:bg-navy-900 rounded-xl border border-amber-100 dark:border-amber-900/30">
                <div className="shrink-0 w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    {toArabicDigits(m.errorCount)}×
                  </span>
                </div>
                <p className="font-quran text-sm text-navy-900 dark:text-white leading-relaxed text-right flex-1 line-clamp-1">
                  {m.preview}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase 2 & 3: Perfect score */}
      {(phase === 2 || phase === 3) && ayahMistakes.length === 0 && score > 0 && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-center">
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
            ✨ ممتاز! أكملت كل الآيات بدون أخطاء في الأولى
          </p>
        </div>
      )}


      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-navy-100 dark:bg-navy-800 text-navy-700 dark:text-navy-200 font-bold text-sm hover:bg-navy-200 dark:hover:bg-navy-700 transition-colors"
        >
          <RotateCcw size={16} />
          إعادة المحاولة
        </button>
        <button
          onClick={onClose}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-br from-gold-400 to-amber-500 text-white font-bold text-sm shadow-lg shadow-gold-500/20 hover:shadow-xl transition-all"
        >
          إنهاء
        </button>
      </div>
    </div>
  );
};
