
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { SURAH_AYAH_COUNTS } from './quranStaticData';
import { getAudioUrl } from './api';
import { getAzhanUrl, MUAZZINS } from './azhanData';

const CACHE_NAME = 'quran-audio-v1';
const AZHAN_CACHE_NAME = 'azhan-audio-v1';
const NATIVE_DIR = Directory.Data; // /data/user/0/com.albayan.quran/files/

// Helper to determine storage engine
const isNative = Capacitor.isNativePlatform();

// --- QURAN AUDIO FUNCTIONS ---

export const getSurahAyahRange = (surahNumber: number): { start: number; end: number } => {
  if (surahNumber < 1 || surahNumber > 114) {
    console.error(`[getSurahAyahRange] Invalid surahNumber: ${surahNumber}`);
    return { start: 0, end: -1 };
  }
  let start = 1;
  for (let i = 0; i < surahNumber - 1; i++) {
    start += SURAH_AYAH_COUNTS[i];
  }
  const end = start + SURAH_AYAH_COUNTS[surahNumber - 1] - 1;
  return { start, end };
};

const getNativePath = (reciterId: string, ayahId: number) => `audio/${reciterId}/${ayahId}.mp3`;
const getNativeAzhanPath = (azhanId: string) => `azhan/${azhanId}.mp3`;

export const isSurahDownloaded = async (reciterId: string, surahNumber: number): Promise<boolean> => {
  const { start, end } = getSurahAyahRange(surahNumber);
  if (isNaN(end) || end < start) return false;
  
  const total = end - start + 1;
  // To avoid hitting the disk too much, we check a few strategic files.
  let checkAyahs = [start, Math.floor(start + total * 0.25), Math.floor(start + total * 0.5), Math.floor(start + total * 0.75), end];
  if (total <= 5) checkAyahs = Array.from({ length: total }, (_, i) => start + i);
  // distinct array
  checkAyahs = Array.from(new Set(checkAyahs));

  if (isNative) {
    try {
      const results = await Promise.all(
        checkAyahs.map(id => Filesystem.stat({
          path: getNativePath(reciterId, id),
          directory: NATIVE_DIR
        }).catch(() => null))
      );
      return results.every((res: any) => res !== null && res.size > 0);
    } catch { return false; }
  } else {
    // Web Cache Fallback
    if (!('caches' in window)) return false;
    try {
      const cache = await caches.open(CACHE_NAME);
      const results = await Promise.all(
        checkAyahs.map(id => cache.match(getAudioUrl(reciterId, id)))
      );
      return results.every(res => res !== undefined && res !== null);
    } catch { return false; }
  }
};

export const downloadSurah = async (
  reciterId: string,
  surahNumber: number,
  onProgress: (percent: number) => void,
  signal?: AbortSignal
): Promise<void> => {
  const { start, end } = getSurahAyahRange(surahNumber);
  
  if (isNaN(end) || end < start || start < 1) {
    throw new Error(`INVALID_RANGE: surah=${surahNumber}, start=${start}, end=${end}`);
  }

  const total = end - start + 1;
  let completed = 0;
  let failedAyahs: number[] = [];

  // Create directory if native
  if (isNative) {
    try {
      await Filesystem.mkdir({ path: `audio/${reciterId}`, directory: NATIVE_DIR, recursive: true });
    } catch (e) { }
  } else if (!('caches' in window)) {
    throw new Error("Storage not supported");
  }

  const cache = isNative ? null : await caches.open(CACHE_NAME);

  for (let i = start; i <= end; i++) {
    if (signal?.aborted) throw new Error("ABORTED");

    const url = getAudioUrl(reciterId, i);
    const nativePath = getNativePath(reciterId, i);

    try {
      if (isNative) {
        // Native Download
        try {
          await Filesystem.stat({ path: nativePath, directory: NATIVE_DIR });
          // Exists
        } catch {
          await Filesystem.downloadFile({
            path: nativePath,
            directory: NATIVE_DIR,
            url: url
          });
        }
      } else {
        // Web Cache
        const match = await cache!.match(url);
        if (!match) {
          await cache!.add(url);
        }
      }
    } catch (e) {
      console.error("Download failed for", i, e);
      failedAyahs.push(i);
    }

    completed++;
    onProgress(Math.round((completed / total) * 100));
  }

  if (failedAyahs.length > (total * 0.1)) {
    throw new Error(`PARTIAL_FAILURE: ${failedAyahs.length}/${total} ayahs failed`);
  }
};

