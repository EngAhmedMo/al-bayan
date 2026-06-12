
import React from 'react';
import { Ayah } from '../types';
import { loadQcfFontForPage, preloadQcfFontsAround, getQcfFontFamily, isQcfFontLoaded } from '../services/qcfFontLoader';
import { toArabicDigits } from '../services/normalization';
import { getGlobalAyahNumber } from '../services/quranStaticData';
import { Play } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface QcfMushafPageProps {
  /** Current Mushaf page number (1–604) */
  page: number;
  /** Ayahs on this page from the offline cache / API */
  ayahs: Ayah[];
  /** Global ayah number of the currently playing audio track */
  currentTrackGlobalId?: number | null;
  /** The ayah the user has selected (modal open) */
  selectedAyah?: Ayah | null;
  /** Search-highlight param from URL in "surah:ayah" format */
  searchHighlight?: string | null;
  /** Callback when user taps/clicks an ayah */
  onAyahClick: (ayah: Ayah) => void;
  /** Callback for the golden "play" button on each surah header */
  playFullSurah: (surahNum: number, surahName: string) => void;
  /** Whether to show a bookmark indicator for this ayah */
  isAyahMarked: (surahNum: number, ayahNum: number) => boolean;
  /** Whether dark mode is active */
  isDark: boolean;
  /** User font-size preference in px (18–44). */
  fontSize: number;
  /** Base URL for assets (required for sub-path GitHub Pages deployments) */
  baseUrl: string;
  /** Callback to check if an ayah is part of today's memorization wird */
  isAyahInWird?: (globalId: number) => boolean;
}

// ── Font State Cache (module level — survives re-renders) ─────────────────

const fontStateCache = new Map<number, 'loading' | 'ready' | 'error'>();

// ── QCF Text Validation ──────────────────────────────────────────────────────
/**
 * Validates that the QCF text actually contains Private Use Area (PUA) characters
 * that the QCF4 font can render. If the text only contains standard Arabic or
 * garbage characters, we should fall back to the standard Uthmani text.
 * 
 * QCF4 fonts use Unicode PUA ranges:
 *   - U+FB50–U+FDFF (Arabic Presentation Forms-A)  
 *   - U+FE70–U+FEFF (Arabic Presentation Forms-B)
 *   - U+E000–U+F8FF (Private Use Area)
 * 
 * The qcf_ayahs.json data uses characters like ﱁﱂﱃ which are in the
 * Arabic Presentation Forms range (U+FC41+). These ONLY render correctly
 * when the corresponding QCF4 page font is loaded.
 */
const isValidQcfText = (text: string | undefined | null): boolean => {
  if (!text || text.length === 0) return false;
  
  // Check if text contains characters in the Arabic Presentation Forms or PUA ranges
  // These are the codepoints that QCF4 fonts map their glyphs to
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // Arabic Presentation Forms-A: U+FB50–U+FDFF
    // Arabic Presentation Forms-B: U+FE70–U+FEFF  
    // Private Use Area: U+E000–U+F8FF
    if ((code >= 0xFB50 && code <= 0xFDFF) ||
         (code >= 0xFE70 && code <= 0xFEFF) ||
         (code >= 0xE000 && code <= 0xF8FF)) {
      return true;
    }
  }
  return false;
};

// ── Main Component ────────────────────────────────────────────────────────
/**
 * QcfMushafPage — Print-faithful Mushaf renderer.
 *
 * Architecture matches the reference app (مكتبة الحكمة / quran_library):
 *   • ALL ayahs rendered as INLINE <span>s inside a SINGLE flowing container
 *   • text-align: justify  →  reproduces the Mushaf's justified line layout
 *   • Ayah numbers rendered using the "AyahNumber" font (Uthmanic_NeoCOLORD)
 *     which draws ornamental rosettes around Arabic numerals automatically
 *   • line-height: 2.0 (matching the printed Mushaf's line spacing)
 *
 * Highlighting (4 states, identical to standard mode):
 *   • Emerald  → currently playing audio ayah
 *   • Amber    → search result ayah
 *   • Gold     → user-selected ayah (modal)
 *   • Red line → bookmarked ayah
 */
