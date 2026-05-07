
import React, { useEffect, useState, useRef, useContext, useLayoutEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { Ayah, Surah, TafsirResponse } from '../types';
import { fetchPage, fetchTafsir, fetchSurahs, RECITERS, getAudioUrl } from '../services/api';
import { loadSingleAyahTafsir, TAFSIR_SOURCES } from '../services/tafsirService';
import { toArabicDigits } from '../services/normalization';
import { SURAH_START_PAGES, SURAH_AYAH_COUNTS, SURAH_NAMES_TASHKEEL, getGlobalAyahNumber, getApproxPageFromGlobalAyah, getAyahById } from '../services/quranStaticData';
import { TopBar } from '../components/TopBar';
import { useAudio, useSettings, NavigationContext, useTheme } from '../components/Layout';
import { ChevronLeft, ChevronRight, PlayCircle, BookOpen, X, Copy, Bookmark, BookmarkPlus, BookmarkCheck, Settings, Type, Mic, FileEdit, Save, Maximize2, Minimize2, Share2, Grid, Book, Hash, Repeat, Play, Infinity as InfinityIcon, LogOut, Plus, Minus, Sun, Moon, RotateCcw, ArrowDownUp } from 'lucide-react';
import {
  toggleAyahBookmark,
  isAyahBookmarked,
  addPageBookmark,
  removePageBookmark,
  isPageBookmarked,
  saveNote,
  getNoteForAyah,
  setLastUsedCategory,
  getResponsiveDefaultFontSize
} from '../services/storage';
import { AnalyticsService } from '../services/analytics'; // Analytics
import { TajweedText, cleanTajweedTags } from '../components/TajweedText';
import { useHifzOptional } from '../contexts/HifzContext';
import { DailyQuizCard } from '../components/hifz/QuizComponents';
import { generateDailyQuiz, generatePhase1Quiz, generatePhase2QuizChunked, generatePhase3Quiz, evaluateQuiz, QuizQuestion, AyahReorderQuestion, WordReorderQuestion, HifzTestResult, QuizDifficulty, AyahSlotError, AyahWordError } from '../services/hifzManager';
import { AlertTriangle, Trophy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QuizPhaseSelector } from '../components/quiz/QuizPhaseSelector';
import { AyahReorderQuiz } from '../components/quiz/AyahReorderQuiz';
import { WordReorderQuiz } from '../components/quiz/WordReorderQuiz';
import { QuizResultScreen, AyahMistakeSummary } from '../components/quiz/QuizResultScreen';
import { saveQuizResult } from '../services/quizHistory';

export const QuranReader: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { setIsFullscreen } = useContext(NavigationContext);
  const { isDark, toggleTheme } = useTheme();

  // -- Smart Logic: Session Context --
  // Consider it "Auxiliary" (Temporary) if there is a HIGHLIGHT or TEMPORARY param.
  // This prevents overwriting the user's saved reading position.
  const isAuxiliarySession = useRef<boolean>(!!searchParams.get('highlight') || !!searchParams.get('temporary'));

  // -- Entry Logic (Case A/B) --
  const [page, setPage] = useState<number>(() => {
    // 1. Direct Page Param (Highest Priority)
    const urlPage = searchParams.get('page');
    if (urlPage) return parseInt(urlPage);

    // 2. Surah/Ayah Param (Sidebar Navigation)
    const surahParam = searchParams.get('surah');
    if (surahParam) {
      const sNum = parseInt(surahParam);
      const aNum = parseInt(searchParams.get('ayah') || '1');
      if (sNum >= 1 && sNum <= 114) {
        // Calculate page locally
        if (aNum === 1) {
          return SURAH_START_PAGES[sNum - 1] || 1;
        } else {
          const globalId = getGlobalAyahNumber(sNum, aNum);
          return getApproxPageFromGlobalAyah(globalId);
        }
      }
    }

    // 3. Highlight Param (Search Results)
    const highlightParam = searchParams.get('highlight');
    if (highlightParam) {
      const [s, a] = highlightParam.split(':').map(Number);
      if (s && a) {
        const globalId = getGlobalAyahNumber(s, a);
        return getApproxPageFromGlobalAyah(globalId);
      }
    }

    // 4. Last Read (Resume)
    // If no specific page/surah in URL, try to load last read
    const saved = localStorage.getItem('lastRead');
    if (saved) {
      try { return JSON.parse(saved).page; } catch (e) { }
    }
    return 1;
  });

  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [loading, setLoading] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);
  const [allSurahs, setAllSurahs] = useState<Surah[]>([]);

  // Interactive State
  const [selectedAyah, setSelectedAyah] = useState<Ayah | null>(null);
  const [tafsirData, setTafsirData] = useState<TafsirResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tafsirLoading, setTafsirLoading] = useState(false);
  const [tafsirSource, setTafsirSource] = useState<'muyassar' | 'ibnKathir' | 'jalalayn'>('muyassar');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false); // Navigation Modal State
  const [navTab, setNavTab] = useState<'surahs' | 'parts' | 'pages'>('surahs');
  const pageInputRef = useRef<HTMLInputElement>(null);

  // Range Repeat State
  const [rangeFromAyah, setRangeFromAyah] = useState(1);
  const [rangeToAyah, setRangeToAyah] = useState(1);
  const [rangeStartText, setRangeStartText] = useState('');
  const [rangeEndText, setRangeEndText] = useState('');

  // Async fetch for live preview to support ayahs on other pages
  useEffect(() => {
    if (selectedAyah && isModalOpen) {
      const surahNum = (selectedAyah as any).surah?.number;
      if (!surahNum) return;

      const fetchTexts = async () => {
        try {
          const start = await getAyahById(`${surahNum}:${rangeFromAyah}`);
          const end = await getAyahById(`${surahNum}:${rangeToAyah}`);
          if (start) setRangeStartText((start as any).aya_text || start.text);
          if (end) setRangeEndText((end as any).aya_text || end.text);
        } catch (e) {
          console.error('Failed to fetch range ayahs text', e);
        }
      };
      fetchTexts();
    }
  }, [rangeFromAyah, rangeToAyah, selectedAyah, isModalOpen]);

  // Immersive Controls State
  const [showImmersiveControls, setShowImmersiveControls] = useState(true);

  // Footer Bar Auto-Hide State (Normal Mode)
  const [showFooterBar, setShowFooterBar] = useState(true);
  const footerTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Function to reset footer auto-hide timer
  const resetFooterTimer = () => {
    // Only apply in normal mode (not immersive)
    if (isImmersive) return;

    if (footerTimerRef.current) clearTimeout(footerTimerRef.current);
    setShowFooterBar(true);
    footerTimerRef.current = setTimeout(() => {
      setShowFooterBar(false);
    }, 3500); // Hide after 3.5 seconds of inactivity
  };

  // Orientation Detection for responsive padding
  const [isLandscape, setIsLandscape] = useState(() => window.innerWidth > window.innerHeight);

  // Sync Global State for Sidebar Hiding
  useEffect(() => {
    setIsFullscreen(isImmersive);

    if (isImmersive) {
      // In immersive mode, default to showing controls initially
      setShowImmersiveControls(true);

      // Push state when entering immersive
      window.history.pushState({ immersive: true }, '');

      const handlePopState = () => {
        setIsImmersive(false);
      };

      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
        setIsFullscreen(false); // Ensure cleanup on unmount
      };
    }
  }, [isImmersive]);

  // Global Settings
  const { fontSize, setFontSize, reciterId, setReciterId, textAlign, setTextAlign } = useSettings();

  // Bookmark & Notes
  const [isAyahSaved, setIsAyahSaved] = useState(false);
  const [isPageSaved, setIsPageSaved] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);

  const { playTrack, currentTrack, isPlaying } = useAudio();
  const hifzContext = useHifzOptional(); // للربط مع منظومة الحفظ
  const pageTopRef = useRef<HTMLDivElement>(null);
  const mushafContainerRef = useRef<HTMLDivElement>(null); // Inner scroll container
  const isAudioNavigatingRef = useRef(false); // Prevent useLayoutEffect interference during audio navigation

  // -- Smart Recitation State --
  type QuizPhase = null | 'selector' | 'phase1' | 'phase2' | 'phase3' | 'result';
  const [quizPhase, setQuizPhase] = useState<QuizPhase>(null);
  const [quizDifficulty, setQuizDifficulty] = useState<QuizDifficulty>('medium');
  const [smartQuizQuestions, setSmartQuizQuestions] = useState<QuizQuestion[]>([]);
  const [smartQuizIndex, setSmartQuizIndex] = useState(0);
  const [smartQuizAnswers, setSmartQuizAnswers] = useState<Record<string, boolean>>({});
  // Phase 2 chunked
  const [phase2Chunks, setPhase2Chunks] = useState<AyahReorderQuestion[]>([]);
  const [phase2ChunkIndex, setPhase2ChunkIndex] = useState(0);
  const [phase2AccErrors, setPhase2AccErrors] = useState<AyahSlotError[]>([]);
  const [phase2AccCorrect, setPhase2AccCorrect] = useState(0);
  const [phase2AccTotal, setPhase2AccTotal] = useState(0);
  const [phase3Quiz, setPhase3Quiz] = useState<WordReorderQuestion | null>(null);
  const [quizAyahMistakes, setQuizAyahMistakes] = useState<AyahMistakeSummary[]>([]);
  const [quizResult, setQuizResult] = useState<{ score: number; correct: number; total: number; timeTakenMs: number; mistakes: { questionText: string; correctAnswer: string | string[] }[] } | null>(null);
  const [quizPhaseNum, setQuizPhaseNum] = useState<1 | 2 | 3>(1);
  const [smartQuizLoading, setSmartQuizLoading] = useState(false);
  const [smartQuizStartTime, setSmartQuizStartTime] = useState(0);

  const isSmartRecitationOpen = quizPhase !== null;

  const closeQuiz = () => {
    setQuizPhase(null);
    setSmartQuizQuestions([]);
    setSmartQuizAnswers({});
    setSmartQuizIndex(0);
    setPhase2Chunks([]);
    setPhase2ChunkIndex(0);
    setPhase2AccErrors([]);
    setPhase2AccCorrect(0);
    setPhase2AccTotal(0);
    setPhase3Quiz(null);
    setQuizResult(null);
    setQuizAyahMistakes([]);
  };

  const openQuizSelector = () => setQuizPhase('selector');

  const startPhase1Reader = async () => {
    if (ayahs.length === 0) return;
    setSmartQuizLoading(true);
    try {
      const questions = generatePhase1Quiz(ayahs, quizDifficulty);
      setSmartQuizQuestions(questions);
      setSmartQuizIndex(0);
      setSmartQuizAnswers({});
      setQuizPhaseNum(1);
      setQuizResult(null);
      setQuizAyahMistakes([]);
      setSmartQuizStartTime(Date.now());
      setQuizPhase('phase1');
    } catch (e) {
      console.error('Phase1 quiz gen failed', e);
    } finally {
      setSmartQuizLoading(false);
    }
  };

  const startPhase2Reader = () => {
    if (ayahs.length === 0) return;
    const chunks = generatePhase2QuizChunked(ayahs, quizDifficulty);
    setPhase2Chunks(chunks);
    setPhase2ChunkIndex(0);
    setPhase2AccErrors([]);
    setPhase2AccCorrect(0);
    setPhase2AccTotal(0);
    setQuizPhaseNum(2);
    setQuizResult(null);
    setQuizAyahMistakes([]);
    setSmartQuizStartTime(Date.now());
    setQuizPhase('phase2');
  };

  const startPhase3Reader = () => {
    if (ayahs.length === 0) return;
    const q = generatePhase3Quiz(ayahs);
    setPhase3Quiz(q);
    setQuizPhaseNum(3);
    setQuizResult(null);
    setQuizAyahMistakes([]);
    setSmartQuizStartTime(Date.now());
    setQuizPhase('phase3');
  };

  const finishPhase1 = () => {
    const evalResult = evaluateQuiz(smartQuizQuestions, smartQuizAnswers);
    const mistakes = smartQuizQuestions
      .filter(q => smartQuizAnswers[q.id] === false)
      .map(q => ({ questionText: q.questionText, correctAnswer: q.correctAnswer }));
    const correct = smartQuizQuestions.filter(q => smartQuizAnswers[q.id] === true).length;
    const timeTakenMs = Date.now() - smartQuizStartTime;
    setQuizResult({
      score: evalResult.score,
      correct,
      total: smartQuizQuestions.length,
      timeTakenMs,
      mistakes,
    });
    saveQuizResult({
      rangeLabel: `صفحة ${page}`,
      phase: 1,
      score: evalResult.score,
      correct,
      total: smartQuizQuestions.length,
      timeTakenMs,
      difficulty: quizDifficulty,
    });
    setQuizPhase('result');
  };

  const finishPhase2Chunk = (correct: number, total: number, _time: number, slotErrors: AyahSlotError[]) => {
    const newCorrect = phase2AccCorrect + correct;
    const newTotal = phase2AccTotal + total;
    const newErrors = [...phase2AccErrors, ...slotErrors];
    if (phase2ChunkIndex < phase2Chunks.length - 1) {
      setPhase2AccCorrect(newCorrect);
      setPhase2AccTotal(newTotal);
      setPhase2AccErrors(newErrors);
      setPhase2ChunkIndex(prev => prev + 1);
    } else {
      const score = newTotal === 0 ? 0 : Math.round((newCorrect / newTotal) * 100);
      const timeTakenMs = Date.now() - smartQuizStartTime;
      const newAyahMistakes = newErrors.filter(e => e.mistakes > 0).map(e => ({ preview: e.preview, errorCount: e.mistakes }));
      setQuizResult({ score, correct: newCorrect, total: newTotal, timeTakenMs, mistakes: [] });
      setQuizAyahMistakes(newAyahMistakes);
      saveQuizResult({ rangeLabel: `صفحة ${page}`, phase: 2, score, correct: newCorrect, total: newTotal, timeTakenMs, difficulty: quizDifficulty });
      setQuizPhase('result');
    }
  };

  const finishPhase3Reader = (correct: number, total: number, timeTakenMs: number, wordErrors: AyahWordError[]) => {
    const score = total === 0 ? 0 : Math.round((correct / total) * 100);
    const newAyahMistakes = wordErrors.filter(e => e.mistakes > 0).map(e => ({ preview: e.preview, errorCount: e.mistakes }));
    setQuizResult({ score, correct, total, timeTakenMs, mistakes: [] });
    setQuizAyahMistakes(newAyahMistakes);
    saveQuizResult({ rangeLabel: `صفحة ${page}`, phase: 3, score, correct, total, timeTakenMs, difficulty: quizDifficulty });
    setQuizPhase('result');
  };

  // Swipe Gesture State for Page Navigation
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isScrollingRef = useRef(false);

  // Swipe Gesture Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    isScrollingRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const touch = e.touches[0];
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);

    // If vertical movement is greater, user is scrolling - don't interfere
    if (deltaY > deltaX && deltaY > 10) {
      isScrollingRef.current = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || isScrollingRef.current) {
      touchStartRef.current = null;
      return;
    }

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
    const SWIPE_THRESHOLD = 60;

    // Only navigate if horizontal swipe is significant and vertical is minimal
    if (Math.abs(deltaX) > SWIPE_THRESHOLD && deltaY < 100) {
      if (deltaX > 0 && page < 604) {
        // Swipe Right -> Next Page (RTL: Right means forward/next in Arabic books)
        handleNext();
      } else if (deltaX < 0 && page > 1) {
        // Swipe Left -> Previous Page (RTL: Left means backward/prev in Arabic books)
        handlePrev();
      }
    }

    touchStartRef.current = null;
  };

  // Common button class for header consistency
  // Common button class for header consistency - Premium Gold Update
  const headerBtnClass = "w-10 h-10 flex items-center justify-center rounded-xl bg-white/80 dark:bg-navy-900/40 backdrop-blur-sm border border-navy-100 dark:border-[#C6AD73]/60 text-navy-600 dark:text-[#C6AD73] hover:border-gold-400 dark:hover:border-[#C6AD73] hover:text-gold-600 dark:hover:text-[#F0CF85] hover:bg-white dark:hover:bg-[#C6AD73]/10 shadow-sm hover:shadow-md transition-all duration-200 active:scale-95 relative overflow-hidden";

  // Orientation change listener
  useEffect(() => {
    const handleOrientationChange = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };

    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  // Fetch Surahs for Nav Modal
  useEffect(() => {
    fetchSurahs().then(setAllSurahs);
  }, []);

  // Footer Auto-Hide Timer - Init on mount, reset when leaving immersive
  useEffect(() => {
    // Start timer on mount (normal mode)
    if (!isImmersive) {
      resetFooterTimer();
    }

    // Cleanup timer on unmount
    return () => {
      if (footerTimerRef.current) clearTimeout(footerTimerRef.current);
    };
  }, [isImmersive]);



  // -- AUDIO SYNC LOGIC (FOLLOW-ALONG) --
  useEffect(() => {
    if (currentTrack && currentTrack.globalAyahNumber) {
      // 1. SMART SELECTION CLEARING
      setSelectedAyah(null);

      if (isPlaying) {
        // Calculate which page this ayah belongs to
        const pageOfTrack = getApproxPageFromGlobalAyah(currentTrack.globalAyahNumber);

        // If the audio has moved to a new page, auto-navigate
        if (pageOfTrack !== page) {
          setPage(pageOfTrack);
        }

        // Auto-scroll to the highlighted ayah if it's on the current page
        // Wait briefly for DOM render
        setTimeout(() => {
          const el = document.getElementById(`ayah-${currentTrack.globalAyahNumber}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    }
  }, [currentTrack?.globalAyahNumber, isPlaying]);

  // -- Smart Logic: Mode Switching & Return to Base --
  useEffect(() => {
    // If we simply navigated to /reader without params, we are in "Resume" mode
    if (location.pathname === '/reader' && location.search === '') {
      isAuxiliarySession.current = false;
      const saved = localStorage.getItem('lastRead');
      if (saved) {
        try {
          const savedPage = JSON.parse(saved).page;
          if (savedPage !== page) setPage(savedPage);
        } catch (e) { }
      }
    }
    // If there is a highlight param OR temporary param, it's an auxiliary session (don't save position)
    // This includes: search results, Friday Kahf notification, etc.
    else if (searchParams.get('highlight') || searchParams.get('temporary')) {
      isAuxiliarySession.current = true;
    }
    // If there is only a Surah param (Sidebar Nav), it is NOT auxiliary, we want to save.
    else if (searchParams.get('surah')) {
      isAuxiliarySession.current = false;
    }
  }, [location, searchParams, location.search]);

  // -- Smart Logic: Silent Reading Session --
  useEffect(() => {
    const startTime = Date.now();
    return () => {
      const sessionDurationSeconds = (Date.now() - startTime) / 1000;
      if (sessionDurationSeconds > 45) {
        setLastUsedCategory("الاستغفار و التوبة");

        // Log deep reading session to Analytics
        AnalyticsService.logEvent('deep_reading_session', {
          duration_seconds: sessionDurationSeconds,
          page_number: page
        });
      }
    };
  }, [page]); // Re-run when page changes to track per page

  // -- Deep Linking & Navigation Logic --
  useEffect(() => {
    const surahParam = searchParams.get('surah');
    const ayahParam = searchParams.get('ayah') || '1';
    const pageParam = searchParams.get('page');
    const highlightParam = searchParams.get('highlight');

    // Case: Navigating via Surah (Sidebar or List)
    if (surahParam && !pageParam) {
      const sNum = parseInt(surahParam);
      const aNum = parseInt(ayahParam);

      if (sNum >= 1 && sNum <= 114) {
        let targetPage = 1;

        if (aNum === 1) {
          targetPage = SURAH_START_PAGES[sNum - 1] || 1;
        } else {
          const globalId = getGlobalAyahNumber(sNum, aNum);
          targetPage = getApproxPageFromGlobalAyah(globalId);
        }

        // If no highlight is present, this is a direct navigation intended to read.
        if (!highlightParam) {
          isAuxiliarySession.current = false;
        }

        // Update URL to match resolved page
        setPage(targetPage);
        setSearchParams(prev => {
          const newP = new URLSearchParams(prev);
          newP.set('page', targetPage.toString());
          if (highlightParam) {
            newP.set('highlight', `${surahParam}:${ayahParam}`);
          } else {
            newP.delete('surah');
            newP.delete('ayah');
          }
          return newP;
        }, { replace: true });
      }
    }
    // Case: Navigating via Page Number directly
    else if (pageParam) {
      const p = parseInt(pageParam);
      if (p !== page) setPage(p);
    }
  }, [searchParams, setSearchParams]);

  // -- Audio-Page Sync: Listen for page changes from audio playback --
  useEffect(() => {
    const handleAudioPageChange = (e: CustomEvent<{ page: number; surah: number; ayah: number }>) => {
      const { page: newPage } = e.detail;
      if (newPage && newPage !== page) {
        // Set flag to prevent useLayoutEffect interference
        isAudioNavigatingRef.current = true;
        // Navigate to the new page for follow-along reading
        setPage(newPage);
        // Note: audioAyahChange will handle the actual scrolling
      }
    };

    window.addEventListener('audioPageChange', handleAudioPageChange as EventListener);
    return () => {
      window.removeEventListener('audioPageChange', handleAudioPageChange as EventListener);
    };
  }, [page]);

  // -- Audio-Ayah Sync: Highlight and scroll to currently playing ayah --
  const [playingAyahGlobal, setPlayingAyahGlobal] = useState<number | null>(null);

  // Helper: Check if an element is currently visible in the scroll container
  const isElementInView = (el: HTMLElement) => {
    const container = mushafContainerRef.current || pageTopRef.current;
    if (!container) return false;
    const rect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    // Check if element is within the vertical bounds of the container
    return rect.top >= containerRect.top && rect.bottom <= containerRect.bottom;
  };

  useEffect(() => {
    const handleAudioAyahChange = (e: CustomEvent<{ globalAyah: number; surah: number; ayah: number }>) => {
      const { globalAyah } = e.detail;
      setPlayingAyahGlobal(globalAyah);

      // SELF-CORRECTING NAVIGATION:
      // If the playing ayah is NOT on the current page, we must navigate to find it.
      if (ayahs.length > 0) {
        const firstAyahGlobal = getGlobalAyahNumber((ayahs[0] as any).surah.number, ayahs[0].numberInSurah);
        const lastAyahGlobal = getGlobalAyahNumber((ayahs[ayahs.length - 1] as any).surah.number, ayahs[ayahs.length - 1].numberInSurah);

        // Logic: Only navigate if the ayah is strictly outside the current page boundaries.
        if (globalAyah > lastAyahGlobal || globalAyah < firstAyahGlobal) {
          // Calculate the exact target page for this global Ayah ID
          const targetPage = getApproxPageFromGlobalAyah(globalAyah);

          // Only update if we are strictly in "Follow Along" mode or the deviation is significant
          // For now, we assume if audio is playing, the user wants to see it.
          if (targetPage !== page) {
            console.log(`[AudioSync] Jump to Page ${targetPage} for Ayah ${globalAyah}`);
            isAudioNavigatingRef.current = true; // Prevent useLayoutEffect interference
            setPage(targetPage);

            // Page changed: NO manual reset needed! scrollIntoView will handle it directly.
            // We just wait for the new page to render.
            setTimeout(() => {
              const el = document.getElementById(`ayah-${globalAyah}`);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }

              // Clear flag after scroll completes
              setTimeout(() => {
                isAudioNavigatingRef.current = false;
              }, 500);
            }, 500); // Unified delay to ensure data load + render
            return; // Exit early to avoid duplicate scroll
          }
        }
      }

      // Same page: Scroll only if NOT visible to prevent unnecessary jitter
      setTimeout(() => {
        const el = document.getElementById(`ayah-${globalAyah}`);
        if (el && !isElementInView(el)) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50); // Short delay for safe DOM access
    };

    window.addEventListener('audioAyahChange', handleAudioAyahChange as EventListener);
    return () => {
      window.removeEventListener('audioAyahChange', handleAudioAyahChange as EventListener);
    };
  }, [ayahs, page]); // Added 'page' dependency to ensure accurate comparison

  // -- Page Content Loading & Auto-Save --
  useEffect(() => {
    const loadPage = async () => {
      setLoading(true);
      const data = await fetchPage(page, reciterId);
      setAyahs(data);
      setLoading(false);
      setIsPageSaved(isPageBookmarked(page));

      if (data.length > 0) {
        const firstAyah = data[0];
        const sName = (firstAyah as any).surah?.name || "القرآن";

        // Log Page View to Analytics
        AnalyticsService.logEvent('view_quran_page', {
          page_number: page,
          surah_name: sName
        });

        // FIXED: Save 'lastRead' if not in auxiliary (search highlight) mode
        // Or if the user has started navigating (next/prev) which clears auxiliary flag
        if (!isAuxiliarySession.current) {
          localStorage.setItem('lastRead', JSON.stringify({ surah: sName, page: page }));
        }
      }

      const highlight = searchParams.get('highlight');
      if (highlight && data.length > 0) {
        setTimeout(() => {
          try {
            // Parse highlight (Surah:Ayah)
            const [s, a] = highlight.split(':').map(Number);
            if (s && a) {
              // Get Global ID for accurate DOM selection
              const globalId = getGlobalAyahNumber(s, a);
              const el = document.getElementById(`ayah-${globalId}`);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('highlight-flash'); // Add CSS class for flash effect
                // Remove flash class after animation (2s to match CSS duration)
                setTimeout(() => el.classList.remove('highlight-flash'), 2000);
              }
            }
          } catch (error) {
            console.error('Error highlighting ayah:', error);
          }
        }, 800); // Slightly increased delay to ensure render
      }
    };

    loadPage();

    const currentUrlPage = searchParams.get('page');
    if (page.toString() !== currentUrlPage) {
      setSearchParams(prev => {
        const newP = new URLSearchParams(prev);
        newP.set('page', page.toString());
        if (!isAuxiliarySession.current) {
          newP.delete('highlight');
          newP.delete('surah');
          newP.delete('ayah');
        }
        return newP;
      }, { replace: true });
    }
  }, [page, reciterId]);

  // -- Force Scroll to Top on Page Change (Reliability Fix) --
  // Uses useLayoutEffect to prevent visual jump and ensure scroll is reset BEFORE paint
  // CRITICAL: Resets BOTH outer (pageTopRef) and inner (mushafContainerRef) scroll containers
  // SKIP if audio is handling navigation to prevent timing conflicts
  useLayoutEffect(() => {
    // Skip if audio is handling the scroll (prevents jitter during recitation)
    if (isAudioNavigatingRef.current) return;

    const resetScroll = () => {
      // Double-check flag before each reset
      if (isAudioNavigatingRef.current) return;

      // Outer container
      if (pageTopRef.current) pageTopRef.current.scrollTop = 0;
      // Inner container (Mushaf Paper) — this is the actual visible scroll area!
      if (mushafContainerRef.current) mushafContainerRef.current.scrollTop = 0;
      // Window fallback for non-immersive mode
      if (!isImmersive) window.scrollTo({ top: 0, behavior: 'auto' });
    };

    // 1. Immediate reset
    resetScroll();

    // 2. Short delay to catch any quick re-renders (e.g. loading state toggles)
    const timer1 = setTimeout(resetScroll, 10);

    // 3. Medium delay for layout stabilization
    const timer2 = setTimeout(resetScroll, 50);

    // 4. Longer delay for potential image loading or heavy DOM updates
    const timer3 = setTimeout(resetScroll, 150);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [page, isImmersive]); // Trigger on page change or immersive mode toggle

  // -- Keyboard Navigation (Left/Right Arrows & Escape) --
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === 'Escape') {
        setIsImmersive(false);
        return;
      }
      
      if (e.key === 'ArrowLeft') {
        // Next page (RTL reading)
        if (page < 604) {
          isAuxiliarySession.current = false;
          isAudioNavigatingRef.current = false;
          setPage(p => p + 1);
        }
      } else if (e.key === 'ArrowRight') {
        // Previous page (RTL reading)
        if (page > 1) {
          isAuxiliarySession.current = false;
          isAudioNavigatingRef.current = false;
          setPage(p => p - 1);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [page]);

  // ... (Rest of the component logic remains identical, omitting for brevity) ...
  // -- Handlers --

  const handleNext = () => {
    // If user clicks Next, they are reading. Save state from now on.
    isAuxiliarySession.current = false;
    // Clear audio navigation flag (user is manually navigating)
    isAudioNavigatingRef.current = false;
    if (page < 604) setPage(p => p + 1);
    resetFooterTimer(); // Keep footer visible while navigating
  };
  const handlePrev = () => {
    // If user clicks Prev, they are reading. Save state from now on.
    isAuxiliarySession.current = false;
    // Clear audio navigation flag (user is manually navigating)
    isAudioNavigatingRef.current = false;
    if (page > 1) setPage(p => p - 1);
    resetFooterTimer(); // Keep footer visible while navigating
  };

  const onAyahClick = (ayah: Ayah) => {
    setSelectedAyah(ayah);
    const sNum = (ayah as any).surah?.number;
    if (sNum) {
      setIsAyahSaved(isAyahBookmarked(sNum, ayah.numberInSurah));
      const existingNote = getNoteForAyah(sNum, ayah.numberInSurah);
      setNoteText(existingNote || '');
    }
    setShowNoteInput(false);
    setIsModalOpen(true);
    setTafsirData(null);
    // Initialize range selectors with the clicked ayah
    const surahNum = (ayah as any).surah?.number;
    if (surahNum) {
      setRangeFromAyah(ayah.numberInSurah);
      setRangeToAyah(ayah.numberInSurah);
    }
  };

  const playFromHere = (autoAdvance: boolean, repeatCount: number = 0, continuousRepeat: number = 0, surahRepeat: number = 0, pageRepeat: number = 0) => {
    if (selectedAyah) {
      const globalId = selectedAyah.number;
      const audioUrl = getAudioUrl(reciterId, globalId);

      // Log Audio Play
      AnalyticsService.logEvent('play_ayah', {
        surah_number: (selectedAyah as any).surah?.number,
        ayah_number: selectedAyah.numberInSurah,
        reciter_id: reciterId
      });

      playTrack(
        audioUrl,
        (() => {
          const sNum = (selectedAyah as any).surah?.number;
          if (sNum && sNum >= 1 && sNum <= 114) return SURAH_NAMES_TASHKEEL[sNum - 1];
          return (selectedAyah as any).surah?.name || '';
        })(),
        `الآية ${toArabicDigits(selectedAyah.numberInSurah)}`,
        globalId,
        autoAdvance,
        repeatCount,
        reciterId,
        continuousRepeat,
        surahRepeat,
        pageRepeat
      );
      setIsModalOpen(false);
      setSelectedAyah(null);
    }
  };

  const playRangeRepeat = (repeatCount: number) => {
    if (!selectedAyah) return;
    const surahNum = (selectedAyah as any).surah?.number;
    if (!surahNum) return;
    const maxAyahs = SURAH_AYAH_COUNTS[surahNum - 1];
    const fromAyah = Math.max(1, Math.min(rangeFromAyah, maxAyahs));
    const toAyah = Math.max(fromAyah, Math.min(rangeToAyah, maxAyahs));
    const rangeStartGlobal = getGlobalAyahNumber(surahNum, fromAyah);
    const rangeEndGlobal = getGlobalAyahNumber(surahNum, toAyah);
    const audioUrl = getAudioUrl(reciterId, rangeStartGlobal);

    AnalyticsService.logEvent('play_range_repeat', {
      surah_number: surahNum,
      from_ayah: fromAyah,
      to_ayah: toAyah,
      repeat_count: repeatCount,
      reciter_id: reciterId
    });

    playTrack(
      audioUrl,
      surahNum >= 1 && surahNum <= 114 ? SURAH_NAMES_TASHKEEL[surahNum - 1] : ((selectedAyah as any).surah?.name || ''),
      `الآية ${toArabicDigits(fromAyah)} - ${toArabicDigits(toAyah)}`,
      rangeStartGlobal,
      true,  // autoAdvance within range
      0,     // no single-ayah repeat
      reciterId,
      0,     // no continuous repeat
      0,     // no surah repeat
      0,     // no page repeat
      rangeStartGlobal,
      rangeEndGlobal,
      repeatCount
    );
    setIsModalOpen(false);
    setSelectedAyah(null);
  };

  const playFullSurah = (surahNumber: number, surahName: string) => {
    const startGlobalId = getGlobalAyahNumber(surahNumber, 1);
    const url = getAudioUrl(reciterId, startGlobalId);

    AnalyticsService.logEvent('play_full_surah', {
      surah_number: surahNumber,
      reciter_id: reciterId
    });

    const tashkeelName = surahNumber >= 1 && surahNumber <= 114
      ? SURAH_NAMES_TASHKEEL[surahNumber - 1]
      : surahName;
    playTrack(url, tashkeelName, `الآية ${toArabicDigits(1)}`, startGlobalId, true, 0, reciterId);
    setSelectedAyah(null);
  };

  const isHighlighted = (ayah: Ayah) => {
    const sNum = (ayah as any).surah?.number;
    const globalId = getGlobalAyahNumber(sNum, ayah.numberInSurah);
    if (currentTrack?.globalAyahNumber === globalId) return true;
    const highlight = searchParams.get('highlight');
    if (!highlight) return false;
    return highlight === `${sNum}:${ayah.numberInSurah}`;
  };

  const getSurahNameForPage = () => {
    if (ayahs.length === 0) return 'المصحف';
    // Show the surah of the FIRST ayah on the page (more accurate for pages spanning multiple surahs)
    return (ayahs[0] as any).surah?.name || 'المصحف';
  };

  // Returns the tashkeel version of the surah name on current page
  const getSurahNameTashkeel = () => {
    if (ayahs.length === 0) return 'الْمُصْحَف';
    const surahNum = (ayahs[0] as any).surah?.number;
    if (surahNum && surahNum >= 1 && surahNum <= 114) {
      return SURAH_NAMES_TASHKEEL[surahNum - 1];
    }
    return (ayahs[0] as any).surah?.name || 'المصحف';
  };

  const navigateToSurah = (surahNum: number) => {
    // FIXED: Arrays are 0-indexed, but surahNum is 1-indexed
    const startPage = SURAH_START_PAGES[surahNum - 1];
    if (startPage) {
      setPage(startPage);
      // Ensure we treat this as a reading session
      isAuxiliarySession.current = false;
      setIsNavOpen(false);
      resetFooterTimer(); // Keep footer visible after navigation
    }
  };

  const navigateToPage = (pageNum: number) => {
    if (pageNum >= 1 && pageNum <= 604) {
      setPage(pageNum);
      // Ensure we treat this as a reading session
      isAuxiliarySession.current = false;
      setIsNavOpen(false);
      resetFooterTimer(); // Keep footer visible after navigation
    }
  };

  return (
    <div className={`absolute inset-0 flex flex-col bg-gold-50 dark:bg-navy-950 overflow-hidden transition-colors duration-500`}>

      {/* 1. Header (Collapsible) - Hidden in Immersive */}
      <div className={`transition-all duration-500 ease-in-out z-40 ${isImmersive ? '-mt-20 opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <TopBar
          title={
            <div className="flex items-center gap-2 min-w-0 overflow-hidden" dir="rtl">
              <span className="text-xs font-bold text-navy-500 dark:text-navy-400 shrink-0 tabular-nums bg-navy-100 dark:bg-navy-800 px-2 py-0.5 rounded-lg">
                {`ص ${toArabicDigits(page)}`}
              </span>
              <span className="w-px h-4 bg-navy-200 dark:bg-navy-700 shrink-0" />
              <span
                className="surah-name-topbar text-navy-900 dark:text-gold-300 truncate"
                dir="rtl"
              >
                {getSurahNameTashkeel()}
              </span>
            </div>
          }
          extra={
            <div className="flex items-center gap-1.5">
              {/* زر الاختبار — يعمل دائماً بدون شرط خطة الحفظ */}
              <button
                onClick={openQuizSelector}
                disabled={loading || smartQuizLoading || ayahs.length === 0}
                className={`${headerBtnClass} !text-emerald-500 !border-emerald-200 dark:!border-emerald-900 hover:!bg-emerald-50 dark:hover:!bg-emerald-900/20 ${smartQuizLoading ? 'opacity-50 cursor-wait' : ''}`}
                title="اختبار الصفحة (٣ مراحل)"
              >
                <BookOpen size={20} className={smartQuizLoading ? 'animate-pulse' : ''} />
              </button>
              <button onClick={() => setIsImmersive(!isImmersive)} className={headerBtnClass} title="ملء الشاشة">
                {isImmersive ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
              </button>
              <button onClick={() => setIsSettingsOpen(true)} className={headerBtnClass} title="الإعدادات">
                <Settings size={20} />
              </button>
              <button
                onClick={() => {
                  if (isPageSaved) removePageBookmark(page); else addPageBookmark(getSurahNameForPage(), page);
                  setIsPageSaved(!isPageSaved);
                }}
                className={`${headerBtnClass} ${isPageSaved ? '!text-red-500 !border-red-200 dark:!border-red-900 bg-red-50 dark:bg-red-900/10' : ''}`}
                title={isPageSaved ? "إزالة الفاصل" : "حفظ الصفحة"}
              >
                {isPageSaved ? <BookmarkCheck size={20} /> : <BookmarkPlus size={20} />}
              </button>
            </div>
          }
        />
      </div>

      {/* 2. Main Content (The Page) */}
      <div
        ref={pageTopRef}
        className={`
          flex-1 overflow-y-auto overflow-x-hidden flex justify-center items-start relative transition-all duration-500 quran-page-scroll scroll-smooth
          ${isLandscape ? 'quran-landscape-adjust' : ''}
          ${isImmersive
            ? 'fixed inset-0 z-50 fullscreen-container flex-col items-center bg-[#fffcf5] dark:bg-[#1a202c] w-full p-0'
            : isLandscape
              ? 'p-2 sm:p-4 pb-24'
              : 'p-2 sm:p-4 pb-36'}
        `}
        onClick={(e) => {
          // Clicking the "void" area exits immersive mode
          if (isImmersive && e.target === pageTopRef.current) setIsImmersive(false);
        }}
      >
        {/* Top Left Floating Controls (Font & Theme) - Only in Immersive Mode */}
        {isImmersive && (
          <div
            onClick={(e) => e.stopPropagation()}
            className={`fixed top-6 left-6 z-[60] flex flex-col gap-3 transition-all duration-500 ${showImmersiveControls ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10 pointer-events-none'}`}
          >
            {/* Font Controls */}
            <div className="flex flex-col bg-navy-800/90 dark:bg-black/70 backdrop-blur-md rounded-2xl p-1.5 border border-white/20 shadow-xl">
              <button
                onClick={() => setFontSize(Math.min(fontSize + 2, 44))}
                className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/20 rounded-xl transition-colors"
                title="تكبير الخط"
              >
                <Plus size={20} />
              </button>
              <div className="h-px bg-white/20 w-full my-1"></div>
              <button
                onClick={() => setFontSize(Math.max(fontSize - 2, 18))}
                className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/20 rounded-xl transition-colors"
                title="تصغير الخط"
              >
                <Minus size={20} />
              </button>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-14 h-14 rounded-full bg-navy-800/90 dark:bg-gold-500/90 backdrop-blur-md flex items-center justify-center text-gold-400 dark:text-navy-900 shadow-xl border border-white/20 hover:scale-110 transition-transform"
              title={isDark ? "الوضع النهاري" : "الوضع الليلي"}
            >
              {isDark ? <Sun size={24} fill="currentColor" /> : <Moon size={24} />}
            </button>
          </div>
        )}

        {/* Professional Floating Exit Button for Immersive Mode (Top Right) */}
        {isImmersive && (
          <button
            onClick={(e) => { e.stopPropagation(); setIsImmersive(false); }}
            className={`fixed top-6 right-6 z-[60] group flex items-center justify-center gap-0 hover:gap-3 bg-navy-900/90 text-white dark:bg-gold-500/90 dark:text-navy-900 shadow-[0_10px_30px_rgba(0,0,0,0.3)] backdrop-blur-md rounded-full w-14 h-14 hover:w-32 transition-all duration-500 ease-out overflow-hidden border border-white/10 hover:border-gold-500 ${showImmersiveControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10 pointer-events-none'}`}
            title="خروج من وضع القراءة"
          >
            <X size={24} className="shrink-0" />
            <span className="max-w-0 group-hover:max-w-xs opacity-0 group-hover:opacity-100 whitespace-nowrap font-bold text-sm transition-all duration-300">
              خروج
            </span>
          </button>
        )}

        {/* Immersive Navigation Arrows */}
        {isImmersive && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              disabled={page >= 604}
              className={`fixed left-4 top-1/2 -translate-y-1/2 z-[60] w-14 h-14 flex items-center justify-center rounded-full bg-navy-800/80 dark:bg-white/20 hover:bg-gold-500 dark:hover:bg-gold-500 text-white dark:text-white hover:text-white backdrop-blur-md shadow-xl border-2 border-white/30 dark:border-white/20 transition-all duration-500 active:scale-95 disabled:opacity-0 disabled:pointer-events-none ${showImmersiveControls ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10 pointer-events-none'}`}
              title="الصفحة التالية"
            >
              <ChevronLeft size={28} strokeWidth={2.5} />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); handlePrev(); }}
              disabled={page <= 1}
              className={`fixed right-4 top-1/2 -translate-y-1/2 z-[60] w-14 h-14 flex items-center justify-center rounded-full bg-navy-800/80 dark:bg-white/20 hover:bg-gold-500 dark:hover:bg-gold-500 text-white dark:text-white hover:text-white backdrop-blur-md shadow-xl border-2 border-white/30 dark:border-white/20 transition-all duration-500 active:scale-95 disabled:opacity-0 disabled:pointer-events-none ${showImmersiveControls ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10 pointer-events-none'}`}
              title="الصفحة السابقة"
            >
              <ChevronRight size={28} strokeWidth={2.5} />
            </button>
          </>
        )}

        {loading ? (
          <div className="w-full max-w-4xl mx-auto h-[80vh] flex flex-col items-center justify-center space-y-6 animate-pulse">
            <div className="w-3/4 h-8 bg-gold-200 dark:bg-navy-800 rounded-lg"></div>
            <div className="w-full h-full bg-white dark:bg-navy-900 rounded-2xl shadow-sm border border-gold-100 dark:border-navy-800 opacity-60"></div>
          </div>
        ) : (
          <div
            className={`
              transition-all duration-500 mx-auto relative w-full
              ${isImmersive
                ? 'w-full md:w-[95%] lg:w-[90%] max-w-[1400px] h-full flex-1 py-0 flex flex-col'
                : 'max-w-4xl h-full flex flex-col'} 
            `}
          >
            {/* Side Click Navigation Areas (Desktop) */}
            <div 
              className="hidden lg:flex absolute top-0 bottom-0 left-0 w-[12%] z-30 cursor-pointer group items-center justify-start"
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              title="الصفحة التالية"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-navy-900/5 to-transparent dark:from-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-l-2xl pointer-events-none"></div>
              <div className="w-12 h-24 flex items-center justify-center -translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 pointer-events-none">
                <ChevronLeft size={40} className="text-navy-400 dark:text-navy-300" strokeWidth={1.5} />
              </div>
            </div>

            <div 
              className="hidden lg:flex absolute top-0 bottom-0 right-0 w-[12%] z-30 cursor-pointer group items-center justify-end"
              onClick={(e) => { e.stopPropagation(); handlePrev(); }}
              title="الصفحة السابقة"
            >
              <div className="absolute inset-0 bg-gradient-to-l from-navy-900/5 to-transparent dark:from-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-r-2xl pointer-events-none"></div>
              <div className="w-12 h-24 flex items-center justify-center translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 pointer-events-none">
                <ChevronRight size={40} className="text-navy-400 dark:text-navy-300" strokeWidth={1.5} />
              </div>
            </div>

            {/* Mushaf Paper Container - Click to Toggle Controls, Touch for Swipe Navigation */}
            <div
              ref={mushafContainerRef}
              onClick={() => {
                if (isImmersive) {
                  setShowImmersiveControls(prev => !prev);
                } else {
                  // Toggle footer visibility in normal mode
                  setShowFooterBar(prev => {
                    if (!prev) {
                      // If showing, reset the timer
                      resetFooterTimer();
                    }
                    return !prev;
                  });
                }
              }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className={`
                relative bg-[#fffcf5] dark:bg-[#1a202c] shadow-2xl overflow-y-auto overflow-x-hidden transition-all duration-500 quran-page-scroll
                ${isImmersive
                  ? 'min-h-full h-full flex-1 md:rounded-2xl border-none md:border border-white/5 shadow-2xl cursor-pointer'
                  : 'rounded-2xl border border-gold-900/5 dark:border-navy-700'}
             `}>

              {/* Paper Texture Overlay - Fixed background that stays visible */}
              <div className="sticky top-0 left-0 right-0 h-0 z-0 pointer-events-none">
                <div className="absolute inset-0 h-[200vh] bg-gradient-to-r from-black/5 via-transparent to-black/5 dark:from-black/40 dark:via-transparent dark:to-black/40"></div>
              </div>

              {/* Content wrapper with min-height to ensure frame covers all content */}
              <div className="relative min-h-full">
                {/* Decorative Frame - Only shown in Normal Mode */}
                {!isImmersive && (
                  <>
                    {/* Outer Border - Sticky on sides */}
                    <div className="absolute inset-0 pointer-events-none p-2 sm:p-4 z-0">
                      <div className="w-full h-full border-2 border-gold-600/20 dark:border-gold-500/10 rounded-lg"></div>
                    </div>
                    {/* Inner Border */}
                    <div className="absolute inset-3 sm:inset-5 pointer-events-none border border-gold-600/10 dark:border-gold-500/5 rounded-md z-0"></div>
                    {/* Corner Decorations */}
                    <CornerDecoration className="top-2 right-2" />
                    <CornerDecoration className="top-2 left-2 -scale-x-100" />
                    <CornerDecoration className="bottom-2 right-2 -scale-y-100" />
                    <CornerDecoration className="bottom-2 left-2 -scale-x-100 -scale-y-100" />
                  </>
                )}

                {/* Page Content - Adaptive Padding for Orientation */}
                <div className={`
                     relative z-10 flex flex-col items-center w-full
                     ${isImmersive
                    ? isLandscape
                      ? 'px-24 py-6 pb-12 md:px-32' // Landscape immersive: more horizontal, less vertical
                      : 'px-12 py-10 pb-16 sm:px-16 md:px-20' // Portrait immersive
                    : isLandscape
                      ? 'px-6 sm:px-16 pt-6 pb-48' // Landscape normal: balanced
                      : 'px-4 sm:px-10 pt-10 pb-52 sm:pt-14'} // Portrait normal: changed
                  `}>

                  {/* Ribbon */}
                  {isPageSaved && !isImmersive && (
                    <div className="absolute -top-1 left-8 w-6 h-12 bg-red-700 shadow-md z-20 animate-in fade-in slide-in-from-top-4">
                      <div className="absolute bottom-0 left-0 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-700 transform rotate-180 translate-y-full"></div>
                    </div>
                  )}

                  {/* Surah Headers are now rendered INLINE with ayahs below */}

                  {/* TEXT BLOCK - Headers are integrated for correct positioning */}
                  <div
                    className="quran-text text-navy-950 dark:text-gray-200 w-full"
                    style={{
                      fontSize: `${fontSize}px`,
                      textAlign: textAlign,
                      fontFeatureSettings: '"cv01" on, "cv02" on' // Ligatures
                    }}
                  >
                    {ayahs.map((ayah, index) => {
                      const surah = (ayah as any).surah;
                      const isFirstAyahOfSurah = ayah.numberInSurah === 1;

                      let displayText = ayah.aya_text || ayah.text;

                      // Robust Bismillah logic
                      if (isFirstAyahOfSurah && surah && surah.number !== 1 && surah.number !== 9) {
                        const prefixes = [
                          "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", // Full Uthmani
                          "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", // Variant
                          "بسم الله الرحمن الرحيم" // Simple
                        ];
                        // Strip regex for wide catch
                        const regex = /^[\s\u0600-\u06FF]*بِسْمِ[\s\u0600-\u06FF]*ٱللَّهِ[\s\u0600-\u06FF]*ٱلرَّحْمَٰنِ[\s\u0600-\u06FF]*ٱلرَّحِيمِ[\s\u0600-\u06FF]*/;

                        for (const p of prefixes) {
                          if (displayText.startsWith(p)) {
                            displayText = displayText.replace(p, '').trim();
                            break;
                          }
                        }
                        // Fallback regex if still starts with Bismillah chars (approx check)
                        if (displayText.startsWith("بِسْمِ") || displayText.startsWith("بسم")) {
                          displayText = displayText.replace(regex, '').trim();
                        }
                      }

                      const isMarked = isAyahBookmarked((ayah as any).surah?.number, ayah.numberInSurah);
                      const highlighted = isHighlighted(ayah);
                      const globalId = getGlobalAyahNumber((ayah as any).surah?.number, ayah.numberInSurah);
                      const isSelected = selectedAyah?.number === ayah.number;
                      const isFatiha = surah?.number === 1;

                      return (
                        <React.Fragment key={ayah.number}>
                          {/* Surah Header */}
                          {/* Surah Header - Professional SVG Implementation */}
                          {isFirstAyahOfSurah && surah && (
                            <div className="w-full mt-2 mb-1 text-center block select-none">
                              <div className="relative flex items-center justify-center py-0 my-1">

                                {/* Ornamental Frame (Banner) */}
                                <img
                                  src={`${import.meta.env.BASE_URL}svgs/surah_banner1.svg`}
                                  alt="Surah Frame"
                                  className={`w-full max-w-[320px] md:max-w-[420px] lg:max-w-[480px] h-auto opacity-90 ${isDark ? 'brightness-110 drop-shadow-[0_0_8px_rgba(234,179,8,0.3)]' : 'drop-shadow-sm'}`}
                                />

                                {/* Surah Name Calligraphy (Centered in Frame) */}
                                <div className="absolute inset-0 flex items-center justify-center z-10">
                                  <img
                                    src={`${import.meta.env.BASE_URL}svgs/surah_name/00${surah.number}.svg`}
                                    alt={surah.name}
                                    className={`h-[90%] w-auto max-w-[95%] object-contain ${isDark ? 'svg-gold-filter' : 'svg-navy-filter'}`}
                                  />
                                </div>

                                {/* Play Button (Positioned safely outside or subtly integrated) */}
                                <button
                                  onClick={(e) => { e.stopPropagation(); playFullSurah(surah.number, surah.name); }}
                                  className="absolute left-[15%] md:left-[32%] z-20 px-3 py-1.5 bg-gradient-to-br from-gold-400 to-gold-600 text-white hover:to-gold-500 rounded-full transition-all shadow-md hover:shadow-lg hover:shadow-gold-500/30 hover:scale-105 border border-white/20 flex items-center justify-center gap-2 group"
                                  title="تشغيل السورة كاملة"
                                >
                                  <span className="text-[10px] font-bold hidden sm:inline opacity-0 group-hover:opacity-100 transition-opacity w-0 group-hover:w-auto overflow-hidden text-nowrap">استماع</span>
                                  <Play size={14} fill="currentColor" />
                                </button>
                              </div>

                              {/* Basmalah Calligraphy */}
                              {surah.number !== 1 && surah.number !== 9 && (
                                <div className="flex justify-center mb-3 mt-0.5 opacity-90">
                                  <img
                                    src={`${import.meta.env.BASE_URL}svgs/besmAllah.svg`}
                                    alt="بسم الله الرحمن الرحيم"
                                    className={`h-8 md:h-10 w-auto ${isDark ? 'svg-gold-filter' : 'svg-navy-filter'}`}
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {/* Ayah Text & Marker */}
                          <span
                            id={`ayah-${globalId}`}
                            onClick={(e) => { e.stopPropagation(); onAyahClick(ayah); }}
                            className={`
                            relative rounded cursor-pointer decoration-clone transition-colors duration-300
                            hover:bg-gold-50 dark:hover:bg-navy-800
                            ${isSelected ? 'bg-gold-100 dark:bg-gold-900/20' : ''}
                            ${highlighted ? 'bg-emerald-200/50 dark:bg-emerald-900/30 animate-pulse' : ''}
                            ${isMarked ? 'underline decoration-red-400 decoration-2 underline-offset-8' : ''}
                            ${isFatiha ? 'text-center' : ''} 
                           `}
                          >
                            {/* Force inline-block for Fatiha ayahs if single line? No, span is inline. Text alignment comes from parent div. */}
                            {ayah.aya_text ? displayText : <TajweedText text={displayText} />}
                          </span>

                          {/* Professional Ayah Marker (Rosette) */}
                          <span className="inline-flex items-center justify-center align-middle select-none text-gold-600 dark:text-gold-500 font-bold h-[1.5em] w-[1.5em] relative mx-0.5 ayah-number"
                            style={{ fontSize: `${fontSize * 0.52}px` }}>
                            {/* Simple ornate circle */}
                            <svg viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-full h-full drop-shadow-sm">
                              <circle cx="18" cy="18" r="17" />
                              <circle cx="18" cy="18" r="13" opacity="0.5" />
                              {/* Decorative dots/petals (Optional simple bloom) */}
                              <path d="M18 5 L18 8 M18 28 L18 31 M5 18 L8 18 M28 18 L31 18" strokeWidth="1.5" opacity="0.4" />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center pt-1 text-[1.4em]">
                              {toArabicDigits(ayah.numberInSurah)}
                            </span>
                          </span>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. Footer Navigation (Collapsible & Auto-Lift with Auto-Hide) */}
        <div
          className={`absolute left-0 right-0 h-16 bg-gradient-to-b from-white to-gold-50/50 dark:from-navy-900 dark:to-navy-950 border-t border-gold-100 dark:border-navy-800 z-40 transition-all duration-500 ease-in-out shadow-[0_-5px_30px_rgba(0,0,0,0.08)] backdrop-blur-md
          ${isImmersive || !showFooterBar ? 'translate-y-[200%] opacity-0' : 'translate-y-0 opacity-100'}
          ${currentTrack ? 'bottom-[150px] md:bottom-[150px]' : 'bottom-[70px] md:bottom-[70px]'} 
        `}
        >
          <div className="max-w-4xl mx-auto w-full h-full flex justify-between items-center px-4 sm:px-6">
            {/* Previous Page (Appears on the RIGHT in RTL) */}
            <button onClick={handlePrev} disabled={page <= 1} className="flex items-center gap-1.5 sm:gap-2 text-navy-700 dark:text-navy-300 disabled:opacity-30 hover:bg-gradient-to-r hover:from-gold-50 hover:to-amber-50 dark:hover:from-navy-800 dark:hover:to-navy-800 px-2 sm:px-4 py-2 rounded-xl transition-all border border-transparent hover:border-gold-200 dark:hover:border-navy-700 group">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gold-100 dark:bg-navy-800 flex items-center justify-center group-hover:bg-gold-200 dark:group-hover:bg-navy-700 transition-colors">
                <ChevronRight size={18} className="text-gold-600 dark:text-gold-400" />
              </div>
              <span className="font-bold text-[11px] sm:text-sm">السابق</span>
            </button>

            {/* Page Number / Navigation Trigger */}
            <div
              className="flex flex-col items-center cursor-pointer hover:scale-105 transition-transform"
              onClick={() => setIsNavOpen(true)}
            >
              <span className="text-[10px] text-navy-400 font-bold mb-0.5">رقم الصفحة</span>
              <span className="text-base font-bold text-navy-900 dark:text-white bg-gradient-to-r from-gold-100 to-amber-100 dark:from-navy-800 dark:to-navy-800 px-5 py-1 rounded-xl border border-gold-200 dark:border-navy-700 shadow-sm flex items-center gap-2 hover:shadow-md transition-shadow">
                <Grid size={14} className="text-gold-600 dark:text-gold-400" />
                {toArabicDigits(page)}
              </span>
            </div>

            {/* Next Page (Appears on the LEFT in RTL) */}
            <button onClick={handleNext} disabled={page >= 604} className="flex items-center gap-1.5 sm:gap-2 text-navy-700 dark:text-navy-300 disabled:opacity-30 hover:bg-gradient-to-r hover:from-gold-50 hover:to-amber-50 dark:hover:from-navy-800 dark:hover:to-navy-800 px-2 sm:px-4 py-2 rounded-xl transition-all border border-transparent hover:border-gold-200 dark:hover:border-navy-700 group">
              <span className="font-bold text-[11px] sm:text-sm">التالي</span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gold-100 dark:bg-navy-800 flex items-center justify-center group-hover:bg-gold-200 dark:group-hover:bg-navy-700 transition-colors">
                <ChevronLeft size={18} className="text-gold-600 dark:text-gold-400" />
              </div>
            </button>
          </div>
        </div>

        {/* --- NEW: Navigation Modal (Surahs/Pages) --- */}
        {
          isNavOpen && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in slide-in-from-bottom-10">
              <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={() => setIsNavOpen(false)}></div>
              <div className="relative w-full sm:max-w-md bg-white dark:bg-navy-950 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden border-t-4 border-gold-500 h-[70vh] flex flex-col">

                {/* Header / Tabs */}
                <div className="p-4 bg-gradient-to-b from-gold-50 to-white dark:from-navy-900 dark:to-navy-950 border-b border-gold-100 dark:border-navy-800">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-navy-900 dark:text-white flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-amber-500 flex items-center justify-center shadow-lg shadow-gold-500/20">
                        <Grid size={18} className="text-white" />
                      </div>
                      الانتقال السريع
                    </h3>
                    <button onClick={() => setIsNavOpen(false)} className="p-2 rounded-xl hover:bg-gold-100 dark:hover:bg-navy-800 text-navy-400 hover:text-navy-600 dark:hover:text-white transition-colors">
                      <X size={20} />
                    </button>
                  </div>

                  <div className="flex bg-white dark:bg-navy-900 p-1.5 rounded-xl border border-gold-100 dark:border-navy-800 shadow-sm">
                    <button
                      onClick={() => setNavTab('surahs')}
                      className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${navTab === 'surahs' ? 'bg-gradient-to-r from-gold-400 to-amber-500 text-white shadow-lg shadow-gold-500/30' : 'text-navy-500 hover:bg-gold-50 dark:hover:bg-navy-800'}`}
                    >
                      <BookOpen size={16} /> السور
                    </button>
                    <button
                      onClick={() => setNavTab('parts')}
                      className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${navTab === 'parts' ? 'bg-gradient-to-r from-gold-400 to-amber-500 text-white shadow-lg shadow-gold-500/30' : 'text-navy-500 hover:bg-gold-50 dark:hover:bg-navy-800'}`}
                    >
                      <Grid size={16} /> الأجزاء
                    </button>
                    <button
                      onClick={() => setNavTab('pages')}
                      className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${navTab === 'pages' ? 'bg-gradient-to-r from-gold-400 to-amber-500 text-white shadow-lg shadow-gold-500/30' : 'text-navy-500 hover:bg-gold-50 dark:hover:bg-navy-800'}`}
                    >
                      <Hash size={16} /> الصفحات
                    </button>
                  </div>
                </div>

                {/* Content Body */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gradient-to-b from-white to-gold-50/30 dark:from-navy-950 dark:to-navy-950">
                  {navTab === 'surahs' ? (
                    <div className="grid grid-cols-3 gap-2.5">
                      {allSurahs.map(s => (
                        <button
                          key={s.number}
                          onClick={() => navigateToSurah(s.number)}
                          className="flex flex-col items-center justify-center p-3 rounded-xl border border-gold-100/50 dark:border-navy-800 hover:border-gold-400 dark:hover:border-gold-500 hover:bg-gradient-to-br hover:from-gold-50 hover:to-amber-50 dark:hover:from-navy-900 dark:hover:to-navy-800 transition-all text-center group shadow-sm hover:shadow-md"
                        >
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-navy-100 to-navy-50 dark:from-navy-800 dark:to-navy-900 flex items-center justify-center text-xs font-bold text-navy-500 dark:text-navy-400 group-hover:from-gold-400 group-hover:to-amber-500 group-hover:text-white transition-all mb-1.5 font-sans shadow-sm">
                            {s.number}
                          </div>
                          <span className="font-quran font-bold text-navy-800 dark:text-white text-base truncate w-full group-hover:text-gold-700 dark:group-hover:text-gold-400 transition-colors">{s.name}</span>
                        </button>
                      ))}
                    </div>
                  ) : navTab === 'parts' ? (
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                      {/* Correct Juz Start Pages (verified from Quran.com and Islamic sources) */}
                      {[
                        1, 22, 42, 62, 82, 102, 121, 142, 162, 182,
                        201, 222, 242, 262, 282, 302, 322, 342, 362, 382,
                        402, 422, 442, 462, 482, 502, 522, 542, 562, 582
                      ].map((startPage, i) => (
                        <button
                          key={i}
                          onClick={() => { navigateToPage(startPage); setIsNavOpen(false); }}
                          className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-gold-100/50 dark:border-navy-800 hover:bg-gradient-to-br hover:from-gold-50 hover:to-amber-50 dark:hover:from-navy-900 dark:hover:to-navy-800 hover:border-gold-400 dark:hover:border-gold-500 transition-all group shadow-sm hover:shadow-md"
                        >
                          <span className="text-[10px] text-navy-400 group-hover:text-gold-600 dark:group-hover:text-gold-400 transition-colors font-bold">الجزء</span>
                          <span className="font-bold text-2xl text-navy-800 dark:text-white group-hover:text-gold-600 dark:group-hover:text-gold-400 transition-colors">{toArabicDigits(i + 1)}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 bg-navy-50 dark:bg-navy-900 p-2 rounded-xl">
                        <span className="text-sm font-bold text-navy-500 px-2">رقم الصفحة:</span>
                        <input
                          ref={pageInputRef}
                          type="number"
                          min="1" max="604"
                          placeholder="1-604"
                          className="flex-1 p-2 rounded-lg bg-white dark:bg-navy-950 border border-navy-200 dark:border-navy-800 text-center font-bold outline-none focus:ring-2 focus:ring-gold-500"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              navigateToPage(parseInt((e.target as HTMLInputElement).value));
                              setIsNavOpen(false);
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            if (pageInputRef.current && pageInputRef.current.value) {
                              navigateToPage(parseInt(pageInputRef.current.value));
                              setIsNavOpen(false);
                            }
                          }}
                          className="bg-gold-500 text-white p-2 rounded-lg font-bold text-sm shadow-md hover:bg-gold-600 transition-colors"
                        >
                          انتقال
                        </button>
                      </div>

                      <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                        {/* Simplified Page Grid - First 30 or full list? User asked for ALL pages. 604 items is heavy but handleable. */}
                        {/* Render a subset or full? Try full 604 but compact. */}
                        {Array.from({ length: 604 }).map((_, i) => {
                          const pNum = i + 1;
                          return (
                            <button
                              key={pNum}
                              onClick={() => { navigateToPage(pNum); setIsNavOpen(false); }}
                              className={`p-2 rounded-lg border text-sm font-bold transition-all ${pNum === page ? 'bg-gold-500 text-white border-gold-500' : 'border-navy-100 dark:border-navy-800 hover:border-gold-500 hover:bg-gold-50 dark:hover:bg-navy-900 text-navy-700 dark:text-navy-300'}`}
                            >
                              {toArabicDigits(pNum)}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )
        }

        {/* 4. Settings Modal */}
        {
          isSettingsOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="absolute inset-0 bg-navy-900/70 backdrop-blur-md" onClick={() => setIsSettingsOpen(false)}></div>
              <div className="relative w-full max-w-sm bg-white dark:bg-navy-900 rounded-3xl shadow-2xl overflow-hidden border border-gold-100 dark:border-navy-800">
                {/* Header */}
                <div className="p-5 border-b border-gold-100 dark:border-navy-800 flex justify-between items-center bg-gradient-to-b from-gold-50 to-white dark:from-navy-900 dark:to-navy-950">
                  <h3 className="font-bold text-lg text-navy-900 dark:text-white flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-amber-500 flex items-center justify-center shadow-lg shadow-gold-500/20">
                      <Settings size={18} className="text-white" />
                    </div>
                    إعدادات العرض
                  </h3>
                  <button onClick={() => setIsSettingsOpen(false)} className="p-2 rounded-xl hover:bg-gold-100 dark:hover:bg-navy-800 text-navy-400 hover:text-navy-600 dark:hover:text-white transition-colors">
                    <X size={20} />
                  </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                  {/* Font Size Section */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="flex items-center gap-2 text-sm font-bold text-navy-700 dark:text-navy-300">
                        <Type size={18} className="text-gold-500" /> حجم الخط
                      </label>
                      {fontSize !== getResponsiveDefaultFontSize() && (
                        <button
                          onClick={() => setFontSize(getResponsiveDefaultFontSize())}
                          className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold text-gold-600 dark:text-gold-400 hover:bg-gold-50 dark:hover:bg-gold-900/10 transition-all duration-300"
                          title="إعادة تعيين الخط للافتراضي"
                        >
                          <RotateCcw size={13} className="group-hover:-rotate-90 transition-transform duration-300" />
                          <span>إعادة تعيين</span>
                        </button>
                      )}
                    </div>

                    {/* Slider row */}
                    <div className="flex items-center gap-3 bg-navy-50 dark:bg-navy-950 px-3 pt-8 pb-3 rounded-xl border border-navy-100 dark:border-navy-800" dir="ltr">
                      <span className="text-xs font-bold text-navy-400 shrink-0">A</span>

                      {/* Track container — label/marker positions are relative to this */}
                      <div className="flex-1 relative h-8 flex items-center">

                        {/* "Default" floating label */}
                        <div
                          className="absolute -top-6 -translate-x-1/2 text-[9px] font-bold text-gold-600 dark:text-gold-400 whitespace-nowrap transition-opacity duration-300 pointer-events-none"
                          style={{
                            left: `${((getResponsiveDefaultFontSize() - 18) / (44 - 18)) * 100}%`,
                            opacity: Math.abs(fontSize - getResponsiveDefaultFontSize()) < 2 ? 1 : 0.5
                          }}
                        >
                          الافتراضي
                        </div>

                        {/* Default position marker (thin vertical line) */}
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3.5 bg-gold-400/60 rounded-full z-0 pointer-events-none"
                          style={{ left: `${((getResponsiveDefaultFontSize() - 18) / (44 - 18)) * 100}%` }}
                        />

                        {/* Track bg */}
                        <div className="absolute inset-y-3.5 left-0 right-0 bg-navy-200 dark:bg-navy-700 rounded-lg" />

                        {/* Filled track */}
                        <div
                          className="absolute inset-y-3.5 left-0 bg-gradient-to-r from-gold-400 to-gold-600 rounded-lg transition-all duration-100"
                          style={{ width: `${((fontSize - 18) / (44 - 18)) * 100}%` }}
                        />

                        {/* Range input */}
                        <input
                          type="range"
                          min="18"
                          max="44"
                          value={fontSize}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            const def = getResponsiveDefaultFontSize();
                            if (Math.abs(val - def) <= 1 && val !== def) {
                              setFontSize(def);
                            } else {
                              setFontSize(val);
                            }
                          }}
                          className="w-full h-8 cursor-pointer z-20 relative appearance-none bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_2px_5px_rgba(0,0,0,0.2)] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gold-500 [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:active:scale-110"
                        />
                      </div>

                      <span className="text-xl font-bold text-navy-900 dark:text-white shrink-0">A</span>
                    </div>

                    {/* End labels */}
                    <div className="flex justify-between px-1 mt-1 text-[10px] font-bold text-navy-400" dir="ltr">
                      <span>صغير</span>
                      <span>كبير</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {/* 5. Ayah Actions Modal */}
        {
          isModalOpen && selectedAyah && (
            <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4 isolate">

              <div
                className="absolute inset-0 bg-navy-900/80 backdrop-blur-sm transition-opacity duration-300"
                onClick={() => setIsModalOpen(false)}
              ></div>

              <div className="relative w-full sm:max-w-lg bg-white dark:bg-navy-950 rounded-t-3xl sm:rounded-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.3)] border-t-4 border-gold-500 overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-full duration-300 ease-out">

                <div className="flex-shrink-0 p-5 border-b border-navy-100 dark:border-navy-800 bg-gradient-to-b from-navy-50 to-white dark:from-navy-900 dark:to-navy-950 relative">

                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="absolute top-4 left-4 p-2 bg-white dark:bg-navy-800 rounded-full text-navy-400 hover:text-red-500 shadow-sm hover:shadow-md transition-all z-10"
                  >
                    <X size={20} />
                  </button>

                  <div className="flex flex-col items-center justify-center gap-2 pt-2">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gold-500/20 rotate-45 rounded-xl blur-sm"></div>
                      <span className="relative w-14 h-14 flex items-center justify-center bg-gold-500 text-white font-bold text-2xl rounded-2xl shadow-lg font-sans border-2 border-white dark:border-navy-800">
                        {toArabicDigits(selectedAyah.numberInSurah)}
                      </span>
                    </div>
                    <div className="text-center mt-1">
                      <h3 className="font-quran text-3xl font-bold text-navy-900 dark:text-white">{(selectedAyah as any).surah?.name}</h3>
                      <div className="flex items-center justify-center gap-2 text-xs font-bold text-navy-500 dark:text-navy-400 mt-1">
                        <span className="bg-navy-100 dark:bg-navy-800 px-2 py-0.5 rounded-md">الجزء {toArabicDigits(selectedAyah.juz)}</span>
                        <span className="w-1 h-1 bg-gold-500 rounded-full"></span>
                        <span className="bg-navy-100 dark:bg-navy-800 px-2 py-0.5 rounded-md">صفحة {toArabicDigits(page)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-navy-950">
                  <div className="p-5 pb-10 space-y-6">

                    {/* Action Buttons: Desaturated/Darker Gradients & Softer Shadows */}
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { icon: <Bookmark size={26} className={isAyahSaved ? "fill-current" : ""} />, label: isAyahSaved ? "محفوظة" : "حفظ", action: () => { toggleAyahBookmark({ surahName: (selectedAyah as any).surah.name, surahNumber: (selectedAyah as any).surah.number, ayahNumber: selectedAyah.numberInSurah, pageNumber: page, timestamp: Date.now() }); setIsAyahSaved(!isAyahSaved); }, color: isAyahSaved ? "from-red-600 to-red-700 shadow-red-500/20" : "from-navy-600 to-navy-700 shadow-navy-500/20" },
                        { icon: <BookOpen size={26} />, label: "تفسير", action: () => { setShowNoteInput(false); !tafsirData ? (setTafsirLoading(true), fetchTafsir((selectedAyah as any).surah.number, selectedAyah.numberInSurah).then(d => { setTafsirData(d); setTafsirLoading(false); })) : setTafsirData(null); }, color: "from-emerald-600 to-emerald-700 shadow-emerald-500/20" },
                        { icon: <Repeat size={26} />, label: "إكمال التلاوة", action: () => playFromHere(true, 0, 0, 0), color: "from-purple-600 to-purple-700 shadow-purple-500/20" },
                        { icon: <PlayCircle size={26} />, label: "استماع", action: () => playFromHere(false, 0, 0, 0), color: "from-indigo-600 to-indigo-700 shadow-indigo-500/20" },
                      ].map((btn, i) => (
                        <button key={i} onClick={btn.action} className="group flex flex-col items-center gap-2">
                          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${btn.color} text-white flex items-center justify-center shadow-lg transition-transform group-active:scale-95 group-hover:scale-105`}>
                            {btn.icon}
                          </div>
                          <span className="text-[11px] font-bold text-navy-700 dark:text-navy-300">{btn.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Hifz (Memorization) Repeater Tools — Compact 2×2 Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      {/* 1. Single Ayah Repeat */}
                      <div className="bg-white dark:bg-navy-900 rounded-xl p-2.5 border border-navy-100 dark:border-navy-800 shadow-sm">
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className="w-5 h-5 rounded-md bg-gold-100 dark:bg-gold-900/20 flex items-center justify-center flex-shrink-0">
                            <Repeat size={12} className="text-gold-600 dark:text-gold-400" />
                          </div>
                          <span className="text-[10px] font-bold text-navy-700 dark:text-navy-200 leading-tight">تكرار الآية</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {[3, 5, 10, 100].map((count) => (
                            <button
                              key={`ayah-${count}`}
                              onClick={() => playFromHere(false, count)}
                              className="py-1.5 bg-navy-50 dark:bg-navy-800 hover:bg-gold-500 hover:text-white dark:hover:bg-gold-500 rounded-lg text-[11px] font-bold text-navy-600 dark:text-navy-300 transition-all active:scale-95 flex items-center justify-center"
                            >
                              {count === 100 ? <InfinityIcon size={13} /> : count}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 2. Continuous Repeat (مع الاستمرار) */}
                      <div className="bg-white dark:bg-navy-900 rounded-xl p-2.5 border border-navy-100 dark:border-navy-800 shadow-sm">
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className="w-5 h-5 rounded-md bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
                            <RotateCcw size={12} className="text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <span className="text-[10px] font-bold text-navy-700 dark:text-navy-200 leading-tight">تكرار الآية (مع الاستمرار)</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {[3, 5, 10, 100].map((count) => (
                            <button
                              key={`cont-${count}`}
                              onClick={() => playFromHere(true, count, count)}
                              className="py-1.5 bg-navy-50 dark:bg-navy-800 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-500 rounded-lg text-[11px] font-bold text-navy-600 dark:text-navy-300 transition-all active:scale-95 flex items-center justify-center"
                            >
                              {count === 100 ? <InfinityIcon size={13} /> : count}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 3. Page Repeat */}
                      <div className="bg-white dark:bg-navy-900 rounded-xl p-2.5 border border-navy-100 dark:border-navy-800 shadow-sm">
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className="w-5 h-5 rounded-md bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                            <Book size={12} className="text-blue-600 dark:text-blue-400" />
                          </div>
                          <span className="text-[10px] font-bold text-navy-700 dark:text-navy-200 leading-tight">تكرار الصفحة</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {[3, 5, 10, 100].map((count) => (
                            <button
                              key={`page-${count}`}
                              onClick={() => playFromHere(true, 0, 0, 0, count)}
                              className="py-1.5 bg-navy-50 dark:bg-navy-800 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-500 rounded-lg text-[11px] font-bold text-navy-600 dark:text-navy-300 transition-all active:scale-95 flex items-center justify-center"
                            >
                              {count === 100 ? <InfinityIcon size={13} /> : count}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 4. Surah Repeat */}
                      <div className="bg-white dark:bg-navy-900 rounded-xl p-2.5 border border-navy-100 dark:border-navy-800 shadow-sm">
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className="w-5 h-5 rounded-md bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                            <RotateCcw size={12} className="text-purple-600 dark:text-purple-400" />
                          </div>
                          <span className="text-[10px] font-bold text-navy-700 dark:text-navy-200 leading-tight">تكرار السورة كاملة</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {[3, 5, 10, 100].map((count) => (
                            <button
                              key={`surah-${count}`}
                              onClick={() => playFromHere(true, 0, 0, count)}
                              className="py-1.5 bg-navy-50 dark:bg-navy-800 hover:bg-purple-500 hover:text-white dark:hover:bg-purple-500 rounded-lg text-[11px] font-bold text-navy-600 dark:text-navy-300 transition-all active:scale-95 flex items-center justify-center"
                            >
                              {count === 100 ? <InfinityIcon size={13} /> : count}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 5. Range Repeat (تكرار نطاق آيات) — Full Width */}
                    <div className="col-span-2 bg-white dark:bg-navy-900 rounded-xl p-3 border border-navy-100 dark:border-navy-800 shadow-sm mt-1">
                      <div className="flex items-center gap-1.5 mb-3">
                        <div className="w-5 h-5 rounded-md bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center flex-shrink-0">
                          <ArrowDownUp size={12} className="text-rose-500 dark:text-rose-400" />
                        </div>
                        <span className="text-[10px] font-bold text-navy-700 dark:text-navy-200 leading-tight">تكرار نطاق آيات</span>
                      </div>

                      {/* From/To Inputs */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex-1 flex items-center gap-1.5 bg-navy-50 dark:bg-navy-950 rounded-lg border border-navy-100 dark:border-navy-800 px-2 py-1.5 transition-colors focus-within:border-rose-300 dark:focus-within:border-rose-800">
                          <span className="text-[9px] font-bold text-navy-400 dark:text-navy-500 whitespace-nowrap">من آية</span>
                          <input
                            type="number"
                            min={1}
                            max={SURAH_AYAH_COUNTS[(selectedAyah as any).surah?.number - 1] || 1}
                            value={rangeFromAyah}
                            onChange={(e) => {
                              const maxAyahs = SURAH_AYAH_COUNTS[(selectedAyah as any).surah?.number - 1] || 1;
                              const v = Math.max(1, Math.min(parseInt(e.target.value) || 1, maxAyahs));
                              setRangeFromAyah(v);
                              if (v > rangeToAyah) setRangeToAyah(v);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full text-center text-sm font-bold text-navy-800 dark:text-white bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                        </div>
                        <span className="text-xs font-bold text-navy-300 dark:text-navy-600">→</span>
                        <div className="flex-1 flex items-center gap-1.5 bg-navy-50 dark:bg-navy-950 rounded-lg border border-navy-100 dark:border-navy-800 px-2 py-1.5 transition-colors focus-within:border-rose-300 dark:focus-within:border-rose-800">
                          <span className="text-[9px] font-bold text-navy-400 dark:text-navy-500 whitespace-nowrap">إلى آية</span>
                          <input
                            type="number"
                            min={rangeFromAyah}
                            max={SURAH_AYAH_COUNTS[(selectedAyah as any).surah?.number - 1] || 1}
                            value={rangeToAyah}
                            onChange={(e) => {
                              const maxAyahs = SURAH_AYAH_COUNTS[(selectedAyah as any).surah?.number - 1] || 1;
                              const v = Math.max(rangeFromAyah, Math.min(parseInt(e.target.value) || rangeFromAyah, maxAyahs));
                              setRangeToAyah(v);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full text-center text-sm font-bold text-navy-800 dark:text-white bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                        </div>
                      </div>

                      {/* Dual Range Slider */}
                      {(() => {
                        const rangeMax = SURAH_AYAH_COUNTS[(selectedAyah as any)?.surah?.number - 1] || 1;
                        if (rangeMax <= 1) return null;
                        const sliderDenom = Math.max(1, rangeMax - 1);
                        const rightPercent = ((rangeFromAyah - 1) / sliderDenom) * 100;
                        const leftPercent = ((rangeMax - rangeToAyah) / sliderDenom) * 100;
                        return (
                          <div className="relative h-6 mt-1 mb-4 px-2 flex items-center" dir="rtl">
                            {/* Track background */}
                            <div className="absolute left-2 right-2 h-1.5 bg-navy-100 dark:bg-navy-800 rounded-full" />
                            {/* Active Track */}
                            <div 
                              className="absolute h-1.5 bg-rose-400 dark:bg-rose-500 rounded-full pointer-events-none"
                              style={{ left: `calc(0.5rem + ${leftPercent}%)`, right: `calc(0.5rem + ${rightPercent}%)` }}
                            />
                            {/* Input Start (From) */}
                            <input 
                              type="range"
                              min={1}
                              max={rangeMax}
                              value={rangeFromAyah}
                              onChange={(e) => {
                                const v = Math.min(parseInt(e.target.value) || 1, rangeMax);
                                setRangeFromAyah(v);
                                if (v > rangeToAyah) setRangeToAyah(v);
                              }}
                              className="absolute left-0 right-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-rose-600 dark:[&::-webkit-slider-thumb]:bg-rose-400 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white dark:[&::-webkit-slider-thumb]:border-navy-900 z-10"
                            />
                            {/* Input End (To) */}
                            <input 
                              type="range"
                              min={1}
                              max={rangeMax}
                              value={rangeToAyah}
                              onChange={(e) => {
                                const v = Math.min(parseInt(e.target.value) || 1, rangeMax);
                                setRangeToAyah(Math.max(v, rangeFromAyah));
                              }}
                              className="absolute left-0 right-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-rose-600 dark:[&::-webkit-slider-thumb]:bg-rose-400 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white dark:[&::-webkit-slider-thumb]:border-navy-900 z-20"
                            />
                          </div>
                        );
                      })()}

                      {/* Live Ayah Preview Cards */}
                      {(() => {
                        return (
                          <div className="flex flex-col sm:flex-row gap-2 mb-3">
                            <div className="flex-1 bg-navy-50/50 dark:bg-navy-900/30 rounded-lg p-2.5 border border-navy-100 dark:border-navy-800">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">بداية التكرار</span>
                                <span className="text-[9px] font-bold text-navy-500 dark:text-navy-400 bg-navy-100 dark:bg-navy-800 px-1.5 py-0.5 rounded">آية {toArabicDigits(rangeFromAyah)}</span>
                              </div>
                              <div className="text-[11px] font-quran text-navy-800 dark:text-navy-200 line-clamp-2 leading-relaxed">
                                {rangeStartText ? cleanTajweedTags(rangeStartText) : 'جاري التحميل...'}
                              </div>
                            </div>
                            <div className="flex-1 bg-navy-50/50 dark:bg-navy-900/30 rounded-lg p-2.5 border border-navy-100 dark:border-navy-800">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">نهاية التكرار</span>
                                <span className="text-[9px] font-bold text-navy-500 dark:text-navy-400 bg-navy-100 dark:bg-navy-800 px-1.5 py-0.5 rounded">آية {toArabicDigits(rangeToAyah)}</span>
                              </div>
                              <div className="text-[11px] font-quran text-navy-800 dark:text-navy-200 line-clamp-2 leading-relaxed">
                                {rangeEndText ? cleanTajweedTags(rangeEndText) : 'جاري التحميل...'}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Ayah count info */}
                      <div className="text-center mb-3">
                        <span className="text-[9px] font-bold text-navy-600 dark:text-navy-300 bg-navy-100 dark:bg-navy-800 px-2.5 py-1 rounded-full">
                          النطاق المحدد: {rangeToAyah >= rangeFromAyah ? `${toArabicDigits(rangeToAyah - rangeFromAyah + 1)} آية` : 'حدد النطاق'}
                        </span>
                      </div>

                      {/* Repeat Count Buttons */}
                      <div className="grid grid-cols-4 gap-1">
                        {[3, 5, 10, 100].map((count) => (
                          <button
                            key={`range-${count}`}
                            onClick={() => playRangeRepeat(count)}
                            disabled={rangeToAyah < rangeFromAyah}
                            className="py-1.5 bg-navy-50 dark:bg-navy-800 hover:bg-rose-500 hover:text-white dark:hover:bg-rose-500 rounded-lg text-[11px] font-bold text-navy-600 dark:text-navy-300 transition-all active:scale-95 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {count === 100 ? <InfinityIcon size={13} /> : count}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => { setTafsirData(null); setShowNoteInput(!showNoteInput); }} className="flex-1 py-3 bg-white dark:bg-navy-800 rounded-xl border border-navy-100 dark:border-navy-700 flex items-center justify-center gap-2 text-xs font-bold text-navy-600 dark:text-navy-300 hover:bg-gold-50 dark:hover:bg-navy-700 transition-colors">
                        <FileEdit size={16} /> تدوين ملاحظة
                      </button>
                      <button onClick={() => { navigator.clipboard.writeText(selectedAyah.aya_text || cleanTajweedTags(selectedAyah.text)); setIsModalOpen(false); }} className="flex-1 py-3 bg-white dark:bg-navy-800 rounded-xl border border-navy-100 dark:border-navy-700 flex items-center justify-center gap-2 text-xs font-bold text-navy-600 dark:text-navy-300 hover:bg-gold-50 dark:hover:bg-navy-700 transition-colors">
                        <Copy size={16} /> نسخ النص
                      </button>
                    </div>

                    <hr className="border-navy-100 dark:border-navy-800" />

                    <div className="min-h-[150px] transition-all duration-300">
                      {tafsirLoading ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-3">
                          <div className="animate-spin rounded-full h-8 w-8 border-4 border-navy-100 border-t-gold-500"></div>
                          <p className="text-xs font-bold text-navy-400">جاري جلب التفسير...</p>
                        </div>
                      ) : tafsirData ? (
                        <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-sm border border-gold-100 dark:border-navy-800 animate-in fade-in zoom-in-95 overflow-hidden">
                          {/* Tafsir Source Tabs */}
                          <div className="flex border-b border-navy-100 dark:border-navy-800 bg-navy-50/50 dark:bg-navy-950/50">
                            {Object.entries(TAFSIR_SOURCES).map(([key, source]) => (
                              <button
                                key={key}
                                onClick={async () => {
                                  if (key === tafsirSource) return;
                                  setTafsirSource(key as any);
                                  setTafsirLoading(true);
                                  try {
                                    const surah = (selectedAyah as any).surah.number;
                                    const ayah = selectedAyah!.numberInSurah;
                                    const editionId = TAFSIR_SOURCES[key as keyof typeof TAFSIR_SOURCES].apiEdition;
                                    let text = await loadSingleAyahTafsir(editionId, surah, ayah);

                                    if (text) {
                                      setTafsirData({
                                        text,
                                        edition: { identifier: key, language: 'ar', name: TAFSIR_SOURCES[key as keyof typeof TAFSIR_SOURCES].name, englishName: key },
                                        surah: { number: surah },
                                        numberInSurah: ayah
                                      });
                                    } else {
                                      setTafsirData({
                                        text: 'التفسير غير متاح لهذه الآية',
                                        edition: { identifier: key, language: 'ar', name: TAFSIR_SOURCES[key as keyof typeof TAFSIR_SOURCES].name, englishName: key },
                                        surah: { number: surah },
                                        numberInSurah: ayah
                                      });
                                    }
                                  } catch (e) {
                                    setTafsirData({
                                      text: 'حدث خطأ أثناء جلب التفسير',
                                      edition: { identifier: 'error', language: 'ar', name: 'خطأ', englishName: 'Error' },
                                      surah: { number: (selectedAyah as any)?.surah?.number || 1 },
                                      numberInSurah: selectedAyah?.numberInSurah || 1
                                    });
                                  } finally {
                                    setTafsirLoading(false);
                                  }
                                }}
                                className={`flex-1 py-2.5 text-[11px] font-bold transition-colors ${key === tafsirSource
                                  ? 'bg-gold-500 text-white shadow-sm'
                                  : 'text-navy-500 dark:text-navy-400 hover:bg-navy-100 dark:hover:bg-navy-800'
                                  }`}
                              >
                                {source.name}
                              </button>
                            ))}
                          </div>

                          {/* Tafsir Content */}
                          <div className="p-5">
                            <div className="flex items-center justify-between mb-3 border-b border-navy-50 dark:border-navy-800 pb-2">
                              <h4 className="text-sm font-bold text-gold-600 dark:text-gold-500 flex items-center gap-2">
                                <BookOpen size={16} />
                                {TAFSIR_SOURCES[tafsirSource].name}
                              </h4>
                              <button onClick={() => setTafsirData(null)} className="text-xs text-navy-400 hover:text-red-500 font-bold">إغلاق</button>
                            </div>
                            <p className="text-base leading-loose text-navy-800 dark:text-gray-300 font-serif text-right">
                              {tafsirData.text}
                            </p>
                            <p className="text-[10px] text-navy-400 dark:text-navy-500 mt-3">
                              💡 التفسير متاح محلياً بدون إنترنت
                            </p>
                          </div>
                        </div>
                      ) : showNoteInput ? (
                        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                          <label className="text-sm font-bold text-navy-700 dark:text-navy-300 flex items-center gap-2">
                            <FileEdit size={16} className="text-gold-500" /> خواطرك حول الآية
                          </label>
                          <textarea
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder="اكتب تدبرك هنا..."
                            className="w-full p-4 rounded-2xl bg-white dark:bg-navy-900 border border-navy-200 dark:border-navy-800 focus:ring-2 focus:ring-gold-500 outline-none text-base min-h-[120px] text-navy-900 dark:text-white resize-none shadow-inner"
                          />
                          <button
                            onClick={() => { saveNote({ surahName: (selectedAyah as any).surah.name, surahNumber: (selectedAyah as any).surah.number, ayahNumber: selectedAyah.numberInSurah, pageNumber: page, text: noteText, timestamp: Date.now() }); setShowNoteInput(false); }}
                            className="w-full py-3.5 bg-navy-800 hover:bg-navy-700 text-white rounded-xl font-bold shadow-lg shadow-navy-900/20 flex items-center justify-center gap-2 transition-colors"
                          >
                            <Save size={18} /> حفظ الملاحظة
                          </button>
                        </div>
                      ) : (
                        <div className="text-center pt-2 pb-6">
                          {/* Single Ayah View: Neutral Background */}
                          <div className="relative p-6 bg-slate-50 dark:bg-[#111827] rounded-3xl shadow-sm border border-navy-50 dark:border-navy-800">
                            <span className="absolute top-4 right-4 text-4xl text-gold-200 dark:text-navy-800 font-serif leading-none">“</span>

                            <div
                              className="quran-text text-4xl leading-[2.6] text-navy-900 dark:text-white relative z-10 w-full"
                              style={{ fontFeatureSettings: '"cv01" on, "cv02" on', textAlign: textAlign }}
                            >
                              {selectedAyah.aya_text || <TajweedText text={selectedAyah.text} />}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="h-10 sm:h-6"></div>
                </div>
              </div>
            </div>
          )
        }
        {/* ===== نظام الاختبار بالمرحلتين ===== */}
        <AnimatePresence>
          {isSmartRecitationOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-navy-900/80 backdrop-blur-sm" dir="rtl">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="bg-white dark:bg-navy-950 rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 relative border border-white/10 dark:border-navy-800/60 shadow-2xl custom-scrollbar"
              >

                {/* ── اختيار المرحلة ── */}
                {quizPhase === 'selector' && (
                  <QuizPhaseSelector
                    rangeLabel={`صفحة ${page}`}
                    ayahCount={ayahs.length}
                    difficulty={quizDifficulty}
                    onDifficultyChange={setQuizDifficulty}
                    onPhase1={startPhase1Reader}
                    onPhase2={startPhase2Reader}
                    onPhase3={startPhase3Reader}
                    onClose={closeQuiz}
                  />
                )}

                {/* ── المرحلة الأولى: أسئلة ذكية ── */}
                {quizPhase === 'phase1' && smartQuizQuestions.length > 0 && (
                  <div className="flex flex-col gap-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-navy-900 dark:text-white">المرحلة الأولى — أسئلة ذكية</h3>
                        <p className="text-xs text-navy-500 dark:text-navy-400 mt-0.5">
                          صفحة {toArabicDigits(page)} — {toArabicDigits(smartQuizIndex + 1)} / {toArabicDigits(smartQuizQuestions.length)}
                        </p>
                      </div>
                      <button onClick={closeQuiz} className="p-2 rounded-xl text-navy-400 hover:text-navy-700 dark:hover:text-white hover:bg-navy-100 dark:hover:bg-navy-800 transition-colors">
                        <X size={20} />
                      </button>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-2 rounded-full bg-navy-100 dark:bg-navy-800 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
                        animate={{ width: `${((smartQuizIndex + 1) / smartQuizQuestions.length) * 100}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>

                    {/* Question card */}
                    <DailyQuizCard
                      question={smartQuizQuestions[smartQuizIndex]}
                      onAnswer={(correct) => {
                        const newAnswers = { ...smartQuizAnswers, [smartQuizQuestions[smartQuizIndex].id]: correct };
                        setSmartQuizAnswers(newAnswers);
                        if (smartQuizIndex < smartQuizQuestions.length - 1) {
                          setTimeout(() => setSmartQuizIndex(prev => prev + 1), 550);
                        } else {
                          // Last question — go to result after short delay
                          setTimeout(() => {
                            const evalResult = evaluateQuiz(smartQuizQuestions, newAnswers);
                            const mistakes = smartQuizQuestions
                              .filter(q => newAnswers[q.id] === false)
                              .map(q => ({ questionText: q.questionText, correctAnswer: q.correctAnswer }));
                            setQuizResult({
                              score: evalResult.score,
                              correct: smartQuizQuestions.filter(q => newAnswers[q.id] === true).length,
                              total: smartQuizQuestions.length,
                              timeTakenMs: Date.now() - smartQuizStartTime,
                              mistakes,
                            });
                            setQuizPhase('result');
                          }, 550);
                        }
                      }}
                    />
                  </div>
                )}

                {/* ── المرحلة الثانية: ترتيب الآيات (مجموعات) ── */}
                {quizPhase === 'phase2' && phase2Chunks.length > 0 && phase2ChunkIndex < phase2Chunks.length && (
                  <AyahReorderQuiz
                    key={`reader-phase2-${phase2ChunkIndex}`}
                    quiz={phase2Chunks[phase2ChunkIndex]}
                    chunkIndex={phase2ChunkIndex}
                    totalChunks={phase2Chunks.length}
                    onFinish={finishPhase2Chunk}
                    onClose={closeQuiz}
                  />
                )}

                {/* ── المرحلة الثالثة: ترتيب الكلمات ── */}
                {quizPhase === 'phase3' && phase3Quiz && (
                  <WordReorderQuiz
                    quiz={phase3Quiz}
                    onFinish={finishPhase3Reader}
                    onClose={closeQuiz}
                  />
                )}


                {/* ── شاشة النتائج ── */}
                {quizPhase === 'result' && quizResult && (
                  <QuizResultScreen
                    score={quizResult.score}
                    correctCount={quizResult.correct}
                    totalCount={quizResult.total}
                    timeTakenMs={quizResult.timeTakenMs}
                    phase={quizPhaseNum}
                    mistakes={quizResult.mistakes}
                    ayahMistakes={quizAyahMistakes}
                    onRetry={() => {
                      if (quizPhaseNum === 1) startPhase1Reader();
                      else if (quizPhaseNum === 2) startPhase2Reader();
                      else startPhase3Reader();
                    }}
                    onClose={() => {
                      if (quizResult.score >= 70 && hifzContext) {
                        hifzContext.markPageAsMemorized(page);
                      }
                      closeQuiz();
                    }}
                  />
                )}

              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const CornerDecoration = ({ className }: { className?: string }) => (
  <div className={`absolute w-12 h-12 text-gold-600/20 dark:text-gold-500/10 pointer-events-none ${className}`}>
    <svg viewBox="0 0 100 100" fill="currentColor" className="w-full h-full">
      <path d="M0 0 H40 V5 H5 V40 H0 Z" />
      <path d="M10 10 H45 V13 H13 V45 H10 Z" opacity="0.6" />
    </svg>
  </div>
);
