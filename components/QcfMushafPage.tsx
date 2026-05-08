
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
  /** Whether to show a bookmark underline for this ayah */
  isAyahMarked: (surahNum: number, ayahNum: number) => boolean;
  /** Whether dark mode is active */
  isDark: boolean;
  /** User font-size preference in px (18–44). QCF scales proportionally. */
  fontSize: number;
  /** Base URL for assets (required for sub-path GitHub Pages deployments) */
  baseUrl: string;
}

// ── Font State Cache ──────────────────────────────────────────────────────────

// Manage font loading state at module level to avoid re-renders causing flicker
const fontStateCache = new Map<number, 'loading' | 'ready' | 'error'>();

// ── Main Component ────────────────────────────────────────────────────────────

/**
 * QcfMushafPage
 *
 * Renders one page of the Holy Quran using authentic King Fahad Complex (QCF4)
 * per-page fonts. The visual output matches the printed Mushaf (طبعة مجمع الملك فهد).
 *
 * Layout: Line-by-line (each ayah on its own row), matching the reference app.
 *
 * Highlighting system mirrors the standard mode exactly:
 *   • Orange/gold   → selected ayah (modal open)
 *   • Emerald green → currently playing audio ayah
 *   • Amber flash   → search result ayah
 *   • Red underline → bookmarked ayah
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
}) => {
  // ── Font Loading ────────────────────────────────────────────────────────────
  const [fontState, setFontState] = React.useState<'loading' | 'ready' | 'error'>(() => {
    return fontStateCache.get(page) ?? 'loading';
  });

  React.useEffect(() => {
    const cached = fontStateCache.get(page);
    if (cached === 'ready') { setFontState('ready'); return; }
    if (cached === 'loading' || cached === undefined) {
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
    }
  }, [page]);

  // ── Derived Values ──────────────────────────────────────────────────────────

  const fontFamily = getQcfFontFamily(page);

  // Scale QCF font proportionally from the user's preference.
  // QCF fonts have larger visual weight → scale down slightly.
  const qcfFontSize = Math.max(18, Math.round(fontSize * 1.05));

  // ── Loading State ───────────────────────────────────────────────────────────

  if (fontState === 'loading') {
    return (
      <div
        className="w-full flex flex-col items-center justify-center py-20 gap-5"
        role="status"
        aria-label="جاري تحميل المصحف"
      >
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 border-[3px] border-gold-200 dark:border-navy-700 rounded-full" />
          <div className="absolute inset-0 border-[3px] border-t-gold-500 dark:border-t-gold-400 rounded-full animate-spin" />
          <span
            className="absolute inset-0 flex items-center justify-center text-gold-600 dark:text-gold-400 font-bold text-2xl"
            style={{ fontFamily: 'Scheherazade New, serif' }}
            aria-hidden="true"
          >
            ق
          </span>
        </div>
        <p className="text-sm text-navy-400 dark:text-navy-500 font-medium tracking-wide">
          جاري تحميل صفحة {toArabicDigits(page)}…
        </p>
      </div>
    );
  }

  // On error: return null → parent falls back to standard rendering
  if (fontState === 'error') return null;

  // ── Helper: compute all highlight states for one ayah ──────────────────────

  const getAyahHighlight = (ayah: Ayah, surahNum: number) => {
    const globalId = getGlobalAyahNumber(surahNum, ayah.numberInSurah);

    // 1. Audio: currently playing ayah → emerald
    const isAudioPlaying = !!(currentTrackGlobalId && currentTrackGlobalId === globalId);

    // 2. Search URL highlight → amber
    const isSearchHighlighted = !!(
      searchHighlight && searchHighlight === `${surahNum}:${ayah.numberInSurah}`
    );

    // 3. Selected (modal open) → gold
    const isSelected = !!(selectedAyah && selectedAyah.number === ayah.number);

    // 4. Bookmarked → red underline
    const isBookmarked = isAyahMarked(surahNum, ayah.numberInSurah);

    return { globalId, isAudioPlaying, isSearchHighlighted, isSelected, isBookmarked };
  };

  // ── Bismillah strip logic ──────────────────────────────────────────────────
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

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="qcf-mushaf-container w-full"
      dir="rtl"
      lang="ar"
    >
      {ayahs.map((ayah) => {
        const surah = (ayah as any).surah;
        const surahNum = surah?.number as number;
        const isFirstAyah = ayah.numberInSurah === 1;

        const {
          globalId,
          isAudioPlaying,
          isSearchHighlighted,
          isSelected,
          isBookmarked,
        } = getAyahHighlight(ayah, surahNum);

        // Strip Bismillah prefix for non-Fatiha, non-Tawba surahs
        let displayText = (ayah as any).aya_text || ayah.text || '';
        if (isFirstAyah && surahNum && surahNum !== 1 && surahNum !== 9) {
          displayText = stripBismillah(displayText);
        }

        // Build highlight class
        const highlightClass = isAudioPlaying
          ? 'bg-emerald-100/80 dark:bg-emerald-900/30 shadow-[0_0_0_2px_rgba(52,211,153,0.4)]'
          : isSearchHighlighted
            ? 'bg-amber-200/60 dark:bg-amber-800/30 animate-pulse'
            : isSelected
              ? 'bg-gold-100 dark:bg-gold-900/25 shadow-[0_0_0_1.5px_rgba(212,164,74,0.5)]'
              : '';

        return (
          <React.Fragment key={`${surahNum}-${ayah.numberInSurah}`}>

            {/* ── Surah Header (only for first ayah of each surah) ── */}
            {isFirstAyah && surah && (
              <div className="qcf-surah-header w-full flex flex-col items-center select-none mb-3 mt-2">

                {/* Banner + Name */}
                <div className="relative flex items-center justify-center w-full">
                  <img
                    src={`${baseUrl}svgs/surah_banner1.svg`}
                    alt={`إطار سورة ${surah.name}`}
                    className={`w-full max-w-[340px] sm:max-w-[420px] md:max-w-[480px] h-auto select-none
                      ${isDark ? 'brightness-110 drop-shadow-[0_0_12px_rgba(234,179,8,0.35)]' : 'drop-shadow-sm'}`}
                  />

                  {/* Surah Name SVG */}
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <img
                      src={`${baseUrl}svgs/surah_name/00${surahNum}.svg`}
                      alt={surah.name}
                      className={`h-[85%] w-auto max-w-[88%] object-contain
                        ${isDark ? 'svg-gold-filter' : 'svg-navy-filter'}`}
                    />
                  </div>

                  {/* ── Golden Play Button (identical position to standard mode) ── */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playFullSurah(surahNum, surah.name);
                    }}
                    className="absolute left-[12%] sm:left-[28%] md:left-[32%] z-20
                      flex items-center justify-center gap-1.5
                      px-2.5 py-1.5 sm:px-3
                      bg-gradient-to-br from-gold-400 to-gold-600
                      text-white rounded-full
                      shadow-md hover:shadow-lg hover:shadow-gold-500/30
                      hover:scale-105 active:scale-95
                      transition-all duration-200
                      border border-white/20 group"
                    title="تشغيل السورة كاملة"
                    aria-label={`تشغيل سورة ${surah.name}`}
                  >
                    <span className="text-[10px] font-bold hidden sm:inline opacity-0 group-hover:opacity-100 transition-opacity
                      overflow-hidden max-w-0 group-hover:max-w-[3rem] whitespace-nowrap">
                      استماع
                    </span>
                    <Play size={13} fill="currentColor" className="shrink-0" />
                  </button>
                </div>

                {/* Basmalah – skip for Al-Fatiha (1) and At-Tawbah (9) */}
                {surahNum !== 1 && surahNum !== 9 && (
                  <div className="flex justify-center mt-2 mb-1.5 opacity-90">
                    <img
                      src={`${baseUrl}svgs/besmAllah.svg`}
                      alt="بسم الله الرحمن الرحيم"
                      className={`h-7 sm:h-9 md:h-10 w-auto
                        ${isDark ? 'svg-gold-filter' : 'svg-navy-filter'}`}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ── Ayah Row (line-by-line layout, matches reference app) ── */}
            <div
              id={`ayah-${globalId}`}
              className={`
                qcf-ayah-row
                w-full flex items-center justify-end
                py-1 px-1 my-0.5
                rounded-lg
                cursor-pointer
                transition-all duration-250
                group
                ${highlightClass}
                ${isBookmarked ? 'underline decoration-red-400 decoration-2 underline-offset-8' : ''}
                hover:bg-gold-50/70 dark:hover:bg-gold-900/15
              `}
              onClick={(e) => { e.stopPropagation(); onAyahClick(ayah); }}
              role="button"
              aria-label={`آية ${ayah.numberInSurah} من سورة ${surah?.name || ''}`}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAyahClick(ayah); } }}
            >
              {/* Ayah Text */}
              <span
                className="qcf-ayah-text flex-1 text-right leading-relaxed"
                style={{
                  fontFamily: `"${fontFamily}", "Scheherazade New", "UthmanicHafs", serif`,
                  fontSize: `${qcfFontSize}px`,
                  lineHeight: 1.85,
                  direction: 'rtl',
                  color: isDark ? '#e8d5a3' : '#1a1208',
                }}
              >
                {displayText}
              </span>

              {/* Ayah Number Marker (Ornamental Rosette) */}
              <span
                className="qcf-ayah-marker shrink-0 inline-flex items-center justify-center
                  text-gold-600 dark:text-gold-400 select-none ms-2"
                style={{
                  width: `${qcfFontSize * 1.15}px`,
                  height: `${qcfFontSize * 1.15}px`,
                  position: 'relative',
                }}
                aria-label={`رقم الآية ${ayah.numberInSurah}`}
              >
                {/* Ornate circle SVG */}
                <svg
                  viewBox="0 0 40 40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  className="w-full h-full"
                  aria-hidden="true"
                >
                  <circle cx="20" cy="20" r="18.5" />
                  <circle cx="20" cy="20" r="14" opacity="0.55" />
                  <path d="M20 6.5 L20 10.5 M20 29.5 L20 33.5 M6.5 20 L10.5 20 M29.5 20 L33.5 20"
                    strokeWidth="1.8" opacity="0.5" />
                  <circle cx="12" cy="12" r="1" fill="currentColor" opacity="0.35" />
                  <circle cx="28" cy="12" r="1" fill="currentColor" opacity="0.35" />
                  <circle cx="12" cy="28" r="1" fill="currentColor" opacity="0.35" />
                  <circle cx="28" cy="28" r="1" fill="currentColor" opacity="0.35" />
                </svg>
                {/* Number */}
                <span
                  className="absolute inset-0 flex items-center justify-center"
                  style={{
                    fontSize: `${qcfFontSize * 0.44}px`,
                    fontFamily: '"AyahNumber", "Scheherazade New", serif',
                    color: 'currentColor',
                    paddingTop: '1px',
                  }}
                >
                  {toArabicDigits(ayah.numberInSurah)}
                </span>
              </span>
            </div>

            {/* Hidden accessible text for screen readers and copy-paste */}
            <span className="sr-only" aria-hidden="false">
              {ayah.text || displayText}
            </span>

          </React.Fragment>
        );
      })}
    </div>
  );
};

export default QcfMushafPage;