export const deleteSurahFromCache = async (reciterId: string, surahNumber: number): Promise<void> => {
  const { start, end } = getSurahAyahRange(surahNumber);
  if (isNative) {
    for (let i = start; i <= end; i++) {
      try {
        await Filesystem.deleteFile({ path: getNativePath(reciterId, i), directory: NATIVE_DIR });
      } catch { }
    }
  } else {
    if (!('caches' in window)) return;
    const cache = await caches.open(CACHE_NAME);
    for (let i = start; i <= end; i++) await cache.delete(getAudioUrl(reciterId, i));
  }
};

export const getPlayableUrl = async (reciterId: string, globalAyahId: number): Promise<string> => {
  const networkUrl = getAudioUrl(reciterId, globalAyahId);

  if (isNative) {
    try {
      const path = getNativePath(reciterId, globalAyahId);
      const stat = await Filesystem.stat({ path, directory: NATIVE_DIR });
      if (stat) {
        const uri = await Filesystem.getUri({ path, directory: NATIVE_DIR });
        return Capacitor.convertFileSrc(uri.uri); // Ensure Webview can read it if needed, but for Native Player pass pure URI?
        // Actually MediaBridge needs real file path or convertFileSrc?
        // ExoPlayer handles http or file://. 
        // Filesystem.getUri returns 'file://...'.
        // Capacitor.convertFileSrc returns 'http://localhost/_capacitor_file_...'
        // Native Player needs 'file://'.
        // JS Audio needs 'http://localhost...'.
        // This function is used by BOTH.
        // If I return 'file://', JS Audio fails.
        // If I return 'http://...', Native Player MIGHT fail if it doesn't support Capacitor scheme.
        // Layout.tsx passes this to MediaBridge.
        // I should return the CAPACITOR URL (http://localhost...) because Native Bridge can be taught to handle it, OR
        // I should use the file:// url and handle it in Layout. But JS Audio needs http.
        // Let's return the Capacitor URL. It works for JS. 
        // Does ExoPlayer support it? Usually no.
        // FIX: Layout.tsx detects 'http://localhost/_capacitor_file_' and converts back to 'file://' for Native Bridge?
        // Or I return a special object? No, string.
        // I will return the Capacitor Webview URL.
        return Capacitor.convertFileSrc(uri.uri);
      }
    } catch { }
  } else {
    if (!('caches' in window)) return networkUrl;
    try {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(networkUrl);
      if (cachedResponse) {
        const blob = await cachedResponse.blob();
        return URL.createObjectURL(blob);
      }
    } catch (e) { }
  }
  return networkUrl;
};

// --- AZHAN FUNCTIONS ---

