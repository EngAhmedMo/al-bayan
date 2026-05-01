import React, { useEffect, useState, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Menu, Bell, Sun, Moon, Search, BookOpen, Radio, Shield, Heart, BookHeart, Compass, WifiOff, Clock, MapPin, Settings, X, Info, Activity, Grid, Bookmark, Calendar, History, Library, ChevronLeft, RefreshCw, Sparkles, Quote, Undo2, RotateCcw, Sunrise, Sunset, MoonIcon, Check, Pause, Brain } from 'lucide-react';
import { HistoryModal } from '../components/HistoryModal';
import { QiblaModal } from '../components/QiblaModal';
import { BathroomModeModal } from '../components/BathroomModeModal';
import { toArabicDigits } from '../services/normalization';
import { useTheme, NavigationContext, useSettings } from '../components/Layout';
import { getUnreadCount, getStoredBenefit, setStoredBenefit, saveLocation, getSavedLocation, getPrayerTracking, markPrayerCompleted, undoPrayerCompletion, resetDailyPrayers, PRAYER_MESSAGES, PrayerTracking } from '../services/storage';
import { getHijriDate, MONTH_MAP } from '../services/eventsData';
import { fetchRandomBenefit, DailyBenefit } from '../services/api';
import { Hadith } from '../services/hadithApi';
import { PrayerData } from '../types';
import { Geolocation } from '@capacitor/geolocation';
import { scheduleAllNotifications } from '../services/notificationManager';
import { FirebaseService } from '../services/firebase';
// calculateQibla removed from here as it is not used in Home anymore
import { calculateLocalPrayerTimes, getTodayPrayerTimesLocal, getWeekPrayerTimes } from '../services/prayerCalculator';
import { MediaBridge } from '../services/mediaBridge';
import { Capacitor } from '@capacitor/core';

import { getPrayerCount } from '../services/storage';
import { PrayerTimesModal } from '../components/PrayerTimesModal';

import { GPSPromptModal } from '../components/GPSPromptModal';
import { CitySearchModal } from '../components/CitySearchModal';
import { useHijriDate } from '../hooks/useHijriDate';
import { syncHijriDateIfNeeded } from '../services/hijriAutoSync';

