import React, { useState, useEffect, createContext, useContext, useRef, useMemo, useLayoutEffect } from 'react';
import { flushSync } from 'react-dom';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { BookOpen, Search, Grid, Moon, Sun, Activity, BookHeart, Menu, X, Play, Pause, SkipForward, SkipBack, Home, Shield, Calendar, Bookmark, Bell, Info, Headphones, Mic, Repeat, Download, WifiOff, Wifi, Settings, Radio, Signal, Volume2, Check, CheckCircle, Trash2, Type, Square, Heart, RotateCcw, Landmark, Library, Plus, AlertCircle, ShieldCheck, Brain, ChevronDown } from 'lucide-react';

import { fetchSurahs, RECITERS, getAudioUrl } from '../services/api';
import { Surah, RadioStation } from '../types';
import { RADIO_STATIONS } from '../services/radioData';
import { requestNotificationPermission, processScheduledNotifications, scheduleAllNotifications } from '../services/notificationManager';
import { getUnreadCount, getStoredFontSize, setStoredFontSize as saveFontSize, getStoredReciter, setStoredReciter as saveReciter, getStoredAzhan, setStoredAzhan, getNotificationSettings, updateSalahSettings, isPerPrayerMuazzinEnabled, NotificationSettings, getStoredTextAlign, setStoredTextAlign as saveTextAlign, TextAlignMode, getResponsiveDefaultFontSize } from '../services/storage';
import { getTodayPrayerTimesLocal } from '../services/prayerCalculator';
import { getMetadataFromGlobalAyah, getApproxPageFromGlobalAyah, SURAH_AYAH_COUNTS, getSurahGlobalAyahRange, getPageGlobalAyahRangeSync, SURAH_NAMES_TASHKEEL } from '../services/quranStaticData';
import { toArabicDigits } from '../services/normalization';
import { getPlayableUrl, getPlayableAzhanUrl, getDownloadedReciters } from '../services/offlineAudio';
import { AzhanModal } from './AzhanModal';
import { MUAZZINS } from '../services/azhanData';
import { MediaBridge } from '../services/mediaBridge';
import { PermissionGate } from './PermissionGate';
import { Sidebar } from './Sidebar';
import { TestGateModal } from './hifz/TestGateModal';
import { SadaqahBanner } from './SadaqahBanner';




const isAndroid = Capacitor.getPlatform() === 'android';
const isDesktop = typeof window !== 'undefined' && '__TAURI__' in window;

// --- Contexts ---
interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}
const ThemeContext = createContext<ThemeContextType>({ isDark: false, toggleTheme: () => { } });
export const useTheme = () => useContext(ThemeContext);

interface AudioContextType {
  currentTrack: { url: string; title: string; subtitle: string; globalAyahNumber?: number; reciterId?: string } | null;
  isPlaying: boolean;
  autoAdvance: boolean;
  repeatCount: number;
  continuousRepeat: number;
  surahRepeat: number;
  pageRepeat: number;
  rangeStart: number;
  rangeEnd: number;
  rangeRepeat: number;
  playTrack: (url: string, title: string, subtitle: string, globalAyahNumber?: number, shouldAutoAdvance?: boolean, repeatCount?: number, forceReciterId?: string, continuousRepeat?: number, surahRepeat?: number, pageRepeat?: number, rangeStartGlobal?: number, rangeEndGlobal?: number, rangeRepeatCount?: number) => void;
  playNext: () => void;
  playPrev: () => void;
  pauseTrack: () => void;
  closePlayer: () => void;
  togglePlay: () => void;
}
export const AudioContext = createContext<AudioContextType>({
  currentTrack: null,
  isPlaying: false,
  autoAdvance: false,
  repeatCount: 0,
  continuousRepeat: 0,
  surahRepeat: 0,
  pageRepeat: 0,
  rangeStart: 0,
  rangeEnd: 0,
  rangeRepeat: 0,
  playTrack: () => { },
  playNext: () => { },
  playPrev: () => { },
  pauseTrack: () => { },
  closePlayer: () => { },
  togglePlay: () => { },
});
export const useAudio = () => useContext(AudioContext);

interface RadioContextType {
  activeStation: RadioStation | null;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  playStation: (station: RadioStation) => void;
  stopRadio: () => void;
  toggleRadio: () => void;
  playNextStation: () => void;
  playPrevStation: () => void;
  sleepTimerEnd: number | null;
  setSleepTimer: (mins: number) => void;
}
export const RadioContext = createContext<RadioContextType>({
  activeStation: null,
  isPlaying: false,
  isLoading: false,
  error: null,
  playStation: () => { },
  stopRadio: () => { },
  toggleRadio: () => { },
  playNextStation: () => { },
  playPrevStation: () => { },
  sleepTimerEnd: null,
  setSleepTimer: () => { },
});
export const useRadio = () => useContext(RadioContext);

// --- NAVIGATION CONTEXT ---
interface NavigationContextType {
  navigateToAyah: (surahId: number, ayahNumber: number, page?: number) => void;
  openSidebar: () => void;
  isFullscreen: boolean;
  setIsFullscreen: (v: boolean) => void;
}

// Strictly initialized to match interface
export const NavigationContext = createContext<NavigationContextType>({
  navigateToAyah: () => { },
  openSidebar: () => { },
  isFullscreen: false,
  setIsFullscreen: () => { }
});

interface SettingsContextType {
  fontSize: number;
  setFontSize: (size: number) => void;
  textAlign: TextAlignMode;
  setTextAlign: (align: TextAlignMode) => void;
  reciterId: string;
  setReciterId: (id: string) => void;
  azhanId: string;
  setAzhanId: (id: string) => void;
  openSettings: () => void;
  previewPlayingId: string | null;
  handlePreviewAzhan: (id: string, name: string) => void;
}
export const SettingsContext = createContext<SettingsContextType>({
  fontSize: 22,
  setFontSize: () => { },
  textAlign: 'justify',
  setTextAlign: () => { },
  reciterId: 'ar.minshawi_murattal',
  setReciterId: () => { },
  azhanId: 'egy_abdulbasit',
  setAzhanId: () => { },
  openSettings: () => { },
  previewPlayingId: null,
  handlePreviewAzhan: () => { }
});
export const useSettings = () => useContext(SettingsContext);

// --- NETWORK STATUS CONTEXT ---
interface NetworkContextType {
  isOnline: boolean;
}
const NetworkContext = createContext<NetworkContextType>({ isOnline: true });
export const useNetwork = () => useContext(NetworkContext);

// Sidebar extracted to components/Sidebar.tsx