const getWebSafeAzhanUrl = (id: string): string | null => {
  const url = getAzhanUrl(id);
  if (!url) return null;
  if (!isNative && url.startsWith('/')) {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${cleanBaseUrl}${url}`;
  }
  return url;
};

export const downloadAzhan = async (azhanId: string, onProgress?: (p: number) => void, signal?: AbortSignal): Promise<void> => {
  const url = getWebSafeAzhanUrl(azhanId);

  // Cannot download if URL is unknown (bundled azhans don't need download)
  if (!url) {
    console.warn(`[OfflineAudio] Cannot download azhan: ${azhanId} - no URL available`);
    return;
  }

  if (isNative) {
    try {
      await Filesystem.mkdir({ path: 'azhan', directory: NATIVE_DIR, recursive: true });
    } catch { }
    await Filesystem.downloadFile({
      path: getNativeAzhanPath(azhanId),
      directory: NATIVE_DIR,
      url: url
    });
    if (onProgress) onProgress(100);
  } else {
    // Web implementation
    if (!('caches' in window)) throw new Error("No Cache");
    const cache = await caches.open(AZHAN_CACHE_NAME);
    const response = await fetch(url);
    await cache.put(url, response);
  }
};

// List of bundled Azhan files in android/app/src/main/res/raw
export const BUNDLED_AZHANS = [
  'egy_abdulbasit', 'egy_ali_mahmoud', 'egy_bahtimi', 'egy_fashni',
  'egy_husary', 'egy_minshawi', 'egy_mustafa', 'egy_naqshbandi',
  'egy_refat', 'egy_toubar', 'other_rabeh', 'egy_ibrahim_gabr',
  'ksa_suraihi'
];

export const getAvailableAzhanIds = async (): Promise<string[]> => {
  const ids = new Set<string>(BUNDLED_AZHANS);

  if (isNative) {
    try {
      // Ensure directory exists to silence "Directory does not exist" logs from Capacitor
      try {
        await Filesystem.stat({ path: 'azhan', directory: NATIVE_DIR });
      } catch {
        await Filesystem.mkdir({ path: 'azhan', directory: NATIVE_DIR, recursive: true });
      }

      const files = await Filesystem.readdir({ path: 'azhan', directory: NATIVE_DIR });
      files.files.forEach(f => {
        const id = f.name.replace('.mp3', '');
        if (id) ids.add(id);
      });
    } catch { }
  } else {
    // Web: check cache (not strictly necessary for random usually but good for completeness)
    try {
      const cache = await caches.open(AZHAN_CACHE_NAME);
      const keys = await cache.keys();
      keys.forEach(req => {
        const url = req.url;
        // Extract ID from URL if possible, or just skip if too complex
      });
    } catch { }
  }

  return Array.from(ids);
};

export const getPlayableAzhanUrl = async (azhanId: string): Promise<string | null> => {
  // 1. CUSTOM MUAZZINS - handle user-uploaded files
  if (azhanId.startsWith('custom_')) {
    if (isNative) {
      try {
        const path = getNativeAzhanPath(azhanId);
        console.log(`[OfflineAudio] Looking for custom azhan at: ${path}`);
        await Filesystem.stat({ path, directory: NATIVE_DIR });
        const uri = await Filesystem.getUri({ path, directory: NATIVE_DIR });
        console.log(`[OfflineAudio] ✅ Found custom azhan: ${uri.uri}`);
        return Capacitor.convertFileSrc(uri.uri);
      } catch (e) {
        // ❌ NO FALLBACK - return null for explicit error handling
        console.error(`[OfflineAudio] ❌ Custom Azhan file missing: ${azhanId}`);
        return null;
      }
    } else {
      // Web: retrieve from Cache API
      try {
        const cache = await caches.open(AZHAN_CACHE_NAME);
        const resp = await cache.match(`custom://${azhanId}`);
        if (resp) {
          return URL.createObjectURL(await resp.blob());
        }
      } catch { }
      // ❌ NO FALLBACK - return null
      console.error(`[OfflineAudio] ❌ Custom Azhan not in cache: ${azhanId}`);
      return null;
    }
  }

  // 2. BUNDLED AZHANS - return Android resource URI directly
  if (isNative && BUNDLED_AZHANS.includes(azhanId)) {
    return `android.resource://com.albayan.quran/raw/${azhanId}`;
  }

  // 3. Check if it's a known muazzin with URL
  const url = getWebSafeAzhanUrl(azhanId);

  if (!url) {
    // ❌ NO FALLBACK - unknown muazzin ID
    console.error(`[OfflineAudio] ❌ Unknown muazzin ID: ${azhanId}`);
    return null;
  }

  // For native: convert relative path to android.resource if bundled
  if (isNative && url.startsWith('/')) {
    const bundledMatch = MUAZZINS.find(m => m.url === url && BUNDLED_AZHANS.includes(m.id));
    if (bundledMatch) {
      return `android.resource://com.albayan.quran/raw/${bundledMatch.id}`;
    }
  }

  // For web or non-bundled
  if (!isNative) {
    if (!('caches' in window)) return url;
    try {
      const cache = await caches.open(AZHAN_CACHE_NAME);
      const resp = await cache.match(url);
      if (resp) return URL.createObjectURL(await resp.blob());
    } catch { }
    return url;
  }

  // ❌ NO FALLBACK - if we reach here on native, something is wrong
  console.error(`[OfflineAudio] ❌ Cannot resolve azhan for native: ${azhanId}`);
  return null;
};

