
/**
 * QCF Font Loader Service
 * Dynamically loads King Fahad Complex QCF4 fonts per Quran page.
 * - Lazy loading: only loads fonts for the current page (+ neighbors for smooth navigation)
 * - Caching: loaded fonts are tracked to avoid duplicate loading
 * - Offline: once cached by browser/service worker, fonts work without internet
 */

const BASE_URL = import.meta.env.BASE_URL || '/';
const QCF_FONTS_PATH = `${BASE_URL}fonts/qcf/`;

// Track which fonts have been successfully loaded
const loadedFonts = new Set<number>();
const loadingFonts = new Set<number>();

/**
 * Load the QCF4 font for a specific Mushaf page number (1-604).
 * Uses FontFace API for dynamic injection without touching CSS files.
 */
export const loadQcfFontForPage = async (pageNum: number): Promise<boolean> => {
  if (pageNum < 1 || pageNum > 604) return false;
  if (loadedFonts.has(pageNum)) return true;
  if (loadingFonts.has(pageNum)) return false; // Already in progress

  loadingFonts.add(pageNum);

  try {
    const fontName = `QCF4${String(pageNum).padStart(3, '0')}`;
    const fontUrl = `${QCF_FONTS_PATH}QCF4${String(pageNum).padStart(3, '0')}_X-Regular.ttf?v=4`;

    // Check if font already exists in document
    const existing = document.fonts.check(`12px "${fontName}"`);
    if (existing) {
      loadedFonts.add(pageNum);
      loadingFonts.delete(pageNum);
      return true;
    }

    const fontFace = new FontFace(fontName, `url("${fontUrl}") format('truetype')`);
    await fontFace.load();
    document.fonts.add(fontFace);

    loadedFonts.add(pageNum);
    loadingFonts.delete(pageNum);
    return true;
  } catch (err) {
    loadingFonts.delete(pageNum);
    // Silently fail - will fall back to standard Uthmani font
    return false;
  }
};

/**
 * Preload fonts for the current page and its neighbors.
 * Ensures smooth page transitions with no font flash.
 */
export const preloadQcfFontsAround = (pageNum: number): void => {
  const pagesToLoad = [pageNum, pageNum - 1, pageNum + 1, pageNum + 2].filter(
    p => p >= 1 && p <= 604
  );
  pagesToLoad.forEach(p => {
    if (!loadedFonts.has(p) && !loadingFonts.has(p)) {
      loadQcfFontForPage(p); // Fire and forget
    }
  });
};

/**
 * Returns the CSS font-family name for a given page.
 * Used inline in style props.
 */
export const getQcfFontFamily = (pageNum: number): string => {
  return `QCF4${String(pageNum).padStart(3, '0')}`;
};

/**
 * Check if a page's font is ready to use.
 */
export const isQcfFontLoaded = (pageNum: number): boolean => {
  return loadedFonts.has(pageNum);
};

/**
 * Clear all loaded font tracking (useful for memory management on low-end devices).
 * Does NOT remove fonts from document - browser handles that.
 */
export const clearFontCache = (): void => {
  loadedFonts.clear();
  loadingFonts.clear();
};
