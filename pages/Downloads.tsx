
import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { RECITERS, fetchSurahs } from '../services/api';
import { Surah } from '../types';
import { isSurahDownloaded, deleteSurahFromCache, validateAzhanFile, saveCustomAzhan, deleteCustomAzhanFile, cleanAudioGarbage } from '../services/offlineAudio';
import { MUAZZINS } from '../services/azhanData';
import { useSettings } from '../components/Layout';
import { getNotificationSettings, updateSalahSettings, setStoredAzhan, getCustomMuazzins, CustomMuazzin, isPerPrayerMuazzinEnabled, NotificationSettings } from '../services/storage';
import { scheduleAllNotifications } from '../services/notificationManager';
import { Download, CheckCircle, Trash2, WifiOff, Loader2, Mic, AlertCircle, XCircle, HardDriveDownload, Pause, Play, Volume2, VolumeX, Music, Square, Check, RotateCcw, Plus, Upload, Eraser } from 'lucide-react';
import { toArabicDigits } from '../services/normalization';
import { AzhanModal } from '../components/AzhanModal';
import { Capacitor } from '@capacitor/core';
import { MediaBridge } from '../services/mediaBridge';
import { useDownload } from '../contexts/DownloadContext';

const AZHAN_TAB_ID = 'TAB_AZHAN';