/**
 * Get playable Azhan URL optimized for Native Android playback.
 * Returns file:// URIs directly instead of localhost URLs for better compatibility.
 * BUNDLED FIRST: Always prioritizes bundled resources for stability.
 * 
 * @param azhanId - The muazzin ID
 * @returns Direct file:// URI or android.resource:// URI, or null if not found
 */
export const getPlayableAzhanUrlForNative = async (azhanId: string): Promise<string | null> => {
  // 1. BUNDLED FIRST - Return android.resource:// directly for bundled azhans
  // These are guaranteed to exist in the APK
  if (BUNDLED_AZHANS.includes(azhanId)) {
    return `android.resource://com.albayan.quran/raw/${azhanId}`;
  }

  // 2. Custom files - Return file:// directly WITHOUT convertFileSrc
  if (azhanId.startsWith('custom_')) {
    try {
      const path = getNativeAzhanPath(azhanId);
      await Filesystem.stat({ path, directory: NATIVE_DIR });
      const uri = await Filesystem.getUri({ path, directory: NATIVE_DIR });
      // Return file:// directly - native layer handles this better than localhost URLs
      return uri.uri;
    } catch {
      // ❌ NO FALLBACK - return null for explicit error handling
      console.error(`[OfflineAudio] ❌ Custom file missing: ${azhanId}`);
      return null;
    }
  }

  // 3. Unknown ID - should not happen if validation is done properly
  console.error(`[OfflineAudio] ❌ Unknown azhan ID for native: ${azhanId}`);
  return null;
};

export const isAzhanDownloaded = async (azhanId: string) => {
  if (isNative && BUNDLED_AZHANS.includes(azhanId)) return true; // Bundled files are always "downloaded"

  if (isNative) {
    try {
      await Filesystem.stat({ path: getNativeAzhanPath(azhanId), directory: NATIVE_DIR });
      return true;
    } catch { return false; }
  } else {
    const url = getWebSafeAzhanUrl(azhanId);
    if (!url) return false; // Unknown azhan
    const cache = await caches.open(AZHAN_CACHE_NAME);
    return (await cache.match(url)) !== undefined;
  }
};

export const deleteAzhanFromCache = async (azhanId: string) => {
  if (isNative) {
    try { await Filesystem.deleteFile({ path: getNativeAzhanPath(azhanId), directory: NATIVE_DIR }); } catch { }
  } else {
    const url = getWebSafeAzhanUrl(azhanId);
    if (!url) return; // Unknown azhan
    const cache = await caches.open(AZHAN_CACHE_NAME);
    await cache.delete(url);
  }
};

export const deleteAllSurahs = async (reciterId: string) => {
  if (isNative) {
    try { await Filesystem.rmdir({ path: `audio/${reciterId}`, directory: NATIVE_DIR, recursive: true }); } catch { }
  } else {
    // Web delete...
  }
};

