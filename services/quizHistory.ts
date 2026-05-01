import { QuizDifficulty } from './hifzManager';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QuizHistoryEntry {
  id: string;
  date: number;                   // Unix timestamp
  rangeLabel: string;             // e.g. "سورة البقرة"
  phase: 1 | 2 | 3;
  score: number;                  // 0-100
  correct: number;
  total: number;
  timeTakenMs: number;
  difficulty: QuizDifficulty;
}

export interface AyahMistake {
  preview: string;
  errorCount: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const HISTORY_KEY = 'al_bayan_quiz_history';
const MAX_ENTRIES = 50;

// ── Helpers ───────────────────────────────────────────────────────────────────

export const saveQuizResult = (
  entry: Omit<QuizHistoryEntry, 'id' | 'date'>
): void => {
  try {
    const existing = getQuizHistory();
    const newEntry: QuizHistoryEntry = {
      ...entry,
      id: `quiz_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      date: Date.now(),
    };
    const updated = [newEntry, ...existing].slice(0, MAX_ENTRIES);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // Silent fail — storage issues should not break the quiz
  }
};

export const getQuizHistory = (): QuizHistoryEntry[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as QuizHistoryEntry[]) : [];
  } catch {
    return [];
  }
};

export const clearQuizHistory = (): void => {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {}
};

/** Returns per-phase summary stats from saved history */
export const getQuizStats = () => {
  const history = getQuizHistory();

  const totalSessions = history.length;
  const avgScore =
    totalSessions === 0
      ? 0
      : Math.round(history.reduce((s, e) => s + e.score, 0) / totalSessions);

  // This week
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const thisWeek = history.filter(e => e.date >= weekAgo);

  return { totalSessions, avgScore, thisWeekCount: thisWeek.length };
};
