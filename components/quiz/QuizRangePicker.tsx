import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, BookOpen, Hash, ChevronLeft, ChevronDown, ChevronUp, X
} from 'lucide-react';
import {
  SURAH_NAMES_ARABIC,
  SURAH_AYAH_COUNTS,
  SURAH_START_PAGES,
  getGlobalAyahNumber,
  getSurahGlobalAyahRange,
} from '../../services/quranStaticData';
import { toArabicDigits } from '../../services/normalization';

export type RangeMode = 'surah' | 'pages' | 'ayahs';

export interface QuizRange {
  mode: RangeMode;
  /** page-based */
  fromPage?: number;
  toPage?: number;
  /** surah-based */
  surahNumber?: number;
  /** ayah-based (global IDs) */
  fromGlobal?: number;
  toGlobal?: number;
  /** Human readable label */
  label: string;
  /** Estimated ayah count */
  estimatedCount: number;
}

interface QuizRangePickerProps {
  onConfirm: (range: QuizRange) => void;
  onCancel: () => void;
}

// Compute the last page of each surah
const getSurahEndPage = (surahNum: number): number => {
  const nextSurahStart = SURAH_START_PAGES[surahNum]; // index surahNum = next surah
  if (!nextSurahStart || surahNum >= 114) return 604;
  return nextSurahStart - 1;
};

