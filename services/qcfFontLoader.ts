
/**
 * QCF Font Loader Service
 * Dynamically loads King Fahad Complex QCF4 fonts per Quran page.
 * - Lazy loading: only loads fonts for the current page (+ neighbors for smooth navigation)
 * - Caching: loaded fonts are tracked to avoid duplicate loading
 * - Offline: once cached by browser/service worker, fonts work without internet
 */

const BASE_URL = import.meta.env.BASE_URL || '/';
const QCF_FONTS_PATH = `${BASE_URL}fonts/qcf_v1/`;

// Track which fonts have been successfully loaded
const loadedFonts = new Set<number>();
const loadingFonts = new Set<number>();

/**
 * Load the QCF font for a specific Mushaf page number (1-604).
 * Uses FontFace API for dynamic injection without touching CSS files.
 */
export const loadQcfFontForPage = async (pageNum: number): Promise<boolean> => {
  // WE NO LONGER LOAD PAGE-SPECIFIC FONTS!
  // This bypasses the heavy 604 font downloads and eliminates PUA encoding issues.
  // We use the unified UthmanicHafs_V20.ttf font for all pages, which is loaded via CSS.
  return true;
};

/**
 * Preload fonts for the current page and its neighbors.
 * Ensures smooth page transitions with no font flash.
 */
export const preloadQcfFontsAround = (pageNum: number): void => {
  // No-op since we use the unified UthmanicHafs font
};

/**
 * Returns the CSS font-family name for a given page.
 * Used inline in style props.
 */
export const getQcfFontFamily = (pageNum: number): string => {
  return '"UthmanicHafs", serif';
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