// ... existing imports

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isDark, toggleTheme } = useTheme();
  const { openSidebar } = useContext(NavigationContext);
  const { openSettings } = useSettings();
  const [lastRead, setLastRead] = useState<{ surah: string, page: number } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const hijri = useHijriDate();

  // --- Toast State ---
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // --- City Search State ---
  const [isCitySearchModalOpen, setIsCitySearchModalOpen] = useState(false);

  // Auto-hide toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // ... inside component ...
  // ... other hooks ...



  // --- Bathroom Mode State ---
  const [isBathroomModalOpen, setIsBathroomModalOpen] = useState(false);
  const [isBathroomModeActive, setIsBathroomModeActive] = useState(false);

  // --- GPS Modal State ---

  const [isGPSModalOpen, setIsGPSModalOpen] = useState(false);

  // --- Qibla State ---
  const [isQiblaModalOpen, setIsQiblaModalOpen] = useState(false);
  // Removed redundant compass and qiblaAngle state

  const handleOpenQibla = () => {
    // Push nested state for Qibla
    window.history.pushState({ modal: 'qibla' }, '');
    setIsQiblaModalOpen(true);
  };

  const promptForLocationSettings = () => {
    // Replaced native confirm with Custom Modal
    setIsGPSModalOpen(true);
  };

  // Daily Benefit State
  const [dailyBenefit, setDailyBenefit] = useState<DailyBenefit | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [loadingBenefit, setLoadingBenefit] = useState(true);

  // Daily Hadith State
  const [dailyHadith, setDailyHadith] = useState<{ hadith: Hadith, bookId: string, bookName: string } | null>(null);
  const [loadingHadith, setLoadingHadith] = useState(true);

  // Prayer Times State
  const [prayerData, setPrayerData] = useState<PrayerData | null>(null);
  const [isPrayerModalOpen, setIsPrayerModalOpen] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [loadingPrayer, setLoadingPrayer] = useState(false);
  const [nextPrayer, setNextPrayer] = useState<{ name: string, time: string, timeLeft: string } | null>(null);

  // --- Remote Config State ---
  const [remoteBanner, setRemoteBanner] = useState<{ active: boolean, text: string } | null>(null);

  // --- Prayer Tracking State (Full Object) ---
  const [prayerTracking, setPrayerTracking] = useState<PrayerTracking>(getPrayerTracking());

  // --- Dashboard State ---
  const [currentPrayerCount, setCurrentPrayerCount] = useState(getPrayerCount());

  useEffect(() => {
    setCurrentPrayerCount(getPrayerCount());
  }, [prayerTracking]);

  // Unified button style class
  /* Unified button style class - Premium Gold Update */
  const headerBtnClass = "w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-navy-900/40 border border-navy-100 dark:border-[#C6AD73]/60 text-navy-600 dark:text-[#C6AD73] hover:border-gold-400 dark:hover:border-[#C6AD73] hover:text-gold-600 dark:hover:text-[#F0CF85] dark:hover:bg-[#C6AD73]/10 shadow-sm hover:shadow-md transition-all duration-200 active:scale-95 relative overflow-hidden";

  useEffect(() => {
    const saved = localStorage.getItem('lastRead');
    if (saved) {
      setLastRead(JSON.parse(saved));
    }
    setUnreadCount(getUnreadCount());
    setUnreadCount(getUnreadCount());
    // setHijri removed, using reactive hook


    // Initial Load of Benefit (Respects Date)
    loadDailyBenefit();
    loadDailyHadith();

    // Auto-sync Hijri date from Dar Al-Ifta Egypt API (fire-and-forget)
    syncHijriDateIfNeeded().catch(() => { /* silent */ });

    // Load prayers locally - no API needed, never expires!
    const cachedPrayers = getTodayPrayerTimesLocal();
    if (cachedPrayers) {
      setPrayerData(cachedPrayers);
      calculateNextPrayer(cachedPrayers);
      // FORCE RESYNC: Ensure new calculation logic (no +2 offset) is applied
      // This key ensures it runs once per update to fix the discrepancy
      const SYNC_KEY = 'prayer_sync_fix_v4';
      const hasSynced = localStorage.getItem(SYNC_KEY);
      const forceSync = !hasSynced;

      scheduleAllNotifications(cachedPrayers, forceSync);

      if (!hasSynced) {
        localStorage.setItem(SYNC_KEY, 'true');
        console.log('[Home] 🔄 Force rescheduling prayers to fix offsets (v4)...');
        setToastMessage('تم تحديث مواقيت الصلاة');
      }

      // Update Android home screen widget with date/prayer data
      if (Capacitor.isNativePlatform()) {
        const hijriData = getHijriDate();
        // ISO date: used as Source-of-Truth lock key in Kotlin (yyyy-MM-dd)
        const now = new Date();
        const isoDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        import('../services/islamicCalendar').then(({ getHijriAdjustment }) => {
          MediaBridge.updateWidgetData({
            hijriDay: toArabicDigits(hijriData.day),
            hijriMonth: MONTH_MAP[hijriData.month] || '',
            hijriYear: toArabicDigits(hijriData.year),
            gregorianDate: isoDate,  // ISO format — Kotlin comparison key
            nextPrayerName: '',  // Will be updated by calculateNextPrayer
            nextPrayerTime: '',
            hijriAdjustment: getHijriAdjustment().toString()
          });
        }).catch(e => console.log('Widget update skipped:', e));
      }
    }

    // --- Check URL for Deep Actions (e.g. from About page) ---
    const action = searchParams.get('action');
    if (action === 'prayers') {
      handleOpenPrayerTimes();
      // Remove the param so it doesn't reopen on refresh
      setSearchParams(prev => {
        const newParams = new URLSearchParams(prev);
        newParams.delete('action');
        return newParams;
      }, { replace: true });
    }

    // --- Load Remote Config (Banner) ---
    const loadRemoteConfig = async () => {
      const isActive = await FirebaseService.getBoolean('home_banner_active');
      if (isActive) {
        const text = await FirebaseService.getString('home_banner_text');
        setRemoteBanner({ active: true, text: text || 'أهلاً بكم في تطبيق البيان' });
      }
    };
    loadRemoteConfig();

    // --- Check for openPrayer param (from notification deep link) ---
    const openPrayer = searchParams.get('openPrayer');
    if (openPrayer === 'true') {
      handleOpenPrayerTimes();
      setSearchParams(prev => {
        const newParams = new URLSearchParams(prev);
        newParams.delete('openPrayer');
        return newParams;
      }, { replace: true });
    }

    // --- Listen for Notification Updates (Real-time Badge) ---
    const handleNotificationUpdate = () => {
      setUnreadCount(getUnreadCount());
    };
    window.addEventListener('notifications-updated', handleNotificationUpdate);

    // Check Bathroom Mode Status
    MediaBridge.getBathroomModeStatus().then(status => {
      setIsBathroomModeActive(status.isActive);
    }).catch(console.error);

    // --- RESUME SYNC ---
    // Listen for global resume event from Layout.tsx
    const handleAppResume = () => {
      console.log('[Home] Received app-resume event. Refreshing data...');

      // 1. Refresh Prayer Times (Vital for correct countdown)
      const freshPrayers = getTodayPrayerTimesLocal();
      if (freshPrayers) {
        setPrayerData(freshPrayers);
        calculateNextPrayer(freshPrayers);
        // Re-schedule notifications if needed is handled in Layout usually, but harmless here
      }

      // 2. Refresh Daily Benefit (if date changed)
      loadDailyBenefit();
      loadDailyHadith();

      // 3. Refresh Hijri Date (if day changed)
      // useHijriDate hook updates automatically on mount/render, 
      // but to force update we might need to trigger a re-render. 
      // Setting state above (prayerData) triggers re-render, so hooks re-run.
    };
    window.addEventListener('app-resume', handleAppResume);

    return () => {
      window.removeEventListener('notifications-updated', handleNotificationUpdate);
      window.removeEventListener('app-resume', handleAppResume);
    };

  }, []);

  // Update Next Prayer Countdown every minute
  useEffect(() => {
    if (prayerData) {
      const interval = setInterval(() => {
        calculateNextPrayer(prayerData);
      }, 60000);
      calculateNextPrayer(prayerData);
      return () => clearInterval(interval);
    }
  }, [prayerData]);

  const loadDailyBenefit = async (forceNew = false) => {
    setLoadingBenefit(true);
    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const stored = getStoredBenefit();
    if (!forceNew && stored && stored.date === todayStr && stored.data) {
      setDailyBenefit(stored.data);
      setLoadingBenefit(false);
      return;
    }

    try {
      const newData = await fetchRandomBenefit();
      if (newData) {
        setDailyBenefit(newData);
        setStoredBenefit(newData);
      }
    } catch (error) {
      console.error("Error loading benefit", error);
    }
    setLoadingBenefit(false);
  };

  const loadDailyHadith = async (forceNew = false) => {
    setLoadingHadith(true);
    const todayStr = new Date().toISOString().split('T')[0];

    const storedKey = 'daily_hadith_v1';
    try {
      const stored = JSON.parse(localStorage.getItem(storedKey) || 'null');
      if (!forceNew && stored && stored.date === todayStr && stored.data) {
        setDailyHadith(stored.data);
        setLoadingHadith(false);
        return;
      }
    } catch (e) {}

    try {
      const { fetchRandomHadith } = await import('../services/hadithApi');
      const newData = await fetchRandomHadith();
      if (newData) {
        setDailyHadith(newData);
        localStorage.setItem(storedKey, JSON.stringify({ date: todayStr, data: newData }));
      }
    } catch (error) {
      console.error("Error loading daily hadith", error);
    }
    setLoadingHadith(false);
  };

  // Handle back button for prayer times modal & Qibla modal
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;

      // Priority 1: Close Qibla Modal if open
      if (isQiblaModalOpen) {
        setIsQiblaModalOpen(false);
        // If we're returning to prayer-times state, keep prayer modal open
        if (state?.modal === 'prayer-times') {
          setIsPrayerModalOpen(true);
        }
        return;
      }

      // Priority 2: Close Prayer Modal
      if (isPrayerModalOpen) {
        setIsPrayerModalOpen(false);
        return;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isPrayerModalOpen, isQiblaModalOpen]);

  const handleOpenPrayerTimes = () => {
    // Push state only if we are not already in it (avoid duplicate pushes on double clicks etc)
    if (window.history.state?.modal !== 'prayer-times') {
      window.history.pushState({ modal: 'prayer-times' }, '');
    }
    setIsPrayerModalOpen(true);
    // Use local calculation - if no location saved yet, fetch it
    const cachedPrayers = getTodayPrayerTimesLocal();
    if (!cachedPrayers) {
      fetchLocationAndPrayers();
    }
  };

  const closePrayerModal = () => {
    setIsPrayerModalOpen(false);
    // Only go back if the current state IS the prayer modal
    if (window.history.state?.modal === 'prayer-times') {
      window.history.back();
    }
  };



  const closeQiblaModal = () => {
    // Close Qibla modal immediately (no animation delay)
    setIsQiblaModalOpen(false);
    // Navigate back if we're in qibla state - handlePopState handles Prayer modal state
    if (window.history.state?.modal === 'qibla') {
      window.history.back();
    }
  };

  const fetchLocationAndPrayers = async (forceRefresh = false) => {
    setLoadingPrayer(true);
    setLocationError(null);

    try {
      // Use LocationManager for robust handling
      const { LocationManager } = await import('../services/LocationManager');
      const result = await LocationManager.getCurrentLocation(forceRefresh);

      // If using cache due to error, inform user but don't block
      if (result.source === 'cache' && result.error) {
        // Cache fallback due to GPS failure - not blocking but worth noting
        console.log('📍 Using cached location:', result.cityName);
      }

      // Manual location is treated as success (user explicitly chose it)
      if (result.source === 'manual') {
        console.log('📍 Using manual location:', result.cityName);
      }

      // If totally failed (Default) OR (Cached but with error AND forceRefresh was requested)
      // Manual and GPS sources are success - no error
      if (result.source === 'default' || (result.source === 'cache' && forceRefresh && result.error)) {
        setLocationError("تعذر تحديث الموقع بدقة. تم استخدام بيانات محفوظة.");
        // Prompt user to open settings if it failed
        if (forceRefresh) {
          setTimeout(() => promptForLocationSettings(), 500);
        }
      }

      // Calculate Prayer Times using LOCAL calculation (works offline!)
      // result.lat and result.lng are guaranteed at this point (either fresh, cached, or default)
      const data = calculateLocalPrayerTimes(result.lat, result.lng, new Date());
      setPrayerData(data);
      calculateNextPrayer(data);
      scheduleAllNotifications(data);

      console.log(`Prayer times calculated via ${result.source}`);

    } catch (error) {
      console.error(error);
      setLocationError("حدث خطأ غير متوقع في تحديد الموقع");
    } finally {
      setLoadingPrayer(false);
    }
  };



  const calculateNextPrayer = (data: PrayerData) => {
    const now = new Date();
    const timings = data.timings;
    const isFriday = now.getDay() === 5; // Friday detection

    const prayers = [
      { name: 'الفجر', time: timings.Fajr },
      { name: 'الشروق', time: timings.Sunrise },
      { name: isFriday ? 'الجمعة' : 'الظهر', time: timings.Dhuhr },
      { name: 'العصر', time: timings.Asr },
      { name: 'المغرب', time: timings.Maghrib },
      { name: 'العشاء', time: timings.Isha },
    ];

    let foundNext = false;
    for (let p of prayers) {
      const [hours, minutes] = p.time.split(':').map(Number);
      const pDate = new Date();
      pDate.setHours(hours, minutes, 0, 0);

      if (pDate > now) {
        const diff = pDate.getTime() - now.getTime();
        const diffHrs = Math.floor(diff / (1000 * 60 * 60));
        const diffMins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        const parts = [];
        if (diffHrs > 0) parts.push(`${toArabicDigits(diffHrs)} ساعة`);
        if (diffMins > 0) parts.push(`${toArabicDigits(diffMins)} دقيقة`);

        // Handle "0 minutes" case (e.g. exactly 1 hour left)
        if (parts.length === 0) parts.push('أقل من دقيقة');

        setNextPrayer({
          name: p.name,
          time: p.time,
          timeLeft: `متبقي ${parts.join(' و ')}`
        });
        
        syncPrayerToWidget(p.name, p.time, pDate.getTime());
        foundNext = true;
        break;
      }
    }

    if (!foundNext) {
      // It's past Isha, next prayer is Fajr tomorrow
      const [fHours, fMinutes] = timings.Fajr.split(':').map(Number);
      const tomorrowFajr = new Date();
      tomorrowFajr.setDate(tomorrowFajr.getDate() + 1);
      tomorrowFajr.setHours(fHours, fMinutes, 0, 0);
      
      setNextPrayer({ name: 'الفجر', time: timings.Fajr, timeLeft: 'غداً' });
      syncPrayerToWidget('الفجر', timings.Fajr, tomorrowFajr.getTime());
    }
  };

  const syncPrayerToWidget = (name: string, time24: string, timestamp: number) => {
    if (Capacitor.isNativePlatform()) {
      const hijriData = getHijriDate();
      const formatted = formatTime12(time24);
      // ISO date: used as Source-of-Truth lock key in Kotlin (yyyy-MM-dd)
      const now = new Date();
      const isoDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      try {
        import('../services/islamicCalendar').then(({ getHijriAdjustment }) => {
          MediaBridge.updateWidgetData({
            hijriDay: toArabicDigits(hijriData.day),
            hijriMonth: MONTH_MAP[hijriData.month] || '',
            hijriYear: toArabicDigits(hijriData.year),
            gregorianDate: isoDate,  // ISO format — Kotlin comparison key
            nextPrayerName: name,
            nextPrayerTime: toArabicDigits(formatted.time) + ' ' + formatted.period,
            nextPrayerTimestamp: timestamp,
            hijriAdjustment: getHijriAdjustment().toString()
          });
        });
      } catch (e) {
        console.error('Widget sync failed:', e);
      }
    }
  };

  const formatTime12 = (time24: string) => {
    if (!time24) return { time: '', period: '' };
    const [hStr, mStr] = time24.split(':');
    const h = parseInt(hStr);
    const m = parseInt(mStr);

    const period = h >= 12 ? 'م' : 'ص';
    const h12 = h % 12 || 12;

    // Pad minutes with leading zero (e.g., 5:4 → 5:04)
    const paddedMinutes = m.toString().padStart(2, '0');

    return {
      time: `${toArabicDigits(h12)}:${toArabicDigits(paddedMinutes)}`,
      period
    };
  };

  const menuItems = [
    { title: 'المصحف الشريف', icon: <BookOpen size={28} />, path: '/reader', bg: 'bg-navy-800', text: 'text-white' },
    { title: 'اختبارات قرآنية', icon: <Brain size={28} />, path: '/quiz', bg: 'bg-gradient-to-br from-indigo-500 to-indigo-700 border border-indigo-400/50 shadow-indigo-500/30', text: 'text-white' },
    { title: 'حصن المسلم', icon: <Shield size={28} />, path: '/adhkar', bg: 'bg-gold-600', text: 'text-white' },
    { title: 'الحديث الشريف', icon: <BookHeart size={28} />, path: '/hadith', bg: 'bg-navy-700', text: 'text-white' },
    { title: 'بحث في القرآن', icon: <Search size={28} />, path: '/search', bg: 'bg-sky-600', text: 'text-white' },
    { title: 'الإذاعة المباشرة', icon: <Radio size={28} />, path: '/radio', bg: 'bg-emerald-600', text: 'text-white' },
    { title: 'السبحة', icon: <Grid size={28} />, path: '/tasbih', bg: 'bg-navy-600', text: 'text-white' },
    { title: 'خطة الحفظ', icon: <Activity size={28} />, path: '/hifz', bg: 'bg-gold-500', text: 'text-white' },
    { title: 'المحفوظات', icon: <Bookmark size={28} />, path: '/bookmarks', bg: 'bg-gold-700', text: 'text-white' },
    { title: 'التحميلات (أوفلاين)', icon: <WifiOff size={28} />, path: '/downloads', bg: 'bg-slate-600', text: 'text-white' },
  ];

  const daysRemaining = 30 - hijri.day;
  const gregorianDateStr = new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="flex flex-col min-h-full bg-gradient-to-b from-gold-50 via-white to-gold-50/50 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 pb-24 font-sans relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gold-400/10 dark:bg-gold-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-1/4 left-0 w-80 h-80 bg-amber-400/10 dark:bg-amber-500/5 rounded-full blur-3xl -translate-x-1/2"></div>
      </div>

      <div className="w-full max-w-5xl mx-auto flex flex-col flex-1 relative z-10">
      {/* Top Bar */}
      <div className="flex justify-between items-center px-5 sm:px-6 pt-6 pb-2 relative z-10">
        <div className="flex items-center gap-3">
          <button onClick={openSidebar} className={`${headerBtnClass} xl:hidden`} title="القائمة الجانبية">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2.5 cursor-pointer group select-none" onClick={() => navigate('/about')} title="عن التطبيق">
            <div className="flex items-center gap-2.5">
              <div className="w-11 h-11 bg-gradient-to-br from-navy-800 to-navy-950 dark:from-[#D4B978] dark:via-[#C6AD73] dark:to-[#9A7B3C] rounded-xl flex items-center justify-center text-white dark:text-white shadow-lg shadow-navy-500/20 dark:shadow-gold-500/30 border border-transparent dark:border-[#C6AD73]/30">
                <span className="font-quran text-2xl font-bold mt-1">ب</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-navy-900 dark:text-white font-quran leading-none">البيان</h1>
                <p className="text-[9px] font-bold text-gold-600 dark:text-gold-400 tracking-wider">القرآن والسنة</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button className={headerBtnClass} onClick={() => setIsHistoryOpen(true)} title="الإحصائيات">
            <Activity size={20} />
          </button>

          {/* BATHROOM MODE TOGGLE - NEW */}
          <button
            className={`${headerBtnClass} ${isBathroomModeActive ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : ''}`}
            onClick={() => setIsBathroomModalOpen(true)}
            title={isBathroomModeActive ? "وضع الصمت نشط" : "وضع الصمت المؤقت"}
          >
            {isBathroomModeActive ? (
              <div className="relative">
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                <Pause size={20} className="text-red-500" fill="currentColor" />
              </div>
            ) : (
              <Pause size={20} className="text-navy-600 dark:text-[#C6AD73]" />
            )}
          </button>

          <button className={headerBtnClass} onClick={() => navigate('/notifications')}>
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 min-w-[20px] h-[20px] bg-gradient-to-br from-red-500 to-red-600 text-white text-[11px] font-bold flex items-center justify-center rounded-full ring-2 ring-white dark:ring-navy-950 shadow-lg shadow-red-500/30 px-1.5 animate-pulse">
                {unreadCount > 9 ? '9+' : toArabicDigits(unreadCount)}
              </span>
            )}
          </button>
          <button onClick={toggleTheme} className={headerBtnClass}>
            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 transform ${isDark ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 rotate-90'}`}>
              <Sun size={20} className="text-gold-500" fill="currentColor" />
            </div>
            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 transform ${!isDark ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-90'}`}>
              <Moon size={20} className="text-navy-600" />
            </div>
          </button>
        </div>
      </div>

      {remoteBanner && remoteBanner.active && (
        <div className="mx-5 mt-4 p-3 bg-gradient-to-r from-gold-500 to-amber-500 text-navy-900 rounded-2xl shadow-lg flex items-center gap-3 animate-in slide-in-from-top-4 duration-500">
          <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm"><Info size={18} /></div>
          <p className="text-sm font-bold flex-1">{remoteBanner.text}</p>
          <button onClick={() => setRemoteBanner(null)} className="p-1 rounded-full hover:bg-white/10"><X size={16} /></button>
        </div>
      )}

      {/* --- PREMIUM DATE CARD --- */}
      <div className="px-5 mt-4 relative z-10">
        <div className="relative w-full bg-gradient-to-br from-[#0F2238] via-[#132A42] to-[#0A1929] dark:from-[#0A1929] dark:via-[#0D1F33] dark:to-[#071320] rounded-[2rem] shadow-2xl shadow-navy-500/20 dark:shadow-navy-950/50 overflow-hidden text-white p-5 sm:p-6 border border-navy-700/30">
          {/* Islamic Pattern Overlay */}
          <div className="absolute inset-0 opacity-5 bg-[url('https://www.transparenttextures.com/patterns/arabesque.png')]"></div>

          {/* Decorative Glows */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-gold-500/10 rounded-full -mr-12 -mt-12 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gold-400/10 rounded-full -ml-8 -mb-8 blur-2xl"></div>

          {/* Main Content Row: Day Box (Right) + Month/Year Block (Left) */}
          <div className="flex items-stretch justify-between gap-4 relative z-10 h-[90px] sm:h-[100px]">
            {/* Right Gold Square (Day) */}
            <div className="w-[90px] h-[90px] sm:w-[100px] sm:h-[100px] bg-gradient-to-br from-[#D4B978] via-[#C6AD73] to-[#9A7B3C] rounded-2xl flex flex-col items-center justify-center shadow-xl shadow-gold-500/30 flex-shrink-0 border border-gold-400/30">
              <span className="text-[3.2rem] sm:text-[3.5rem] font-black font-sans text-white drop-shadow-lg leading-none">
                {toArabicDigits(hijri.day)}
              </span>
            </div>

            {/* Left Block: flex container for (Month) and (Button + Year) */}
            <div className="flex-1 flex justify-between h-full">
              
              {/* Right Side: Month Name */}
              <div className="flex flex-col justify-center h-full pt-1">
                <h2 className="text-[2.2rem] sm:text-[2.5rem] font-bold font-quran text-white leading-none drop-shadow-lg">
                  {MONTH_MAP[hijri.month]}
                </h2>
              </div>

              {/* Left Side: Events Button + Year */}
              <div className="flex flex-col items-end justify-between h-full py-0.5">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/events');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-gradient-to-r from-[#1A314D]/80 to-[#1A314D]/60 hover:from-[#1A314D] hover:to-[#253D5C] text-white border border-[#C6AD73]/40 shadow-sm hover:shadow-lg transition-all group active:scale-95"
                  title="المناسبات الإسلامية"
                >
                  <Calendar size={15} className="text-[#C6AD73] group-hover:text-gold-400 transition-colors" />
                  <span className="text-[12px] sm:text-[13px] font-bold">المناسبات</span>
                </button>

                <div className="text-lg text-[#C6AD73] font-bold flex items-center justify-end gap-1.5">
                  <span>{toArabicDigits(hijri.year)}</span>
                  <span className="text-sm opacity-70">هـ</span>
                </div>
              </div>
            </div>
          </div>

          {/* Middle Row: Gregorian Date (Left) + Days Remaining (Right) */}
          <div className="flex justify-between items-center mt-4 relative z-10">
            {/* Gregorian Date */}
            <div className="bg-[#1A314D]/60 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-[#2A4566]/50">
              <span className="text-[11px] sm:text-[12px] font-bold text-gray-300">
                {gregorianDateStr}
              </span>
            </div>

            {/* Days Remaining */}
            <div className="flex items-center gap-1.5 bg-[#1A314D]/60 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-[#2A4566]/50">
              <span className="w-2 h-2 rounded-full bg-gradient-to-br from-gold-400 to-amber-500 shadow-sm shadow-gold-500/50"></span>
              <span className="text-[11px] sm:text-[12px] font-bold text-[#C6AD73]">
                {toArabicDigits(daysRemaining > 0 ? daysRemaining : 0)} يوم لنهاية الشهر الهجري
              </span>
            </div>
          </div>

          {/* Bottom Row: Location (Right) + Prayer Button (Left) */}
          <div className="flex justify-between items-center mt-3 relative z-10 gap-3">
            {/* Location Display */}
            <div className="flex items-center gap-1.5 bg-[#1A314D]/60 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-[#2A4566]/50">
              <MapPin size={14} className="text-[#C6AD73]" />
              <span className="text-[11px] font-bold text-gray-300 truncate max-w-[150px] sm:max-w-[200px]">
                {localStorage.getItem('user_location_name') || (prayerData?.meta?.timezone?.split('/').pop() || 'تحديد الموقع')}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCitySearchModalOpen(true);
                }}
                className="hidden lg:flex p-1 rounded-full hover:bg-white/10 text-stone-300 hover:text-white transition-colors"
                title="تحديد الموقع يدوياً"
              >
                <Search size={12} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fetchLocationAndPrayers(true);
                }}
                disabled={loadingPrayer}
                className={`p-1 rounded-full hover:bg-white/10 text-gold-500 transition-colors ${loadingPrayer ? 'animate-spin' : ''}`}
                title="تحديث الموقع تلقائياً"
              >
                <RefreshCw size={12} />
              </button>
            </div>

            {/* Prayer Times Button */}
            <button
              onClick={handleOpenPrayerTimes}
              className="bg-gradient-to-r from-[#1A314D]/80 to-[#1A314D]/60 hover:from-[#1A314D] hover:to-[#253D5C] text-white px-4 py-2.5 rounded-xl border border-[#C6AD73]/50 flex items-center gap-2 transition-all active:scale-95 shadow-lg hover:shadow-xl"
            >
              <Clock size={16} className="text-[#C6AD73]" />
              <span className="text-[12px] sm:text-[13px] font-bold">مواقيت الصلاة</span>
            </button>
          </div>

        </div>
      </div>

      {/* Prayer Times Modal Component */}
      <PrayerTimesModal
        isOpen={isPrayerModalOpen}
        onClose={closePrayerModal}
        prayerData={prayerData}
        nextPrayer={nextPrayer}
        prayerTracking={prayerTracking}
        setPrayerTracking={setPrayerTracking}
        onRefreshLocation={() => fetchLocationAndPrayers(true)}
        onOpenQibla={handleOpenQibla}
        onOpenSettings={openSettings}
        locationError={locationError}
        loadingPrayer={loadingPrayer}
      />

      {/* City Search Modal Component (Desktop Only Feature Access) */}
      <CitySearchModal 
        isOpen={isCitySearchModalOpen}
        onClose={() => setIsCitySearchModalOpen(false)}
        onCitySelected={() => fetchLocationAndPrayers(false)}
      />



      <div className="px-5 mt-6 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {menuItems.map((item, idx) => (
            <button
              key={idx}
              onClick={() => navigate(item.path)}
              className={`${item.bg} ${item.text} p-4 sm:p-5 rounded-2xl shadow-lg hover:shadow-xl flex items-center gap-3 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-95 transition-all duration-300 relative overflow-hidden group`}
            >
              <div className="absolute right-0 top-0 w-20 h-20 bg-white/10 rounded-bl-full -mr-6 -mt-6 transition-transform duration-500 group-hover:scale-150"></div>
              <div className="absolute bottom-0 left-0 w-16 h-16 bg-black/5 rounded-tr-full -ml-4 -mb-4"></div>
              <div className="relative z-10 w-12 h-12 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-inner">
                {item.icon}
              </div>
              <span className="relative z-10 font-bold text-sm sm:text-base">{item.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-6 relative z-10">
        <div className="bg-white/95 dark:bg-navy-800/95 backdrop-blur-xl rounded-2xl p-5 shadow-lg shadow-gold-500/5 dark:shadow-navy-950/50 border-r-4 border-gradient-to-b border-gold-500 flex justify-between items-center cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 group" onClick={() => navigate(lastRead ? `/reader?page=${lastRead.page}` : '/reader')}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-gold-400 to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-gold-500/30">
              <BookOpen size={24} className="text-white" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-navy-400 dark:text-navy-400 mb-1">آخر قراءة</h3>
              <p className="text-lg sm:text-xl font-bold text-navy-900 dark:text-white font-quran">{lastRead ? lastRead.surah : 'القرآن الكريم'}</p>
              <p className="text-xs text-navy-500 dark:text-navy-400 mt-1">{lastRead ? `صفحة ${toArabicDigits(lastRead.page)}` : 'اضغط للبدء'}</p>
            </div>
          </div>
          <div className="w-10 h-10 bg-gradient-to-br from-navy-100 to-navy-200 dark:from-navy-700 dark:to-navy-800 rounded-xl flex items-center justify-center text-navy-600 dark:text-gold-400 group-hover:from-gold-400 group-hover:to-amber-500 group-hover:text-white transition-all shadow-sm"><ChevronLeft size={20} /></div>
        </div>
      </div>

      <div className="px-5 mt-6 mb-4 relative z-10">
        <div className="bg-white/95 dark:bg-navy-800/95 backdrop-blur-xl rounded-2xl p-5 sm:p-6 shadow-lg shadow-gold-500/5 dark:shadow-navy-950/50 relative overflow-hidden border border-gold-100 dark:border-navy-700">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-gold-400 via-amber-500 to-navy-500"></div>

          {/* Decorative Quote Icon */}
          <div className="absolute top-4 left-4 opacity-5">
            <Quote size={80} className="text-gold-500" />
          </div>

          <div className="flex justify-between items-center mb-5 relative z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-gradient-to-br from-gold-400 to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-gold-500/30">
                <BookHeart size={18} className="text-white" />
              </div>
              <span className="text-sm font-bold text-navy-800 dark:text-white">فائدة اليوم</span>
            </div>
            <button
              onClick={() => loadDailyBenefit(true)}
              disabled={loadingBenefit}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-br from-navy-100 to-navy-200 dark:from-navy-700 dark:to-navy-800 text-navy-600 dark:text-navy-300 hover:from-gold-400 hover:to-amber-500 hover:text-white transition-all text-xs font-bold shadow-sm hover:shadow-md ${loadingBenefit ? 'opacity-50' : ''}`}
            >
              {loadingBenefit ? (<RefreshCw size={14} className="animate-spin" />) : (<Sparkles size={14} />)}
              <span>فائدة جديدة</span>
            </button>
          </div>
          {loadingBenefit ? (
            <div className="space-y-4 animate-pulse relative z-10">
              <div className="h-6 bg-navy-100 dark:bg-navy-700 rounded-lg w-3/4 mx-auto"></div>
              <div className="h-4 bg-navy-50 dark:bg-navy-700 rounded-lg w-full"></div>
              <div className="h-4 bg-navy-50 dark:bg-navy-700 rounded-lg w-5/6"></div>
            </div>
          ) : dailyBenefit ? (
            <div className="relative z-10">
              <div className="relative mb-5">
                <Quote size={24} className="text-gold-200 dark:text-navy-600 absolute -top-2 right-0 rotate-180" />
                <p className="font-quran text-lg sm:text-xl leading-[2.4] text-center text-navy-900 dark:text-white px-4">{dailyBenefit.ayah.text}</p>
                <p className="text-[10px] text-center text-navy-400 dark:text-navy-500 mt-3 font-bold">{dailyBenefit.surahName} - آية {toArabicDigits(dailyBenefit.ayah.numberInSurah)}</p>
              </div>
              <div className="bg-gradient-to-br from-navy-50 to-stone-50 dark:from-navy-900 dark:to-navy-950 p-4 rounded-xl border border-navy-100 dark:border-navy-700">
                <h4 className="text-[10px] font-bold text-gold-600 dark:text-gold-400 mb-2 flex items-center gap-1.5"><Library size={12} /> التفسير الميسر:</h4>
                <p className="text-xs sm:text-sm text-navy-600 dark:text-navy-200 leading-relaxed text-justify">{dailyBenefit.tafsir}</p>
              </div>
            </div>
          ) : (
            <div className="text-center text-red-400 text-sm py-4 relative z-10">فشل في تحميل الفائدة. تأكد من الاتصال بالإنترنت.</div>
          )}
        </div>
      </div>

      {/* Daily Hadith Section */}
      <div className="px-5 mb-10 relative z-10">
        <div className="bg-white/95 dark:bg-navy-800/95 backdrop-blur-xl rounded-2xl p-5 sm:p-6 shadow-lg shadow-gold-500/5 dark:shadow-navy-950/50 relative overflow-hidden border border-gold-100 dark:border-navy-700">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-navy-500 via-gold-400 to-amber-500"></div>

          <div className="flex justify-between items-center mb-5 relative z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-gradient-to-br from-navy-400 to-navy-600 rounded-xl flex items-center justify-center shadow-lg shadow-navy-500/30">
                <BookOpen size={18} className="text-white" />
              </div>
              <span className="text-sm font-bold text-navy-800 dark:text-white">حديث اليوم</span>
            </div>
            <button
              onClick={() => loadDailyHadith(true)}
              disabled={loadingHadith}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-br from-navy-100 to-navy-200 dark:from-navy-700 dark:to-navy-800 text-navy-600 dark:text-navy-300 hover:from-navy-400 hover:to-navy-500 hover:text-white transition-all text-xs font-bold shadow-sm hover:shadow-md ${loadingHadith ? 'opacity-50' : ''}`}
            >
              {loadingHadith ? (<RefreshCw size={14} className="animate-spin" />) : (<Sparkles size={14} />)}
              <span>حديث جديد</span>
            </button>
          </div>

          {loadingHadith ? (
            <div className="space-y-4 animate-pulse relative z-10">
              <div className="h-4 bg-navy-100 dark:bg-navy-700 rounded-lg w-full"></div>
              <div className="h-4 bg-navy-50 dark:bg-navy-700 rounded-lg w-full"></div>
              <div className="h-4 bg-navy-50 dark:bg-navy-700 rounded-lg w-3/4"></div>
            </div>
          ) : dailyHadith ? (
            <div className="relative z-10">
              <div className="relative mb-3">
                <Quote size={24} className="text-navy-200 dark:text-navy-600 absolute -top-2 right-0 rotate-180" />
                <p className="font-quran text-lg sm:text-xl leading-[2.2] text-center text-navy-900 dark:text-white px-4">
                  {dailyHadith.hadith.arabic || dailyHadith.hadith.text}
                </p>
              </div>
              <div className="flex justify-between items-center mt-4 border-t border-navy-100 dark:border-navy-700 pt-4">
                <p className="text-[10px] sm:text-xs text-navy-500 dark:text-navy-400 font-bold bg-navy-50 dark:bg-navy-900 px-3 py-1.5 rounded-lg border border-navy-100 dark:border-navy-700">
                  📖 {dailyHadith.bookName}
                </p>
                <button
                  onClick={() => navigate(`/hadith?book=${dailyHadith.bookId}&target=${String(dailyHadith.hadith.id || dailyHadith.hadith.hadithnumber)}`)}
                  className="text-[10px] sm:text-xs font-bold text-gold-600 hover:text-gold-500 transition-colors flex items-center gap-1"
                >
                  اذهب إلى الحديث المعروض
                  <ChevronLeft size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center text-red-400 text-sm py-4 relative z-10">فشل في تحميل الحديث. تأكد من الاتصال بالإنترنت.</div>
          )}
        </div>
      </div>

      </div> {/* End of max-w-5xl wrapper */}

      {/* Qibla Compass Modal */}
      <QiblaModal
        isOpen={isQiblaModalOpen}
        onClose={closeQiblaModal}
        userLat={searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : (getSavedLocation()?.lat ?? null)}
        userLng={searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : (getSavedLocation()?.lng ?? null)}
        onRefreshLocation={() => fetchLocationAndPrayers(true)}
      />

      {/* History Modal */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />

      {/* Bathroom Mode Modal */}
      <BathroomModeModal
        visible={isBathroomModalOpen}
        onClose={() => setIsBathroomModalOpen(false)}
        onStatusChange={setIsBathroomModeActive}
      />

      {/* Custom GPS Prompt Modal */}
      <GPSPromptModal
        isOpen={isGPSModalOpen}
        onClose={() => setIsGPSModalOpen(false)}
        onConfirm={async () => {
          try {
            const { MediaBridge } = await import('../services/mediaBridge');
            await MediaBridge.requestLocationSettings();
          } catch (e) {
            console.error("Failed to open settings", e);
          }
        }}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-gray-900/95 text-white px-6 py-3 rounded-full shadow-xl shadow-gold-500/10 z-[100] flex items-center gap-3 animate-in fade-in slide-in-from-bottom-8 duration-500 pointer-events-none border border-gold-500/30 backdrop-blur-md">
          <div className="w-8 h-8 rounded-full bg-gold-500/20 flex items-center justify-center">
            <Check className="w-5 h-5 text-gold-400" />
          </div>
          <span className="font-bold text-sm text-center leading-relaxed">{toastMessage}</span>
        </div>
      )}

    </div>
  );
};
