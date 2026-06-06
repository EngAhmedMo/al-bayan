import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Shuffle, BookOpen, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { fetchPageOffline } from '../services/quranOfflineCache';
import {
  getAyahsForDailyWird,
  generatePhase1Quiz,
  generatePhase2QuizChunked,
  generatePhase3Quiz,
  evaluateQuiz,
  groupAyahsBySurah,
  QuizQuestion,
  AyahReorderQuestion,
  WordReorderQuestion,
  QuizDifficulty,
  AyahSlotError,
  AyahWordError,
  HifzTestResult,
} from '../services/hifzManager';
import {
  getGlobalAyahNumber,
  SURAH_NAMES_ARABIC,
  SURAH_AYAH_COUNTS,
  getMetadataFromGlobalAyah,
} from '../services/quranStaticData';
import { toArabicDigits } from '../services/normalization';
import { Ayah } from '../types';
import { DailyQuizCard } from '../components/hifz/QuizComponents';
import { QuizPhaseSelector } from '../components/quiz/QuizPhaseSelector';
import { QuizRangePicker, QuizRange } from '../components/quiz/QuizRangePicker';
import { AyahReorderQuiz } from '../components/quiz/AyahReorderQuiz';
import { WordReorderQuiz } from '../components/quiz/WordReorderQuiz';
import { QuizResultScreen, AyahMistakeSummary } from '../components/quiz/QuizResultScreen';
import { cleanTajweedTags } from '../components/TajweedText';
import { saveQuizResult } from '../services/quizHistory';
import { useHifz } from '../contexts/HifzContext';
import { HifzService } from '../services/HifzService';
import { triggerHifzCompletion } from '../services/confetti';

// ── Types ──────────────────────────────────────────────────────────────────
type PageState =
  | 'home'        // landing / pick range
  | 'loading'     // fetching ayahs
  | 'phase_sel'   // choose phase 1 or 2
  | 'phase1'      // running phase 1 quiz
  | 'phase2'      // running phase 2 quiz
  | 'phase3'      // running phase 3 quiz
  | 'surah_transition' // transition between Surahs
  | 'result';     // show results