export const QcfMushafPage: React.FC<QcfMushafPageProps> = ({
  page,
  ayahs,
  currentTrackGlobalId,
  selectedAyah,
  searchHighlight,
  onAyahClick,
  playFullSurah,
  isAyahMarked,
  isDark,
  fontSize,
  baseUrl,
  isAyahInWird,
}) => {
  // ── Font Loading ────────────────────────────────────────────────────────
  const [fontState, setFontState] = React.useState<'loading' | 'ready' | 'error'>(() => {
    return fontStateCache.get(page) ?? 'loading';
  });

  React.useEffect(() => {
    const cached = fontStateCache.get(page);
    if (cached === 'ready') { setFontState('ready'); return; }

    setFontState('loading');
    fontStateCache.set(page, 'loading');
    let cancelled = false;

    if (isQcfFontLoaded(page)) {
      fontStateCache.set(page, 'ready');
      setFontState('ready');
      preloadQcfFontsAround(page);
      return;
    }

    loadQcfFontForPage(page).then(ok => {
      if (cancelled) return;
      const state = ok ? 'ready' : 'error';
      fontStateCache.set(page, state);
      setFontState(state);
      if (ok) preloadQcfFontsAround(page);
    });

    return () => { cancelled = true; };
  }, [page]);

  // ── Derived ─────────────────────────────────────────────────────────────

  const fontFamily = getQcfFontFamily(page);
  // QCF fonts have larger visual weight — scale proportionally
  const qcfFontSize = Math.max(18, Math.round(fontSize * 1.08));
  // Ayah number marker size — proportional but dampened for large font sizes
  const markerFontSize = Math.max(14, Math.round(qcfFontSize * 0.72));

  // ── Loading Spinner ─────────────────────────────────────────────────────

  if (fontState === 'loading') {
    return (
      <div className="w-full flex flex-col items-center justify-center py-20 gap-5" role="status" aria-label="جاري تحميل المصحف">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 border-[3px] border-gold-200 dark:border-navy-700 rounded-full" />
          <div className="absolute inset-0 border-[3px] border-t-gold-500 dark:border-t-gold-400 rounded-full animate-spin" />
          <span className="absolute inset-0 flex items-center justify-center text-gold-600 dark:text-gold-400 font-bold text-2xl" style={{ fontFamily: 'Scheherazade New, serif' }} aria-hidden="true">ق</span>
        </div>
        <p className="text-sm text-navy-400 dark:text-navy-500 font-medium">جاري تحميل صفحة {toArabicDigits(page)}…</p>
      </div>
    );
  }

  if (fontState === 'error') return null;

  // ── Helpers ─────────────────────────────────────────────────────────────

  const getHighlightClasses = (ayah: Ayah, surahNum: number): string => {
    const globalId = getGlobalAyahNumber(surahNum, ayah.numberInSurah);
    const classes: string[] = [];

    // Layer 1: Hifz Wird highlight (background layer)
    if (isAyahInWird && isAyahInWird(globalId)) {
      classes.push('qcf-highlight-hifz');
    }

    // Layer 2: Audio highlight (overrides/comes on top of wird background, but keeps bottom border via combo CSS)
    if (currentTrackGlobalId && currentTrackGlobalId === globalId) {
      classes.push('qcf-highlight-audio');
    }
    // Layer 3: Search result (amber pulse)
    else if (searchHighlight && searchHighlight === `${surahNum}:${ayah.numberInSurah}`) {
      classes.push('qcf-highlight-search');
    }
    // Layer 4: Selected ayah (gold)
    else if (selectedAyah && selectedAyah.number === ayah.number) {
      classes.push('qcf-highlight-selected');
    }

    return classes.join(' ');
  };

  /** Strip Bismillah prefix from first ayah text (non-Fatiha, non-Tawba) */
  const stripBismillah = (text: string): string => {
    const patterns = [
      /^[\s\u0600-\u06FF\u0670\u0671]*بِسْمِ[\s\u0600-\u06FF\u0670\u0671]*ٱللَّهِ[\s\u0600-\u06FF\u0670\u0671]*ٱلرَّحْمَٰنِ[\s\u0600-\u06FF\u0670\u0671]*ٱلرَّحِيمِ[\s\u0600-\u06FF\u0670\u0671]*/,
      /^بسم الله الرحمن الرحيم\s*/,
    ];
    for (const p of patterns) {
      const stripped = text.replace(p, '').trim();
      if (stripped !== text.trim()) return stripped;
    }
    return text;
  };

  // ── Build content fragments ─────────────────────────────────────────────
  // We render everything into a SINGLE container: surah headers inline-block, ayah text inline.

  const fragments: React.ReactNode[] = [];

  ayahs.forEach((ayah) => {
    const surah = (ayah as any).surah;
    const surahNum = surah?.number as number;
    const isFirstAyah = ayah.numberInSurah === 1;
    const globalId = getGlobalAyahNumber(surahNum, ayah.numberInSurah);
    const highlightClass = getHighlightClasses(ayah, surahNum);
    const isBookmarked = isAyahMarked(surahNum, ayah.numberInSurah);

    // ── TEXT SELECTION LOGIC ──
    // Priority: QCF PUA text (for QCF4 font rendering) → Uthmani text → emlaey fallback
    // ── TEXT SELECTION LOGIC ──
    // We now use standard Uthmani Unicode text with UthmanicHafs_V20.ttf
    // This perfectly matches the Al-Hikmah text rendering style and eliminates all PUA encoding issues.
    
    let fallbackText = (ayah as any).aya_text || ayah.text || '';
    
    // Strip Bismillah from first ayah of surahs (except Fatiha and Tawba)
    if (isFirstAyah && surahNum && surahNum !== 1 && surahNum !== 9) {
      fallbackText = stripBismillah(fallbackText);
    }
    
    const initialText = fallbackText.trim();
    const lastChar = toArabicDigits(ayah.numberInSurah);

    // ── Surah Header (block-level, full width, breaks the flow) ──
    if (isFirstAyah && surah) {
      fragments.push(
        <div key={`header-${surahNum}`} className="qcf-surah-header w-full flex flex-col items-center select-none my-3">
          {/* Banner + Name */}
          <div className="relative flex items-center justify-center w-full">
            <img
              src={`${baseUrl}svgs/surah_banner1.svg`}
              alt={`إطار سورة ${surah.name}`}
              className={`w-full max-w-[340px] sm:max-w-[420px] md:max-w-[480px] h-auto select-none ${isDark ? 'brightness-110 drop-shadow-[0_0_12px_rgba(234,179,8,0.35)]' : 'drop-shadow-sm'}`}
            />
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <img
                src={`${baseUrl}svgs/surah_name/00${surahNum}.svg`}
                alt={surah.name}
                className={`h-[85%] w-auto max-w-[88%] object-contain ${isDark ? 'svg-gold-filter' : 'svg-navy-filter'}`}
              />
            </div>
            {/* Golden Play Button */}
            <button
              onClick={(e) => { e.stopPropagation(); playFullSurah(surahNum, surah.name); }}
              className="absolute left-[12%] sm:left-[28%] md:left-[32%] z-20 flex items-center justify-center gap-1.5 px-2.5 py-1.5 sm:px-3 bg-gradient-to-br from-gold-400 to-gold-600 text-white rounded-full shadow-md hover:shadow-lg hover:shadow-gold-500/30 hover:scale-105 active:scale-95 transition-all duration-200 border border-white/20 group"
              title="تشغيل السورة كاملة"
              aria-label={`تشغيل سورة ${surah.name}`}
            >
              <span className="text-[10px] font-bold hidden sm:inline opacity-0 group-hover:opacity-100 transition-opacity overflow-hidden max-w-0 group-hover:max-w-[3rem] whitespace-nowrap">استماع</span>
              <Play size={13} fill="currentColor" className="shrink-0" />
            </button>
          </div>

          {/* Basmalah (skip Fatiha=1 and Tawba=9) */}
          {surahNum !== 1 && surahNum !== 9 && (
            <div className="flex justify-center mt-2 mb-1 opacity-90">
              <img
                src={`${baseUrl}svgs/besmAllah.svg`}
                alt="بسم الله الرحمن الرحيم"
                className={`h-7 sm:h-9 md:h-10 w-auto ${isDark ? 'svg-gold-filter' : 'svg-navy-filter'}`}
              />
            </div>
          )}
        </div>
      );
    }

    // ── Ayah Text (INLINE span) ──
    fragments.push(
      <span
        key={`ayah-${globalId}`}
        id={`ayah-${globalId}`}
        className={`qcf-ayah-span ${highlightClass} ${isBookmarked ? 'qcf-bookmarked' : ''}`}
        onClick={(e) => { e.stopPropagation(); onAyahClick(ayah); }}
        role="button"
        tabIndex={0}
        aria-label={`آية ${ayah.numberInSurah} من سورة ${surah?.name || ''}`}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAyahClick(ayah); } }}
        style={{
          fontFamily: '"UthmanicHafs", "Scheherazade New", serif',
        }}
      >
        {initialText}
        {/* ── Ayah Number Marker ── */}
        <span
          className="qcf-ayah-number"
          style={{
            fontFamily: '"AyahNumber", serif',
            fontSize: `${markerFontSize}px`,
            color: isDark ? '#d4a44a' : '#c49838',
          }}
          aria-hidden="true"
        >
          {` ${lastChar} `}
        </span>
      </span>
    );
  });

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="qcf-mushaf-container" dir="rtl" lang="ar">
      <div
        className="qcf-text-block"
        style={{
          fontFamily: `"${fontFamily}", "Scheherazade New", "UthmanicHafs", serif`,
          fontSize: `${qcfFontSize}px`,
          color: isDark ? '#e8d5a3' : '#1a1208',
        }}
      >
        {fragments}
      </div>
    </div>
  );
};

export default QcfMushafPage;
