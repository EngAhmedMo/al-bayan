
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

