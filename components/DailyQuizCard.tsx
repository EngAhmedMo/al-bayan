
import React, { useState } from 'react';
import { Eye, EyeOff, Check, X } from 'lucide-react';

interface QuizQuestion {
    id: string;
    type: string;
    questionText: string;
    ayah: { text: string };
    correctAnswer: string;
}

interface DailyQuizCardProps {
    question: QuizQuestion;
    onAnswer: (correct: boolean) => void;
}

export const DailyQuizCard: React.FC<DailyQuizCardProps> = ({ question, onAnswer }) => {
    const [showAnswer, setShowAnswer] = useState(false);

    return (
        <div className="w-full bg-navy-50 dark:bg-navy-700/50 rounded-2xl p-6 border border-navy-100 dark:border-navy-600">
            <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-4 text-center">
                {question.questionText}
            </h3>

            <div className={`p-4 rounded-xl text-center font-quran text-xl leading-relaxed transition-all mb-6 ${showAnswer ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-navy-100 dark:bg-navy-800 text-transparent blur-sm select-none'}`}>
                {question.ayah.text}
            </div>

            <div className="flex gap-3 justify-center mb-6">
                <button
                    onClick={() => setShowAnswer(!showAnswer)}
                    className="flex items-center gap-2 px-4 py-2 bg-navy-200 dark:bg-navy-600 text-navy-700 dark:text-navy-200 rounded-lg text-sm font-bold"
                >
                    {showAnswer ? <EyeOff size={16} /> : <Eye size={16} />}
                    {showAnswer ? 'إخفاء الإجابة' : 'إظهار الإجابة'}
                </button>
            </div>

            {showAnswer && (
                <div className="flex gap-4">
                    <button
                        onClick={() => onAnswer(false)}
                        className="flex-1 py-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-200 transition-colors"
                    >
                        <X size={20} />
                        أخطأت
                    </button>
                    <button
                        onClick={() => onAnswer(true)}
                        className="flex-1 py-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-200 transition-colors"
                    >
                        <Check size={20} />
                        أصبت
                    </button>
                </div>
            )}
        </div>
    );
};
