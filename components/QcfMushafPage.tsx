
import React, { useEffect, useState, useCallback } from 'react';
import { Ayah } from '../types';
import { loadQcfFontForPage, preloadQcfFontsAround, getQcfFontFamily, isQcfFontLoaded } from '../services/qcfFontLoader';
import { toArabicDigits } from '../services/normalization';
import { getGlobalAyahNumber } from '../services/quranStaticData';

// ── QCF Data Types ──────────────────────────────────────────────────────────

/**
 * A single glyph unit rendered using QCF fonts.
 * We reconstruct this structure from the Uthmani text + page mapping.
 */
interface QcfPageLine {
  /** The encoded text string to render with QCF font */
  text: string;
  /** Whether this is a centered line (Fatiha, Basmalah, etc.) */
  isCentered?: boolean;
}

// ── Main Component ───────────────────────────────────────────────────────────

interface QcfMushafPageProps {
  /** Current page number (1-604) */
  page: number;
  /** Ayahs data (standard Uthmani text + metadata) from existing API */
  ayahs: Ayah[];
  /** Currently playing ayah for audio sync highlight */
  playingAyahGlobal: number | null;
  /** Highlighted ayah (from search) */
  highlightedAyah?: { surah: number; ayah: number } | null;
  /** Callback when an ayah is clicked */
  onAyahClick: (ayah: Ayah) => void;
  /** Whether dark mode is active */
  isDark: boolean;
  /** Font size multiplier (user preference, 0.8–1.4) */
  fontScale?: number;
}

/**
 * QcfMushafPage
 * 
 * Renders Quran text using authentic King Fahad Complex QCF4 fonts,
 * matching the exact printed Mushaf layout. Each page has a dedicated
 * font file that encodes its exact calligraphic rendering.
 * 
 * Architecture:
 * - Renders the Uthmani text but forces the QCF font family
 * - QCF fonts use Unicode PUA (Private Use Area) encoding
 * - We display the aya_text from API directly with the page-specific font
 * - Interaction (click/tap) still works per-ayah via span wrapping
 * - The plain Arabic text is stored invisibly for search/copy functionality
 */