export const Downloads: React.FC = () => {
  const { reciterId, setReciterId, azhanId, setAzhanId } = useSettings(); // Use this for DEFAULT values if needed
  const [surahs, setSurahs] = useState<Surah[]>([]);

  // Use Global Download Context
  const {
    startDownload,
    cancelDownload,
    deleteSurah,
    activeDownloads,
    getDownloadState,
    startBulkDownload,
    pauseBulkDownload,
    resumeBulkDownload,
    cancelBulkDownload,
    isBulkActive,
    bulkProgress,
    clearAudioCache,
    isClearingCache
  } = useDownload();

  // Local state for Surah "Presence" (is downloaded on disk?)
  const [downloadStatus, setDownloadStatus] = useState<Record<number, 'downloaded' | 'none'>>({});
  const [isCheckingDownloads, setIsCheckingDownloads] = useState(true);

  const [activeTab, setActiveTab] = useState(reciterId || RECITERS[0].id);
  const [searchParams] = useSearchParams();

  // Refs for auto-scrolling tabs
  const tabsRef = useRef<Record<string, HTMLButtonElement | null>>({});

  // Auto-scroll active tab into view
  useEffect(() => {
    const activeEl = tabsRef.current[activeTab];
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeTab]);

  // Handle ?tab=azhan query parameter and Sync with Global Reciter
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'azhan') {
      setActiveTab(AZHAN_TAB_ID);
    } else {
      // SYNC: Always default to the globally selected reciter when visiting this page
      // unless specifically navigating to Azhan tab
      if (reciterId && RECITERS.some(r => r.id === reciterId)) {
        setActiveTab(reciterId);
      }
    }
  }, [searchParams, reciterId]);

  // Azhan Modal Preview State
  const [azhanModalPreview, setAzhanModalPreview] = useState<{ muazzinName: string; azhanId: string } | null>(null);
  const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null);

  // Custom Muazzin Upload State
  const [customMuazzins, setCustomMuazzins] = useState<CustomMuazzin[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [newMuazzinName, setNewMuazzinName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete Confirmation Modal State
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Bulk Delete State (Local)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Surah Delete Confirmation State
  const [surahToDelete, setSurahToDelete] = useState<Surah | null>(null);

  // Bulk Delete All Confirmation State
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deleteAllCount, setDeleteAllCount] = useState(0);

  // Clear Cache Confirmation State
  const [showClearCacheModal, setShowClearCacheModal] = useState(false);

  // Garbage Collector State
  const [isCleaningGarbage, setIsCleaningGarbage] = useState(false);
  const [garbageStats, setGarbageStats] = useState<{deleted: number, bytesFreed: number} | null>(null);
  const [garbageProgress, setGarbageProgress] = useState<string>('');

  const isAzhanMode = activeTab === AZHAN_TAB_ID;

  // Azhan Volume State
  const [azhanVolume, setAzhanVolume] = useState<number>(80);

  // Load volume from storage on mount
  useEffect(() => {
    const settings = getNotificationSettings();
    setAzhanVolume(settings.salah.azhanVolume ?? 80);
  }, []);

  // Update volume in storage when changed
  const handleVolumeChange = (newVolume: number) => {
    setAzhanVolume(newVolume);
    updateSalahSettings({ azhanVolume: newVolume });
  };

  useEffect(() => {
    fetchSurahs().then(setSurahs);

    const handleSettingsUpdate = (e: CustomEvent) => {
      const newSettings = e.detail.settings as NotificationSettings;
      if (newSettings?.salah?.azhanVolume !== undefined) {
        setAzhanVolume(prev => prev !== newSettings.salah.azhanVolume ? newSettings.salah.azhanVolume : prev);
      }
    };
    window.addEventListener('notification-settings-updated', handleSettingsUpdate as EventListener);

    // Listen for download completions to update "downloadStatus" locally
    const handleDownloadComplete = (e: CustomEvent) => {
      const { reciterId, surahId } = e.detail;
      if (reciterId === activeTab) {
        setDownloadStatus(prev => ({ ...prev, [surahId]: 'downloaded' }));
      }
    };
    // Listen for delete completion
    const handleDownloadDelete = (e: CustomEvent) => {
      const { reciterId, surahId } = e.detail;
      if (reciterId === activeTab) {
        setDownloadStatus(prev => ({ ...prev, [surahId]: 'none' }));
      }
    };

    window.addEventListener('download-completed', handleDownloadComplete as EventListener);
    window.addEventListener('download-deleted', handleDownloadDelete as EventListener);

    return () => {
      window.removeEventListener('notification-settings-updated', handleSettingsUpdate as EventListener);
      window.removeEventListener('download-completed', handleDownloadComplete as EventListener);
      window.removeEventListener('download-deleted', handleDownloadDelete as EventListener);
    };
  }, [activeTab]); // activeTab dependency ensures we filter events correctly if needed

  useEffect(() => {
    setAzhanModalPreview(null);
  }, [activeTab]);

  useEffect(() => {
    setCustomMuazzins(getCustomMuazzins());
  }, []);

  const checkDownloads = async () => {
    if (isAzhanMode) return;
    if (surahs.length === 0) return;

    setIsCheckingDownloads(true);
    const statusMap: Record<number, 'downloaded' | 'none'> = {};
    // Only check "presence" on disk. Progress is handled by Context.
    // Batch processing to prevent blocking the Capacitor Bridge
    const batchSize = 10;
    for (let i = 0; i < surahs.length; i += batchSize) {
      const batch = surahs.slice(i, i + batchSize);
      await Promise.all(batch.map(async (s) => {
        const isDown = await isSurahDownloaded(activeTab, s.number);
        statusMap[s.number] = isDown ? 'downloaded' : 'none';
      }));
    }
    setDownloadStatus(prev => ({ ...prev, ...statusMap }));
    setIsCheckingDownloads(false);
  };

  // Check downloads when Tab changes or Init
  useEffect(() => {
    checkDownloads();
  }, [surahs, activeTab]);


  // --- HANDLERS ---

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    const validation = await validateAzhanFile(file);
    if (!validation.valid) {
      setUploadError(validation.errorArabic || validation.error || 'خطأ في الملف');
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
    setShowUploadModal(true);
  };

  const handleUploadConfirm = async () => {
    if (!selectedFile || !newMuazzinName.trim()) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const muazzin = await saveCustomAzhan(selectedFile, newMuazzinName.trim());
      setCustomMuazzins(prev => [...prev, muazzin]);
      setShowUploadModal(false);
      setSelectedFile(null);
      setNewMuazzinName('');
      if (navigator.vibrate) navigator.vibrate(50);
    } catch (error: any) {
      setUploadError(error.message || 'فشل في حفظ الملف');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteCustomMuazzin = (id: string, name: string) => {
    setDeleteConfirmModal({ id, name });
  };

  const confirmDeleteMuazzin = async () => {
    if (!deleteConfirmModal) return;
    setIsDeleting(true);
    try {
      await deleteCustomAzhanFile(deleteConfirmModal.id);
      const { cleanupAzhanSettings } = await import('../services/storage');
      cleanupAzhanSettings(deleteConfirmModal.id);
      await scheduleAllNotifications();
      setCustomMuazzins(prev => prev.filter(m => m.id !== deleteConfirmModal.id));
      if (azhanId === deleteConfirmModal.id) {
        setAzhanId('egy_abdulbasit');
      }
      if (navigator.vibrate) navigator.vibrate(30);
    } catch (error) {
      console.error('Failed to delete custom muazzin:', error);
    } finally {
      setIsDeleting(false);
      setDeleteConfirmModal(null);
    }
  };


  // --- Single Surah Actions (Context Wrapper) ---
  const onDownloadClick = (surah: Surah) => {
    startDownload(activeTab, surah);
  };

  const onCancelClick = (surah: Surah) => {
    cancelDownload(activeTab, surah.number);
  };

  const onDeleteClick = async (surah: Surah) => {
    setSurahToDelete(surah);
  };

  const confirmDeleteSurah = async () => {
    if (!surahToDelete) return;
    await deleteSurah(activeTab, surahToDelete);
    setSurahToDelete(null);
    // Status update handled by event listener above
  };


  // --- Bulk Actions (Context Wrapper) ---
  const handleStartBulk = () => {
    const toDownload = surahs
      .filter(s => downloadStatus[s.number] !== 'downloaded')
      .map(s => s.number);

    if (toDownload.length === 0) {
      alert("جميع السور محملة بالفعل لهذا القارئ!");
      return;
    }

    startBulkDownload(activeTab, toDownload);
  };

  const handlePauseResumeBulk = () => {
    // If we are actively downloading, pause.
    // If we are paused... wait, context doesn't expose "isPaused" state directly simply?
    // Actually Context handles queue. If we pause, we seek to Resume.
    // For V1, let's just support Pause -> Cancel for simplicity or just basic Pause/Resume if context allows.
    // Current context implementation: pauseBulkDownload aborts current. resumeBulkDownload restarts.
    // We need a local "isPaused" flag synced with context? 
    // The context `isBulkActive` is true during download.
    // Let's rely on Context completely.

    // Since context doesn't maintain "Paused" state persistently if aborted,
    // We'll treat this as Cancel for now or implement better Pause in Context V2.
    // **FIX:** Simply use Cancel for now to avoid complexity, or reimplement queue logic.
    // Let's implement active Pause logic in UI:
    // If isBulkActive -> Pause.
    // If paused locally -> Resume.
    pauseBulkDownload();
  };

  const handleCleanGarbage = async () => {
    if (isCleaningGarbage) return;
    setIsCleaningGarbage(true);
    setGarbageStats(null);
    setGarbageProgress('جاري فحص وتصليح الملفات...');
    try {
      const stats = await cleanAudioGarbage(activeTab, (msg) => setGarbageProgress(msg));
      setGarbageStats(stats);
      if (stats.deleted > 0) {
        checkDownloads();
      }
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء تنظيف الملفات');
    } finally {
      setIsCleaningGarbage(false);
      setTimeout(() => {
        setGarbageProgress('');
      }, 5000);
    }
  };

  const handleDeleteAllSurahs = async () => {
    const count = Object.values(downloadStatus).filter(s => s === 'downloaded').length;
    if (count === 0) return;
    setDeleteAllCount(count);
    setShowDeleteAllConfirm(true);
  };

  const confirmDeleteAllSurahs = async () => {
    setShowDeleteAllConfirm(false);
    setIsBulkDeleting(true);
    try {
      const { deleteAllSurahs } = await import('../services/offlineAudio');
      await deleteAllSurahs(activeTab);
      setDownloadStatus({});
      await checkDownloads();
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handlePlayPreview = async (muazzinId: string, muazzinName: string) => {
    if (previewPlayingId === muazzinId) {
      setAzhanModalPreview(null);
      setPreviewPlayingId(null);
      if (Capacitor.getPlatform() === 'android') {
        try { await MediaBridge.stop?.(); } catch { }
      }
      return;
    }
    setPreviewPlayingId(muazzinId);
    setAzhanModalPreview({ muazzinName, azhanId: muazzinId });
  };

  const handleSelectAzhan = (id: string) => {
    setAzhanId(id);
    if (navigator.vibrate) navigator.vibrate(20);
  };

  // --- UI Helpers ---
  const currentReciterName = RECITERS.find(r => r.id === activeTab)?.name;
  const surahsDownloadedCount = Object.values(downloadStatus).filter(s => s === 'downloaded').length;
  const totalCount = surahs.length;


  return (
    <div className="flex flex-col min-h-full h-full bg-gradient-to-b from-gold-50 via-stone-50 to-stone-100 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 font-sans overflow-hidden">
      <TopBar title={isAzhanMode ? "اختيار المؤذن" : "إدارة التحميلات"} />

      <div className="flex-1 overflow-y-auto pb-24">

        {/* Header / Tabs */}
        <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-b from-white to-stone-50/50 dark:from-navy-900 dark:to-navy-900/80 border-b border-navy-100/80 dark:border-navy-800 shadow-sm sticky top-0 z-20 backdrop-blur-sm">
          <div className="mb-5">
            <h2 className="text-lg md:text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2.5">
              {isAzhanMode ? <Volume2 className="text-gold-500" size={22} /> : <WifiOff className="text-gold-500" size={22} />}
              {isAzhanMode ? "تخصيص صوت الأذان" : "الاستماع دون إنترنت"}
            </h2>
            <p className="text-xs md:text-sm text-navy-500 dark:text-navy-400 mt-1.5 leading-relaxed">
              {isAzhanMode
                ? <span>المؤذن الحالي: <span className="font-bold text-gold-600 dark:text-gold-400">{MUAZZINS.find(m => m.id === azhanId)?.name || 'غير محدد'}</span></span>
                : "تحميل المصحف للاستماع دون اتصال بالإنترنت."
              }
            </p>
          </div>

          {/* Horizontal Tabs - UNLOCKED NOW */}
          <div className="flex gap-2 md:gap-3 overflow-x-auto pb-2 no-scrollbar mb-3">
            {RECITERS.map(r => (
              <button ref={el => { tabsRef.current[r.id] = el; }}
                key={r.id}
                onClick={() => setActiveTab(r.id)}
                // REMOVED: disabled={isBulkActive} to allow switching tabs!
                className={`flex items-center gap-2 px-4 md:px-5 py-2.5 rounded-full text-xs md:text-sm font-bold whitespace-nowrap transition-all duration-200 border shadow-sm ${activeTab === r.id
                  ? 'bg-gradient-to-r from-navy-800 to-navy-700 text-white border-navy-700 shadow-md scale-[1.02]'
                  : 'bg-white dark:bg-navy-800/80 text-navy-600 dark:text-navy-300 border-navy-100 dark:border-navy-700 hover:bg-navy-50 dark:hover:bg-navy-750 hover:border-navy-200 dark:hover:border-navy-600'
                  }`}
              >
                {/* Show spinner on tab if downloading in background for THIS reciter? */}
                {/* Implementing Reciter-specific persistence feedback on tab is a nice to have, skip for now to keep simple */}
                {activeTab === r.id && <Mic size={12} className="animate-pulse" />}
                {r.name}
              </button>
            ))}

            {/* Special Azhan Tab */}
            <button ref={el => { tabsRef.current[AZHAN_TAB_ID] = el; }}
              onClick={() => setActiveTab(AZHAN_TAB_ID)}
              className={`flex items-center gap-2 px-4 md:px-5 py-2.5 rounded-full text-xs md:text-sm font-bold whitespace-nowrap transition-all duration-200 border shadow-sm ${activeTab === AZHAN_TAB_ID
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20 scale-[1.02]'
                : 'bg-white dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                }`}
            >
              {activeTab === AZHAN_TAB_ID ? <Volume2 size={14} className="animate-pulse" /> : <Music size={14} />}
              أصوات الأذان
            </button>
          </div>

          {/* --- DASHBOARD --- */}
          {!isAzhanMode && (
            <div className="bg-gradient-to-br from-stone-50 to-navy-50/50 dark:from-navy-900/50 dark:to-navy-950/50 rounded-2xl p-4 md:p-5 border border-navy-100/80 dark:border-navy-800 transition-all shadow-sm">

              {/* STATUS ROW */}
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-start flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs md:text-sm font-bold text-navy-600 dark:text-navy-300">حالة التخزين:</span>
                    <span className="bg-white dark:bg-navy-800 px-3 py-1 rounded-xl text-xs md:text-sm font-bold text-gold-600 dark:text-gold-500 border border-navy-100 dark:border-navy-700 shadow-sm flex items-center justify-center min-w-[100px]">
                      {isCheckingDownloads ? (
                        <Loader2 size={14} className="animate-spin text-gold-500" />
                      ) : (
                        `${toArabicDigits(surahsDownloadedCount)} / ${toArabicDigits(totalCount)} سورة`
                      )}
                    </span>
                  </div>

                  {/* CLEAR CACHE BUTTON */}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <button
                      onClick={() => setShowClearCacheModal(true)}
                      disabled={isClearingCache}
                      className="text-[10px] text-navy-400 hover:text-red-500 underline flex items-center gap-1 transition-colors"
                    >
                      {isClearingCache ? <Loader2 size={10} className="animate-spin" /> : <Eraser size={10} />}
                      تنظيف الملفات المؤقتة
                    </button>
                    {!isBulkActive && (
                      <button
                        onClick={handleCleanGarbage}
                        disabled={isCleaningGarbage}
                        className="text-[10px] text-emerald-500 hover:text-emerald-600 underline flex items-center gap-1 transition-colors"
                      >
                        {isCleaningGarbage ? <Loader2 size={10} className="animate-spin" /> : <AlertCircle size={10} />}
                        إصلاح وملء الفراغات الناتجة عن أخطاء
                      </button>
                    )}
                  </div>
                  {(garbageProgress || garbageStats) && (
                    <div className="text-[10px] mt-1 p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg w-full">
                      {garbageProgress}
                      {garbageStats && (
                        <div className="font-bold mt-1">
                          تم حذف {toArabicDigits(garbageStats.deleted)} ملف تالف، وتوفير {toArabicDigits(Math.round(garbageStats.bytesFreed / 1024 / 1024))} ميجابايت.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {surahsDownloadedCount > 0 && !isBulkActive && (
                  <button
                    onClick={handleDeleteAllSurahs}
                    disabled={isBulkDeleting}
                    className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-transparent hover:border-red-200 dark:hover:border-red-800"
                  >
                    {isBulkDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    حذف الكل
                  </button>
                )}
              </div>

              {/* BULK PROGRESS */}
              {isBulkActive && bulkProgress ? (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                  <div className="flex justify-between text-xs md:text-sm font-bold text-navy-600 dark:text-navy-300">
                    <span>جاري تحميل المصحف ({currentReciterName})...</span>
                    <span>{toArabicDigits(bulkProgress.completed)} من {toArabicDigits(bulkProgress.total)}</span>
                  </div>

                  <div className="w-full h-3 md:h-4 bg-navy-200 dark:bg-navy-800 rounded-full overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-gradient-to-r from-gold-400 to-gold-500 striped-bar transition-all duration-300 rounded-full"
                      style={{ width: `${(bulkProgress.completed / bulkProgress.total) * 100}%` }}
                    ></div>
                  </div>

                  <div className="flex gap-2">
                    {/* 
                         TODO: Implement Pause/Resume properly later. 
                         For now, Cancel is safer to avoid state desync.
                      */}
                    <button onClick={cancelBulkDownload} className="flex-1 py-2 bg-red-50 text-red-500 rounded-lg text-xs font-bold flex justify-center items-center gap-2 hover:bg-red-100"><XCircle size={14} /> إلغاء</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleStartBulk}
                  disabled={surahsDownloadedCount === totalCount || isBulkDeleting}
                  className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-sm shadow-sm transition-all ${surahsDownloadedCount === totalCount
                    ? 'bg-emerald-100 text-emerald-700 cursor-default'
                    : 'bg-gold-500 hover:bg-gold-600 text-navy-900'
                    }`}
                >
                  {surahsDownloadedCount === totalCount ? (
                    <>
                      <CheckCircle size={18} /> المصحف محمل بالكامل
                    </>
                  ) : (
                    <>
                      <HardDriveDownload size={18} /> تحميل الباقي ({toArabicDigits(totalCount - surahsDownloadedCount)} سورة)
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* --- MAIN CONTENT LIST --- */}
        <div className="p-4 md:p-6 lg:p-8 space-y-3 md:space-y-4">

          {isAzhanMode ? (
            // --- AZHAN MODE (Unchanged UI logic, kept for completeness) ---
            // (Truncated for brevity in plan, but will include full logic in file write)
            <AzhanList
              azhanId={azhanId}
              azhanVolume={azhanVolume}
              handleVolumeChange={handleVolumeChange}
              handleSelectAzhan={handleSelectAzhan}
              handlePlayPreview={handlePlayPreview}
              previewPlayingId={previewPlayingId}
              customMuazzins={customMuazzins}
              handleDeleteCustomMuazzin={handleDeleteCustomMuazzin}
              onAddCustomClick={() => fileInputRef.current?.click()}
              isPerPrayerEnabled={isPerPrayerMuazzinEnabled()}
            />
          ) : (
            // --- SURAH LIST ---
            surahs.map(surah => {
              // Local disk status
              const status = downloadStatus[surah.number] || 'none';

              // Context download state (progress/active)
              const dlState = getDownloadState(activeTab, surah.number);
              const isDownloading = dlState?.status === 'downloading';
              const progress = dlState?.progress || 0;
              const isError = dlState?.status === 'error';

              // Only show queued if BULK is active AND this specific surah is pending?
              // Context doesn't expose the queue list directly.
              // So we only show "Downloading" if it's actually processing.
              // For bulk items pending, they will just show "Download" button until they start.
              // That's acceptable for V1.

              return (
                <div key={surah.number} className="flex items-center justify-between p-4 md:p-5 bg-white dark:bg-navy-900/80 rounded-2xl border border-navy-100/80 dark:border-navy-800 shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="flex items-center gap-3 md:gap-4 flex-1">
                    <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-navy-50 to-stone-100 dark:from-navy-800 dark:to-navy-850 flex items-center justify-center text-sm md:text-base font-bold text-navy-600 dark:text-navy-300 font-sans shadow-sm border border-navy-100/50 dark:border-navy-700">
                      {toArabicDigits(surah.number)}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-navy-900 dark:text-white text-base md:text-lg">{surah.name}</h3>
                      <p className="text-[10px] md:text-xs text-navy-400 mt-0.5">{toArabicDigits(surah.numberOfAyahs)} آية</p>

                      {isDownloading && (
                        <div className="w-full max-w-[140px] h-1.5 bg-navy-200 dark:bg-navy-700 mt-2.5 rounded-full overflow-hidden shadow-inner flex">
                          <div className="h-full bg-gradient-to-r from-gold-400 to-gold-500 transition-all duration-300 rounded-full" style={{ width: `${progress}%` }}></div>
                        </div>
                      )}

                      {isError && <span className="text-[10px] text-red-500 font-bold">فشل التحميل</span>}
                    </div>
                  </div>

                  <div>
                    {status === 'downloaded' ? (
                      <div className="flex items-center gap-2 md:gap-3">
                        <span className="text-[10px] md:text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg">محملة</span>
                        <button onClick={() => onDeleteClick(surah)} className="p-2.5 text-red-400 bg-red-50 dark:bg-red-900/15 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-all">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ) : isDownloading ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] md:text-xs font-bold text-gold-600 bg-gold-50 dark:bg-gold-900/20 px-2 py-1 rounded-lg">{toArabicDigits(progress)}%</span>
                        <button
                          onClick={() => onCancelClick(surah)}
                          className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                        >
                          <Square size={14} fill="currentColor" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onDownloadClick(surah)}
                        disabled={isBulkActive} // Disable individual download if bulk is running generally? Or allow mixed? 
                        // Safer to disable to prevent race conditions for now.
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-br from-navy-50 to-stone-100 dark:from-navy-800 dark:to-navy-850 hover:from-gold-400 hover:to-gold-500 hover:text-white dark:hover:from-gold-500 dark:hover:to-gold-600 text-navy-600 dark:text-navy-300 rounded-xl text-xs md:text-sm font-bold transition-all duration-200 disabled:opacity-50 shadow-sm hover:shadow-md"
                      >
                        <Download size={16} />
                        <span>تحميل</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Hidden File Input for Custom Azhan */}
      <input ref={fileInputRef} type="file" accept=".mp3,audio/mpeg" className="hidden" onChange={handleFileSelect} />

      {/* --- MODALS (Azhan Preview, Upload, Delete) --- */}
      {azhanModalPreview && (
        <AzhanModal
          prayerName="معاينة الأذان"
          prayerTime={new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: false })}
          initialAzhanId={azhanModalPreview.azhanId}
          onClose={() => { setAzhanModalPreview(null); setPreviewPlayingId(null); }}
          onSelect={async (id, volume) => {
            setStoredAzhan(id);
            setAzhanId(id);
            updateSalahSettings({ azhanVolume: volume });
            await scheduleAllNotifications(undefined, true);
            setAzhanModalPreview(null);
            setPreviewPlayingId(null);
          }}
        />
      )}

      {/* Upload Modal */}
      {showUploadModal && <UploadModal
        filename={selectedFile?.name}
        size={selectedFile?.size}
        error={uploadError}
        isUploading={isUploading}
        name={newMuazzinName}
        setName={setNewMuazzinName}
        onConfirm={handleUploadConfirm}
        onCancel={() => { setShowUploadModal(false); setSelectedFile(null); setNewMuazzinName(''); setUploadError(null); }}
      />}

      {/* Delete Confirmation Modal */}
      {deleteConfirmModal && (
        <DeleteConfirmModal
          name={deleteConfirmModal.name}
          isDeleting={isDeleting}
          onConfirm={confirmDeleteMuazzin}
          onCancel={() => setDeleteConfirmModal(null)}
        />
      )}

      {/* Surah Delete Confirmation Modal */}
      {surahToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSurahToDelete(null)}>
          <div className="absolute inset-0 bg-navy-950/70 backdrop-blur-md" />
          <div
            className="relative w-full max-w-sm bg-white dark:bg-navy-900 rounded-3xl shadow-2xl border border-navy-200 dark:border-navy-700 overflow-hidden transform animate-in zoom-in-95 fade-in duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Icon */}
            <div className="flex flex-col items-center pt-8 pb-4 px-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900/30 dark:to-orange-900/20 flex items-center justify-center mb-4 shadow-lg shadow-red-500/10">
                <Trash2 className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-navy-900 dark:text-white text-center">حذف من التخزين</h3>
            </div>

            {/* Message */}
            <div className="px-6 pb-5">
              <p className="text-sm text-navy-600 dark:text-navy-300 text-center leading-relaxed">
                هل تريد حذف <span className="font-bold text-navy-900 dark:text-white">{surahToDelete.name}</span> من التخزين؟
              </p>
              <p className="text-xs text-navy-400 dark:text-navy-500 text-center mt-2">
                سيتم حذف الملف الصوتي المحمل
              </p>
            </div>

            {/* Action Buttons */}
            <div className="px-6 pb-8 pt-2 flex gap-3">
              <button
                onClick={() => setSurahToDelete(null)}
                className="flex-1 py-3.5 px-4 bg-navy-100 dark:bg-navy-800 text-navy-700 dark:text-navy-200 font-bold rounded-2xl hover:bg-navy-200 dark:hover:bg-navy-700 active:scale-[0.98] transition-all text-sm"
              >
                إلغاء
              </button>
              <button
                onClick={confirmDeleteSurah}
                className="flex-1 py-3.5 px-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold rounded-2xl shadow-lg shadow-red-500/20 hover:shadow-xl active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-2"
              >
                <Trash2 size={16} />
                حذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Surahs Confirmation Modal */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowDeleteAllConfirm(false)}>
          <div className="absolute inset-0 bg-navy-950/70 backdrop-blur-md" />
          <div
            className="relative w-full max-w-sm bg-white dark:bg-navy-900 rounded-3xl shadow-2xl border border-navy-200 dark:border-navy-700 overflow-hidden transform animate-in zoom-in-95 fade-in duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Icon */}
            <div className="flex flex-col items-center pt-8 pb-4 px-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900/30 dark:to-orange-900/20 flex items-center justify-center mb-4 shadow-lg shadow-red-500/10">
                <Trash2 className="w-9 h-9 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-navy-900 dark:text-white text-center">حذف جميع السور</h3>
            </div>

            {/* Message */}
            <div className="px-6 pb-5">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-800/50 mb-3">
                <p className="text-sm text-red-700 dark:text-red-300 text-center leading-relaxed font-bold">
                  ⚠️ سيتم حذف {toArabicDigits(deleteAllCount)} سورة
                </p>
              </div>
              <p className="text-sm text-navy-600 dark:text-navy-300 text-center leading-relaxed">
                هل أنت متأكد من حذف جميع السور المحملة للقارئ <span className="font-bold text-navy-900 dark:text-white">{currentReciterName}</span>؟
              </p>
              <p className="text-xs text-navy-400 dark:text-navy-500 text-center mt-2">
                لا يمكن التراجع عن هذا الإجراء
              </p>
            </div>

            {/* Action Buttons */}
            <div className="px-6 pb-8 pt-2 flex gap-3">
              <button
                onClick={() => setShowDeleteAllConfirm(false)}
                className="flex-1 py-3.5 px-4 bg-navy-100 dark:bg-navy-800 text-navy-700 dark:text-navy-200 font-bold rounded-2xl hover:bg-navy-200 dark:hover:bg-navy-700 active:scale-[0.98] transition-all text-sm"
              >
                إلغاء
              </button>
              <button
                onClick={confirmDeleteAllSurahs}
                className="flex-1 py-3.5 px-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold rounded-2xl shadow-lg shadow-red-500/20 hover:shadow-xl active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-2"
              >
                <Trash2 size={16} />
                حذف الكل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Cache Confirmation Modal */}
      {showClearCacheModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowClearCacheModal(false)}>
          <div className="absolute inset-0 bg-navy-950/70 backdrop-blur-md" />
          <div
            className="relative w-full max-w-xs bg-white dark:bg-navy-900 rounded-3xl shadow-2xl border border-navy-200 dark:border-navy-700 overflow-hidden transform animate-in zoom-in-95 fade-in duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center pt-6 pb-4 px-5">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gold-100 to-amber-100 dark:from-gold-900/30 dark:to-amber-900/20 flex items-center justify-center mb-3 shadow-sm">
                <Eraser className="w-6 h-6 text-gold-600 dark:text-gold-400" />
              </div>
              <h3 className="text-base font-bold text-navy-900 dark:text-white text-center">تنظيف الملفات المؤقتة؟</h3>
            </div>

            <div className="px-5 pb-4">
              <p className="text-xs text-navy-600 dark:text-navy-300 text-center leading-relaxed">
                سيؤدي هذا لتحسين أداء التطبيق وتوفير بعض المساحة.
              </p>
              <p className="text-[10px] text-navy-400 dark:text-navy-500 text-center mt-2 font-bold">
                لن يتم حذف المصحف المحمل.
              </p>
            </div>

            <div className="px-5 pb-6 pt-2 flex gap-3">
              <button
                onClick={() => setShowClearCacheModal(false)}
                className="flex-1 py-2.5 px-3 bg-navy-100 dark:bg-navy-800 text-navy-700 dark:text-navy-200 font-bold rounded-xl hover:bg-navy-200 dark:hover:bg-navy-700 active:scale-[0.98] transition-all text-xs"
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  clearAudioCache();
                  setShowClearCacheModal(false);
                }}
                className="flex-1 py-2.5 px-3 bg-gradient-to-r from-gold-500 to-amber-600 text-white font-bold rounded-xl shadow-md hover:shadow-lg active:scale-[0.98] transition-all text-xs flex items-center justify-center gap-2"
              >
                <Check size={14} />
                تأكيد
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};


// --- Sub-components for cleaner code ---

// ... AzhanList, UploadModal, DeleteConfirmModal ...
// I will include these inline in the actual file write to ensure it compiles without extra imports.
// Just ensuring logical separation here.

const UploadModal = ({ filename, size, error, isUploading, name, setName, onConfirm, onCancel }: any) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onCancel}>
    <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-navy-100 dark:border-navy-800" onClick={e => e.stopPropagation()}>
      <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
        <Upload className="text-gold-500" size={22} /> تسمية المؤذن
      </h3>
      <div className="mb-4">
        <label className="block text-sm font-bold text-navy-600 dark:text-navy-300 mb-2">اسم المؤذن للعرض</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: أذان الحرم المكي" className="w-full px-4 py-3 bg-navy-50 dark:bg-navy-800 border border-navy-200 dark:border-navy-700 rounded-xl text-navy-800 dark:text-white placeholder-navy-400 focus:outline-none focus:ring-2 focus:ring-gold-500" autoFocus />
      </div>
      {filename && (
        <div className="mb-4 p-3 bg-navy-50 dark:bg-navy-800 rounded-xl text-sm">
          <div className="flex items-center gap-2 text-navy-600 dark:text-navy-300">
            <Music size={16} className="text-gold-500" />
            <span className="truncate flex-1">{filename}</span>
            <span className="text-navy-400">({(size / (1024 * 1024)).toFixed(1)} MB)</span>
          </div>
        </div>
      )}
      {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl flex gap-2"><AlertCircle size={16} />{error}</div>}
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 py-3 px-4 bg-navy-100 dark:bg-navy-800 text-navy-600 dark:text-navy-300 font-bold rounded-xl" disabled={isUploading}>إلغاء</button>
        <button onClick={onConfirm} disabled={!name.trim() || isUploading} className="flex-1 py-3 px-4 bg-gold-500 text-white font-bold rounded-xl flex justify-center gap-2 disabled:opacity-50">
          {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} حفظ
        </button>
      </div>
    </div>
  </div>
);

const DeleteConfirmModal = ({ name, isDeleting, onConfirm, onCancel }: any) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4" onClick={!isDeleting ? onCancel : undefined}>
    <div className="bg-white dark:bg-navy-900 rounded-3xl shadow-2xl w-full max-w-sm p-6 transform transition-all animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
      <div className="flex justify-center mb-5"><div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center"><Trash2 className="w-8 h-8 text-red-500" /></div></div>
      <h3 className="text-lg font-bold text-center mb-2 dark:text-white">حذف المؤذن المخصص</h3>
      <p className="text-sm text-center mb-6 text-navy-600 dark:text-navy-400">هل أنت متأكد من حذف <b>"{name}"</b>؟</p>
      <div className="flex gap-3">
        <button onClick={onCancel} disabled={isDeleting} className="flex-1 py-3.5 bg-navy-50 dark:bg-navy-800 text-navy-700 dark:text-navy-200 font-bold rounded-xl">إلغاء</button>
        <button onClick={onConfirm} disabled={isDeleting} className="flex-1 py-3.5 bg-red-500 text-white font-bold rounded-xl flex justify-center gap-2">
          {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />} حذف
        </button>
      </div>
    </div>
  </div>
);

// Extracted Azhan List to keep main component clean
const AzhanList = ({ azhanId, azhanVolume, handleVolumeChange, handleSelectAzhan, handlePlayPreview, previewPlayingId, customMuazzins, handleDeleteCustomMuazzin, onAddCustomClick, isPerPrayerEnabled }: any) => {
  return (
    <div className="space-y-4">
      {/* Volume Slider Card */}
      <div className="bg-gradient-to-br from-gold-50 via-amber-50/80 to-orange-50/50 dark:from-navy-800/60 dark:via-navy-900/60 dark:to-navy-950/60 p-5 md:p-6 rounded-2xl border border-gold-100/80 dark:border-navy-700 mb-5 shadow-sm">
        <div className="flex items-center gap-3 md:gap-4 mb-5">
          <div className="p-3 bg-gradient-to-br from-gold-500 to-amber-500 rounded-xl text-white shadow-lg shadow-gold-500/25"><Volume2 size={22} /></div>
          <div className="flex-1">
            <h4 className="font-bold text-navy-800 dark:text-white text-sm md:text-base">مستوى صوت الأذان</h4>
            <p className="text-[10px] md:text-xs text-navy-500 dark:text-navy-400 mt-0.5">يُستخدم لتنبيهات وقت الصلاة</p>
          </div>
          <span className="text-lg md:text-xl font-bold text-gold-600 dark:text-gold-400 bg-white dark:bg-navy-800 px-4 py-2 rounded-xl border border-gold-100 dark:border-navy-700">{azhanVolume}%</span>
        </div>
        <div className="flex items-center gap-3">
          <Volume2 size={18} className="text-gold-500 flex-shrink-0" />
          <div className="flex-1 relative" style={{ direction: 'ltr' }}>
            <input type="range" min="0" max="100" step="5" value={azhanVolume} onChange={(e) => handleVolumeChange(Number(e.target.value))} className="w-full h-2.5 rounded-full appearance-none cursor-pointer"
              style={{ background: `linear-gradient(to right, #D97706 0%, #F59E0B ${azhanVolume}%, ${document.documentElement.classList.contains('dark') ? '#1f2937' : '#e5e7eb'} ${azhanVolume}%, ${document.documentElement.classList.contains('dark') ? '#1f2937' : '#e5e7eb'} 100%)` }} />
          </div>
          <VolumeX size={18} className="text-navy-400 dark:text-navy-500 flex-shrink-0" />
        </div>
        {azhanVolume !== 80 && (
          <button onClick={() => handleVolumeChange(80)} className="mt-3 w-full py-2.5 px-4 bg-white dark:bg-navy-800 hover:bg-navy-50 text-navy-600 dark:text-navy-300 text-xs font-bold rounded-xl border border-navy-100 dark:border-navy-700 flex justify-center gap-2"><RotateCcw size={14} /> إعادة تعيين (٨٠٪)</button>
        )}
      </div>

      {isPerPrayerEnabled && (
        <div className="mb-5 p-4 bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-700 rounded-2xl flex items-start gap-3">
          <AlertCircle className="text-amber-500 flex-shrink-0 mt-0.5" size={18} />
          <div>
            <p className="text-sm font-bold text-amber-700 dark:text-amber-400">تم تفعيل التخصيص لكل صلاة</p>
            <p className="text-[11px] text-amber-600 dark:text-amber-500 mt-1">تغيير المؤذن من هنا سيُطبَّق كمؤذن افتراضي عام.</p>
          </div>
        </div>
      )}

      {MUAZZINS.map(m => {
        const isSelected = azhanId === m.id;
        return (
          <div key={m.id} className={`flex items-center justify-between p-4 md:p-5 rounded-2xl border shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md ${isSelected ? 'bg-gradient-to-br from-gold-50 to-amber-50/50 dark:from-gold-900/15 dark:to-navy-900 border-gold-400 ring-2 ring-gold-400/50' : 'bg-white dark:bg-navy-900/80 border-navy-100 dark:border-navy-800'}`} onClick={() => handleSelectAzhan(m.id)}>
            <div className="flex items-center gap-3 md:gap-4 flex-1">
              <button onClick={(e) => { e.stopPropagation(); handlePlayPreview(m.id, m.name); }} className={`w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center transition-all ${previewPlayingId === m.id ? 'bg-gold-500 text-white shadow-lg' : 'bg-navy-50 dark:bg-navy-800 text-navy-500'}`}>
                {previewPlayingId === m.id ? <Pause size={22} fill="currentColor" /> : <Play size={22} className="ml-0.5" />}
              </button>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`font-bold text-base md:text-lg ${isSelected ? 'text-navy-900 dark:text-white' : 'text-navy-700 dark:text-navy-200'}`}>{m.name}</span>
                  {isSelected && <CheckCircle size={16} className="text-gold-500" />}
                </div>
                <div className="flex gap-2 mt-1.5">
                  <span className="text-[9px] font-bold bg-white dark:bg-navy-950 border border-navy-100 dark:border-navy-700 px-2 py-0.5 rounded-lg text-navy-500">
                    {m.style === 'saudi' || m.id === 'ksa_suraihi' ? 'المدرسة السعودية' : m.style === 'algerian' ? 'المدرسة الجزائرية' : 'المدرسة المصرية'}
                  </span>
                </div>
              </div>
            </div>
            <div className="pr-4 border-r border-navy-100 dark:border-navy-800">
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-gold-500 bg-gold-500 text-white' : 'border-navy-200 dark:border-navy-700'}`}>{isSelected && <Check size={14} strokeWidth={3} />}</div>
            </div>
          </div>
        );
      })}

      {/* Custom Muazzins */}
      {customMuazzins.length > 0 && (
        <>
          <div className="mt-6 mb-3 flex items-center gap-2">
            <div className="h-px flex-1 bg-navy-200 dark:bg-navy-700"></div>
            <span className="text-xs font-bold text-navy-500 dark:text-navy-400 px-2">مؤذنين مخصصين</span>
            <div className="h-px flex-1 bg-navy-200 dark:bg-navy-700"></div>
          </div>
          {customMuazzins.map((cm: any) => {
            const isSelected = azhanId === cm.id;
            return (
              <div key={cm.id} className={`flex items-center justify-between p-4 md:p-5 rounded-2xl border shadow-sm cursor-pointer transition-all ${isSelected ? 'bg-gradient-to-br from-emerald-50 to-green-50/50 dark:from-emerald-900/15 dark:to-navy-900 border-emerald-400 ring-2 ring-emerald-400/50' : 'bg-white dark:bg-navy-900/80 border-navy-100 dark:border-navy-800'}`} onClick={() => handleSelectAzhan(cm.id)}>
                <div className="flex items-center gap-3 md:gap-4 flex-1">
                  <button onClick={(e) => { e.stopPropagation(); handlePlayPreview(cm.id, cm.displayName); }} className={`w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center transition-all ${previewPlayingId === cm.id ? 'bg-emerald-500 text-white shadow-lg' : 'bg-navy-50 dark:bg-navy-800 text-navy-500'}`}>
                    {previewPlayingId === cm.id ? <Pause size={22} fill="currentColor" /> : <Play size={22} className="ml-0.5" />}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-base md:text-lg ${isSelected ? 'text-navy-900 dark:text-white' : 'text-navy-700 dark:text-navy-200'}`}>🎙️ {cm.displayName}</span>
                      {isSelected && <CheckCircle size={16} className="text-emerald-500" />}
                    </div>
                    <span className="text-[10px] text-navy-400 dark:text-navy-500 mt-1 block">{(cm.sizeBytes / 1024 / 1024).toFixed(1)} MB • {new Date(cm.addedAt).toLocaleDateString('ar-EG')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteCustomMuazzin(cm.id, cm.displayName); }} className="p-2 rounded-lg text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 size={18} /></button>
                  <div className="pr-2 border-r border-navy-100 dark:border-navy-800">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-navy-200 dark:border-navy-700'}`}>{isSelected && <Check size={14} strokeWidth={3} />}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      <div className="mt-6">
        <button onClick={onAddCustomClick} className="w-full py-4 px-5 bg-gradient-to-br from-navy-50 to-navy-100/50 dark:from-navy-800/60 dark:to-navy-900/60 border-2 border-dashed border-navy-200 dark:border-navy-700 rounded-2xl text-navy-600 dark:text-navy-300 font-bold text-sm flex items-center justify-center gap-3 transition-all hover:border-gold-400">
          <Plus size={20} className="text-gold-500" /> إضافة مؤذن من الجهاز <span className="text-[10px] font-normal text-navy-400">(MP3 - حد أقصى ١٠ ميجا)</span>
        </button>
      </div>
    </div>
  );
};