export const cleanAudioGarbage = async (reciterId: string, onProgress: (msg: string) => void): Promise<{ deleted: number, bytesFreed: number }> => {
  if (!isNative) return { deleted: 0, bytesFreed: 0 };
  
  let deletedCount = 0;
  let bytesFreed = 0;

  try {
    const reciterDir = `audio/${reciterId}`;
    
    try { await Filesystem.stat({ path: reciterDir, directory: NATIVE_DIR }); } catch { return { deleted: 0, bytesFreed: 0 }; }

    const filesResult = await Filesystem.readdir({ path: reciterDir, directory: NATIVE_DIR });
    const files = filesResult.files;

    onProgress(`جاري فحص ${files.length} ملف...`);

    const batchSize = 50;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      await Promise.all(batch.map(async (file) => {
        const numStr = file.name.replace('.mp3', '');
        const ayahId = parseInt(numStr, 10);
        
        let shouldDelete = false;
        if (isNaN(ayahId) || ayahId < 1 || ayahId > 6236) {
          shouldDelete = true;
        }

        // Professionally checking file size - if less than 5KB it's likely a corrupted download or empty 
        if (file.size !== undefined && file.size < 5000) {
          shouldDelete = true;
        }

        if (shouldDelete) {
          deletedCount++;
          if (file.size !== undefined) bytesFreed += file.size;
          try {
            await Filesystem.deleteFile({ path: `${reciterDir}/${file.name}`, directory: NATIVE_DIR });
          } catch {}
        }
      }));
    }
  } catch (err) {
    console.error("Failed to clean garbage", err);
  }
  
  return { deleted: deletedCount, bytesFreed };
};

export const getDownloadedReciters = async (): Promise<string[]> => {
  if (!isNative) return [];
  try {
    const res = await Filesystem.readdir({ path: 'audio', directory: NATIVE_DIR });
    const downloadedIds: string[] = [];
    for (const dir of res.files) {
      if (dir.type === 'directory') {
        try {
           const sub = await Filesystem.readdir({ path: `audio/${dir.name}`, directory: NATIVE_DIR });
           if (sub.files.length > 0) {
             downloadedIds.push(dir.name);
           }
        } catch {}
      } else {
        // Fallback or older structure? Just check existing directories.
        // Actually Capacitor readdir might not reliably give "type" on some versions. Let's just assume it's a directory.
        downloadedIds.push(dir.name); // If we can't tell, assume existence means downloaded something. Let's try to check type.
      }
    }
    // Filter duplicates and valid names
    return Array.from(new Set(downloadedIds.filter(id => id && id.length > 2)));
  } catch {
    return [];
  }
};

export const downloadQueueProcessor = async (
  reciterId: string, 
  queue: number[], 
  onSurahComplete: (n: number) => void, 
  onTotalProgress: (c: number) => void, 
  initialCompletedCount: number, 
  signal: AbortSignal
): Promise<{ failedSurahs: number[] }> => {
  let completedSoFar = initialCompletedCount;
  const failedSurahs: number[] = [];
  for (const surahNum of queue) {
    if (signal.aborted) throw new Error("PAUSED");
    try {
      await downloadSurah(reciterId, surahNum, () => { }, signal);
      completedSoFar++;
      onSurahComplete(surahNum);
      onTotalProgress(completedSoFar);
    } catch (e: any) { 
      if (e.name === 'AbortError' || e.message === 'ABORTED' || e.message === 'PAUSED') throw new Error("PAUSED");
      console.error(`[BulkDownload] Failed surah ${surahNum}:`, e);
      failedSurahs.push(surahNum);
      completedSoFar++;
      onTotalProgress(completedSoFar);
    }
  }
  return { failedSurahs };
};

// --- Custom Muazzin Upload Functions ---

import { addCustomMuazzin, deleteCustomMuazzin as deleteCustomMuazzinFromStorage, CustomMuazzin, getCustomMuazzins } from './storage';

/**
 * Generate a safe UUID-based filename for custom Azhan
 * Avoids Arabic characters that may cause filesystem issues
 */
const generateSafeAzhanId = (): string => {
  const uuid = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  return `custom_${uuid}`;
};

/**
 * Validation result for custom Azhan file
 */
export interface AzhanValidationResult {
  valid: boolean;
  error?: string;
  errorArabic?: string;
}

/**
 * Validate a custom Azhan file before upload
 * Checks: size, extension, MIME type, and MP3 magic bytes
 */