export const QcfMushafPage: React.FC<QcfMushafPageProps> = ({
  page,
  ayahs,
  playingAyahGlobal,
  highlightedAyah,
  onAyahClick,
  isDark,
  fontScale = 1.0,
}) => {
  const [fontReady, setFontReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // ── Font Loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    setFontReady(false);
    setLoadError(false);

    // Immediately check if already loaded
    if (isQcfFontLoaded(page)) {
      setFontReady(true);
      preloadQcfFontsAround(page);
      return;
    }

    let cancelled = false;

    loadQcfFontForPage(page)
      .then(success => {
        if (cancelled) return;
        if (success) {
          setFontReady(true);
          preloadQcfFontsAround(page);
        } else {
          setLoadError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => { cancelled = true; };
  }, [page]);

  // ── Render Helpers ────────────────────────────────────────────────────────

  const fontFamily = getQcfFontFamily(page);

  /**
   * Adaptive base font size for QCF rendering.
   * QCF fonts have larger visual size than regular Arabic fonts,
   * so we scale down slightly from the user's preference.
   */
  const baseFontSize = Math.round(28 * fontScale); // px

  /**
   * Line height for QCF – needs more breathing room than standard Arabic.
   */
  const lineHeight = 2.2;

  // ── Loading State ─────────────────────────────────────────────────────────

  if (!fontReady && !loadError) {
    return (
      <div
        className="w-full flex flex-col items-center justify-center py-16 gap-4"
        role="status"
        aria-label="جاري تحميل المصحف"
      >
        {/* Animated Quran loading indicator */}
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-gold-200 dark:border-navy-700 rounded-full" />
          <div className="absolute inset-0 border-4 border-t-gold-500 dark:border-t-gold-400 rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-gold-600 dark:text-gold-400 text-xl font-bold" style={{ fontFamily: 'Scheherazade New, serif' }}>
              ق
            </span>
          </div>
        </div>
        <p className="text-sm text-navy-400 dark:text-navy-500 font-medium">
          جاري تحميل الصفحة {toArabicDigits(page)}...
        </p>
      </div>
    );
  }

  // ── Fallback to standard rendering if QCF fails ───────────────────────────

  if (loadError) {
    // Return null to let parent handle fallback rendering
    return null;
  }

  // ── Main QCF Render ───────────────────────────────────────────────────────

  return (
    <div
      className="qcf-mushaf-container w-full relative"
      dir="rtl"
      lang="ar"
    >
      {/* QCF Text Block */}
      <div
        className="qcf-text-block text-navy-950 dark:text-[#e8d5a3] w-full text-center leading-loose tracking-wide"
        style={{
          fontFamily: `"${fontFamily}", "Scheherazade New", "UthmanicHafs", serif`,
          fontSize: `${baseFontSize}px`,
          lineHeight: lineHeight,
          textAlign: 'justify',
          textAlignLast: 'center',
          direction: 'rtl',
          wordSpacing: '0.05em',
        }}
      >
        {ayahs.map((ayah) => {
          const surah = (ayah as any).surah;
          const globalId = getGlobalAyahNumber(surah?.number, ayah.numberInSurah);
          const isFirstAyah = ayah.numberInSurah === 1;
          const isPlaying = playingAyahGlobal === globalId;
          const isHighlighted =
            highlightedAyah?.surah === surah?.number &&
            highlightedAyah?.ayah === ayah.numberInSurah;

          // Text to display – prefer aya_text (Uthmani with QCF encoding)
          const displayText = (ayah as any).aya_text || ayah.text || '';

          return (
            <React.Fragment key={ayah.number}>
              {/* Surah Header Block */}
              {isFirstAyah && surah && (
                <div className="qcf-surah-header w-full flex flex-col items-center my-3 select-none">
                  {/* Surah Banner Image */}
                  <div className="relative flex items-center justify-center w-full mb-1">
                    <img
                      src={`${import.meta.env.BASE_URL}svgs/surah_banner1.svg`}
                      alt={`سورة ${surah.name}`}
                      className={`w-full max-w-[320px] md:max-w-[420px] lg:max-w-[480px] h-auto opacity-90
                        ${isDark ? 'brightness-110 drop-shadow-[0_0_10px_rgba(234,179,8,0.4)]' : 'drop-shadow-sm'}`}
                    />
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                      <img
                        src={`${import.meta.env.BASE_URL}svgs/surah_name/00${surah.number}.svg`}
                        alt={surah.name}
                        className={`h-[85%] w-auto max-w-[90%] object-contain
                          ${isDark ? 'svg-gold-filter' : 'svg-navy-filter'}`}
                      />
                    </div>
                  </div>

                  {/* Basmalah – for surahs other than Al-Fatiha (1) and At-Tawbah (9) */}
                  {surah.number !== 1 && surah.number !== 9 && (
                    <div className="flex justify-center mt-1 mb-2 opacity-90">
                      <img
                        src={`${import.meta.env.BASE_URL}svgs/besmAllah.svg`}
                        alt="بسم الله الرحمن الرحيم"
                        className={`h-8 md:h-10 w-auto ${isDark ? 'svg-gold-filter' : 'svg-navy-filter'}`}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Ayah Text Span – interactive, with audio/search highlighting */}
              <span
                id={`ayah-${globalId}`}
                onClick={(e) => { e.stopPropagation(); onAyahClick(ayah); }}
                className={`
                  qcf-ayah-span relative cursor-pointer rounded-sm transition-all duration-300
                  hover:bg-gold-100/60 dark:hover:bg-gold-900/20
                  ${isPlaying
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 shadow-[0_0_0_2px_rgba(52,211,153,0.4)]'
                    : ''}
                  ${isHighlighted
                    ? 'bg-amber-200/60 dark:bg-amber-900/30 animate-pulse'
                    : ''}
                `}
                style={{
                  padding: '0 1px',
                  fontFamily: `"${fontFamily}", "Scheherazade New", serif`,
                }}
                title={`آية ${toArabicDigits(ayah.numberInSurah)}`}
                aria-label={`آية ${ayah.numberInSurah} من سورة ${surah?.name || ''}`}
              >
                {displayText}
              </span>

              {/* Ayah Number Marker (ornamental rosette) */}
              <span
                className="qcf-ayah-marker inline-flex items-center justify-center align-middle select-none text-gold-600 dark:text-gold-400"
                style={{
                  width: `${baseFontSize * 1.1}px`,
                  height: `${baseFontSize * 1.1}px`,
                  fontSize: `${baseFontSize * 0.48}px`,
                  verticalAlign: 'middle',
                  position: 'relative',
                  margin: '0 2px',
                }}
                aria-label={`رقم الآية ${ayah.numberInSurah}`}
              >
                <svg
                  viewBox="0 0 40 40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  className="w-full h-full drop-shadow-sm"
                >
                  {/* Outer circle */}
                  <circle cx="20" cy="20" r="18.5" />
                  {/* Inner decorative circle */}
                  <circle cx="20" cy="20" r="14" opacity="0.5" />
                  {/* Cross markers at cardinal points */}
                  <path d="M20 6L20 10 M20 30L20 34 M6 20L10 20 M30 20L34 20" strokeWidth="1.8" opacity="0.5" />
                  {/* Diagonal dots for extra ornament */}
                  <circle cx="11.5" cy="11.5" r="1" fill="currentColor" opacity="0.3" />
                  <circle cx="28.5" cy="11.5" r="1" fill="currentColor" opacity="0.3" />
                  <circle cx="11.5" cy="28.5" r="1" fill="currentColor" opacity="0.3" />
                  <circle cx="28.5" cy="28.5" r="1" fill="currentColor" opacity="0.3" />
                </svg>
                <span
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ paddingTop: '2px', fontSize: '1.35em', fontFamily: 'inherit' }}
                >
                  {toArabicDigits(ayah.numberInSurah)}
                </span>
              </span>

              {/* Invisible accessible text for copy/search (hidden from visual render) */}
              <span
                className="sr-only"
                aria-hidden="false"
              >
                {ayah.text || displayText}
              </span>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default QcfMushafPage;
