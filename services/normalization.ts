
/**
 * Normalizes Arabic text for consistent and fuzzy search.
 * Rules:
 * 1. Remove Tashkeel (Diacritics) & Quranic symbols.
 * 2. Unify Alef (أ، إ، آ، ٱ -> ا).
 * 3. Unify Ya (ى -> ي).
 * 4. Unify Taa Marbuta (ة -> ه).
 * 5. Remove Tatweel (ـ).
 */
export const normalizeArabic = (text: string): string => {
  if (!text) return '';

  let normalized = text;

  // Remove Tashkeel and Quranic Marks (064B-065F, 0670, 06D6-06ED)
  normalized = normalized.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');

  // Unify Alef (including Alef Wasl ٱ)
  normalized = normalized.replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627');

  // Unify Ya (Alif Maqsura to Ya)
  normalized = normalized.replace(/\u0649/g, '\u064A');

  // Unify Taa Marbuta to Ha (Critical for fuzzy search: مكة = مكه)
  normalized = normalized.replace(/\u0629/g, '\u0647');

  // Remove Tatweel (Kashida)
  normalized = normalized.replace(/\u0640/g, '');

  return normalized.trim();
};

/**
 * Removes "Al-" (The) prefix from Arabic words to improve search matching.
 * e.g., "الجنة" -> "جنة", "والناس" -> "ناس"
 */
export const stripDiacriticsAndPrefixes = (text: string): string => {
  let normalized = normalizeArabic(text);

  // Remove "Al-" (ال) at the start of the word
  if (normalized.startsWith('ال')) {
    normalized = normalized.substring(2);
  }
  // Remove "Wal-" (وال)
  else if (normalized.startsWith('وال')) {
    normalized = normalized.substring(3);
  }
  // Remove "Fal-" (فال)
  else if (normalized.startsWith('فال')) {
    normalized = normalized.substring(3);
  }
  // Remove "Lil-" (لل)
  else if (normalized.startsWith('لل')) {
    normalized = normalized.substring(2);
  }

  return normalized;
};

export const toArabicDigits = (n: number | string): string => {
  return n.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
};

export const cleanTajweedTags = (text: string): string => {
  if (!text) return '';

  // 1. Fix the "Extra Alif" data issue first
  let clean = text.replace(/\u0672/g, '\u0670');

  // 2. Remove all Tajweed tags [x[...]]
  // Logic: The tags wrap content. We want to KEEP the content but REMOVE the wrapper.
  let previous = '';
  while (clean !== previous) {
    previous = clean;
    clean = clean.replace(/\[[a-z]+(?::\d+)?\[([^\]]*)\]/g, '$1');
  }

  // Final cleanup of formatting chars if any remain
  clean = clean.replace(/[\[\]]/g, '');

  return clean;
};

/**
 * Cleans Quran text from metadata codes (e.g., [h:24], [s]).
 * Used for displaying plain Arabic text in tests.
 */
export const cleanQuranText = (text: string): string => {
  if (!text) return '';
  // Remove content in square brackets (metadata)
  let cleaned = text.replace(/\[[^\]]*\]/g, '');
  // Remove any remaining English letters (just in case)
  cleaned = cleaned.replace(/[a-zA-Z]/g, '');
  // Remove extra spaces
  return cleaned.replace(/\s+/g, ' ').trim();
};

/**
 * Cleans Quran text for display by stripping silent vowel marks (U+06DF, U+06E0)
 * and placeholder dotted circles (U+25CC) that cause rendering glitches in browsers.
 */
export const cleanQuranTextForDisplay = (text: string): string => {
  if (!text) return '';
  return text.replace(/[\u06DF\u06E0\u25CC]/g, '');
};

/**
 * Restores diacritics for the word 'Allah' to ensure proper visual layout
 * in specific fonts.
 */
export const restoreAllahDiacritics = (text: string): string => {
  if (!text) return '';
  return text
    // 1. First, protect/convert standard Allah (الله) forms
    .replace(/الل[ََّٰ]*ه[ُ]/g, '\x00RAF\x00')
    .replace(/الل[ََّٰ]*ه[ِ]/g, '\x00JAR\x00')
    .replace(/الل[ََّٰ]*ه[َ]/g, '\x00NAS\x00')
    .replace(/الل[ََّٰ]*ه(?![\u064B-\u065F])/g, '\x00RAF\x00') // default to damma
    
    // 2. Next, protect or convert لله (lillah) forms
    .replace(/لِلَّهِ/g, '\x00LIL\x00')
    .replace(/للّهِ/g, '\x00LIL\x00')
    .replace(/للهِ/g, '\x00LIL\x00')
    .replace(/لله/g, '\x00LIL\x00')
    .replace(/للّه/g, '\x00LIL\x00')
    
    // 3. Restore the tokens to their perfect Unicode representations with shadda + dagger alif (no redundant fatha to prevent rendering glitches)
    .replace(/\x00RAF\x00/g, 'اللّٰهُ')
    .replace(/\x00JAR\x00/g, 'اللّٰهِ')
    .replace(/\x00NAS\x00/g, 'اللّٰهَ')
    .replace(/\x00LIL\x00/g, 'لِلّٰهِ');
};

/**
 * Cleans Adhkar/Dhikr text from special/malformed unicode characters, dotted circles,
 * brackets, and extraneous marks.
 */
export const cleanDhikrText = (text: string): string => {
  if (!text) return '';
  const cleaned = text
    .replace(/[\u06DF\u06E0\u25CC]/g, '')   // Quranic silent marks and dotted circles
    .replace(/[{}]/g,              '')   // curly brackets
    .replace(/[﴿﴾]/g,             '')   // Quran brackets
    .replace(/[\u0660-\u0669]/g,   '')   // Arabic-Indic digits
    .replace(/[١٢٣٤٥٦٧٨٩٠]/g,    '')   // Eastern-Arabic numerals
    .replace(/\[\d+\]/g,           '')   // [1] footnotes
    .replace(/\(\d+\)/g,           '')   // (1) footnotes
    .replace(/\s*\*\s*/g,          ' ')  // asterisks
    .replace(/\s+/g,               ' ')  // collapse whitespace
    .trim();
  return restoreAllahDiacritics(cleaned);
};