export const QuizRangePicker: React.FC<QuizRangePickerProps> = ({ onConfirm, onCancel }) => {
  const [mode, setMode] = useState<RangeMode>('surah');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSurah, setSelectedSurah] = useState<number | null>(null);
  const [expandedSurahOptions, setExpandedSurahOptions] = useState(false);

  // Pages mode
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(1);

  // Ayahs mode
  const [fromSurah, setFromSurah] = useState(1);
  const [fromAyah, setFromAyah] = useState(1);
  const [toSurah, setToSurah] = useState(1);
  const [toAyah, setToAyah] = useState(7);

  // Filtered surahs
  const filteredSurahs = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return SURAH_NAMES_ARABIC.map((name, i) => ({ name, num: i + 1 }));
    return SURAH_NAMES_ARABIC
      .map((name, i) => ({ name, num: i + 1 }))
      .filter(s => s.name.includes(q) || s.num.toString().includes(q));
  }, [searchQuery]);

  const handleSurahSelect = (surahNum: number) => {
    setSelectedSurah(surahNum);
    setExpandedSurahOptions(true);
  };

  const buildSurahRange = (): QuizRange => {
    const s = selectedSurah!;
    const name = SURAH_NAMES_ARABIC[s - 1];
    const ayahCount = SURAH_AYAH_COUNTS[s - 1];
    const { firstGlobal, lastGlobal } = getSurahGlobalAyahRange(s);
    return {
      mode: 'surah',
      surahNumber: s,
      fromGlobal: firstGlobal,
      toGlobal: lastGlobal,
      label: `سورة ${name}`,
      estimatedCount: ayahCount,
    };
  };

  const buildPagesRange = (): QuizRange => {
    const fp = Math.max(1, Math.min(fromPage, 604));
    const tp = Math.max(fp, Math.min(toPage, 604));
    const approxCount = Math.round((tp - fp + 1) * 8); // ~8 ayahs/page
    return {
      mode: 'pages',
      fromPage: fp,
      toPage: tp,
      label: `الصفحات ${toArabicDigits(fp)} — ${toArabicDigits(tp)}`,
      estimatedCount: approxCount,
    };
  };

  const buildAyahsRange = (): QuizRange => {
    const fromGlobal = getGlobalAyahNumber(fromSurah, fromAyah);
    const toGlobal = getGlobalAyahNumber(toSurah, toAyah);
    const fg = Math.min(fromGlobal, toGlobal);
    const tg = Math.max(fromGlobal, toGlobal);
    const count = tg - fg + 1;
    return {
      mode: 'ayahs',
      fromGlobal: fg,
      toGlobal: tg,
      label: `من ${SURAH_NAMES_ARABIC[fromSurah - 1]} ${toArabicDigits(fromAyah)} إلى ${SURAH_NAMES_ARABIC[toSurah - 1]} ${toArabicDigits(toAyah)}`,
      estimatedCount: count,
    };
  };

  const canConfirm = () => {
    if (mode === 'surah') return selectedSurah !== null;
    if (mode === 'pages') return fromPage <= toPage;
    if (mode === 'ayahs') {
      const fg = getGlobalAyahNumber(fromSurah, fromAyah);
      const tg = getGlobalAyahNumber(toSurah, toAyah);
      return fg <= tg;
    }
    return false;
  };

  const handleConfirm = () => {
    if (mode === 'surah') onConfirm(buildSurahRange());
    else if (mode === 'pages') onConfirm(buildPagesRange());
    else onConfirm(buildAyahsRange());
  };

  const tabs: { id: RangeMode; label: string; icon: React.ReactNode }[] = [
    { id: 'surah', label: 'بالسورة', icon: <BookOpen size={14} /> },
    { id: 'pages', label: 'بالصفحات', icon: <Hash size={14} /> },
    { id: 'ayahs', label: 'بالآيات', icon: <Hash size={14} /> },
  ];

  return (
    <div className="flex flex-col gap-4" dir="rtl">
      {/* Title */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-navy-900 dark:text-white">اختر نطاق الاختبار</h2>
        <button onClick={onCancel} className="p-1.5 rounded-lg text-navy-400 hover:text-navy-700 dark:hover:text-white hover:bg-navy-100 dark:hover:bg-navy-800 transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Mode Tabs */}
      <div className="flex bg-navy-50 dark:bg-navy-900 p-1.5 rounded-xl border border-navy-100 dark:border-navy-800 gap-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setMode(tab.id)}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5
              ${mode === tab.id
                ? 'bg-gradient-to-r from-gold-400 to-amber-500 text-white shadow-md shadow-gold-500/20'
                : 'text-navy-500 dark:text-navy-400 hover:bg-navy-100 dark:hover:bg-navy-800'}`}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* ── Content by mode ── */}
      <AnimatePresence mode="wait">
        {/* SURAH MODE */}
        {mode === 'surah' && (
          <motion.div
            key="surah"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-3"
          >
            {/* Search */}
            <div className="relative">
              <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ابحث عن سورة..."
                className="w-full pr-9 pl-3 py-2.5 rounded-xl bg-navy-50 dark:bg-navy-900 border border-navy-100 dark:border-navy-800 text-sm text-navy-900 dark:text-white placeholder:text-navy-400 focus:ring-2 focus:ring-gold-400 outline-none transition"
              />
            </div>

            {/* Surah Grid */}
            <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto custom-scrollbar">
              {filteredSurahs.map(s => {
                const isSelected = selectedSurah === s.num;
                const startPage = SURAH_START_PAGES[s.num - 1];
                return (
                  <button
                    key={s.num}
                    onClick={() => handleSurahSelect(s.num)}
                    className={`flex flex-col items-center py-2.5 px-1 rounded-xl border text-center transition-all
                      ${isSelected
                        ? 'border-gold-400 bg-gradient-to-br from-gold-50 to-amber-50 dark:from-gold-950/30 dark:to-amber-950/20 shadow-md'
                        : 'border-navy-100 dark:border-navy-800 hover:border-gold-300 hover:bg-gold-50/50 dark:hover:bg-navy-800/60'}`}
                  >
                    <span className={`text-[10px] font-bold w-6 h-6 rounded-full flex items-center justify-center mb-1 transition-all
                      ${isSelected ? 'bg-gold-500 text-white' : 'bg-navy-100 dark:bg-navy-800 text-navy-500 dark:text-navy-400'}`}>
                      {s.num}
                    </span>
                    <span className={`font-quran text-sm leading-tight truncate w-full transition-colors
                      ${isSelected ? 'text-gold-700 dark:text-gold-400' : 'text-navy-800 dark:text-white'}`}>
                      {s.name}
                    </span>
                    <span className="text-[9px] text-navy-400 dark:text-navy-500 mt-0.5">ص {toArabicDigits(startPage)}</span>
                  </button>
                );
              })}
            </div>

            {/* Selected Surah Detail */}
            <AnimatePresence>
              {selectedSurah && expandedSurahOptions && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 rounded-2xl bg-gold-50 dark:bg-gold-950/20 border border-gold-200 dark:border-gold-900/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-navy-900 dark:text-white flex items-center gap-2">
                        <span className="font-quran text-base">{SURAH_NAMES_ARABIC[selectedSurah - 1]}</span>
                      </h4>
                      <span className="text-[11px] text-navy-400 dark:text-navy-500">
                        {toArabicDigits(SURAH_AYAH_COUNTS[selectedSurah - 1])} آية
                        · ص {toArabicDigits(SURAH_START_PAGES[selectedSurah - 1])} – {toArabicDigits(getSurahEndPage(selectedSurah))}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* PAGES MODE */}
        {mode === 'pages' && (
          <motion.div
            key="pages"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-3"
          >
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'من صفحة', value: fromPage, setValue: setFromPage, min: 1, max: 604 },
                { label: 'إلى صفحة', value: toPage, setValue: setToPage, min: fromPage, max: 604 },
              ].map(field => (
                <div key={field.label} className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-navy-600 dark:text-navy-400">{field.label}</label>
                  <input
                    type="number"
                    min={field.min}
                    max={field.max}
                    value={field.value}
                    onChange={e => field.setValue(Math.min(field.max, Math.max(field.min, parseInt(e.target.value) || field.min)))}
                    className="p-2.5 rounded-xl bg-navy-50 dark:bg-navy-900 border border-navy-100 dark:border-navy-800 text-center font-bold text-navy-900 dark:text-white focus:ring-2 focus:ring-gold-400 outline-none text-sm"
                  />
                </div>
              ))}
            </div>
            {fromPage > toPage && (
              <p className="text-xs text-red-500 font-bold">⚠️ صفحة البداية يجب أن تكون أصغر من أو تساوي صفحة النهاية</p>
            )}
            <div className="p-3 rounded-xl bg-navy-50 dark:bg-navy-900 border border-navy-100 dark:border-navy-800">
              <p className="text-xs text-navy-500 dark:text-navy-400 text-center">
                عدد الصفحات: <span className="font-bold text-navy-800 dark:text-white">{toArabicDigits(Math.max(0, toPage - fromPage + 1))}</span>
                &nbsp;· حوالي <span className="font-bold text-navy-800 dark:text-white">{toArabicDigits(Math.max(0, toPage - fromPage + 1) * 8)}</span> آية
              </p>
            </div>
          </motion.div>
        )}

        {/* AYAHS MODE */}
        {mode === 'ayahs' && (
          <motion.div
            key="ayahs"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-3"
          >
            {[
              { heading: 'من الآية', surah: fromSurah, setSurah: setFromSurah, ayah: fromAyah, setAyah: setFromAyah },
              { heading: 'إلى الآية', surah: toSurah, setSurah: setToSurah, ayah: toAyah, setAyah: setToAyah },
            ].map((row, ri) => (
              <div key={ri} className="p-3 rounded-xl bg-navy-50 dark:bg-navy-900 border border-navy-100 dark:border-navy-800 space-y-2">
                <p className="text-xs font-bold text-navy-600 dark:text-navy-400">{row.heading}</p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-navy-400 dark:text-navy-500 mb-1 block">السورة</label>
                    <select
                      value={row.surah}
                      onChange={e => { row.setSurah(parseInt(e.target.value)); row.setAyah(1); }}
                      className="w-full p-2 rounded-lg bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-700 text-sm text-navy-900 dark:text-white focus:ring-2 focus:ring-gold-400 outline-none font-quran"
                    >
                      {SURAH_NAMES_ARABIC.map((name, i) => (
                        <option key={i + 1} value={i + 1}>{i + 1}. {name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="text-[10px] text-navy-400 dark:text-navy-500 mb-1 block">رقم الآية</label>
                    <input
                      type="number"
                      min={1}
                      max={SURAH_AYAH_COUNTS[row.surah - 1]}
                      value={row.ayah}
                      onChange={e => row.setAyah(Math.min(SURAH_AYAH_COUNTS[row.surah - 1], Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-full p-2 rounded-lg bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-700 text-center font-bold text-sm text-navy-900 dark:text-white focus:ring-2 focus:ring-gold-400 outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Button */}
      <button
        onClick={handleConfirm}
        disabled={!canConfirm()}
        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-gold-400 to-amber-500 text-white font-bold text-sm shadow-lg shadow-gold-500/25 hover:shadow-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <BookOpen size={16} />
        التالي — اختر المرحلة
      </button>
    </div>
  );
};