// Audio Player Bar
const AudioPlayerBar = () => {
  const { currentTrack, isPlaying, autoAdvance, repeatCount, continuousRepeat, surahRepeat, pageRepeat, rangeStart, rangeEnd, rangeRepeat, togglePlay, playNext, playPrev, playTrack, closePlayer } = useAudio();
  const { isFullscreen } = useContext(NavigationContext);
  const { reciterId, setReciterId } = useSettings();
  const [showReciterMenu, setShowReciterMenu] = useState(false);
  const [downloadedReciters, setDownloadedReciters] = useState<string[]>([]);

  useEffect(() => {
    if (showReciterMenu) {
      getDownloadedReciters().then(setDownloadedReciters);
    }
  }, [showReciterMenu]);

  if (!currentTrack) return null;

  const activeReciterId = currentTrack.reciterId || reciterId;
  const currentReciter = RECITERS.find(r => r.id === activeReciterId) || RECITERS[0];

  const handleReciterChange = (newReciterId: string) => {
    setReciterId(newReciterId);
    setShowReciterMenu(false);
    if (currentTrack && currentTrack.globalAyahNumber) {
      const newUrl = getAudioUrl(newReciterId, currentTrack.globalAyahNumber);
      playTrack(
        newUrl,
        currentTrack.title,
        currentTrack.subtitle,
        currentTrack.globalAyahNumber,
        autoAdvance,
        repeatCount,
        newReciterId
      );
    }
  };

  // Determine which repeat badge to show (priority: range > ayah > continuous > page > surah > autoAdvance)
  const renderRepeatBadge = () => {
    if (rangeRepeat > 0) {
      // Range repeat (نطاق آيات)
      const startMeta = rangeStart > 0 ? getMetadataFromGlobalAyah(rangeStart) : null;
      const endMeta = rangeEnd > 0 ? getMetadataFromGlobalAyah(rangeEnd) : null;
      return (
        <span className="flex items-center gap-0.5 text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-900/20 px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap">
          <Repeat size={10} /> نطاق {startMeta ? toArabicDigits(startMeta.ayahInSurah) : '?'}-{endMeta ? toArabicDigits(endMeta.ayahInSurah) : '?'} ×{rangeRepeat >= 100 ? '∞' : rangeRepeat}
        </span>
      );
    }
    if (repeatCount > 0 && continuousRepeat === 0) {
      // Single ayah repeat (no auto-advance)
      return (
        <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap">
          <Repeat size={10} /> {repeatCount >= 100 ? '∞' : repeatCount}
        </span>
      );
    }
    if (repeatCount > 0 && continuousRepeat > 0) {
      // Continuous repeat (مع الاستمرار) — show repeat count per ayah
      return (
        <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap">
          <Repeat size={10} /> ×{repeatCount >= 100 ? '∞' : repeatCount} متصل
        </span>
      );
    }
    if (pageRepeat > 0) {
      return (
        <span className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap">
          <Repeat size={10} /> صفحة {pageRepeat >= 100 ? '∞' : pageRepeat}
        </span>
      );
    }
    if (surahRepeat > 0) {
      return (
        <span className="flex items-center gap-0.5 text-purple-600 dark:text-purple-400 font-bold bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap">
          <Repeat size={10} /> سورة {surahRepeat >= 100 ? '∞' : surahRepeat}
        </span>
      );
    }
    if (autoAdvance) {
      return (
        <span className="flex items-center gap-0.5 text-gold-600 dark:text-gold-500 font-bold bg-gold-50 dark:bg-gold-900/20 px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap">
          <Repeat size={10} /> متابعة
        </span>
      );
    }
    return null;
  };

  return (
    <div className={`fixed ${isFullscreen ? 'bottom-4 sm:bottom-6' : 'bottom-[86px] sm:bottom-[92px]'} left-0 right-0 px-2 sm:px-4 z-50 transition-all duration-500 animate-in slide-in-from-bottom-10 pointer-events-none`}>
      {/* Container is pointer-events-none, inner elements must be auto to avoid blocking touches on page content */}
      <div className="max-w-4xl mx-auto w-full relative pointer-events-auto">
      {showReciterMenu && (
        <>
          {/* Backdrop for Mobile/Tablet */}
          <div 
            className="fixed inset-0 bg-navy-950/60 backdrop-blur-sm z-[99] md:hidden pointer-events-auto animate-in fade-in duration-200" 
            onClick={() => setShowReciterMenu(false)}
          />
          
          <div className="fixed md:absolute bottom-0 md:bottom-full left-0 right-0 md:left-6 md:right-auto w-full md:w-[450px] lg:w-[500px] mb-0 md:mb-2 bg-white dark:bg-navy-950 md:bg-white/95 md:dark:bg-navy-950/95 md:backdrop-blur-xl rounded-t-3xl md:rounded-2xl shadow-2xl border-t border-x md:border border-navy-100 dark:border-navy-800 md:border-navy-100 md:dark:border-navy-700 overflow-hidden animate-in slide-in-from-bottom-full md:slide-in-from-bottom-10 md:zoom-in-95 duration-300 md:duration-200 origin-bottom flex flex-col max-h-[80vh] md:max-h-[450px] z-[100] md:z-auto pointer-events-auto">
            {/* Drag Handle for Mobile Bottom Sheet */}
            <div className="flex justify-center py-2 md:hidden bg-navy-50 dark:bg-navy-900/50 shrink-0 border-b border-navy-100/40 dark:border-navy-800/40">
              <div className="w-12 h-1 bg-navy-200 dark:bg-navy-700 rounded-full"></div>
            </div>
            <div className="p-4 border-b border-navy-100 dark:border-navy-800 flex justify-between items-center bg-navy-50 dark:bg-navy-900/50 shrink-0">
              <h4 className="text-sm sm:text-base font-bold text-navy-800 dark:text-white">اختر القارئ</h4>
              <button 
                onClick={() => setShowReciterMenu(false)}
                className="p-2 -mr-2 rounded-xl hover:bg-navy-100/50 dark:hover:bg-navy-800 text-navy-400 hover:text-red-500 transition-colors"
                title="إغلاق"
              >
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-3 overflow-y-auto custom-scrollbar flex-1" ref={(el) => {
              if (el) {
                // Auto-scroll to selected reciter
                const selectedBtn = el.querySelector(`[data-selected="true"]`);
                if (selectedBtn) {
                  selectedBtn.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }
              }
            }}>
              {RECITERS.map(r => (
                <button
                  key={r.id}
                  data-selected={reciterId === r.id}
                  onClick={() => handleReciterChange(r.id)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-200 border min-h-[70px] justify-center relative ${reciterId === r.id
                    ? 'bg-gold-50 border-gold-500 dark:bg-gold-900/40 scale-105 shadow-md shadow-gold-500/20'
                    : 'bg-transparent dark:bg-transparent border-transparent hover:bg-navy-50 dark:hover:bg-navy-800 hover:scale-105'
                    }`}
                >
                  {downloadedReciters.includes(r.id) && (
                    <div className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-[1px] shadow-sm z-20" title="تم تحميله للعمل بدون إنترنت">
                      <Check size={11} strokeWidth={4} />
                    </div>
                  )}
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-navy-100 dark:border-navy-700 shadow-sm relative shrink-0">
                    <div className="absolute inset-0 flex items-center justify-center bg-navy-100 dark:bg-navy-800 text-navy-400">
                      <Mic size={14} />
                    </div>
                    {r.image && (
                      <img
                        src={r.image}
                        alt={r.name}
                        className="relative z-10 w-full h-full object-cover transition-opacity duration-300"
                        onError={(e) => { e.currentTarget.style.opacity = '0'; }}
                      />
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-center text-navy-800 dark:text-navy-200 w-full leading-tight line-clamp-2">{r.name}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="mx-3 md:mx-0 mb-3 md:mb-0">
        <div className="bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border border-gold-300/40 dark:border-gold-500/20 rounded-2xl md:rounded-3xl md:border-b-0 p-3 md:px-6 shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] flex items-center justify-between gap-3 relative overflow-hidden transition-all duration-500">
          
          {/* Subtle glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gold-50/40 to-transparent dark:via-gold-500/5 opacity-60 pointer-events-none"></div>

          <div className="flex items-center gap-3 overflow-hidden flex-1 group cursor-pointer select-none relative z-10" onClick={() => setShowReciterMenu(!showReciterMenu)}>
            <button
              className="relative w-9 h-9 md:w-11 md:h-11 flex-shrink-0 bg-gold-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-gold-500/30 transition-transform group-hover:scale-105"
            >
              {isPlaying ? (
                <div className="flex gap-0.5 items-end h-3">
                  <span className="w-[3px] bg-white animate-[music-bar_1s_ease-in-out_infinite] h-2"></span>
                  <span className="w-[3px] bg-white animate-[music-bar_1.2s_ease-in-out_infinite] h-3.5"></span>
                  <span className="w-[3px] bg-white animate-[music-bar_0.8s_ease-in-out_infinite] h-2.5"></span>
                </div>
              ) : (
                <Headphones size={16} />
              )}
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-navy-800 rounded-full flex items-center justify-center border border-white dark:border-navy-900">
                <Grid size={8} />
              </div>
            </button>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="audio-surah-name text-navy-900 dark:text-gold-300 font-bold truncate transition-colors text-[11px] sm:text-xs md:text-sm" dir="rtl">
                  {currentTrack.title}
                </span>
                <span className="text-navy-300 dark:text-navy-700 text-[10px] sm:text-xs">•</span>
                <span className="text-[10px] sm:text-xs text-navy-500 dark:text-navy-400 font-medium truncate">{currentTrack.subtitle}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="flex items-center gap-1 text-[9px] sm:text-[10px] bg-gradient-to-r from-gold-500/10 to-amber-500/10 text-gold-600 dark:text-gold-400 font-bold px-2 py-0.5 rounded-full border border-gold-200/40 dark:border-gold-500/20 shrink-0 hover:from-gold-500/20 hover:to-amber-500/20 transition-all duration-200">
                  <Mic size={10} className="shrink-0 text-gold-500" />
                  <span>القارئ: {currentReciter.name}</span>
                  <ChevronDown size={10} className="shrink-0 text-gold-500 animate-pulse" />
                </span>
                {renderRepeatBadge()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 md:gap-3 flex-shrink-0 relative z-10">
            <button
              onClick={playPrev}
              className="p-1.5 text-navy-400 hover:text-gold-600 dark:text-navy-400 dark:hover:text-gold-400 transition-colors rounded-full hover:bg-navy-50 dark:hover:bg-navy-800"
              title="الآية السابقة"
            >
              <SkipForward size={16} className="fill-current" />
            </button>

            <button
              onClick={togglePlay}
              className="w-9 h-9 md:w-11 md:h-11 flex items-center justify-center rounded-full bg-navy-900 dark:bg-white text-white dark:text-navy-900 hover:bg-gold-600 dark:hover:bg-gold-400 transition-all shadow-md active:scale-95"
            >
              {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="ml-0.5" />}
            </button>

            <button
              onClick={playNext}
              className="p-1.5 text-navy-400 hover:text-gold-600 dark:text-navy-400 dark:hover:text-gold-400 transition-colors rounded-full hover:bg-navy-50 dark:hover:bg-navy-800"
              title="الآية التالية"
            >
              <SkipBack size={16} className="fill-current" />
            </button>

            <div className="w-px h-5 bg-navy-100 dark:bg-navy-700 mx-0.5"></div>

            <button
              onClick={closePlayer}
              className="p-1.5 text-red-400 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors rounded-full hover:bg-red-50 dark:hover:bg-red-900/20"
              title="إغلاق المشغل"
            >
              <X size={16} />
            </button>
          </div>

        </div>
      </div>
      </div>
    </div>
  );
};

const RadioPlayerBar = () => {
  const { activeStation, isPlaying, isLoading, toggleRadio, stopRadio, playNextStation, playPrevStation, error } = useRadio();
  const { isFullscreen } = useContext(NavigationContext);

  if (!activeStation) return null;

  return (
    <div className={`fixed ${isFullscreen ? 'bottom-4 sm:bottom-6' : 'bottom-[86px] sm:bottom-[92px]'} left-2 right-2 z-50 pointer-events-none flex justify-center transition-all duration-500`}>
      <div className="w-full max-w-3xl pointer-events-auto animate-in slide-in-from-bottom-10 fade-in duration-500">
        <div className={`relative overflow-hidden rounded-2xl md:rounded-3xl p-3 md:p-4 flex items-center justify-between gap-3 md:gap-6 shadow-xl shadow-black/10 hover:shadow-2xl transition-all duration-500 bg-white/95 border border-gold-200/60 backdrop-blur-xl text-navy-900 dark:bg-[#0f172a]/95 dark:border-emerald-500/20 dark:text-white dark:shadow-black/40`}>
          {/* ... Radio content ... */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gold-50/40 to-transparent dark:via-emerald-500/5 opacity-60 animate-pulse pointer-events-none"></div>
          <div className="flex items-center gap-2 md:gap-5 flex-1 min-w-0">
            <div className={`relative w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl shrink-0 flex items-center justify-center transition-colors duration-500 shadow-inner ${isPlaying ? 'bg-gold-500 text-white dark:bg-emerald-600 dark:shadow-emerald-900/30' : 'bg-navy-100 text-navy-400 dark:bg-navy-800 dark:text-navy-500'}`}>
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/80 border-t-transparent rounded-full animate-spin"></div>
              ) : isPlaying ? (
                <div className="flex gap-1 items-end h-5 pb-1">
                  <span className="w-1 bg-white animate-[music-bar_0.6s_ease-in-out_infinite] h-2 rounded-full"></span>
                  <span className="w-1 bg-white animate-[music-bar_0.8s_ease-in-out_infinite] h-4 rounded-full"></span>
                  <span className="w-1 bg-white animate-[music-bar_1.0s_ease-in-out_infinite] h-3 rounded-full"></span>
                </div>
              ) : (
                <Radio size={24} />
              )}
            </div>
            <div className="flex flex-col min-w-0 relative z-10">
              <h3 className="font-bold text-sm md:text-lg truncate leading-tight tracking-tight">{activeStation.name}</h3>
              <div className="flex items-center gap-2 text-xs md:text-sm font-medium mt-0.5">
                <span className={`flex items-center gap-1 ${isPlaying ? "text-emerald-600 dark:text-emerald-400" : error ? "text-amber-500" : "text-navy-400 dark:text-navy-500"}`}>
                  <Signal size={12} className={isPlaying ? "animate-pulse" : ""} />
                  <span className="truncate">{isLoading ? 'جاري الاتصال...' : error ? error : (isPlaying ? 'بث مباشر' : 'متوقف')}</span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 shrink-0 relative z-10 pl-1">
            <button onClick={playPrevStation} title="المحطة السابقة" className="p-2 rounded-full text-navy-500 hover:bg-navy-100/80 dark:text-slate-400 dark:hover:bg-white/10"><SkipForward size={20} className="fill-current md:w-6 md:h-6" /></button>
            <button onClick={toggleRadio} className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 ${isPlaying ? 'bg-navy-900 text-white dark:bg-white dark:text-navy-900' : 'bg-gold-500 text-white dark:bg-emerald-600'}`}>{isPlaying ? <Pause size={18} fill="currentColor" className="md:w-5 md:h-5" /> : <Play size={18} fill="currentColor" className="ml-0.5 md:w-5 md:h-5" />}</button>
            <button onClick={playNextStation} title="المحطة التالية" className="p-2 rounded-full text-navy-500 hover:bg-navy-100/80 dark:text-slate-400 dark:hover:bg-white/10"><SkipBack size={20} className="fill-current md:w-6 md:h-6" /></button>
            <div className="w-px h-6 md:h-8 bg-navy-100 dark:bg-white/10 mx-1 md:mx-1.5"></div>
            <button onClick={stopRadio} className="p-2 rounded-full bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20"><X size={18} className="md:w-5 md:h-5" /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

const DesktopNavItem = ({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all duration-150 group relative overflow-hidden ${isActive
        ? 'bg-gold-50 dark:bg-navy-800 text-gold-700 dark:text-gold-400'
        : 'text-navy-500 dark:text-navy-400 hover:bg-gold-50/50 dark:hover:bg-navy-800/50 hover:text-navy-700 dark:hover:text-white'
      }`
    }
  >
    {({ isActive }) => (
      <>
        {isActive && <div className="absolute right-0 top-0 bottom-0 w-1 bg-gold-500 rounded-l-full"></div>}
        <div className={`transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</div>
        <span>{label}</span>
      </>
    )}
  </NavLink>
);

const NavItem = ({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `group flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-300 relative ${isActive
        ? 'text-gold-600 dark:text-gold-400'
        : 'text-navy-400 dark:text-navy-500 hover:text-navy-600 dark:hover:text-navy-300'
      }`
    }
  >
    {({ isActive }) => (
      <>
        {/* Active Pill Background */}
        <div className={`absolute inset-y-1.5 inset-x-2 rounded-[14px] transition-all duration-300 ${
          isActive ? 'bg-gold-50/80 dark:bg-gold-500/10 shadow-sm border border-gold-100/50 dark:border-gold-500/20' : 'opacity-0 scale-95'
        }`} />
        
        <div
          className={`relative z-10 transition-all duration-300 ${
            isActive ? '-translate-y-1 scale-110 drop-shadow-md' : 'group-hover:scale-105 group-hover:-translate-y-0.5'
          }`}
        >
          {icon}
        </div>
        <span className={`relative z-10 text-[10px] font-bold transition-all duration-300 ${isActive ? '-translate-y-0.5 opacity-100' : 'opacity-80 group-hover:opacity-100'}`}>{label}</span>
      </>
    )}
  </NavLink>
);


export const Layout: React.FC = () => {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const unreadCount = getUnreadCount();

  // Network Status
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Global Resume Listener (Sync UI on Resume)
    let resumeListener: any;
    const setupResumeListener = async () => {
      resumeListener = await App.addListener('resume', () => {
        console.log('[Layout] App Resumed - Triggering Global Sync...');

        // 1. Process local notifications (alarms that might have fired)
        processScheduledNotifications();

        // 2. Dispatch global event for child components (Home, etc.) to refresh
        window.dispatchEvent(new CustomEvent('app-resume'));

        // 3. Force re-check of current Azhan trigger (in case we missed it by seconds)
        // We will need to define checkPrayers outside or trigger it via effect?
        // Layout's checkPrayers loop handles it, but we can't easily call it here unless we refactor.
        // For now, the existing interval in Layout will catch it within 30s, 
        // OR we can rely on 'app-resume' if we move checkPrayers logic.
        // Let's keep it simple: relying on interval for Azhan trigger is fine, 
        // but UI (countdown) needs immediate update which Home.tsx will handle via 'app-resume'.
      });
    };
    setupResumeListener();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (resumeListener) {
        resumeListener.remove();
      }
    };
  }, []);

  // Audio State & Persistence Restoration
  const savedState = useMemo(() => {
    const saved = localStorage.getItem('saved_player_state');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return null;
  }, []);

  const [currentTrack, setCurrentTrack] = useState<{ url: string; title: string; subtitle: string; globalAyahNumber?: number; reciterId?: string } | null>(savedState?.currentTrack || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(savedState?.autoAdvance ?? false);
  const [repeatCount, setRepeatCount] = useState(savedState?.repeatCount ?? 0);
  const [continuousRepeat, setContinuousRepeat] = useState(savedState?.continuousRepeat ?? 0);
  const continuousRepeatRef = useRef(savedState?.continuousRepeat ?? 0);
  const [surahRepeat, setSurahRepeat] = useState(savedState?.surahRepeat ?? 0);
  const surahRepeatRef = useRef(savedState?.surahRepeat ?? 0);
  const [pageRepeat, setPageRepeat] = useState(savedState?.pageRepeat ?? 0);
  const pageRepeatRef = useRef(savedState?.pageRepeat ?? 0);
  const [rangeStart, setRangeStart] = useState(savedState?.rangeStart ?? 0);
  const rangeStartRef = useRef(savedState?.rangeStart ?? 0);
  const [rangeEnd, setRangeEnd] = useState(savedState?.rangeEnd ?? 0);
  const rangeEndRef = useRef(savedState?.rangeEnd ?? 0);
  const [rangeRepeat, setRangeRepeat] = useState(savedState?.rangeRepeat ?? 0);
  const rangeRepeatRef = useRef(savedState?.rangeRepeat ?? 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadAudioRef = useRef<HTMLAudioElement | null>(null);
  const playTrackId = useRef<number>(0);
  const consecutiveErrors = useRef(0);

  // Persist Player State changes
  useEffect(() => {
    if (currentTrack) {
      localStorage.setItem('saved_player_state', JSON.stringify({
        currentTrack,
        autoAdvance,
        repeatCount,
        continuousRepeat,
        surahRepeat,
        pageRepeat,
        rangeStart,
        rangeEnd,
        rangeRepeat
      }));
    } else {
      localStorage.removeItem('saved_player_state');
    }
  }, [currentTrack, autoAdvance, repeatCount, continuousRepeat, surahRepeat, pageRepeat, rangeStart, rangeEnd, rangeRepeat]);

  // Radio State with LocalStorage Persistence
  const [radioStation, setRadioStation] = useState<RadioStation | null>(() => {
    const saved = localStorage.getItem('saved_radio_state');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return null;
  });

  const [isRadioPlaying, setIsRadioPlaying] = useState(false);
  const [radioLoading, setRadioLoading] = useState(false);
  const [radioError, setRadioError] = useState<string | null>(null);
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const radioAudioRef = useRef<HTMLAudioElement | null>(null);
  const [sleepTimerEnd, setSleepTimerEnd] = useState<number | null>(null);

  useEffect(() => {
    if (radioStation) {
      localStorage.setItem('saved_radio_state', JSON.stringify(radioStation));
    } else {
      localStorage.removeItem('saved_radio_state');
    }
  }, [radioStation]);

  // Centralized Audio/Radio Playback State Persistence for startup redirection
  useEffect(() => {
    if (isPlaying) {
      localStorage.setItem('audio_was_playing', 'true');
      localStorage.setItem('last_active_audio_type', 'quran');
    } else if (isRadioPlaying) {
      localStorage.setItem('audio_was_playing', 'true');
      localStorage.setItem('last_active_audio_type', 'radio');
    } else {
      localStorage.setItem('audio_was_playing', 'false');
      localStorage.setItem('last_active_audio_type', 'none');
    }
  }, [isPlaying, isRadioPlaying]);

  const handleSetSleepTimer = async (mins: number) => {
    if (mins > 0) {
      if (isAndroid) {
        try { await MediaBridge.setSleepTimer({ duration: mins }); } catch(e) {}
      }
      setSleepTimerEnd(Date.now() + mins * 60 * 1000);
    } else {
      if (isAndroid) {
        try { await MediaBridge.cancelSleepTimer(); } catch(e) {}
      }
      setSleepTimerEnd(null);
    }
  };

  // Web Fallback Timer & UI Sync
  useEffect(() => {
    if (!sleepTimerEnd) return;
    const interval = setInterval(() => {
      if (Date.now() >= sleepTimerEnd) {
        setSleepTimerEnd(null);
        // If web, perform the stop. If Android, native service will stop and broadcast.
        // We do it here for web fallback, or as a safety net.
        if (!isAndroid) {
          if (isPlaying) pauseTrack();
          if (isRadioPlaying) stopRadio();
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerEnd, isPlaying, isRadioPlaying]);

  // GAPLESS FIX: Track the highest Ayah ID we have already queued to native
  // This prevents the "double-queue" bug where moving to N+1 queues N+2 again
  const lastQueuedAyahRef = useRef<number>(0);

  // AZHAN INTEGRATION: Save track state before Azhan interrupts playback
  // This allows us to resume Quran playback after Azhan ends
  const savedTrackBeforeAzhanRef = useRef<{
    track: { url: string; title: string; subtitle: string; globalAyahNumber?: number } | null;
    wasPlaying: boolean;
    autoAdvance: boolean;
    reciterId: string;
  } | null>(null);

  const activeStationRef = useRef<RadioStation | null>(null);
  const urlIndexRef = useRef<number>(0);

  // Settings State
  const [fontSize, setFontSizeState] = useState(getStoredFontSize());
  const [textAlign, setTextAlignState] = useState<TextAlignMode>(getStoredTextAlign());
  const [reciterId, setReciterIdState] = useState(getStoredReciter());
  const [azhanId, setAzhanIdState] = useState(getStoredAzhan());
  const [perPrayerEnabled, setPerPrayerEnabled] = useState(isPerPrayerMuazzinEnabled());
  const [gestureSettings, setGestureSettings] = useState({ masterEnabled: true, flipEnabled: true, volumeEnabled: true });

  const ToggleSwitch = ({ enabled, onChange }: { enabled: boolean; onChange: (val: boolean) => void }) => (
      <button
          onClick={() => onChange(!enabled)}
          className={`relative w-9 h-5 rounded-full transition-all duration-300 shadow-inner shrink-0 ${enabled
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-emerald-500/30'
              : 'bg-navy-200 dark:bg-navy-700'
              }`}
      >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${enabled ? 'left-4' : 'left-0.5'
              }`} style={{ transform: enabled ? 'translateX(2px)' : 'translateX(0)' }} />
      </button>
  );

  // --- AZHAN STATE ---
  const [azhanModalData, setAzhanModalData] = useState<{ name: string; time: string; isReal?: boolean } | null>(null);
  const lastAzhanTriggered = useRef<string | null>(null);
  // SYNC: Listen for Global Settings Updates (Volume & Azhan ID)
  useEffect(() => {
    const handleSettingsUpdate = (e: CustomEvent) => {
      const newSettings = e.detail.settings as NotificationSettings;
      if (newSettings?.salah?.azhanVolume !== undefined) {
        // Determine if we should update local state
        // Only update if it's different to avoid jitter (though React handles this usually)
        setAzhanVolume(prev => prev !== newSettings.salah.azhanVolume ? newSettings.salah.azhanVolume : prev);
      }
    };

    window.addEventListener('notification-settings-updated', handleSettingsUpdate as EventListener);

    // SYNC: Listen for direct Azhan ID changes (e.g. from Settings Modal)
    const handleAzhanChange = (e: CustomEvent) => {
      setAzhanIdState(e.detail);
    };
    window.addEventListener('azhan-changed', handleAzhanChange as EventListener);

    // SYNC: Listen for Per-Prayer toggle (e.g. from Notification Settings)
    const handlePerPrayerChange = (e: CustomEvent) => {
      setPerPrayerEnabled(e.detail);
    };
    window.addEventListener('per-prayer-changed', handlePerPrayerChange as EventListener);

    return () => {
      window.removeEventListener('notification-settings-updated', handleSettingsUpdate as EventListener);
      window.removeEventListener('azhan-changed', handleAzhanChange as EventListener);
      window.removeEventListener('per-prayer-changed', handlePerPrayerChange as EventListener);
    };
  }, []);
  const [azhanVolume, setAzhanVolume] = useState(getNotificationSettings().salah.azhanVolume ?? 80);

  const azhanPreviewRef = useRef<HTMLAudioElement | null>(null);
  const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null);
  // Audio Preview Logic
  const currentAudioRef = React.useRef<HTMLAudioElement | null>(null);

  const handleAzhanVolumeChange = (newVolume: number) => {
    setAzhanVolume(newVolume);
    updateSalahSettings({ azhanVolume: newVolume });
    if (isAndroid) {
      MediaBridge.setAzhanVolume({ volume: newVolume }).catch(console.error);
    }
  };

  // Prefetch Surahs for Sidebar
  const [surahs, setSurahs] = useState<Surah[]>([]);
  useEffect(() => {
    fetchSurahs().then(setSurahs).catch(console.error);
  }, []);



  const setFontSize = (size: number) => { setFontSizeState(size); saveFontSize(size); };
  const setTextAlign = (align: TextAlignMode) => { setTextAlignState(align); saveTextAlign(align); };
  const setReciterId = (id: string) => { setReciterIdState(id); saveReciter(id); };
  const setAzhanId = async (id: string) => {
    setAzhanIdState(id);
    setStoredAzhan(id);
    // FORCE UPDATE: Reschedule all alarms immediately so the next prayer uses the new Azhan
    console.log('[Layout] Azhan Changed to:', id, '- Triggering Reschedule...');
    await scheduleAllNotifications(undefined, true);
  };

  useEffect(() => { activeStationRef.current = radioStation; }, [radioStation]);
  useEffect(() => { urlIndexRef.current = currentUrlIndex; }, [currentUrlIndex]);

  // Clean up azhan preview when leaving preview route (handled in SettingsPage)

  // --- Initial System Checks & Prayer Watcher ---
  useEffect(() => {
    requestNotificationPermission();
    processScheduledNotifications(); // Process any scheduled notifications that fired while app was closed
    if (isAndroid) {
      // Request all necessary permissions for Adhan to work properly
      MediaBridge.requestNotificationsPermission().catch(console.error);
      MediaBridge.requestBatteryOptimizationBypass().catch(console.error);

      // Check and request exact alarm permission (Android 12+)
      MediaBridge.checkExactAlarmPermission().then(result => {
        if (!result.canScheduleExactAlarms) {
          console.warn('Exact alarms not permitted, requesting...');
          MediaBridge.requestExactAlarmPermission().catch(console.error);
        }
      }).catch(console.error);

      // Request DND access to allow Adhan to bypass Do Not Disturb
      MediaBridge.requestDndAccess().catch(console.error);
    }

    const checkPrayers = () => {
      // On Android and Desktop, we rely on Native backend (AlarmManager / scheduler.rs)
      if (isAndroid || isDesktop) return;

      // Use LOCAL calculation - works offline forever!
      const todayPrayers = getTodayPrayerTimesLocal();
      if (!todayPrayers) return;

      const now = new Date();
      const currentHm = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      if (lastAzhanTriggered.current === currentHm) return;

      const timings = todayPrayers.timings;
      const isFriday = now.getDay() === 5; // Friday detection
      const prayersToCheck = [
        { name: 'الفجر', time: timings.Fajr },
        { name: isFriday ? 'الجمعة' : 'الظهر', time: timings.Dhuhr },
        { name: 'العصر', time: timings.Asr },
        { name: 'المغرب', time: timings.Maghrib },
        { name: 'العشاء', time: timings.Isha }
      ];

      const match = prayersToCheck.find(p => p.time.startsWith(currentHm));

      if (match) {
        setAzhanModalData({ name: `صلاة ${match.name}`, time: match.time });
        lastAzhanTriggered.current = currentHm;

        if (isPlaying) pauseTrack();
        if (isRadioPlaying) stopRadio();
        if (previewPlayingId && azhanPreviewRef.current) {
          azhanPreviewRef.current.pause();
          setPreviewPlayingId(null);
        }
      }
    };

    const timer = setInterval(checkPrayers, 30000);
    checkPrayers();

    // Handle notification taps - navigate to deep link
    const handleNotificationTap = (event: CustomEvent<{ deepLink: string; extra: any }>) => {
      const { deepLink } = event.detail;
      if (deepLink) {
        navigate(deepLink);
      }
    };

    window.addEventListener('notification-tap', handleNotificationTap as EventListener);

    // Check for pending deep link (if app was opened from notification)
    const pendingDeepLink = localStorage.getItem('pending_deep_link');
    if (pendingDeepLink) {
      localStorage.removeItem('pending_deep_link');
      navigate(pendingDeepLink);
    }

    return () => {
      clearInterval(timer);
      window.removeEventListener('notification-tap', handleNotificationTap as EventListener);
    };
  }, [isPlaying, isRadioPlaying, previewPlayingId]);

  const toggleTheme = () => {
    // Enable global transitions ONLY during the switch to prevent lag
    document.body.classList.add('theme-transition');

    // Toggle the theme state
    setIsDark((prev) => !prev);

    // Remove the transition class after the animation completes
    // 300ms duration + small buffer
    setTimeout(() => {
      document.body.classList.remove('theme-transition');
    }, 320);
  };

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const trackRef = useRef(currentTrack);
  const autoAdvanceRef = useRef(autoAdvance);
  const repeatCountRef = useRef(repeatCount);
  const reciterRef = useRef(reciterId);

  useEffect(() => { trackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { autoAdvanceRef.current = autoAdvance; }, [autoAdvance]);
  useEffect(() => { repeatCountRef.current = repeatCount; }, [repeatCount]);
  useEffect(() => { continuousRepeatRef.current = continuousRepeat; }, [continuousRepeat]);
  useEffect(() => { surahRepeatRef.current = surahRepeat; }, [surahRepeat]);
  useEffect(() => { pageRepeatRef.current = pageRepeat; }, [pageRepeat]);
  useEffect(() => { rangeStartRef.current = rangeStart; }, [rangeStart]);
  useEffect(() => { rangeEndRef.current = rangeEnd; }, [rangeEnd]);
  useEffect(() => { rangeRepeatRef.current = rangeRepeat; }, [rangeRepeat]);
  useEffect(() => { reciterRef.current = reciterId; }, [reciterId]);

  useEffect(() => {
    if (!isAndroid && !audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.playbackRate = 1.0;
      audioRef.current.addEventListener('ended', handleTrackEnded);
      audioRef.current.addEventListener('error', handleAudioError);
    }
    if (!isAndroid && !radioAudioRef.current) {
      radioAudioRef.current = new Audio();
      radioAudioRef.current.removeAttribute('crossorigin');

      radioAudioRef.current.onerror = () => {
        const station = activeStationRef.current;
        const idx = urlIndexRef.current;
        if (station && idx < station.url.length - 1) {
          const nextIdx = idx + 1;
          setCurrentUrlIndex(nextIdx);
          if (radioAudioRef.current) {
            const url = station.url[nextIdx];
            radioAudioRef.current.src = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
            radioAudioRef.current.load();
            radioAudioRef.current.play().catch(console.error);
          }
        } else {
          setRadioError("تعذر الاتصال بالبث");
          setRadioLoading(false);
          setIsRadioPlaying(false);
        }
      };

      radioAudioRef.current.onplaying = () => {
        setRadioLoading(false);
        setIsRadioPlaying(true);
        setRadioError(null);
      };
    }
  }, []);

  // Handle Remote Control Events (Next/Prev from Notification)
  useEffect(() => {
    if (!isAndroid) return;

    const listenerPromise = MediaBridge.addListener('controlNotification', (data: { action: 'next' | 'prev' }) => {
      if (data.action === 'next') {
        if (trackRef.current && trackRef.current.globalAyahNumber) {
          // Audio Next
          consecutiveErrors.current = 0;
          const nextAyahNum = trackRef.current.globalAyahNumber + 1;
          if (nextAyahNum <= 6236) {
            const nextMeta = getMetadataFromGlobalAyah(nextAyahNum);
            const currentReciterId = reciterRef.current;
            const nextUrl = getAudioUrl(currentReciterId, nextAyahNum);
            playTrack(nextUrl, `سورة ${nextMeta.surahName}`, `الآية ${toArabicDigits(nextMeta.ayahInSurah)}`, nextAyahNum, autoAdvanceRef.current, 0, currentReciterId);
          }
        } else if (activeStationRef.current) {
          // Radio Next
          const s = activeStationRef.current;
          const idx = RADIO_STATIONS.findIndex(x => x.id === s.id);
          if (idx !== -1) {
            const nextIdx = (idx + 1) % RADIO_STATIONS.length;
            playStation(RADIO_STATIONS[nextIdx]);
          }
        }
      }
      if (data.action === 'prev') {
        if (trackRef.current && trackRef.current.globalAyahNumber) {
          // Audio Prev
          const prevAyahNum = trackRef.current.globalAyahNumber - 1;
          if (prevAyahNum >= 1) {
            const prevMeta = getMetadataFromGlobalAyah(prevAyahNum);
            const currentReciterId = reciterRef.current;
            const nextUrl = getAudioUrl(currentReciterId, prevAyahNum);
            playTrack(nextUrl, `سورة ${prevMeta.surahName}`, `الآية ${toArabicDigits(prevMeta.ayahInSurah)}`, prevAyahNum, autoAdvanceRef.current, 0, currentReciterId);
          }
        } else if (activeStationRef.current) {
          // Radio Prev
          const s = activeStationRef.current;
          const idx = RADIO_STATIONS.findIndex(x => x.id === s.id);
          if (idx !== -1) {
            const nextIdx = (idx - 1 + RADIO_STATIONS.length) % RADIO_STATIONS.length;
            playStation(RADIO_STATIONS[nextIdx]);
          }
        }
      }
    });

    return () => {
      listenerPromise.then(h => h.remove());
    };
  }, []);

  // AZHAN INTEGRATION: Handle Azhan started/finished events for state sync
  useEffect(() => {
    if (!isAndroid && !isDesktop) return;

    // Listen for Azhan start - save current playback state and pause UI
    const startListenerPromise = MediaBridge.addListener('azhanStarted', (data: { prayerName: string, muazzinId?: string, isPreview?: boolean, isReal?: boolean, isPreAlert?: boolean }) => {
      // Skip if this is just a preview (user testing Azhan from settings)
      if (data.isPreview) return;

      console.log('[Layout] \u{1F54C} Azhan Started:', data.prayerName);

      // Save current track state BEFORE Azhan interrupts
      if (trackRef.current && isPlaying) {
        savedTrackBeforeAzhanRef.current = {
          track: { ...trackRef.current },
          wasPlaying: true,
          autoAdvance: autoAdvanceRef.current,
          reciterId: reciterRef.current
        };
        console.log('[Layout] \u{1F4BE} Saved track before Azhan:', savedTrackBeforeAzhanRef.current.track?.globalAyahNumber);
      }

      // Update UI state - Azhan is now playing, not Quran
      setIsPlaying(false);

      if (isDesktop) {
        if (azhanPreviewRef.current) azhanPreviewRef.current.pause();

        if (data.prayerName === 'الصلاة على النبي') {
            const audioUrl = `/audio/${data.muazzinId || 'salawat_one'}.mp3`;
            azhanPreviewRef.current = new Audio(audioUrl);
            azhanPreviewRef.current.volume = azhanVolume / 100;
            
            azhanPreviewRef.current.onended = () => {
                const saved = savedTrackBeforeAzhanRef.current;
                if (saved && saved.wasPlaying && saved.track && saved.track.globalAyahNumber) {
                    playTrack(
                        saved.track.url,
                        saved.track.title,
                        saved.track.subtitle,
                        saved.track.globalAyahNumber,
                        saved.autoAdvance,
                        0,
                        saved.reciterId
                    );
                } else if (saved && saved.wasPlaying) {
                    setIsPlaying(true);
                }
                savedTrackBeforeAzhanRef.current = null;
            };
            azhanPreviewRef.current.play().catch(e => console.error("Desktop salawat playback failed:", e));
        } else if (!data.isPreAlert) {
            // It is an Azhan! Bring the window to the front!
            import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
              const win = getCurrentWindow();
              win.show();
              win.setFocus();
            }).catch(e => console.error("Could not show window:", e));

            // Set Azhan Modal Data. The modal will handle playing the audio itself.
            const timeStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: false });
            setAzhanModalData({ name: `صلاة ${data.prayerName}`, time: timeStr });
            lastAzhanTriggered.current = timeStr;
        }
      }
    });

    // Listen for Azhan end - optionally resume Quran playback
    const endListenerPromise = MediaBridge.addListener('azhanDismissed', () => {
      console.log('[Layout] \u{1F54C} Azhan Finished/Dismissed');

      // Check if we had a track playing before Azhan
      const saved = savedTrackBeforeAzhanRef.current;
      if (saved && saved.wasPlaying && saved.track && saved.track.globalAyahNumber) {
        console.log('[Layout] \u{25B6}\u{FE0F} Resuming Quran from Ayah:', saved.track.globalAyahNumber);

        // Resume playback from where we left off
        playTrack(
          saved.track.url,
          saved.track.title,
          saved.track.subtitle,
          saved.track.globalAyahNumber,
          saved.autoAdvance,
          0, // Reset repeat count
          saved.reciterId
        );
      }

      // Clear saved state
      savedTrackBeforeAzhanRef.current = null;
    });

    return () => {
      startListenerPromise.then(h => h.remove());
      endListenerPromise.then(h => h.remove());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // SALAWAT INTEGRATION: Handle Salawat started/finished events for Quran pause/resume
  useEffect(() => {
    if (!isAndroid && !isDesktop) return;

    // Listen for Salawat start - save current playback state and pause UI
    const salawatStartPromise = MediaBridge.addListener('salawatStarted', () => {
      console.log('[Layout] \u{1F932} Salawat Started');

      // Save current track state BEFORE Salawat interrupts
      // We reuse the same ref as Azhan since only one can be active at a time
      if (trackRef.current && isPlaying) {
        savedTrackBeforeAzhanRef.current = {
          track: { ...trackRef.current },
          wasPlaying: true,
          autoAdvance: autoAdvanceRef.current,
          reciterId: reciterRef.current
        };
        console.log('[Layout] \u{1F4BE} Saved track before Salawat:', savedTrackBeforeAzhanRef.current.track?.globalAyahNumber);
      }

      // Update UI state - Salawat is now playing, not Quran
      setIsPlaying(false);
    });

    // Listen for Salawat end - restore UI state only
    // IMPORTANT: Native (AudioPlaybackService) handles the actual audio resume via savedMediaItem.
    // JS must NOT call playTrack() here to avoid Double Resume (audio starting twice).
    const salawatEndPromise = MediaBridge.addListener('salawatFinished', () => {
      console.log('[Layout] \u{1F932} Salawat Finished - restoring UI state only (native handles audio resume)');

      const saved = savedTrackBeforeAzhanRef.current;
      if (saved && saved.wasPlaying) {
        // Restore UI playback indicator so player controls appear correctly.
        // The actual audio was already resumed by AudioPlaybackService.stopSalawat().
        console.log('[Layout] \u{1F3AE} Restoring UI playing state after Salawat');
        setIsPlaying(true);
      }

      // Always clear saved state
      savedTrackBeforeAzhanRef.current = null;
    });

    return () => {
      salawatStartPromise.then(h => h.remove());
      salawatEndPromise.then(h => h.remove());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  // Handle Native Playback State (Auto-Advance on Android)
  useEffect(() => {
    if (!isAndroid) return;
    const listenerPromise = MediaBridge.addListener('onPlaybackStateChanged', (data: { state: number }) => {
      // STATE_ENDED = 4
      if (data.state === 4) {
        handleTrackEnded();
      }
    });
    return () => { listenerPromise.then(h => h.remove()); };
  }, []);

  // Sync isPlaying state with Native Android Player
  useEffect(() => {
    if (!isAndroid) return;
    const listenerPromise = MediaBridge.addListener('onIsPlayingChanged', (data: { isPlaying: boolean }) => {
      setIsPlaying(data.isPlaying);
    });
    return () => { listenerPromise.then(h => h.remove()); };
  }, []);

  // Handle Native Gapless Transitions
  useEffect(() => {
    if (!isAndroid) return;

    // DEBOUNCING: Prevent duplicate event processing
    let lastTransitionId = '';
    let lastTransitionTime = 0;

    const listenerPromise = MediaBridge.addListener('mediaItemTransition', (data: { mediaId: string, title: string, subtitle: string }) => {
      const now = Date.now();

      // CRITICAL FIX: Ignore duplicate events within 100ms
      if (data.mediaId === lastTransitionId && now - lastTransitionTime < 100) {
        console.log('[Layout] ⚠️ Ignoring duplicate transition event for:', data.mediaId);
        return;
      }

      lastTransitionId = data.mediaId;
      lastTransitionTime = now;

      console.log('[Layout] ✅ Gapless Transition to:', data.mediaId);
      const newGlobalAyah = parseInt(data.mediaId);

      if (!isNaN(newGlobalAyah)) {
        const currentGlobal = trackRef.current?.globalAyahNumber;

        // REPEAT SYNC: Did we wrap around?
        if (currentGlobal) {
          const currentPage = getApproxPageFromGlobalAyah(currentGlobal);
          const pageRange = getPageGlobalAyahRangeSync(currentPage);

          if (rangeStartRef.current > 0 && rangeEndRef.current > 0 && currentGlobal === rangeEndRef.current && newGlobalAyah === rangeStartRef.current) {
            if (rangeRepeatRef.current > 0 && rangeRepeatRef.current !== 100) {
              const newRepeat = rangeRepeatRef.current - 1;
              setRangeRepeat(newRepeat);
              rangeRepeatRef.current = newRepeat;
              console.log('[Layout] 🔁 Wrapped around Range! Remaining repeats:', newRepeat);
            }
          } else if (rangeStartRef.current > 0 && rangeEndRef.current > 0 && currentGlobal === rangeEndRef.current && rangeRepeatRef.current === 0) {
            console.log('[Layout] 🛑 Range Repeat Finished. Stopping playback.');
            MediaBridge.stop();
            setIsPlaying(false);
            setRangeStart(0); rangeStartRef.current = 0;
            setRangeEnd(0); rangeEndRef.current = 0;
            return;
          } else if (pageRepeatRef.current > 0 && pageRange && currentGlobal === pageRange.lastGlobal && newGlobalAyah === pageRange.firstGlobal) {
            const newRepeat = pageRepeatRef.current - 1;
            setPageRepeat(newRepeat);
            pageRepeatRef.current = newRepeat;
            console.log('[Layout] 🔁 Wrapped around Page! Remaining repeats:', newRepeat);
          } else {
            const prevMeta = getMetadataFromGlobalAyah(currentGlobal);
            const newMeta = getMetadataFromGlobalAyah(newGlobalAyah);
            // If we went from last ayah to first ayah of the SAME surah
            if (prevMeta.surahNumber === newMeta.surahNumber && prevMeta.ayahInSurah > newMeta.ayahInSurah) {
              if (surahRepeatRef.current > 0 && surahRepeatRef.current !== 100) {
                const newRepeat = surahRepeatRef.current - 1;
                setSurahRepeat(newRepeat);
                surahRepeatRef.current = newRepeat;
                console.log('[Layout] 🔁 Wrapped around Surah! Remaining repeats:', newRepeat);
              }
            }
          }
        }

        // Update UI State without re-triggering playback
        const newMeta = getMetadataFromGlobalAyah(newGlobalAyah);
        const currentReciterId = reciterRef.current;
        const newUrl = getAudioUrl(currentReciterId, newGlobalAyah); // Just for state

        // Update Track State
        setCurrentTrack({
          url: newUrl,
          title: data.title,
          subtitle: data.subtitle,
          globalAyahNumber: newGlobalAyah,
          reciterId: currentReciterId
        });
        trackRef.current = { url: newUrl, title: data.title, subtitle: data.subtitle, globalAyahNumber: newGlobalAyah, reciterId: currentReciterId }; // Sync ref

        // Dispatch Events for UI Sync (Highlight & Page Turn)
        const nextPage = getApproxPageFromGlobalAyah(newGlobalAyah);
        const currentPage = getApproxPageFromGlobalAyah(newGlobalAyah - 1); // Previous was current

        if (nextPage !== currentPage) {
          window.dispatchEvent(new CustomEvent('audioPageChange', {
            detail: { page: nextPage, surah: newMeta.surahNumber, ayah: newMeta.ayahInSurah }
          }));
        }

        window.dispatchEvent(new CustomEvent('audioAyahChange', {
          detail: { globalAyah: newGlobalAyah, surah: newMeta.surahNumber, ayah: newMeta.ayahInSurah }
        }));

        // GAPLESS: Maintain the buffer by queueing the next track
        // This ensures ExoPlayer always has the next verse ready for seamless transition
        queueNextTrack(newGlobalAyah, currentReciterId, 1).catch(console.error);
      }
    });

    return () => { listenerPromise.then(h => h.remove()); };
  }, []);


  const handleTrackEnded = () => {
    if (repeatCountRef.current > 0) {
      const nextRepeat = repeatCountRef.current >= 100 ? repeatCountRef.current : repeatCountRef.current - 1;
      setRepeatCount(nextRepeat);
      if (isAndroid) {
        if (trackRef.current) {
          playTrack(trackRef.current.url, trackRef.current.title, trackRef.current.subtitle, trackRef.current.globalAyahNumber, autoAdvanceRef.current, nextRepeat, reciterRef.current, continuousRepeatRef.current, surahRepeatRef.current, pageRepeatRef.current, rangeStartRef.current, rangeEndRef.current, rangeRepeatRef.current);
        }
      } else if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(console.error);
      }
      return;
    }
    consecutiveErrors.current = 0;
    if (autoAdvanceRef.current && trackRef.current && trackRef.current.globalAyahNumber) {

      // Protect range repeat from early exit
      if (isAndroid && continuousRepeatRef.current === 0 && rangeStartRef.current === 0) {
        // GAPLESS SOLUTION: Trust Native Queue 100% ONLY IF NOT REPEATING
        // ExoPlayer handles transitions automatically via its internal queue.
        console.log('[Layout] Android: Trusting native gapless queue. No JS intervention.');
        return; // Critical: Exit early, let ExoPlayer do its job
      }

      playNextVerse();
    } else {
      setIsPlaying(false);
    }
  };

  const handleAudioError = (e: Event) => {
    if (autoAdvanceRef.current && trackRef.current && trackRef.current.globalAyahNumber) {
      if (consecutiveErrors.current > 5) { setIsPlaying(false); consecutiveErrors.current = 0; return; }
      consecutiveErrors.current += 1;
      setTimeout(() => { playNextVerse(); }, 200);
    } else {
      setIsPlaying(false);
    }
  };

  /**
   * Helper to queue the next track(s) in the native buffer (Gapless)
   * @param currentGlobalAyah - The currently playing Ayah
   * @param currentReciter - The reciter ID
   * @param depth - How many tracks ahead to queue (default: 1 for stability)
   */
  async function queueNextTrack(currentGlobalAyah: number, currentReciter: string, depth: number = 1) {
    let current = currentGlobalAyah;
    let tempSurahRepeat = surahRepeatRef.current;
    let tempPageRepeat = pageRepeatRef.current;

    let tempRangeRepeat = rangeRepeatRef.current;

    for (let i = 1; i <= depth; i++) {
      const currentMeta = getMetadataFromGlobalAyah(current);
      const surahLength = SURAH_AYAH_COUNTS[currentMeta.surahNumber - 1];

      let nextGlobal = current + 1;
      
      const currentPage = getApproxPageFromGlobalAyah(current);
      const pageRange = getPageGlobalAyahRangeSync(currentPage);

      // Predict loop: Range > Page > Surah
      if (rangeStartRef.current > 0 && rangeEndRef.current > 0 && current === rangeEndRef.current && tempRangeRepeat > 0) {
          nextGlobal = rangeStartRef.current;
          if (tempRangeRepeat !== 100) tempRangeRepeat -= 1;
      } else if (rangeStartRef.current > 0 && rangeEndRef.current > 0 && current === rangeEndRef.current && tempRangeRepeat === 0) {
          break; // Range finished
      } else if (pageRange && current === pageRange.lastGlobal && tempPageRepeat > 0) {
          nextGlobal = pageRange.firstGlobal;
          if (tempPageRepeat !== 100) tempPageRepeat -= 1;
      } else if (currentMeta.ayahInSurah === surahLength && tempSurahRepeat > 0) {
          nextGlobal = getSurahGlobalAyahRange(currentMeta.surahNumber).firstGlobal;
          if (tempSurahRepeat !== 100) tempSurahRepeat -= 1;
      }

      if (nextGlobal > 6236) break;

      // GAPLESS FIX: Smart Queueing with Immediate Lock
      // Only queue if this Ayah is NEW (using strict inequality to allow looping backwards)
      if (nextGlobal !== lastQueuedAyahRef.current) {

        // CRITICAL FIX: Update tracker IMMEDIATELY before async operation
        // This prevents race conditions where two events check the ref before either updates it
        lastQueuedAyahRef.current = nextGlobal;

        const nextMeta = getMetadataFromGlobalAyah(nextGlobal);
        const playableNextUrl = await getPlayableUrl(currentReciter, nextGlobal);

        console.log(`[Layout] ✅ Queueing Track (surahRepeat=${tempSurahRepeat}):`, nextGlobal);

        await MediaBridge.queueNext({
          url: playableNextUrl,
          title: `سورة ${nextMeta.surahName}`,
          subtitle: `الآية ${toArabicDigits(nextMeta.ayahInSurah)}`,
          mediaId: nextGlobal.toString()
        });
      } else {
        // Debug log to confirm the fix is working
        console.log(`[Layout] ⏭️ Skipped duplicate queue for Ayah ${nextGlobal}`);
      }
      current = nextGlobal;
    }
  }

  const playNextVerse = () => {
    const currentGlobal = trackRef.current?.globalAyahNumber;
    if (!currentGlobal) return;
    
    let nextGlobal = currentGlobal + 1;
    let newSurahRepeat = surahRepeatRef.current;
    let newPageRepeat = pageRepeatRef.current;
    let newRangeRepeat = rangeRepeatRef.current;
    
    const currentMeta = getMetadataFromGlobalAyah(currentGlobal);
    const surahLength = SURAH_AYAH_COUNTS[currentMeta.surahNumber - 1];
    
    // REPEAT LOGIC: Range Repeat (highest priority) > Page Repeat > Surah Repeat
    const currentPage = getApproxPageFromGlobalAyah(currentGlobal);
    const pageRange = getPageGlobalAyahRangeSync(currentPage);

    // Range Repeat: loop from rangeEnd back to rangeStart
    if (rangeStartRef.current > 0 && rangeEndRef.current > 0 && currentGlobal === rangeEndRef.current && newRangeRepeat > 0) {
      if (newRangeRepeat !== 100) newRangeRepeat -= 1;
      setRangeRepeat(newRangeRepeat);
      rangeRepeatRef.current = newRangeRepeat;
      nextGlobal = rangeStartRef.current;
    } else if (rangeStartRef.current > 0 && rangeEndRef.current > 0 && currentGlobal === rangeEndRef.current && newRangeRepeat === 0) {
      // Range finished - stop playback
      setIsPlaying(false);
      setRangeStart(0); rangeStartRef.current = 0;
      setRangeEnd(0); rangeEndRef.current = 0;
      return;
    } else if (pageRange && currentGlobal === pageRange.lastGlobal && newPageRepeat > 0) {
      if (newPageRepeat !== 100) newPageRepeat -= 1;
      setPageRepeat(newPageRepeat);
      pageRepeatRef.current = newPageRepeat;
      nextGlobal = pageRange.firstGlobal;
    } else if (currentMeta.ayahInSurah === surahLength && newSurahRepeat > 0) {
      if (newSurahRepeat !== 100) newSurahRepeat -= 1;
      setSurahRepeat(newSurahRepeat);
      surahRepeatRef.current = newSurahRepeat;
      // Loop back to the first Ayah of the current Surah
      nextGlobal = getSurahGlobalAyahRange(currentMeta.surahNumber).firstGlobal;
    }

    if (nextGlobal <= 6236) {
      const nextMeta = getMetadataFromGlobalAyah(nextGlobal);
      const currentReciterId = reciterRef.current;
      const nextUrl = getAudioUrl(currentReciterId, nextGlobal);

      // Calculate page change for auto-navigation
      const nextPage = getApproxPageFromGlobalAyah(nextGlobal);
      const currentPage = getApproxPageFromGlobalAyah(currentGlobal);

      if (nextPage !== currentPage) {
        // Navigate reader to the new page containing this ayah
        const event = new CustomEvent('audioPageChange', {
          detail: { page: nextPage, surah: nextMeta.surahNumber, ayah: nextMeta.ayahInSurah }
        });
        window.dispatchEvent(event);
      }

      // Also dispatch ayah highlight event for syncing the highlighted ayah
      const highlightEvent = new CustomEvent('audioAyahChange', {
        detail: { globalAyah: nextGlobal, surah: nextMeta.surahNumber, ayah: nextMeta.ayahInSurah }
      });
      window.dispatchEvent(highlightEvent);

      // Apply continuous repeat logic to the NEXT track
      const newRepeatCount = continuousRepeatRef.current > 0 ? continuousRepeatRef.current : 0;
      setRepeatCount(newRepeatCount);
      repeatCountRef.current = newRepeatCount;

      // WEB GAPLESS: Disable preloaded gapless swap if repeating to prevent audio context overlaps
      if (!isAndroid && preloadAudioRef.current && newRepeatCount === 0) {
        // Swap players for seamless transition
        const oldAudio = audioRef.current;
        audioRef.current = preloadAudioRef.current;
        preloadAudioRef.current = null;

        // Update track state BEFORE playing
        const newTrack = {
          url: nextUrl,
          title: `سورة ${nextMeta.surahName}`,
          subtitle: `الآية ${toArabicDigits(nextMeta.ayahInSurah)}`,
          globalAyahNumber: nextGlobal
        };
        setCurrentTrack(newTrack);
        trackRef.current = newTrack;

        // Setup event listeners on the new audio element
        audioRef.current.addEventListener('ended', handleTrackEnded);
        audioRef.current.addEventListener('error', handleAudioError);

        // Start playback immediately (already buffered!)
        audioRef.current.play().catch(console.error);

        // Preload the NEXT track (N+2 relative to original)
        const afterNextMeta = getMetadataFromGlobalAyah(nextGlobal);
        const afterNextSurahLength = SURAH_AYAH_COUNTS[afterNextMeta.surahNumber - 1];
        let afterNextGlobal = nextGlobal + 1;
        
        const afterNextPage = getApproxPageFromGlobalAyah(nextGlobal);
        const afterNextPageRange = getPageGlobalAyahRangeSync(afterNextPage);

        if (rangeStartRef.current > 0 && rangeEndRef.current > 0 && nextGlobal === rangeEndRef.current && newRangeRepeat > 0) {
            afterNextGlobal = rangeStartRef.current;
        } else if (rangeStartRef.current > 0 && rangeEndRef.current > 0 && nextGlobal === rangeEndRef.current && newRangeRepeat === 0) {
            afterNextGlobal = 6237; // Out of bounds so it doesn't preload
        } else if (afterNextPageRange && nextGlobal === afterNextPageRange.lastGlobal && newPageRepeat > 0) {
            afterNextGlobal = afterNextPageRange.firstGlobal;
        } else if (afterNextMeta.ayahInSurah === afterNextSurahLength && newSurahRepeat > 0) {
            afterNextGlobal = getSurahGlobalAyahRange(afterNextMeta.surahNumber).firstGlobal;
        }

        if (afterNextGlobal <= 6236) {
          const afterNextUrl = getAudioUrl(currentReciterId, afterNextGlobal);
          const preloader = new Audio(afterNextUrl);
          preloader.preload = 'auto';
          preloader.load();
          preloadAudioRef.current = preloader;
        }

        // Cleanup old audio
        if (oldAudio) {
          oldAudio.removeEventListener('ended', handleTrackEnded);
          oldAudio.removeEventListener('error', handleAudioError);
          oldAudio.pause();
          oldAudio.src = '';
        }

        console.log('[Layout] Web Gapless: Swapped to preloaded audio for Ayah', nextGlobal);
        return;
      }

      playTrack(nextUrl, `سورة ${nextMeta.surahName}`, `الآية ${toArabicDigits(nextMeta.ayahInSurah)}`, nextGlobal, true, newRepeatCount, currentReciterId, continuousRepeatRef.current, surahRepeatRef.current, pageRepeatRef.current, rangeStartRef.current, rangeEndRef.current, rangeRepeatRef.current);
    } else {
      setIsPlaying(false);
    }
  };

  const playTrack = async (url: string, title: string, subtitle: string, globalAyahNumber?: number, shouldAutoAdvance = false, repeat = 0, forceReciterId?: string, continuousRepeatCount = 0, surahRepeatCount = 0, pageRepeatCount = 0, rangeStartGlobal = 0, rangeEndGlobal = 0, rangeRepeatCount = 0) => {
    if (activeStationRef.current) stopRadio();
    if (previewPlayingId && azhanPreviewRef.current) { azhanPreviewRef.current.pause(); setPreviewPlayingId(null); }
    const requestId = ++playTrackId.current;
    
    // Set continuous, surah, page, and range repeat flags
    setContinuousRepeat(continuousRepeatCount);
    continuousRepeatRef.current = continuousRepeatCount;
    setSurahRepeat(surahRepeatCount);
    surahRepeatRef.current = surahRepeatCount;
    setPageRepeat(pageRepeatCount);
    pageRepeatRef.current = pageRepeatCount;
    setRangeStart(rangeStartGlobal);
    rangeStartRef.current = rangeStartGlobal;
    setRangeEnd(rangeEndGlobal);
    rangeEndRef.current = rangeEndGlobal;
    setRangeRepeat(rangeRepeatCount);
    rangeRepeatRef.current = rangeRepeatCount;

    const targetReciterId = forceReciterId || reciterId;
    let finalUrl = url;
    if (globalAyahNumber && targetReciterId) {
      try { finalUrl = await getPlayableUrl(targetReciterId, globalAyahNumber); } catch (e) { }
    }
    if (requestId !== playTrackId.current) return;

    try {
      if (isAndroid) {
        // Native Android Playback ONLY
        await MediaBridge.play({
          url: finalUrl,
          title: title,
          subtitle: subtitle,
          mediaId: globalAyahNumber?.toString(), // Use Ayah ID for tracking
          artworkUrl: 'https://al-bayan.app/icon-512.png',
          isStream: false
        });

        // GAPLESS FIX: Reset the queue tracker whenever we start a fresh track
        // The native player clears its queue on .play(), so we must clear our tracker too.
        if (globalAyahNumber) {
          lastQueuedAyahRef.current = globalAyahNumber;
        }

        // GAPLESS: Immediately queue the next track if Auto-Advance is on AND no repetitions
        if (shouldAutoAdvance && globalAyahNumber && repeat === 0 && continuousRepeatCount === 0) {
          // Queue N+1 to enable seamless native transitions
          queueNextTrack(globalAyahNumber, targetReciterId, 1).catch(e => console.warn('Queue failed', e));
        }

        consecutiveErrors.current = 0;
      } else {
        // Web Playback Logic ONLY
        if (!audioRef.current) return;

        if (audioRef.current.src !== finalUrl) {
          audioRef.current.src = finalUrl;
          audioRef.current.load();
        }

        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            consecutiveErrors.current = 0;
            if (globalAyahNumber) {
              let tempSurahRepeat = surahRepeatCount;
              let tempPageRepeat = pageRepeatCount;

              const currentMeta = getMetadataFromGlobalAyah(globalAyahNumber);
              const surahLength = SURAH_AYAH_COUNTS[currentMeta.surahNumber - 1];
              let nextGlobal = globalAyahNumber + 1;

              const currentPage = getApproxPageFromGlobalAyah(globalAyahNumber);
              const pageRange = getPageGlobalAyahRangeSync(currentPage);

              let tempRangeRepeat = rangeRepeatCount;

              if (rangeStartGlobal > 0 && rangeEndGlobal > 0 && globalAyahNumber === rangeEndGlobal && tempRangeRepeat > 0) {
                  nextGlobal = rangeStartGlobal;
              } else if (rangeStartGlobal > 0 && rangeEndGlobal > 0 && globalAyahNumber === rangeEndGlobal && tempRangeRepeat === 0) {
                  nextGlobal = 6237; // Out of bounds
              } else if (pageRange && globalAyahNumber === pageRange.lastGlobal && tempPageRepeat > 0) {
                  nextGlobal = pageRange.firstGlobal;
              } else if (currentMeta.ayahInSurah === surahLength && tempSurahRepeat > 0) {
                  nextGlobal = getSurahGlobalAyahRange(currentMeta.surahNumber).firstGlobal;
              }

              if (nextGlobal <= 6236) {
                const nextUrl = getAudioUrl(targetReciterId, nextGlobal);
                const preloader = new Audio(nextUrl);
                preloader.preload = 'auto';
                preloader.load();
                preloadAudioRef.current = preloader;
              }
            }
          }).catch(error => {
            if (error.name !== 'AbortError') {
              if (shouldAutoAdvance && globalAyahNumber && consecutiveErrors.current <= 5) {
                consecutiveErrors.current += 1;
                setTimeout(() => playNextVerse(), 200);
              } else {
                setIsPlaying(false);
              }
            }
          });
        }
      }
    } catch (e) { setIsPlaying(false); }

    setCurrentTrack({ url, title, subtitle, globalAyahNumber, reciterId: targetReciterId });
    setIsPlaying(true);
    setAutoAdvance(shouldAutoAdvance);
    setRepeatCount(repeat);
  };

  const pauseTrack = () => {
    if (isAndroid) {
      MediaBridge.pause();
    } else {
      audioRef.current?.pause();
    }
    setIsPlaying(false);
  };

  const closePlayer = () => {
    if (isAndroid) {
      MediaBridge.stop();
    } else if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    if ('mediaSession' in navigator) { navigator.mediaSession.playbackState = 'none'; navigator.mediaSession.metadata = null; }
    setIsPlaying(false);
    setCurrentTrack(null);
    setAutoAdvance(false);
    setRepeatCount(0);
    setRangeStart(0); rangeStartRef.current = 0;
    setRangeEnd(0); rangeEndRef.current = 0;
    setRangeRepeat(0); rangeRepeatRef.current = 0;
    consecutiveErrors.current = 0;
  };

  const togglePlay = () => {
    if (isPlaying) {
      pauseTrack();
    }
    else if (currentTrack) {
      if (activeStationRef.current) stopRadio();
      if (isAndroid) {
        // Safe playTrack invocation to guarantee the native player is correctly loaded, initialized, and playing
        playTrack(
          currentTrack.url,
          currentTrack.title,
          currentTrack.subtitle,
          currentTrack.globalAyahNumber,
          autoAdvance,
          repeatCount,
          currentTrack.reciterId || reciterId,
          continuousRepeat,
          surahRepeat,
          pageRepeat,
          rangeStart,
          rangeEnd,
          rangeRepeat
        );
      } else if (audioRef.current) {
        if (!audioRef.current.src || audioRef.current.src === '') {
          audioRef.current.src = currentTrack.url;
          audioRef.current.load();
        }
        audioRef.current.play().catch(console.error);
        setIsPlaying(true);
      }
    }
  };

  const manualChangeTrack = (offset: number) => {
    if (!currentTrack || !currentTrack.globalAyahNumber) return;
    const nextAyahNum = currentTrack.globalAyahNumber + offset;
    if (nextAyahNum < 1 || nextAyahNum > 6236) return;
    consecutiveErrors.current = 0;
    const nextMeta = getMetadataFromGlobalAyah(nextAyahNum);
    const currentReciterId = reciterRef.current;
    const nextUrl = getAudioUrl(currentReciterId, nextAyahNum);

    // Calculate page for the next ayah and navigate if user is on reader page
    // This enables the "follow-along" experience during continuous playback
    const nextPage = getApproxPageFromGlobalAyah(nextAyahNum);
    const currentPage = getApproxPageFromGlobalAyah(currentTrack.globalAyahNumber);

    if (nextPage !== currentPage) {
      // Navigate the reader to the new page containing this ayah
      // This will trigger automatically if user is on the QuranReader page
      const event = new CustomEvent('audioPageChange', {
        detail: { page: nextPage, surah: nextMeta.surahNumber, ayah: nextMeta.ayahInSurah }
      });
      window.dispatchEvent(event);
    }

    playTrack(nextUrl, `سورة ${nextMeta.surahName}`, `الآية ${toArabicDigits(nextMeta.ayahInSurah)}`, nextAyahNum, autoAdvance, 0, currentReciterId, continuousRepeatRef.current, surahRepeatRef.current, pageRepeatRef.current, rangeStartRef.current, rangeEndRef.current, rangeRepeatRef.current);
  };

  const playStation = (station: RadioStation) => {
    if (trackRef.current) closePlayer();
    if (previewPlayingId && azhanPreviewRef.current) { azhanPreviewRef.current.pause(); setPreviewPlayingId(null); }
    setRadioStation(station);
    setRadioLoading(true);
    setRadioError(null);
    setCurrentUrlIndex(0);

    const url = station.url[0];
    const finalUrl = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;

    if (isAndroid) {
      // Native Radio
      MediaBridge.play({
        url: finalUrl,
        title: station.name,
        subtitle: 'بث مباشر',
        artworkUrl: station.img || 'https://al-bayan.app/icon-512.png',
        isStream: true
      });
      // Mock loading state for native as it handles itself
      setTimeout(() => {
        setRadioLoading(false);
        setIsRadioPlaying(true);
      }, 1000);
    } else if (radioAudioRef.current) {
      // Web Radio
      radioAudioRef.current.src = finalUrl;
      radioAudioRef.current.load();
      radioAudioRef.current.play().catch(e => {
        if (e.name !== 'AbortError') radioAudioRef.current?.dispatchEvent(new Event('error'));
      });
    }
  };

  const stopRadio = () => {
    if (isAndroid) {
      MediaBridge.stop();
    } else if (radioAudioRef.current) {
      radioAudioRef.current.pause();
      radioAudioRef.current.src = "";
    }
    setRadioStation(null);
    setIsRadioPlaying(false);
    setRadioLoading(false);
    setRadioError(null);
  };

  const toggleRadio = () => {
    if (isRadioPlaying) {
      if (isAndroid) {
        MediaBridge.pause();
      } else {
        radioAudioRef.current?.pause();
      }
      setIsRadioPlaying(false);
    } else {
      if (radioStation) {
        if (trackRef.current) closePlayer();
        if (isAndroid) {
          setRadioLoading(true);
          playStation(radioStation); // Use playStation to re-trigger
        } else if (radioAudioRef.current && radioAudioRef.current.src) {
          setRadioLoading(true);
          radioAudioRef.current.play().catch(() => { });
        } else {
          playStation(radioStation);
        }
      }
    }
  };

  const changeStation = (direction: 'next' | 'prev') => {
    if (!radioStation) return;
    const currentIndex = RADIO_STATIONS.findIndex(s => s.id === radioStation.id);
    if (currentIndex === -1) return;
    let nextIndex;
    if (direction === 'next') {
      nextIndex = (currentIndex + 1) % RADIO_STATIONS.length;
    } else {
      nextIndex = (currentIndex - 1 + RADIO_STATIONS.length) % RADIO_STATIONS.length;
    }
    playStation(RADIO_STATIONS[nextIndex]);
  };

  // Listen for Native Azhan Dismissal
  useEffect(() => {
    if (!isAndroid) return;
    const listenerPromise = MediaBridge.addListener('azhanDismissed', () => {
      if (previewPlayingId) {
        setPreviewPlayingId(null);
        if (azhanPreviewRef.current) azhanPreviewRef.current.pause();
      }
    });
    return () => { listenerPromise.then(h => h.remove()); };
  }, [previewPlayingId]);

  // Listen for Native Sleep Timer Finished
  useEffect(() => {
    if (!isAndroid) return;
    const listenerPromise = MediaBridge.addListener('sleepTimerFinished', () => {
      setSleepTimerEnd(null);
      savedTrackBeforeAzhanRef.current = null;
      if (currentTrack) pauseTrack();
      if (isRadioPlaying) stopRadio();
    });
    return () => { listenerPromise.then(h => h.remove()); };
  }, [currentTrack, isRadioPlaying]);

  // Listen for Native Azhan Start (Android)
  useEffect(() => {
    if (!isAndroid) return;
    const listenerPromise = MediaBridge.addListener('azhanStarted', (data: { prayerName: string, muazzinId: string, isPreview?: boolean, isReal?: boolean }) => {
      // Always manage audio conflicts
      // Always manage audio conflicts
      // CRITICAL FIX: Do NOT call MediaBridge.pause/stop() if isAndroid is true!
      // The Native AudioService is ALREADY playing the Azhan (which shares the ExoPlayer).
      // Sending pause/stop commands here would immediately kill the Azhan that just started.
      if (currentTrack) {
        if (isAndroid) {
          setIsPlaying(false); // Just update UI state
        } else {
          pauseTrack(); // Web: Pause audio element
        }
      }
      if (isRadioPlaying) {
        if (isAndroid) {
          setIsRadioPlaying(false);
          setRadioStation(null);
          setRadioLoading(false);
        } else {
          stopRadio(); // Web: Stop audio element
        }
      }

      // Always update playing ID (for list icons/states)
      if (data.muazzinId) {
        // FIX: If we are currently previewing 'random', keep it as 'random' 
        // even though native reports the resolved real ID (e.g. 'egy_abdulbasit')
        setPreviewPlayingId(prev => {
          if (prev === 'random' && data.muazzinId !== 'random') return 'random';
          return data.muazzinId;
        });
      }

      // FIX: Double Interface Prevention
      // Check if this is a Preview vs Real Azhan based on explicit flag from native
      const isPreview = data.isPreview ?? (data.prayerName?.includes('معاينة') || data.prayerName?.startsWith('أذان '));

      if (isPreview) {
        console.log('[Layout] Preview started (Flag) - Skipping Global Modal');
        return;
      }

      const now = new Date();
      const formattedTime = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

      setAzhanModalData({
        name: data.prayerName || 'الصلاة',
        time: formattedTime,
        isReal: true // Mark as real to avoid double-playing in Modal
      });
    });
    return () => { listenerPromise.then(h => h.remove()); };
  }, [currentTrack, isRadioPlaying]);

  const handlePreviewAzhan = async (id: string, name: string) => {
    if (currentTrack) pauseTrack();
    if (isRadioPlaying) stopRadio();

    // If already playing this ID, stop it
    if (previewPlayingId === id) {
      if (azhanPreviewRef.current) azhanPreviewRef.current.pause();
      if (isAndroid) await MediaBridge.stop();
      setPreviewPlayingId(null);
      setAzhanModalData(null); // Close modal if open
      return;
    }

    // Stop partial playback
    if (previewPlayingId) {
      if (azhanPreviewRef.current) azhanPreviewRef.current.pause();
      if (isAndroid) await MediaBridge.stop();
    }

    setPreviewPlayingId(id);

    // Open the standardized Azhan Modal for ALL platforms
    // This ensures consistent UI (Glassmorphism) and logic
    const now = new Date();
    const formattedTime = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

    // Pass the specific muazzin ID to the modal via a temporary storage or prop
    // Since AzhanModal normally reads from storage, we might need a way to override it.
    // However, AzhanModal takes `prayerName` and `prayerTime`. 
    // It reads `getStoredAzhan()` internally. 
    // We need to tell it WHICH muazzin to play.
    // The current AzhanModal implementation reads `getStoredAzhan` on mount.
    // To support previewing *specific* muazzins, we should pass the muazzinIf as a prop?
    // Looking at AzhanModal props: { prayerName, prayerTime, onClose }
    // It does NOT take an ID. It uses the stored preference.
    // FIX: We need to temporarily set the stored preference OR update AzhanModal to accept an optional `overrideAzhanId`.

    // For now, let's update AzhanModal to allow overriding the ID, but first let's just render it.
    // Actually, simply passing the ID to AzhanModal is better. 
    // But I can't change the props interface in this Replace block without breaking other usages?
    // Other usage in Layout lines 1459 just passes name/time.
    // I will use a clever hack: save the ID to storage? No, that changes user settings.
    // I should simply update AzhanModal to accept `initialAzhanId`.
    // BUT since I am editing Layout first, let's simply render the modal.
    // I'll assume AzhanModal will be updated to handle the `previewId` if I pass it, 
    // OR I can use a context/global state.
    // Wait, `Downloads.tsx` sets `setAzhanModalPreview`.
    // It passes `muazzinName` but not ID?
    // Let's look at Downloads.tsx line 134: `setAzhanModalPreview({ muazzinName });`
    // And `handleSelectAzhan` sets `setAzhanId(id)` (line 138).
    // So Downloads works because it UPDATES the stored ID.
    // Settings menu works similarly? 
    // Line 1279 in Layout.tsx: `onClick={() => setAzhanId(m.id)}`.
    // So `setAzhanId` IS called when clicking the item card.
    // Then `handlePreviewAzhan` is called via button click.
    // So the stored ID *is* updated to the one being previewed.
    // So AzhanModal will pick it up automatically!

    setAzhanModalData({
      name: 'معاينة الأذان',
      time: formattedTime
    });
  };

  // --- Tauri Desktop Tray Media Controls ---
  useEffect(() => {
    if (!isDesktop) return;
    
    let unlistenPlayPause: () => void;
    let unlistenNext: () => void;
    let unlistenPrev: () => void;
    let unlistenStop: () => void;

    import('@tauri-apps/api/event').then(({ listen }) => {
      listen('tray-play-pause', () => {
        if (trackRef.current) togglePlay();
        else if (activeStationRef.current) toggleRadio();
      }).then(f => unlistenPlayPause = f);
      
      listen('tray-next', () => {
        if (trackRef.current) manualChangeTrack(1);
        else if (activeStationRef.current) changeStation('next');
      }).then(f => unlistenNext = f);
      
      listen('tray-prev', () => {
        if (trackRef.current) manualChangeTrack(-1);
        else if (activeStationRef.current) changeStation('prev');
      }).then(f => unlistenPrev = f);
      
      listen('tray-stop', () => {
        if (trackRef.current) closePlayer();
        else if (activeStationRef.current) stopRadio();
      }).then(f => unlistenStop = f);
    });

    return () => {
      if (unlistenPlayPause) unlistenPlayPause();
      if (unlistenNext) unlistenNext();
      if (unlistenPrev) unlistenPrev();
      if (unlistenStop) unlistenStop();
    };
  }, []);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      if (currentTrack) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title,
          artist: currentTrack.subtitle,
          album: 'البيان - القرآن الكريم',
          artwork: [{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' }]
        });
        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
        navigator.mediaSession.setActionHandler('play', togglePlay);
        navigator.mediaSession.setActionHandler('pause', togglePlay);
        navigator.mediaSession.setActionHandler('previoustrack', () => manualChangeTrack(-1));
        navigator.mediaSession.setActionHandler('nexttrack', () => manualChangeTrack(1));
        navigator.mediaSession.setActionHandler('stop', closePlayer);
      } else if (radioStation) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: radioStation.name,
          artist: 'الإذاعة المباشرة',
          album: 'البيان',
          artwork: [{ src: radioStation.img || '/icon-512.png', sizes: '512x512', type: 'image/png' }]
        });
        navigator.mediaSession.playbackState = isRadioPlaying ? 'playing' : 'paused';
        navigator.mediaSession.setActionHandler('play', toggleRadio);
        navigator.mediaSession.setActionHandler('pause', toggleRadio);
        navigator.mediaSession.setActionHandler('previoustrack', () => changeStation('prev'));
        navigator.mediaSession.setActionHandler('nexttrack', () => changeStation('next'));
        navigator.mediaSession.setActionHandler('stop', stopRadio);
      } else {
        navigator.mediaSession.playbackState = 'none';
      }
    }
  }, [currentTrack, isPlaying, radioStation, isRadioPlaying]);

  const themeContextValue = useMemo(() => ({ isDark, toggleTheme }), [isDark]);
  const settingsContextValue = useMemo(() => ({ fontSize, setFontSize, textAlign, setTextAlign, reciterId, setReciterId, azhanId, setAzhanId, openSettings: () => navigate('/settings'), previewPlayingId, handlePreviewAzhan }), [fontSize, textAlign, reciterId, azhanId, navigate, previewPlayingId, handlePreviewAzhan]);
  const networkContextValue = useMemo(() => ({ isOnline }), [isOnline]);
  const radioContextValue = useMemo(() => ({ activeStation: radioStation, isPlaying: isRadioPlaying, isLoading: radioLoading, error: radioError, playStation, stopRadio, toggleRadio, playNextStation: () => changeStation('next'), playPrevStation: () => changeStation('prev'), sleepTimerEnd, setSleepTimer: handleSetSleepTimer }), [radioStation, isRadioPlaying, radioLoading, radioError, sleepTimerEnd]);

  return (
    <ThemeContext.Provider value={themeContextValue}>
      <SettingsContext.Provider value={settingsContextValue}>
        <NetworkContext.Provider value={networkContextValue}>
          <AudioContext.Provider value={{ currentTrack, isPlaying, autoAdvance, repeatCount, continuousRepeat, surahRepeat, pageRepeat, rangeStart, rangeEnd, rangeRepeat, playTrack, playNext: () => manualChangeTrack(1), playPrev: () => manualChangeTrack(-1), pauseTrack, closePlayer, togglePlay }}>
            <RadioContext.Provider value={radioContextValue}>
              <NavigationContext.Provider value={{ navigateToAyah: (s, a, p) => { navigate(`/reader?page=${p}&highlight=${s}:${a}`); setSidebarOpen(false); }, openSidebar: () => setSidebarOpen(true), isFullscreen, setIsFullscreen }}>
                <div className="flex justify-center w-full min-h-[100dvh] bg-gold-50 dark:bg-navy-950 relative">
                  
                  {/* Daily Frequency Capped Banner */}
                  <SadaqahBanner />

                  <div 
                    className="flex h-[100dvh] overflow-hidden bg-gold-50 dark:bg-navy-950 transition-colors duration-500 ease-in-out w-full"
                    dir="rtl"
                  >
                  {/* Offline Banner - REMOVED: was covering UI content */}
                  {/* Settings Modal moved to SettingsPage */}

                  <TestGateModal />
                  <PermissionGate>
                    <Sidebar
                      isOpen={isSidebarOpen}
                      close={() => setSidebarOpen(false)}
                      navigateToSurah={(n) => navigate(`/reader?surah=${n}`)}
                      openSettings={() => navigate('/settings')}
                      surahs={surahs}
                    />

                    <div className="flex-1 flex flex-col h-full relative overflow-hidden">
                      <main className={`flex-1 ${location.pathname === '/reader' || isFullscreen ? 'overflow-hidden' : 'overflow-y-auto'} overflow-x-hidden relative scroll-smooth`}>
                        <Outlet />
                      </main>

                      {/* Render Players: Exclusive Logic */}
                      {currentTrack ? <AudioPlayerBar /> : radioStation ? <RadioPlayerBar /> : null}

                      {azhanModalData && (
                        <AzhanModal
                          prayerName={azhanModalData.name}
                          prayerTime={azhanModalData.time}
                          initialAzhanId={previewPlayingId || undefined}
                          isReal={azhanModalData.isReal}
                          onClose={() => {
                            setAzhanModalData(null);
                            setPreviewPlayingId(null);
                          }}
                        />
                      )}
                      <nav className={`h-[68px] bg-white/85 dark:bg-navy-900/85 backdrop-blur-xl border border-white/40 dark:border-navy-700/50 grid grid-cols-6 gap-0 items-center px-1 z-40 fixed bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] transition-all duration-500 ease-in-out pb-1 pt-1 ${isFullscreen ? 'translate-y-[150%] opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
                        <NavItem to="/" icon={<Home size={22} />} label="الرئيسية" />
                        <NavItem to="/reader" icon={<BookOpen size={22} />} label="المصحف" />
                        <NavItem to="/hifz" icon={<Activity size={22} />} label="الحفظ" />
                        <NavItem to="/radio" icon={<Radio size={22} />} label="الإذاعة" />
                        <NavItem to="/adhkar" icon={<Shield size={22} />} label="الأذكار" />
                        <NavItem to="/tasbih" icon={<Grid size={22} />} label="السبحة" />
                      </nav>
                    </div>

                  </PermissionGate>
                </div>
              </div>
              </NavigationContext.Provider>
            </RadioContext.Provider>
          </AudioContext.Provider>
        </NetworkContext.Provider>
      </SettingsContext.Provider>
    </ThemeContext.Provider>
  );
};