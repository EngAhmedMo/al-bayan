
export interface Muazzin {
  id: string;
  name: string;
  url: string;
  style: 'egyptian' | 'algerian' | 'saudi';
}

/**
 * مصادر الأذان المصري المعتمدة (توصية البحث 2025)
 * الروابط تدعم الـ CORS والـ Streaming العالي الجودة
 */
export const MUAZZINS: Muazzin[] = [
  {
    id: 'random',
    name: '🔀 مؤذن عشوائي (آلي)',
    url: '', // Will be handled dynamically
    style: 'egyptian'
  },
  {
    id: 'egy_refat',
    name: 'الشيخ محمد رفعت',
    url: '/audio/egy_refat.mp3',
    style: 'egyptian'
  },
  {
    id: 'egy_abdulbasit',
    name: 'الشيخ عبد الباسط عبد الصمد',
    url: '/audio/egy_abdulbasit.mp3',
    style: 'egyptian'
  },
  {
    id: 'egy_minshawi',
    name: 'الشيخ محمد صديق المنشاوي',
    url: '/audio/egy_minshawi.mp3',
    style: 'egyptian'
  },
  {
    id: 'egy_mustafa',
    name: 'الشيخ مصطفى إسماعيل',
    url: '/audio/egy_mustafa.mp3',
    style: 'egyptian'
  },
  {
    id: 'egy_husary',
    name: 'الشيخ محمود خليل الحصري',
    url: '/audio/egy_husary.mp3',
    style: 'egyptian'
  },
  {
    id: 'egy_ali_mahmoud',
    name: 'الشيخ علي محمود',
    url: '/audio/egy_ali_mahmoud.mp3',
    style: 'egyptian'
  },
  {
    id: 'egy_toubar',
    name: 'الشيخ نصر الدين طوبار',
    url: '/audio/egy_toubar.mp3',
    style: 'egyptian'
  },
  {
    id: 'egy_fashni',
    name: 'الشيخ طه الفشني',
    url: '/audio/egy_fashni.mp3',
    style: 'egyptian'
  },
  {
    id: 'egy_naqshbandi',
    name: 'الشيخ سيد النقشبندي',
    url: '/audio/egy_naqshbandi.mp3',
    style: 'egyptian'
  },
  {
    id: 'egy_bahtimi',
    name: 'الشيخ كامل يوسف البهتيمي',
    url: '/audio/egy_bahtimi.mp3',
    style: 'egyptian'
  },
  {
    id: 'other_rabeh',
    name: 'الشيخ رابح بن دراح',
    url: '/audio/other_rabeh.mp3',
    style: 'algerian'
  },
  {
    id: 'egy_ibrahim_gabr',
    name: 'الشيخ إبراهيم جبر',
    url: '/audio/egy_ibrahim_gabr.mp3',
    style: 'egyptian'
  },
  {
    id: 'ksa_suraihi',
    name: 'الشيخ عبد المجيد السريحي',
    url: '/audio/ksa_suraihi.mp3',
    style: 'saudi'
  }
];

export const getAzhanUrl = (id: string): string | null => {
  const muazzin = MUAZZINS.find(m => m.id === id);

  if (muazzin && muazzin.url) {
    return muazzin.url;
  }

  // ❌ NO FALLBACK - return null for explicit error handling
  // Callers must handle null (missing muazzin) appropriately
  return null;
};

/**
 * List of bundled Azhan IDs (available in res/raw)
 * These files are guaranteed to exist in the APK
 */
export const BUNDLED_AZHAN_IDS = [
  'egy_abdulbasit', 'egy_refat', 'egy_minshawi', 'egy_husary', 'egy_mustafa',
  'egy_ali_mahmoud', 'egy_toubar', 'egy_fashni', 'egy_naqshbandi',
  'egy_bahtimi', 'other_rabeh', 'egy_ibrahim_gabr', 'ksa_suraihi'
];

/**
 * Check if an ID is a bundled (guaranteed available) muazzin
 */
export const isBundledMuazzin = (id: string): boolean => {
  return BUNDLED_AZHAN_IDS.includes(id);
};

// Import for custom muazzins integration
import { getCustomMuazzins, CustomMuazzin } from './storage';

/**
 * Get all muazzins including custom user-uploaded ones
 * Custom muazzins appear after bundled ones, before the end
 */
export const getAllMuazzins = (): Muazzin[] => {
  const customMuazzins = getCustomMuazzins();

  if (customMuazzins.length === 0) {
    return MUAZZINS;
  }

  // Convert CustomMuazzin to Muazzin format
  const customAsMuazzins: Muazzin[] = customMuazzins.map(cm => ({
    id: cm.id,
    name: `🎙️ ${cm.displayName}`,
    url: '', // Custom files have no URL, they use file:// paths
    style: 'egyptian' as const // Default style for custom
  }));

  // Insert custom muazzins after bundled ones (keep 'random' at top)
  return [...MUAZZINS, ...customAsMuazzins];
};

/**
 * Check if a muazzin ID is a custom (user-uploaded) one
 */
export const isCustomMuazzin = (id: string): boolean => {
  return id.startsWith('custom_');
};