// ── Component ──────────────────────────────────────────────────────────────
export const QuranQuiz: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const hifzContext = useHifz();
  const startDailyQuiz = searchParams.get('startDailyQuiz') === 'true';
  const [isDailyWirdMode, setIsDailyWirdMode] = useState(false);

  const [pageState, setPageState] = useState<PageState>('home');
  const [loadError, setLoadError] = useState<string | null>(null);

  // Loaded ayahs
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [currentRange, setCurrentRange] = useState<QuizRange | null>(null);

  // Difficulty
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('medium');

  // Surah grouping states for daily quiz flow
  const [surahGroups, setSurahGroups] = useState<Ayah[][]>([]);
  const [currentSurahIndex, setCurrentSurahIndex] = useState(0);

  // Accumulated results across surahs
  const [accumulatedP1Questions, setAccumulatedP1Questions] = useState<QuizQuestion[]>([]);
  const [accumulatedP1Answers, setAccumulatedP1Answers] = useState<Record<string, boolean>>({});

  // Load daily wird on mount if query param is set
  const hasLoadedWirdRef = useRef(false);
  useEffect(() => {
    if (startDailyQuiz && hifzContext.state && !hasLoadedWirdRef.current) {
      hasLoadedWirdRef.current = true;
      setIsDailyWirdMode(true);
      setLoadError(null);
      setPageState('loading');
      
      const loadDailyWird = async () => {
        try {
          const { state } = hifzContext;
          if (!state) return;
          const startLoc = state.startPoint + state.currentProgress;
          const loaded = await getAyahsForDailyWird(state.planType, startLoc, state.amountPerDay);
          
          if (loaded.length === 0) {
            setLoadError('لم يتم العثور على آيات لوردك اليومي. تحقق من تحميل بيانات المصحف.');
            setPageState('home');
            return;
          }
          
          setAyahs(loaded);
        } catch (err: any) {
          console.error("Failed to load daily wird ayahs", err);
          setLoadError(err.message || 'حدث خطأ أثناء تحميل الآيات. حاول مرة أخرى.');
          setPageState('home');
        }
      };
      
      loadDailyWird();
    }
  }, [startDailyQuiz, hifzContext.state]);

  // Auto-start Phase 1 when ayahs are loaded in daily wird mode
  useEffect(() => {
    if (pageState === 'loading' && isDailyWirdMode && ayahs.length > 0) {
      const groups = groupAyahsBySurah(ayahs);
      setSurahGroups(groups);
      setCurrentSurahIndex(0);
      setAccumulatedP1Questions([]);
      setAccumulatedP1Answers({});

      // Start Phase 1 for the first Surah group
      const firstSurahAyahs = groups[0];
      const questions = generatePhase1Quiz(firstSurahAyahs, difficulty);
      setQuizQuestions(questions);
      setQuizIndex(0);
      setQuizAnswers({});
      setAyahMistakes([]);
      startTimeRef.current = Date.now();
      setPageState('phase1');
    }
  }, [pageState, isDailyWirdMode, ayahs, difficulty]);

  // Phase 1
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, boolean>>({});

  // Phase 2: multi-chunk
  const [phase2Chunks, setPhase2Chunks] = useState<AyahReorderQuestion[]>([]);
  const [phase2ChunkIndex, setPhase2ChunkIndex] = useState(0);
  const [phase2AccErrors, setPhase2AccErrors] = useState<AyahSlotError[]>([]);
  const [phase2AccCorrect, setPhase2AccCorrect] = useState(0);
  const [phase2AccTotal, setPhase2AccTotal] = useState(0);

  // Phase 3
  const [phase3Quiz, setPhase3Quiz] = useState<WordReorderQuestion | null>(null);

  // ayah-level mistakes for result screen
  const [ayahMistakes, setAyahMistakes] = useState<AyahMistakeSummary[]>([]);

  // Results
  const [result, setResult] = useState<{
    score: number; correct: number; total: number; timeTakenMs: number;
    mistakes: { questionText: string; correctAnswer: string | string[] }[];
    phase: 1 | 2 | 3;
  } | null>(null);

  const startTimeRef = useRef(0);

  // ── Load ayahs for a given range ──
  const loadAyahs = useCallback(async (range: QuizRange): Promise<Ayah[]> => {
    const loaded: Ayah[] = [];

    if (range.mode === 'pages') {
      const fp = range.fromPage ?? 1;
      const tp = range.toPage ?? fp;
      for (let p = fp; p <= tp; p++) {
        try {
          const pa = await fetchPageOffline(p);
          loaded.push(...pa);
        } catch { /* skip page */ }
      }
    } else if (range.mode === 'ayahs' || range.mode === 'surah') {
      const fg = range.fromGlobal ?? 1;
      const tg = range.toGlobal ?? fg;
      // Calculate page range
      const { getApproxPageFromGlobalAyah } = await import('../services/quranStaticData');
      const startPage = getApproxPageFromGlobalAyah(fg);
      // Pad endPage by +1 to guarantee surah boundary overlap captures offline
      const endPage = Math.min(604, getApproxPageFromGlobalAyah(tg) + 1);
      for (let p = Math.max(1, startPage - 1); p <= endPage; p++) {
        try {
          const pa = await fetchPageOffline(p);
          const relevant = pa.filter(a => a.number >= fg && a.number <= tg);
          loaded.push(...relevant);
        } catch { /* skip */ }
      }
    }

    return loaded.sort((a, b) => a.number - b.number);
  }, []);

  // ── Handle range confirmed ──
  const handleRangeConfirmed = useCallback(async (range: QuizRange) => {
    setCurrentRange(range);
    setLoadError(null);
    setPageState('loading');

    try {
      const loaded = await loadAyahs(range);
      if (loaded.length === 0) {
        setLoadError('لم يتم العثور على آيات لهذا النطاق. تحقق من الاتصال بالإنترنت أو حاول تنزيل البيانات أولاً.');
        setPageState('home');
        return;
      }
      setAyahs(loaded);
      setPageState('phase_sel');
    } catch {
      setLoadError('حدث خطأ أثناء تحميل الآيات. حاول مرة أخرى.');
      setPageState('home');
    }
  }, [loadAyahs]);

  // ── Start Phase 1 ──
  const startPhase1 = useCallback(() => {
    const questions = generatePhase1Quiz(ayahs, difficulty);
    setQuizQuestions(questions);
    setQuizIndex(0);
    setQuizAnswers({});
    setAyahMistakes([]);
    startTimeRef.current = Date.now();
    setPageState('phase1');
  }, [ayahs, difficulty]);

  // ── Start Phase 2 (chunked) ──
  const startPhase2 = useCallback(() => {
    const chunks = generatePhase2QuizChunked(ayahs, difficulty);
    setPhase2Chunks(chunks);
    setPhase2ChunkIndex(0);
    setPhase2AccErrors([]);
    setPhase2AccCorrect(0);
    setPhase2AccTotal(0);
    setAyahMistakes([]);
    startTimeRef.current = Date.now();
    setPageState('phase2');
  }, [ayahs, difficulty]);

  const startPhase2ForCurrentSurah = useCallback((surahAyahs: Ayah[]) => {
    const chunks = generatePhase2QuizChunked(surahAyahs, difficulty);
    if (chunks.length > 0) {
      setPhase2Chunks(chunks);
      setPhase2ChunkIndex(0);
      setPhase2AccErrors([]);
      setPhase2AccCorrect(0);
      setPhase2AccTotal(0);
      setPageState('phase2');
    } else {
      startPhase3ForCurrentSurah(surahAyahs);
    }
  }, [difficulty]);

  // ── Start Phase 3 ──
  const startPhase3 = useCallback(() => {
    const q = generatePhase3Quiz(ayahs, difficulty);
    setPhase3Quiz(q);
    setAyahMistakes([]);
    startTimeRef.current = Date.now();
    setPageState('phase3');
  }, [ayahs, difficulty]);

  const startPhase3ForCurrentSurah = useCallback((surahAyahs: Ayah[]) => {
    const q = generatePhase3Quiz(surahAyahs, difficulty);
    if (q.ayahs.length > 0) {
      setPhase3Quiz(q);
      setPageState('phase3');
    } else {
      completeCurrentSurahGroup();
    }
  }, [difficulty]);

  // ── Complete daily wird progress and save results ──
  const completeDailyWirdAndFinishOverall = useCallback((finalScore: number, finalP1Questions: QuizQuestion[], finalP1Answers: Record<string, boolean>) => {
    if (!hifzContext.state) return;
    
    // Save progress to database
    const newState = HifzService.completeDailyWird(hifzContext.state);
    
    // Process quiz result for SRS algorithm tracking (mistakes and intervals)
    const testResult: HifzTestResult = {
      date: HifzService.getTodayString(),
      score: finalScore,
      duration: (Date.now() - startTimeRef.current) / 1000,
      totalItems: finalP1Questions.length,
      correctItems: finalP1Questions.filter(q => finalP1Answers[q.id] === true).length,
      mistakes: finalP1Questions.filter(q => finalP1Answers[q.id] === false).length,
      type: 'daily'
    };
    
    const { newState: srsState } = HifzService.processQuizResult(
      newState,
      testResult,
      { questions: finalP1Questions, answers: finalP1Answers }
    );
    
    hifzContext.updateState(srsState);

    // Save quiz result
    saveQuizResult({
      rangeLabel: 'الورد اليومي',
      phase: 3,
      score: finalScore,
      correct: finalP1Questions.filter(q => finalP1Answers[q.id] === true).length,
      total: finalP1Questions.length,
      timeTakenMs: Date.now() - startTimeRef.current,
      difficulty,
    });

    // Trigger celebration
    triggerHifzCompletion();

    // Show custom results screen
    setResult({
      score: finalScore,
      correct: finalP1Questions.filter(q => finalP1Answers[q.id] === true).length,
      total: finalP1Questions.length,
      timeTakenMs: Date.now() - startTimeRef.current,
      mistakes: [],
      phase: 3
    });
    setPageState('result');
  }, [hifzContext, difficulty]);

  // Legacy fallback (should not be triggered for new multi-surah)
  const completeDailyWirdAndFinish = useCallback((finalScore: number) => {
    completeDailyWirdAndFinishOverall(finalScore, quizQuestions, quizAnswers);
  }, [completeDailyWirdAndFinishOverall, quizQuestions, quizAnswers]);

  // ── Complete current Surah group in daily quiz ──
  const completeCurrentSurahGroup = useCallback(() => {
    if (currentSurahIndex < surahGroups.length - 1) {
      setPageState('surah_transition');
    } else {
      const finalP1Questions = [...accumulatedP1Questions, ...quizQuestions];
      const finalP1Answers = { ...accumulatedP1Answers, ...quizAnswers };
      const correctCount = finalP1Questions.filter(q => finalP1Answers[q.id] === true).length;
      const totalCount = finalP1Questions.length;
      const finalScore = totalCount === 0 ? 100 : Math.round((correctCount / totalCount) * 100);
      completeDailyWirdAndFinishOverall(finalScore, finalP1Questions, finalP1Answers);
    }
  }, [currentSurahIndex, surahGroups, quizQuestions, quizAnswers, accumulatedP1Questions, accumulatedP1Answers, completeDailyWirdAndFinishOverall]);

  // Auto-redirect back to dashboard after 4 seconds when daily wird quiz is successfully completed
  useEffect(() => {
    if (pageState === 'result' && isDailyWirdMode && result && result.score >= 80) {
      const timer = setTimeout(() => {
        navigate('/hifz');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [pageState, isDailyWirdMode, result, navigate]);

  // ── Handle Exit Quiz ──
  const handleExitQuiz = useCallback(() => {
    if (isDailyWirdMode) {
      if (window.confirm("هل أنت متأكد من إلغاء الاختبار؟ لن يتم تسجيل حفظ اليوم.")) {
        navigate('/hifz');
      }
    } else {
      resetToHome();
    }
  }, [isDailyWirdMode, navigate]);

  // ── Handle Skip Daily Quiz ──
  const handleSkipDailyQuiz = useCallback(() => {
    if (isDailyWirdMode && hifzContext?.state) {
      const newState = HifzService.completeDailyWird(hifzContext.state);
      hifzContext.updateState(newState);
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
      triggerHifzCompletion();
      navigate('/hifz');
    }
  }, [isDailyWirdMode, hifzContext, navigate]);

  // ── Finish Phase 1 (called after last answer) ──
  const finishPhase1 = useCallback((finalAnswers: Record<string, boolean>) => {
    const evalResult = evaluateQuiz(quizQuestions, finalAnswers);
    const mistakes = quizQuestions
      .filter(q => finalAnswers[q.id] === false)
      .map(q => ({ questionText: q.questionText, correctAnswer: q.correctAnswer }));
    const correct = quizQuestions.filter(q => finalAnswers[q.id] === true).length;
    const timeTakenMs = Date.now() - startTimeRef.current;

    if (isDailyWirdMode) {
      if (evalResult.score >= 80) {
        setQuizAnswers(finalAnswers); // Save final answers for this Surah
        startPhase2ForCurrentSurah(surahGroups[currentSurahIndex]);
      } else {
        setResult({ score: evalResult.score, correct, total: quizQuestions.length, timeTakenMs, mistakes, phase: 1 });
        setAyahMistakes([]);
        saveQuizResult({
          rangeLabel: 'الورد اليومي - المرحلة الأولى',
          phase: 1,
          score: evalResult.score,
          correct,
          total: quizQuestions.length,
          timeTakenMs,
          difficulty,
        });
        setPageState('result');
      }
    } else {
      setResult({ score: evalResult.score, correct, total: quizQuestions.length, timeTakenMs, mistakes, phase: 1 });
      setAyahMistakes([]);
      saveQuizResult({
        rangeLabel: currentRange?.label ?? '',
        phase: 1,
        score: evalResult.score,
        correct,
        total: quizQuestions.length,
        timeTakenMs,
        difficulty,
      });
      setPageState('result');
    }
  }, [quizQuestions, currentRange, difficulty, isDailyWirdMode, startPhase2ForCurrentSurah, surahGroups, currentSurahIndex]);

  // ── Finish Phase 2 chunk ──
  const finishPhase2Chunk = useCallback((correct: number, total: number, _time: number, slotErrors: AyahSlotError[]) => {
    const newCorrect = phase2AccCorrect + correct;
    const newTotal = phase2AccTotal + total;
    const newErrors = [...phase2AccErrors, ...slotErrors];

    if (phase2ChunkIndex < phase2Chunks.length - 1) {
      // More chunks
      setPhase2AccCorrect(newCorrect);
      setPhase2AccTotal(newTotal);
      setPhase2AccErrors(newErrors);
      setPhase2ChunkIndex(prev => prev + 1);
    } else {
      // All chunks done
      const score = newTotal === 0 ? 0 : Math.round((newCorrect / newTotal) * 100);
      const timeTakenMs = Date.now() - startTimeRef.current;
      const newAyahMistakes = newErrors
        .filter(e => e.mistakes > 0)
        .map(e => ({ preview: e.preview, errorCount: e.mistakes }));

      if (isDailyWirdMode) {
        if (score >= 80) {
          startPhase3ForCurrentSurah(surahGroups[currentSurahIndex]);
        } else {
          setResult({ score, correct: newCorrect, total: newTotal, timeTakenMs, mistakes: [], phase: 2 });
          setAyahMistakes(newAyahMistakes);
          saveQuizResult({
            rangeLabel: 'الورد اليومي - المرحلة الثانية',
            phase: 2,
            score,
            correct: newCorrect,
            total: newTotal,
            timeTakenMs,
            difficulty
          });
          setPageState('result');
        }
      } else {
        setResult({ score, correct: newCorrect, total: newTotal, timeTakenMs, mistakes: [], phase: 2 });
        setAyahMistakes(newAyahMistakes);
        saveQuizResult({
          rangeLabel: currentRange?.label ?? '',
          phase: 2,
          score,
          correct: newCorrect,
          total: newTotal,
          timeTakenMs,
          difficulty
        });
        setPageState('result');
      }
    }
  }, [
    phase2AccCorrect, phase2AccTotal, phase2AccErrors, phase2ChunkIndex, phase2Chunks,
    currentRange, difficulty, isDailyWirdMode, startPhase3ForCurrentSurah, surahGroups, currentSurahIndex
  ]);

  // ── Finish Phase 3 ──
  const finishPhase3 = useCallback((correct: number, total: number, timeTakenMs: number, wordErrors: AyahWordError[]) => {
    const score = total === 0 ? 0 : Math.round((correct / total) * 100);
    const newAyahMistakes = wordErrors
      .filter(e => e.mistakes > 0)
      .map(e => ({ preview: e.preview, errorCount: e.mistakes }));

    if (isDailyWirdMode) {
      if (score >= 80) {
        completeCurrentSurahGroup();
      } else {
        setResult({ score, correct, total, timeTakenMs, mistakes: [], phase: 3 });
        setAyahMistakes(newAyahMistakes);
        saveQuizResult({
          rangeLabel: 'الورد اليومي - المرحلة الثالثة',
          phase: 3,
          score,
          correct,
          total,
          timeTakenMs,
          difficulty
        });
        setPageState('result');
      }
    } else {
      setResult({ score, correct, total, timeTakenMs, mistakes: [], phase: 3 });
      setAyahMistakes(newAyahMistakes);
      saveQuizResult({
        rangeLabel: currentRange?.label ?? '',
        phase: 3,
        score,
        correct,
        total,
        timeTakenMs,
        difficulty
      });
      setPageState('result');
    }
  }, [currentRange, difficulty, isDailyWirdMode, completeCurrentSurahGroup]);

  // ── Reset to home ──
  const resetToHome = () => {
    setPageState('home');
    setAyahs([]);
    setCurrentRange(null);
    setQuizQuestions([]);
    setQuizAnswers({});
    setQuizIndex(0);
    setPhase2Chunks([]);
    setPhase2ChunkIndex(0);
    setPhase2AccErrors([]);
    setPhase2AccCorrect(0);
    setPhase2AccTotal(0);
    setPhase3Quiz(null);
    setResult(null);
    setLoadError(null);
    setAyahMistakes([]);
    setSurahGroups([]);
    setCurrentSurahIndex(0);
    setAccumulatedP1Questions([]);
    setAccumulatedP1Answers({});
    hasLoadedWirdRef.current = false;
  };

  // ── Retry same range ──
  const handleRetry = () => {
    if (result?.phase === 1) startPhase1();
    else if (result?.phase === 2) startPhase2();
    else startPhase3();
  };

  // ── Ayah preview helper ──
  const getPreview = (ayah: Ayah): string => {
    const raw = ayah.aya_text || cleanTajweedTags(ayah.text) || '';
    const words = raw.trim().split(/\s+/);
    return words.length <= 7 ? raw.trim() : words.slice(0, 7).join(' ') + '...';
  };

  // ── Render ──
  return (
    <div className="flex flex-col h-full bg-gold-50 dark:bg-navy-950" dir="rtl">

      {/* TopBar */}
      <TopBar title="اختبارات القرآن الكريم" />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 pb-32 space-y-6">

          <AnimatePresence mode="wait">

            {/* ═══ HOME: Range Picker ═══ */}
            {pageState === 'home' && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                {/* Hero */}
                <div className="text-center py-6">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-gold-400 to-amber-500 flex items-center justify-center shadow-2xl shadow-gold-500/30">
                    <span className="text-4xl">📖</span>
                  </div>
                  <h1 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">اختبارات القرآن</h1>
                  <p className="text-sm text-navy-500 dark:text-navy-400 max-w-xs mx-auto leading-relaxed">
                    اختر نطاق آيات وابدأ الاختبار على ثلاث مراحل — أسئلة ذكية، ترتيب الآيات، وترتيب الكلمات
                  </p>
                </div>

                {/* Error */}
                {loadError && (
                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50">
                    <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
                  </div>
                )}

                {/* Range Picker */}
                <div className="bg-white dark:bg-navy-900 rounded-3xl shadow-sm border border-navy-100 dark:border-navy-800 p-5">
                  <QuizRangePicker
                    onConfirm={handleRangeConfirmed}
                    onCancel={() => {}}
                  />
                </div>

                {/* Info Cards */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      icon: Brain,
                      color: 'from-emerald-500 to-teal-600',
                      shadow: 'shadow-emerald-500/20',
                      title: 'المرحلة الأولى',
                      desc: 'أسئلة ذكية متنوعة لكل آية',
                    },
                    {
                      icon: Shuffle,
                      color: 'from-violet-500 to-purple-600',
                      shadow: 'shadow-violet-500/20',
                      title: 'المرحلة الثانية',
                      desc: 'رتّب الآيات بالترتيب الصحيح',
                    },
                    {
                      icon: BookOpen,
                      color: 'from-blue-500 to-indigo-600',
                      shadow: 'shadow-blue-500/20',
                      title: 'المرحلة الثالثة',
                      desc: 'رتّب كلمات كل آية بدقة',
                    },
                  ].map((card, i) => {
                    const Icon = card.icon;
                    return (
                      <div
                        key={i}
                        className="bg-white dark:bg-navy-900 rounded-2xl border border-navy-100 dark:border-navy-800 p-3 space-y-2 shadow-sm"
                      >
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg ${card.shadow}`}>
                          <Icon size={16} className="text-white" />
                        </div>
                        <h3 className="text-xs font-bold text-navy-900 dark:text-white leading-tight">{card.title}</h3>
                        <p className="text-[10px] text-navy-500 dark:text-navy-400 leading-relaxed">{card.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ═══ LOADING ═══ */}
            {pageState === 'loading' && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-24 gap-6"
              >
                <div className="relative">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-gold-400 to-amber-500 flex items-center justify-center shadow-2xl shadow-gold-500/30">
                    <span className="text-4xl">📖</span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white dark:bg-navy-950 flex items-center justify-center shadow">
                    <Loader2 size={16} className="text-gold-500 animate-spin" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="font-bold text-navy-900 dark:text-white">جاري تحميل الآيات...</p>
                  <p className="text-sm text-navy-400 mt-1">{currentRange?.label}</p>
                </div>
              </motion.div>
            )}

            {/* ═══ PHASE SELECTOR ═══ */}
            {pageState === 'phase_sel' && (
              <motion.div
                key="phase_sel"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25 }}
              >
                {/* Ayah preview */}
                {ayahs.length > 0 && (
                  <div className="mb-5 bg-white dark:bg-navy-900 rounded-2xl border border-navy-100 dark:border-navy-800 overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-navy-100 dark:border-navy-800 flex items-center justify-between">
                      <p className="text-xs font-bold text-navy-600 dark:text-navy-400">
                        معاينة الآيات المختارة
                      </p>
                      <span className="text-xs font-bold text-gold-600 dark:text-gold-400">
                        {toArabicDigits(ayahs.length)} آية
                      </span>
                    </div>
                    <div className="p-3 max-h-36 overflow-y-auto custom-scrollbar space-y-1.5">
                      {ayahs.slice(0, 20).map((a, i) => (
                        <div key={a.number} className="flex items-start gap-2 py-1 px-2 rounded-lg hover:bg-navy-50 dark:hover:bg-navy-800/50 transition-colors">
                          <span className="shrink-0 w-6 h-6 rounded-full bg-gold-100 dark:bg-gold-900/30 text-gold-700 dark:text-gold-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                            {toArabicDigits(a.numberInSurah)}
                          </span>
                          <p className="font-quran text-sm text-navy-900 dark:text-white leading-relaxed">
                            {getPreview(a)}
                          </p>
                        </div>
                      ))}
                      {ayahs.length > 20 && (
                        <p className="text-center text-xs text-navy-400 dark:text-navy-500 py-1">
                          و {toArabicDigits(ayahs.length - 20)} آية أخرى...
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-white dark:bg-navy-900 rounded-3xl border border-navy-100 dark:border-navy-800 p-5 shadow-sm">
                  <QuizPhaseSelector
                    rangeLabel={currentRange?.label ?? ''}
                    ayahCount={ayahs.length}
                    difficulty={difficulty}
                    onDifficultyChange={setDifficulty}
                    onPhase1={startPhase1}
                    onPhase2={startPhase2}
                    onPhase3={startPhase3}
                    onClose={handleExitQuiz}
                    onCompleteWithoutQuiz={isDailyWirdMode ? handleSkipDailyQuiz : undefined}
                  />
                </div>
              </motion.div>
            )}

            {/* ═══ PHASE 1 ═══ */}
            {pageState === 'phase1' && quizQuestions.length > 0 && (
              <motion.div
                key="phase1"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                {/* Header */}
                <div className="flex items-center justify-between bg-white dark:bg-navy-900 rounded-2xl border border-navy-100 dark:border-navy-800 px-4 py-3 shadow-sm">
                  <div>
                    <h2 className="text-sm font-bold text-navy-900 dark:text-white">المرحلة الأولى — أسئلة ذكية</h2>
                    <p className="text-xs text-navy-400 dark:text-navy-500 mt-0.5">
                      {toArabicDigits(quizIndex + 1)} / {toArabicDigits(quizQuestions.length)}
                      &nbsp;·&nbsp;{isDailyWirdMode ? 'الورد اليومي' : (currentRange?.label ?? '')}
                    </p>
                  </div>
                  <button
                    onClick={handleExitQuiz}
                    className="text-xs font-bold text-navy-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    إنهاء
                  </button>
                </div>

                {/* Progress */}
                <div className="w-full h-2 rounded-full bg-navy-100 dark:bg-navy-800 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
                    animate={{ width: `${((quizIndex + 1) / quizQuestions.length) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>

                {/* Question */}
                <div className="bg-white dark:bg-navy-900 rounded-3xl border border-navy-100 dark:border-navy-800 p-4 shadow-sm">
                  <DailyQuizCard
                    question={quizQuestions[quizIndex]}
                    onAnswer={(correct) => {
                      const newAnswers = { ...quizAnswers, [quizQuestions[quizIndex].id]: correct };
                      setQuizAnswers(newAnswers);
                      if (quizIndex < quizQuestions.length - 1) {
                        setTimeout(() => setQuizIndex(prev => prev + 1), 550);
                      } else {
                        setTimeout(() => finishPhase1(newAnswers), 550);
                      }
                    }}
                  />
                </div>
              </motion.div>
            )}

            {/* ═══ PHASE 2 (متعدد المجموعات) ═══ */}
            {pageState === 'phase2' && phase2Chunks.length > 0 && phase2ChunkIndex < phase2Chunks.length && (
              <motion.div
                key={`phase2-${phase2ChunkIndex}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25 }}
                className="bg-white dark:bg-navy-900 rounded-3xl border border-navy-100 dark:border-navy-800 p-4 shadow-sm"
              >
                <AyahReorderQuiz
                  quiz={phase2Chunks[phase2ChunkIndex]}
                  chunkIndex={phase2ChunkIndex}
                  totalChunks={phase2Chunks.length}
                  onFinish={finishPhase2Chunk}
                  onClose={handleExitQuiz}
                />
              </motion.div>
            )}

            {/* ═══ PHASE 3 ═══ */}
            {pageState === 'phase3' && phase3Quiz && (
              <motion.div
                key="phase3"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25 }}
                className="bg-white dark:bg-navy-900 rounded-3xl border border-navy-100 dark:border-navy-800 p-4 shadow-sm"
              >
                <WordReorderQuiz
                  quiz={phase3Quiz}
                  onFinish={finishPhase3}
                  onClose={handleExitQuiz}
                />
              </motion.div>
            )}

            {/* ═══ SURAH TRANSITION ═══ */}
            {pageState === 'surah_transition' && (
              <motion.div
                key="surah_transition"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-navy-900 rounded-3xl border border-navy-100 dark:border-navy-800 p-6 shadow-xl text-center space-y-6"
              >
                <div className="w-20 h-20 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-4xl shadow-inner animate-pulse">
                  🏆
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-navy-900 dark:text-white">
                    أتممت بنجاح: سورة {
                      SURAH_NAMES_ARABIC[
                        (surahGroups[currentSurahIndex]?.[0]?.surah?.number ?? 
                         getMetadataFromGlobalAyah(surahGroups[currentSurahIndex]?.[0]?.number).surahNumber) - 1
                      ]
                    }
                  </h2>
                  <p className="text-sm text-navy-500 dark:text-navy-400 leading-relaxed px-4">
                    الحمد لله، لقد اجتزت بنجاح جميع مراحل التثبيت لسورة {
                      SURAH_NAMES_ARABIC[
                        (surahGroups[currentSurahIndex]?.[0]?.surah?.number ?? 
                         getMetadataFromGlobalAyah(surahGroups[currentSurahIndex]?.[0]?.number).surahNumber) - 1
                      ]
                    }.
                  </p>
                </div>

                <div className="bg-gold-50/50 dark:bg-navy-800/50 rounded-2xl p-4 border border-gold-100/30 inline-block px-8">
                  <p className="text-xs font-bold text-gold-600 dark:text-gold-400 mb-1">المحطة التالية</p>
                  <p className="font-bold text-lg text-navy-900 dark:text-white">
                    سورة {
                      SURAH_NAMES_ARABIC[
                        (surahGroups[currentSurahIndex + 1]?.[0]?.surah?.number ?? 
                         getMetadataFromGlobalAyah(surahGroups[currentSurahIndex + 1]?.[0]?.number).surahNumber) - 1
                      ]
                    }
                  </p>
                </div>

                <button
                  onClick={() => {
                    // Update accumulated list with the current Surah's Phase 1 questions/answers
                    setAccumulatedP1Questions(prev => [...prev, ...quizQuestions]);
                    setAccumulatedP1Answers(prev => ({ ...prev, ...quizAnswers }));

                    // Advance to next Surah
                    const nextIdx = currentSurahIndex + 1;
                    setCurrentSurahIndex(nextIdx);

                    // Initialize Phase 1 for the next Surah
                    const nextSurahAyahs = surahGroups[nextIdx];
                    const questions = generatePhase1Quiz(nextSurahAyahs, difficulty);
                    setQuizQuestions(questions);
                    setQuizIndex(0);
                    setQuizAnswers({});
                    setAyahMistakes([]);
                    setPageState('phase1');
                  }}
                  className="w-full py-4 bg-gradient-to-br from-gold-400 to-amber-500 text-white font-bold rounded-2xl shadow-lg shadow-gold-500/20 hover:shadow-xl transition-all active:scale-95 text-base flex items-center justify-center gap-2"
                >
                  <span>ابدأ اختبار سورة {
                    SURAH_NAMES_ARABIC[
                      (surahGroups[currentSurahIndex + 1]?.[0]?.surah?.number ?? 
                       getMetadataFromGlobalAyah(surahGroups[currentSurahIndex + 1]?.[0]?.number).surahNumber) - 1
                    ]
                  }</span>
                  <ArrowRight size={18} className="rotate-180" />
                </button>
              </motion.div>
            )}

            {/* ═══ RESULT (مصحف حر / نطاق مخصص) ═══ */}
            {pageState === 'result' && result && !isDailyWirdMode && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <div className="bg-white dark:bg-navy-900 rounded-3xl border border-navy-100 dark:border-navy-800 p-5 shadow-sm">
                  <QuizResultScreen
                    score={result.score}
                    correctCount={result.correct}
                    totalCount={result.total}
                    timeTakenMs={result.timeTakenMs}
                    phase={result.phase}
                    mistakes={result.mistakes}
                    ayahMistakes={ayahMistakes}
                    onRetry={handleRetry}
                    onClose={handleExitQuiz}
                  />
                </div>

                {/* Try other phase */}
                <div className="bg-white dark:bg-navy-900 rounded-2xl border border-navy-100 dark:border-navy-800 p-4 shadow-sm">
                  <p className="text-xs font-bold text-navy-500 dark:text-navy-400 mb-3">جرّب مرحلة أخرى على نفس النطاق:</p>
                  <div className="flex gap-2">
                    <button
                      onClick={startPhase1}
                      className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-xl text-xs font-bold transition-colors
                        ${result.phase === 1
                          ? 'bg-navy-100 dark:bg-navy-800 text-navy-400 cursor-default'
                          : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50'}`}
                      disabled={result.phase === 1}
                    >
                      <Brain size={14} />
                      <span>الأولى</span>
                    </button>
                    <button
                      onClick={startPhase2}
                      className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-xl text-xs font-bold transition-colors
                        ${result.phase === 2
                          ? 'bg-navy-100 dark:bg-navy-800 text-navy-400 cursor-default'
                          : 'bg-violet-50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-950/40 border border-violet-200 dark:border-violet-900/50'}`}
                      disabled={result.phase === 2}
                    >
                      <Shuffle size={14} />
                      <span>الثانية</span>
                    </button>
                    <button
                      onClick={startPhase3}
                      className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-xl text-xs font-bold transition-colors
                        ${result.phase === 3
                          ? 'bg-navy-100 dark:bg-navy-800 text-navy-400 cursor-default'
                          : 'bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50'}`}
                      disabled={result.phase === 3}
                    >
                      <BookOpen size={14} />
                      <span>الثالثة</span>
                    </button>
                  </div>
                </div>

                {/* New range */}
                <button
                  onClick={handleExitQuiz}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-navy-200 dark:border-navy-700 text-sm font-bold text-navy-600 dark:text-navy-300 hover:bg-navy-100 dark:hover:bg-navy-800 transition-colors"
                >
                  <ArrowRight size={15} />
                  اختبار نطاق جديد
                </button>
              </motion.div>
            )}

            {/* ═══ RESULT SUCCESS (الورد اليومي - اجتياز) ═══ */}
            {pageState === 'result' && result && isDailyWirdMode && result.score >= 80 && (
              <motion.div
                key="daily-result-success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-navy-900 rounded-3xl border border-navy-100 dark:border-navy-800 p-6 shadow-xl text-center space-y-6"
              >
                <div className="w-24 h-24 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-5xl animate-bounce">
                  ✨
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">مبارك إتمام الورد اليومي!</h2>
                  <p className="text-sm text-navy-500 dark:text-navy-400 leading-relaxed">
                    لقد اجتزت جميع مراحل التثبيت بنجاح (الأسئلة الذكية، ترتيب الآيات، وترتيب الكلمات) بنسبة نجاح تفوق الـ ٨٠٪. تم تسجيل إنجازك لهذا اليوم بحمد الله.
                  </p>
                </div>
                <div className="bg-navy-50 dark:bg-navy-800/50 rounded-2xl p-4 grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-black text-navy-900 dark:text-white">{toArabicDigits(result.score)}%</p>
                    <p className="text-[10px] font-bold text-navy-400 dark:text-navy-500">متوسط الأداء</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-black text-navy-900 dark:text-white">
                      {toArabicDigits(Math.round(result.timeTakenMs / 1000 / 60))} د
                    </p>
                    <p className="text-[10px] font-bold text-navy-400 dark:text-navy-500">الوقت المستغرق</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/hifz')}
                  className="w-full py-4 bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/20 hover:shadow-xl transition-all active:scale-95 text-base"
                >
                  العودة للوحة الحفظ
                </button>
              </motion.div>
            )}

            {/* ═══ RESULT FAILURE (الورد اليومي - فشل) ═══ */}
            {pageState === 'result' && result && isDailyWirdMode && result.score < 80 && (
              <motion.div
                key="daily-result-fail"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-navy-900 rounded-3xl border border-navy-100 dark:border-navy-800 p-6 shadow-xl text-center space-y-6"
              >
                <div className="w-24 h-24 mx-auto rounded-full bg-red-50 dark:bg-red-950/20 flex items-center justify-center text-5xl">
                  ⚠️
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-red-500 dark:text-red-400">تحتاج لمزيد من المراجعة</h2>
                  <p className="text-sm text-navy-500 dark:text-navy-400 leading-relaxed">
                    لقد حصلت على نسبة نجاح {toArabicDigits(result.score)}% في هذه المرحلة، وهي أقل من الحد الأدنى المطلوب (٨٠٪) لتسجيل الحفظ اليومي. يرجى إعادة قراءة الورد من المصحف ثم المحاولة مجدداً.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      // Restart the daily quiz from Phase 1
                      setPageState('loading');
                      startPhase1();
                    }}
                    className="flex-1 py-3.5 bg-navy-100 dark:bg-navy-800 text-navy-700 dark:text-navy-200 font-bold rounded-xl text-sm hover:bg-navy-200 dark:hover:bg-navy-700 transition-colors"
                  >
                    إعادة المحاولة
                  </button>
                  <button
                    onClick={() => navigate('/hifz')}
                    className="flex-1 py-3.5 bg-gradient-to-br from-gold-400 to-amber-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-gold-500/20 hover:shadow-xl transition-all"
                  >
                    لوحة الحفظ
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