export const validateAzhanFile = async (file: File): Promise<AzhanValidationResult> => {
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB

  // 1. Check size
  if (file.size > MAX_SIZE) {
    return {
      valid: false,
      error: 'File too large',
      errorArabic: 'حجم الملف كبير جداً (الحد الأقصى ١٠ ميجابايت)'
    };
  }

  // 2. Check extension
  if (!file.name.toLowerCase().endsWith('.mp3')) {
    return {
      valid: false,
      error: 'Invalid extension',
      errorArabic: 'يجب أن يكون الملف بصيغة MP3'
    };
  }

  // 3. Check MIME type (if available)
  if (file.type && !file.type.includes('audio')) {
    return {
      valid: false,
      error: 'Invalid MIME type',
      errorArabic: 'الملف ليس ملف صوتي صالح'
    };
  }

  // 4. Check MP3 magic bytes (ID3 tag or MP3 frame sync)
  try {
    const buffer = await file.slice(0, 4).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // ID3v2 header: starts with "ID3"
    const isID3 = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;

    // MP3 frame sync: starts with 0xFF followed by 0xE* or 0xF*
    const isMP3Frame = bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0;

    if (!isID3 && !isMP3Frame) {
      return {
        valid: false,
        error: 'Not a valid MP3 file',
        errorArabic: 'الملف ليس ملف MP3 صالح'
      };
    }
  } catch (e) {
    return {
      valid: false,
      error: 'Cannot read file',
      errorArabic: 'لا يمكن قراءة الملف'
    };
  }

  return { valid: true };
};

/**
 * Save a custom Azhan file uploaded by user
 * Returns the created CustomMuazzin object
 */
export const saveCustomAzhan = async (
  file: File,
  displayName: string
): Promise<CustomMuazzin> => {
  // Generate safe ID
  const id = generateSafeAzhanId();
  const filePath = `azhan/${id}.mp3`;

  if (isNative) {
    // Native: Copy file to app storage
    try {
      // Ensure azhan directory exists
      await Filesystem.mkdir({
        path: 'azhan',
        directory: NATIVE_DIR,
        recursive: true
      });
    } catch { /* Directory may already exist */ }

    // Convert File to base64 and write
    const reader = new FileReader();
    const base64Data = await new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:audio/mpeg;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    await Filesystem.writeFile({
      path: filePath,
      data: base64Data,
      directory: NATIVE_DIR
    });
  } else {
    // Web: Store in Cache API
    const cache = await caches.open(AZHAN_CACHE_NAME);
    const response = new Response(file, {
      headers: { 'Content-Type': 'audio/mpeg' }
    });
    await cache.put(`custom://${id}`, response);
  }

  // Create and save metadata
  const muazzin: CustomMuazzin = {
    id,
    displayName: displayName.trim() || 'مؤذن مخصص',
    filePath,
    addedAt: Date.now(),
    sizeBytes: file.size
  };

  addCustomMuazzin(muazzin);

  console.log(`[OfflineAudio] ✅ Saved custom Azhan: ${id} (${displayName})`);
  return muazzin;
};

/**
 * Delete a custom Azhan file and its metadata
 */
export const deleteCustomAzhanFile = async (id: string): Promise<void> => {
  const filePath = `azhan/${id}.mp3`;

  if (isNative) {
    try {
      await Filesystem.deleteFile({
        path: filePath,
        directory: NATIVE_DIR
      });
    } catch {
      console.warn(`[OfflineAudio] Failed to delete file: ${filePath}`);
    }
  } else {
    // Web: Remove from Cache
    try {
      const cache = await caches.open(AZHAN_CACHE_NAME);
      await cache.delete(`custom://${id}`);
    } catch { }
  }

  // Remove metadata from storage
  deleteCustomMuazzinFromStorage(id);

  console.log(`[OfflineAudio] 🗑️ Deleted custom Azhan: ${id}`);
};

/**
 * Get all available Azhan IDs including custom ones
 */
export const getAllAzhanIds = (): string[] => {
  const customIds = getCustomMuazzins().map(m => m.id);
  return [...BUNDLED_AZHANS, ...customIds];
};
