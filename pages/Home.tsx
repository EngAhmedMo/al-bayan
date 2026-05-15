import React, { useEffect, useState, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Menu, Bell, Sun, Moon, Search, BookOpen, Radio, Shield, Heart, BookHeart, Compass, WifiOff, Clock, MapPin, Settings, X, Info, Activity, Grid, Bookmark, Calendar, History, Library, ChevronLeft, RefreshCw, Sparkles, Quote, Undo2, RotateCcw, Sunrise, Sunset, MoonIcon, Check, Pause, Brain, Copy, Share2, ChevronDown, ChevronUp, ExternalLink, Award } from 'lucide-react';
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
import { Share } from '@capacitor/share';


import { getPrayerCount } from '../services/storage';
import { PrayerTimesModal } from '../components/PrayerTimesModal';

import { GPSPromptModal } from '../components/GPSPromptModal';
import { CitySearchModal } from '../components/CitySearchModal';
import { useHijriDate } from '../hooks/useHijriDate';
import { getHijriAdjustment, getFutureHijriDatesJSON } from '../services/islamicCalendar';

// ... existing imports

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isDark, toggleTheme } = useTheme();
  const { openSidebar } = useContext(NavigationContext);
  const { openSettings } = useSettings();
  const [lastRead, setLastRead] = useState<{ surah: string, page: number } | null>(() => {
    try {
      const saved = localStorage.getItem('lastRead');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
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
  const [isBenefitCopied, setIsBenefitCopied] = useState(false);
  const [showBenefitTafsir, setShowBenefitTafsir] = useState(true);

  // Daily Hadith State
  const [dailyHadith, setDailyHadith] = useState<{ hadith: Hadith, bookId: string, bookName: string } | null>(null);
  const [loadingHadith, setLoadingHadith] = useState(true);
  const [isHadithCopied, setIsHadithCopied] = useState(false);
  const [isHadithExpanded, setIsHadithExpanded] = useState(false);

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
  /* Unified button style class - Premium Gold Update & Optimized */
  const headerBtnClass = "w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-white/40 dark:bg-navy-800/40 backdrop-blur-md border border-white/60 dark:border-navy-600/50 text-navy-700 dark:text-gold-300 hover:bg-white/80 dark:hover:bg-navy-700/70 hover:border-gold-300 dark:hover:border-gold-500/60 hover:text-gold-600 dark:hover:text-gold-400 hover:shadow-[0_0_15px_rgba(251,191,36,0.3)] shadow-sm transition-all duration-300 active:scale-95 group relative overflow-hidden transform-gpu";

  useEffect(() => {
    setUnreadCount(getUnreadCount());
    // setHijri removed, using reactive hook

    // Initial Load of Benefit (Respects Date)
    loadDailyBenefit();
    loadDailyHadith();

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
        const now = new Date();
        const displayDateFormat = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
        const displayDate = toArabicDigits(displayDateFormat.format(now));
        
        MediaBridge.updateWidgetData({
            hijriDay: toArabicDigits(hijriData.day),
            hijriMonth: MONTH_MAP[hijriData.month] || '',
            hijriYear: toArabicDigits(hijriData.year),
            gregorianDate: displayDate,  // Display format for widget
            nextPrayerName: '',  // Will be updated by calculateNextPrayer
            nextPrayerTime: '',
            hijriAdjustment: getHijriAdjustment().toString(),
            hijriDatesJson: getFutureHijriDatesJSON()
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

  // Copy & Share helpers
  const copyBenefit = async () => {
    if (!dailyBenefit) return;
    const text = `﴿ ${dailyBenefit.ayah.text} ﴾\n[سورة ${dailyBenefit.surahName} - الآية ${dailyBenefit.ayah.numberInSurah}]\n\nالتفسير الميسر:\n${dailyBenefit.tafsir}\n\n[البيان - القرآن والسنة]`;
    try {
      await navigator.clipboard.writeText(text);
      setIsBenefitCopied(true);
      setTimeout(() => setIsBenefitCopied(false), 2000);
    } catch { setToastMessage('تعذّر النسخ'); }
  };

  const shareContent = async (title: string, text: string, fallbackSuccessMsg: string) => {
    try {
      // 1. Native Mobile Sharing (Android/iOS via Capacitor)
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: title,
          text: text,
          dialogTitle: 'مشاركة عبر',
        });
      } 
      // 2. Web Share API (Modern Browsers)
      else if (navigator.share) {
        await navigator.share({
          title: title,
          text: text,
        });
      } 
      // 3. Fallback to Clipboard (Desktop/Unsupported)
      else {
        await navigator.clipboard.writeText(text);
        setToastMessage(fallbackSuccessMsg);
      }
    } catch (err) {
      console.log('Error sharing content', err);
      // If user cancelled, it throws an error usually, we can ignore it
    }
  };

  const shareBenefit = async () => {
    if (!dailyBenefit) return;
    const text = `﴿ ${dailyBenefit.ayah.text} ﴾\n[سورة ${dailyBenefit.surahName} - الآية ${dailyBenefit.ayah.numberInSurah}]\n\nالتفسير الميسر:\n${dailyBenefit.tafsir}\n\n[البيان - القرآن والسنة]`;
    await shareContent('فائدة اليوم', text, 'تم نسخ الآية للمشاركة');
  };

  const copyHadith = async () => {
    if (!dailyHadith) return;
    const text = `${dailyHadith.hadith.arabic || dailyHadith.hadith.text}\n\n[${dailyHadith.bookName} - حديث رقم ${dailyHadith.hadith.hadithnumber || dailyHadith.hadith.id}]\n[البيان - القرآن والسنة]`;
    try {
      await navigator.clipboard.writeText(text);
      setIsHadithCopied(true);
      setTimeout(() => setIsHadithCopied(false), 2000);
    } catch { setToastMessage('تعذّر النسخ'); }
  };

  const shareHadith = async () => {
    if (!dailyHadith) return;
    const text = `${dailyHadith.hadith.arabic || dailyHadith.hadith.text}\n\n[${dailyHadith.bookName}]\n[البيان - القرآن والسنة]`;
    await shareContent('حديث اليوم', text, 'تم نسخ الحديث للمشاركة');
  };

  const getGradeBadge = (grades?: { name: string; grade: string }[]) => {
    if (!grades || grades.length === 0) return null;
    const g = grades[0];
    const gr = g.grade?.toLowerCase() || '';
    let color = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    if (gr.includes('صحيح') || gr.includes('sahih')) color = 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700';
    else if (gr.includes('حسن') || gr.includes('hasan')) color = 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-700';
    else if (gr.includes('ضعيف') || gr.includes('daif') || gr.includes('weak')) color = 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-700';
    return { label: g.grade, color };
  };

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
      const now = new Date();
      const displayDateFormat = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
      const displayDate = toArabicDigits(displayDateFormat.format(now));
      
      try {
        import('../services/islamicCalendar').then(({ getHijriAdjustment }) => {
          MediaBridge.updateWidgetData({
            hijriDay: toArabicDigits(hijriData.day),
            hijriMonth: MONTH_MAP[hijriData.month] || '',
            hijriYear: toArabicDigits(hijriData.year),
            gregorianDate: displayDate,
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

  // Each item: glow = outer glow rgba, ring = border color rgba, iconClass = Tailwind text color
  // Unified to a premium Gold theme as requested
  const menuItems = [
    {
      title: 'اختبارات',
      icon: <Brain size={22} />,
      path: '/quiz',
      glow: 'rgba(198,173,115,0.25)',
      ring: 'rgba(198,173,115,0.45)',
      iconClass: 'text-gold-600 dark:text-gold-400',
    },
    {
      title: 'الحديث',
      icon: <BookHeart size={22} />,
      path: '/hadith',
      glow: 'rgba(198,173,115,0.25)',
      ring: 'rgba(198,173,115,0.45)',
      iconClass: 'text-gold-600 dark:text-gold-400',
    },
    {
      title: 'تفسير',
      icon: <Library size={22} />,
      path: '/tafsir',
      glow: 'rgba(198,173,115,0.25)',
      ring: 'rgba(198,173,115,0.45)',
      iconClass: 'text-gold-600 dark:text-gold-400',
    },
    {
      title: 'البحث',
      icon: <Search size={22} />,
      path: '/search',
      glow: 'rgba(198,173,115,0.25)',
      ring: 'rgba(198,173,115,0.45)',
      iconClass: 'text-gold-600 dark:text-gold-400',
    },
    {
      title: 'المحفوظات',
      icon: <Bookmark size={22} />,
      path: '/bookmarks',
      glow: 'rgba(198,173,115,0.25)',
      ring: 'rgba(198,173,115,0.45)',
      iconClass: 'text-gold-600 dark:text-gold-400',
    },
    {
      title: 'المناسبات',
      icon: <Calendar size={22} />,
      path: '/events',
      glow: 'rgba(198,173,115,0.25)',
      ring: 'rgba(198,173,115,0.45)',
      iconClass: 'text-gold-600 dark:text-gold-400',
    },
    {
      title: 'أوفلاين',
      icon: <WifiOff size={22} />,
      path: '/downloads',
      glow: 'rgba(198,173,115,0.25)',
      ring: 'rgba(198,173,115,0.45)',
      iconClass: 'text-gold-600 dark:text-gold-400',
    },
    {
      title: 'الإعدادات',
      icon: <Settings size={22} />,
      path: '/settings',
      glow: 'rgba(198,173,115,0.25)',
      ring: 'rgba(198,173,115,0.45)',
      iconClass: 'text-gold-600 dark:text-gold-400',
    },
  ];

  const daysRemaining = 30 - hijri.day;
  const gregorianDateStr = new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="flex flex-col min-h-full bg-gradient-to-b from-gold-50 via-white to-gold-50/50 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 pb-28 font-sans relative overflow-x-hidden">
      {/* Background Decorative Elements - Optimized for Performance */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.1),transparent_70%)] dark:bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.05),transparent_70%)] -translate-y-1/2 translate-x-1/3 transform-gpu"></div>
        <div className="absolute bottom-1/4 left-0 w-[400px] h-[400px] bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.1),transparent_70%)] dark:bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.05),transparent_70%)] -translate-x-1/2 transform-gpu"></div>
      </div>

      <div className="w-full max-w-5xl mx-auto flex flex-col flex-1 relative z-10">
      {/* Top Bar Container */}
      <div className="sticky top-0 z-50 px-4 sm:px-5 pt-4 pb-2 transform-gpu">
        <div className="flex justify-between items-center bg-white/60 dark:bg-navy-900/60 backdrop-blur-md rounded-[2rem] px-3 sm:px-4 py-2.5 sm:py-3 shadow-sm border border-white/40 dark:border-navy-600/30">
          <div className="flex items-center gap-1.5 sm:gap-3 flex-1 min-w-0">
            <button onClick={openSidebar} className={`${headerBtnClass}`} title="القائمة الجانبية">
              <Menu size={18} className="group-hover:scale-110 transition-transform" />
            </button>
            <div className="flex items-center gap-1.5 sm:gap-2.5 cursor-pointer group select-none relative flex-1 min-w-0 shrink-0" onClick={() => navigate('/about')} title="عن التطبيق">
              <div className="absolute inset-0 bg-gold-400/20 blur-md rounded-full scale-110 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="flex items-center gap-2 sm:gap-2.5 relative z-10 min-w-0 shrink-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 aspect-square bg-gradient-to-br from-[#DFCD92] via-[#C6AD73] to-[#9A7B3C] rounded-full flex items-center justify-center text-white shadow-md border border-gold-300/50 group-hover:rotate-12 transition-transform duration-300">
                  <span className="font-quran text-[22px] sm:text-2xl font-bold mt-1.5 drop-shadow-sm">ب</span>
                </div>
                <div className="shrink min-w-0">
                  <h1 className="text-lg sm:text-xl font-bold text-navy-900 dark:text-white font-quran leading-none drop-shadow-sm tracking-wide shrink min-w-0 truncate">البيان</h1>
                  <p className="hidden xs:block text-[8px] sm:text-[9px] font-bold text-gold-600 dark:text-gold-400 tracking-wider shrink min-w-0 truncate">القرآن والسنة</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-1.5 sm:gap-2 shrink-0">
            <button className={`${headerBtnClass} hidden xs:flex`} onClick={() => setIsHistoryOpen(true)} title="الإحصائيات">
              <Activity size={18} className="group-hover:rotate-12 transition-transform" />
            </button>

            {/* BATHROOM MODE TOGGLE - NEW */}
            <button
              className={`${headerBtnClass} ${isBathroomModeActive ? '!bg-red-500/20 !border-red-500/50' : ''}`}
              onClick={() => setIsBathroomModalOpen(true)}
              title={isBathroomModeActive ? "وضع الصمت نشط" : "وضع الصمت المؤقت"}
            >
              {isBathroomModeActive ? (
                <div className="relative">
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                  <Pause size={18} className="text-red-500" fill="currentColor" />
                </div>
              ) : (
                <Pause size={18} className="group-hover:scale-110 transition-transform" />
              )}
            </button>

            <button className={headerBtnClass} onClick={() => navigate('/notifications')}>
              <Bell size={18} className="group-hover:scale-110 transition-transform origin-top" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-gradient-to-br from-red-500 to-red-600 text-white text-[9px] font-bold flex items-center justify-center rounded-full shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse">
                  {unreadCount > 9 ? '9+' : toArabicDigits(unreadCount)}
                </span>
              )}
            </button>
            <button onClick={toggleTheme} className={headerBtnClass}>
              <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 transform ${isDark ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 rotate-90'}`}>
                <Sun size={18} className="text-gold-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)] group-hover:rotate-45 transition-transform duration-500" fill="currentColor" />
              </div>
              <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 transform ${!isDark ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-90'}`}>
                <Moon size={18} className="text-navy-600 group-hover:-rotate-12 transition-transform duration-500" />
              </div>
            </button>
          </div>
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
      <div className="px-4 sm:px-5 mt-4 relative z-10">
        {/* Subtle Ambient Glow behind the card */}
        <div className="absolute inset-0 bg-gold-400/20 dark:bg-gold-500/10 blur-[40px] rounded-full scale-90 -z-10"></div>
        
        <div className="relative w-full bg-gradient-to-br from-[#0F2238]/95 via-[#132A42]/95 to-[#0A1929]/95 dark:from-[#081321]/95 dark:via-[#0A1828]/95 dark:to-[#050D17]/95 backdrop-blur-2xl rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.25)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden text-white p-5 sm:p-6 border border-white/10 dark:border-white/5">
          {/* Islamic Pattern Overlay */}
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/arabesque.png')] mix-blend-overlay"></div>

          {/* Decorative Glows inside */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-gold-400/15 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-gold-500/10 rounded-full -ml-12 -mb-12 blur-2xl pointer-events-none"></div>

          {/* Main Content Row: Day Box (Right) + Month/Year Block (Left) */}
          <div className="flex items-stretch justify-between gap-4 relative z-10 h-[90px] sm:h-[100px]">
            {/* Right Gold Square (Day) with glowing ring */}
            <div className="relative w-[90px] h-[90px] sm:w-[100px] sm:h-[100px] flex-shrink-0 group cursor-default">
              {/* Outer Glow Ring */}
              <div className="absolute inset-0 bg-gold-400/30 rounded-2xl blur-md group-hover:blur-lg transition-all duration-500"></div>
              {/* Inner Card */}
              <div className="relative w-full h-full bg-gradient-to-br from-[#DFCD92] via-[#C6AD73] to-[#9A7B3C] rounded-2xl flex flex-col items-center justify-center shadow-inner border border-gold-300/40">
                <span className="text-[3.2rem] sm:text-[3.5rem] font-black font-sans text-[#1A314D] drop-shadow-sm leading-none">
                  {toArabicDigits(hijri.day)}
                </span>
              </div>
            </div>

            {/* Left Block: flex container for (Month) and (Button + Year) */}
            <div className="flex-1 flex justify-between h-full pl-1">
              
              {/* Right Side: Month Name */}
              <div className="flex flex-col justify-center h-full pt-1">
                <h2 className="text-[2.2rem] sm:text-[2.6rem] font-bold font-quran text-white leading-none drop-shadow-lg tracking-wide">
                  {MONTH_MAP[hijri.month]}
                </h2>
              </div>

              {/* Left Side: Year */}
              <div className="flex flex-col items-end justify-end h-full py-0.5">
                <div className="text-lg text-[#C6AD73] font-bold flex items-center justify-end gap-1.5">
                  <span>{toArabicDigits(hijri.year)}</span>
                  <span className="text-sm opacity-70">هـ</span>
                </div>
              </div>
            </div>
          </div>

          {/* Middle Row: Gregorian Date (Left) + Days Remaining (Right) */}
          <div className="flex justify-between items-center mt-5 relative z-10">
            {/* Gregorian Date */}
            <div className="bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 shadow-inner">
              <span className="text-[11px] sm:text-[12px] font-bold text-gray-200">
                {gregorianDateStr}
              </span>
            </div>

            {/* Days Remaining */}
            <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 shadow-inner">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-gold-400"></span>
              </span>
              <span className="text-[11px] sm:text-[12px] font-bold text-gold-300">
                {toArabicDigits(daysRemaining > 0 ? daysRemaining : 0)} يوم لنهاية الشهر الهجري
              </span>
            </div>
          </div>

          {/* Bottom Row: Location (Right) + Prayer Button (Left) */}
          <div className="flex justify-between items-center mt-3 relative z-10 gap-3">
            {/* Location Display */}
            <div className="flex items-center gap-1.5 bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/10 cursor-pointer transition-colors"
                 onClick={(e) => {
                   e.stopPropagation();
                   setIsCitySearchModalOpen(true);
                 }}
            >
              <MapPin size={14} className="text-gold-300" />
              <span className="text-[11px] font-bold text-gray-200 truncate max-w-[150px] sm:max-w-[200px]">
                {localStorage.getItem('user_location_name') || (prayerData?.meta?.timezone?.split('/').pop() || 'تحديد الموقع')}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCitySearchModalOpen(true);
                }}
                className="hidden lg:flex p-1 rounded-full hover:bg-white/20 text-gray-300 hover:text-white transition-colors"
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
                className={`p-1 rounded-full hover:bg-white/20 text-gold-400 transition-colors ${loadingPrayer ? 'animate-spin' : ''}`}
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



      {/* ── Circular Glow Menu Grid ─────────────────────────────────── */}
      <div className="px-4 sm:px-5 mt-5 relative z-10">
        <div className="grid grid-cols-4 lg:grid-cols-8 gap-x-2 gap-y-5 sm:gap-x-4 sm:gap-y-6">
          {menuItems.map((item, idx) => (
            <button
              key={idx}
              onClick={() => navigate(item.path)}
              className="menu-icon-btn flex flex-col items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 rounded-xl"
              aria-label={item.title}
            >
              {/* Circular icon with per-item glow */}
              <div
                className={`menu-icon-circle ${item.iconClass}`}
                style={{
                  '--icon-glow-color': item.glow,
                  '--icon-ring-color': item.ring,
                  width: '56px',
                  height: '56px',
                } as React.CSSProperties}
              >
                {item.icon}
              </div>
              {/* Label */}
              <span className="menu-icon-label">{item.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 sm:px-5 mt-6 relative z-10 group cursor-pointer" onClick={() => navigate(lastRead ? `/reader?page=${lastRead.page}` : '/reader')}>
        {/* Ambient Glow */}
        <div className="absolute inset-0 bg-gold-400/10 dark:bg-gold-500/5 blur-2xl rounded-2xl scale-95 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        
        <div className="bg-white/60 dark:bg-navy-800/50 backdrop-blur-2xl rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.05)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)] border border-white/50 dark:border-navy-600/30 flex justify-between items-center group-hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
          {/* Edge Glow effect */}
          <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-gold-400 to-amber-500 shadow-[0_0_10px_rgba(251,191,36,0.5)]"></div>

          <div className="flex items-center gap-4 relative z-10">
            <div className="relative w-14 h-14 shrink-0">
              <div className="absolute inset-0 bg-gold-400/30 blur-sm rounded-full scale-90 group-hover:scale-105 transition-transform duration-500 transform-gpu"></div>
              <div className="relative w-full h-full bg-gradient-to-br from-gold-400 to-amber-500 rounded-xl flex items-center justify-center shadow-sm border border-gold-300/50">
                <BookOpen size={24} className="text-white drop-shadow-sm" />
              </div>
            </div>
            <div>
              <h3 className="text-[11px] font-bold text-navy-500 dark:text-navy-400 mb-1 tracking-wide">آخر قراءة</h3>
              <p className="text-lg sm:text-xl font-bold text-navy-900 dark:text-white font-quran drop-shadow-sm">{lastRead ? lastRead.surah : 'القرآن الكريم'}</p>
              <p className="text-[11px] text-navy-500 dark:text-navy-400 mt-1">{lastRead ? `صفحة ${toArabicDigits(lastRead.page)}` : 'اضغط للبدء'}</p>
            </div>
          </div>
          <div className="relative w-10 h-10 bg-white/50 dark:bg-navy-700/50 backdrop-blur-md rounded-full flex items-center justify-center text-navy-600 dark:text-gold-400 border border-white/40 dark:border-navy-600/50 group-hover:bg-gold-400 group-hover:text-white group-hover:border-gold-400 group-hover:shadow-[0_0_15px_rgba(251,191,36,0.4)] transition-all duration-300">
            <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-5 mt-6 mb-4 relative z-10">
        <div className="bg-white/60 dark:bg-navy-800/50 backdrop-blur-md rounded-2xl p-5 sm:p-6 shadow-sm relative overflow-hidden border border-white/50 dark:border-navy-600/30 transform-gpu">
          
          {/* Top Ambient Glow (Gold/Amber) */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.15),transparent_70%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.1),transparent_70%)] pointer-events-none transform-gpu"></div>

          {/* Decorative Quote Icon */}
          <div className="absolute top-2 left-2 opacity-5 dark:opacity-10 transform -scale-x-100">
            <Quote size={100} className="text-gold-500" />
          </div>

          <div className="flex justify-between items-center mb-5 relative z-10">
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 shrink-0">
                <div className="absolute inset-0 bg-gold-400/30 blur-sm rounded-full scale-90 transform-gpu"></div>
                <div className="relative w-full h-full bg-gradient-to-br from-gold-400 to-amber-500 rounded-xl flex items-center justify-center shadow-sm border border-gold-300/50">
                  <BookHeart size={20} className="text-white drop-shadow-sm" />
                </div>
              </div>
              <span className="text-[13px] font-bold text-navy-800 dark:text-white drop-shadow-sm">فائدة اليوم</span>
            </div>
            <button
              onClick={() => loadDailyBenefit(true)}
              disabled={loadingBenefit}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/50 dark:bg-navy-700/50 backdrop-blur-md text-gold-600 dark:text-gold-400 hover:bg-gold-50 dark:hover:bg-navy-600 border border-white/50 dark:border-navy-600/50 hover:border-gold-300 dark:hover:border-gold-500/50 transition-all text-[11px] font-bold shadow-sm active:scale-95 ${loadingBenefit ? 'opacity-50' : ''}`}
            >
              {loadingBenefit ? (<RefreshCw size={13} className="animate-spin" />) : (<Sparkles size={13} />)}
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
              {/* Ayah Text */}
              <div className="relative mb-4">
                <Quote size={24} className="text-gold-200 dark:text-navy-600 absolute -top-2 right-0 rotate-180" />
                <p className="font-quran text-lg sm:text-xl leading-[2.4] text-center text-navy-900 dark:text-white px-4">{dailyBenefit.ayah.text}</p>
                <p className="text-[10px] text-center text-navy-400 dark:text-navy-500 mt-3 font-bold tracking-wide">
                  ﴿ {dailyBenefit.surahName} — الآية {toArabicDigits(dailyBenefit.ayah.numberInSurah)} ﴾
                </p>
              </div>

              {/* Action Bar */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 my-5">
                <button
                  onClick={copyBenefit}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold transition-all duration-300 backdrop-blur-md border shadow-[0_4px_12px_rgba(0,0,0,0.05)] ${
                    isBenefitCopied
                      ? 'bg-emerald-500/90 text-white border-emerald-500/50 scale-95'
                      : 'bg-white/60 dark:bg-navy-700/50 text-navy-600 dark:text-navy-300 border-white/50 dark:border-navy-600/50 hover:bg-gold-50 dark:hover:bg-navy-600 hover:text-gold-600 dark:hover:text-gold-400 hover:border-gold-300 dark:hover:border-gold-500/50'
                  }`}
                  title="نسخ الآية"
                >
                  {isBenefitCopied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{isBenefitCopied ? 'تم النسخ!' : 'نسخ'}</span>
                </button>

                <button
                  onClick={shareBenefit}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold transition-all duration-300 backdrop-blur-md border shadow-[0_4px_12px_rgba(0,0,0,0.05)] bg-white/60 dark:bg-navy-700/50 text-navy-600 dark:text-navy-300 border-white/50 dark:border-navy-600/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-500/50 active:scale-95"
                  title="مشاركة الآية"
                >
                  <Share2 size={14} />
                  <span>مشاركة</span>
                </button>

                <button
                  onClick={() => setShowBenefitTafsir(v => !v)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold transition-all duration-300 backdrop-blur-md border shadow-[0_4px_12px_rgba(0,0,0,0.05)] active:scale-95 ${
                    showBenefitTafsir 
                      ? 'bg-gold-50 dark:bg-gold-900/20 text-gold-600 dark:text-gold-400 border-gold-300 dark:border-gold-500/50'
                      : 'bg-white/60 dark:bg-navy-700/50 text-navy-600 dark:text-navy-300 border-white/50 dark:border-navy-600/50 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-300 dark:hover:border-amber-500/50'
                  }`}
                  title="إظهار / إخفاء التفسير"
                >
                  <Library size={14} />
                  <span>التفسير</span>
                  {showBenefitTafsir ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>

              {/* Collapsible Tafsir */}
              <div
                className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-in-out ${
                  showBenefitTafsir ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0 mt-0'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="bg-white/80 dark:bg-navy-900/80 p-4 rounded-2xl border border-white/50 dark:border-navy-700/50 shadow-inner">
                    <h4 className="text-[11px] font-bold text-gold-600 dark:text-gold-400 mb-2.5 flex items-center gap-1.5">
                      <Library size={12} />
                      التفسير الميسر
                    </h4>
                    <p className="text-xs sm:text-[13px] text-navy-700 dark:text-navy-200 leading-[2.2] text-right drop-shadow-sm">{dailyBenefit.tafsir}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-red-400 text-sm py-4 relative z-10">فشل في تحميل الفائدة. تأكد من الاتصال بالإنترنت.</div>
          )}
        </div>
      </div>

      {/* Daily Hadith Section */}
      <div className="px-4 sm:px-5 mb-10 relative z-10">
        <div className="bg-white/60 dark:bg-navy-800/50 backdrop-blur-md rounded-2xl p-5 sm:p-6 shadow-sm relative overflow-hidden border border-white/50 dark:border-navy-600/30 transform-gpu">
          
          {/* Top Ambient Glow (Blue/Cyan) */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.15),transparent_70%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.1),transparent_70%)] pointer-events-none transform-gpu"></div>

          {/* Decorative Quote Icon */}
          <div className="absolute top-2 left-2 opacity-5 dark:opacity-10 transform -scale-x-100">
            <Quote size={100} className="text-sky-500" />
          </div>

          <div className="flex justify-between items-center mb-5 relative z-10">
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 shrink-0">
                <div className="absolute inset-0 bg-sky-400/30 blur-sm rounded-full scale-90 transform-gpu"></div>
                <div className="relative w-full h-full bg-gradient-to-br from-sky-400 to-blue-500 rounded-xl flex items-center justify-center shadow-sm border border-sky-300/50">
                  <BookOpen size={20} className="text-white drop-shadow-sm" />
                </div>
              </div>
              <span className="text-[13px] font-bold text-navy-800 dark:text-white drop-shadow-sm">حديث اليوم</span>
            </div>
            <button
              onClick={() => loadDailyHadith(true)}
              disabled={loadingHadith}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/50 dark:bg-navy-700/50 backdrop-blur-md text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-navy-600 border border-white/50 dark:border-navy-600/50 hover:border-sky-300 dark:hover:border-sky-500/50 transition-all text-[11px] font-bold shadow-sm active:scale-95 ${loadingHadith ? 'opacity-50' : ''}`}
            >
              {loadingHadith ? (<RefreshCw size={13} className="animate-spin" />) : (<Sparkles size={13} />)}
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
              {/* Hadith Text */}
              <div className="relative mb-4">
                <Quote size={24} className="text-sky-200 dark:text-navy-600 absolute -top-2 right-0 rotate-180" />
                <div className="px-4">
                  <p className={`font-quran text-lg sm:text-xl leading-[2.4] text-center text-navy-900 dark:text-white drop-shadow-sm transition-all duration-500 ease-in-out ${isHadithExpanded ? '' : 'line-clamp-4'}`}>
                    {dailyHadith.hadith.arabic || dailyHadith.hadith.text}
                  </p>
                  {((dailyHadith.hadith.arabic || dailyHadith.hadith.text || '').length > 300) && (
                    <button
                      onClick={() => setIsHadithExpanded(!isHadithExpanded)}
                      className="mt-2 text-[12px] font-bold text-sky-500 dark:text-sky-400 hover:text-sky-600 dark:hover:text-sky-300 w-full text-center flex items-center justify-center gap-1 transition-colors"
                    >
                      {isHadithExpanded ? 'طي الحديث' : 'اقرأ المزيد'}
                      {isHadithExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  )}
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 my-5">
                <button
                  onClick={copyHadith}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold transition-all duration-300 backdrop-blur-md border shadow-[0_4px_12px_rgba(0,0,0,0.05)] ${
                    isHadithCopied
                      ? 'bg-emerald-500/90 text-white border-emerald-500/50 scale-95'
                      : 'bg-white/60 dark:bg-navy-700/50 text-navy-600 dark:text-navy-300 border-white/50 dark:border-navy-600/50 hover:bg-sky-50 dark:hover:bg-navy-600 hover:text-sky-600 dark:hover:text-sky-400 hover:border-sky-300 dark:hover:border-sky-500/50'
                  }`}
                  title="نسخ الحديث"
                >
                  {isHadithCopied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{isHadithCopied ? 'تم النسخ!' : 'نسخ'}</span>
                </button>

                <button
                  onClick={shareHadith}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold transition-all duration-300 backdrop-blur-md border shadow-[0_4px_12px_rgba(0,0,0,0.05)] bg-white/60 dark:bg-navy-700/50 text-navy-600 dark:text-navy-300 border-white/50 dark:border-navy-600/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-500/50 active:scale-95"
                  title="مشاركة الحديث"
                >
                  <Share2 size={14} />
                  <span>مشاركة</span>
                </button>

                <button
                  onClick={() => navigate(`/hadith?book=${dailyHadith.bookId}&target=${String(dailyHadith.hadith.id || dailyHadith.hadith.hadithnumber)}`)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold transition-all duration-300 backdrop-blur-md border shadow-[0_4px_12px_rgba(0,0,0,0.05)] bg-white/60 dark:bg-navy-700/50 text-navy-600 dark:text-navy-300 border-white/50 dark:border-navy-600/50 hover:bg-navy-100 dark:hover:bg-navy-600 hover:text-navy-800 dark:hover:text-white hover:border-navy-300 dark:hover:border-navy-500/50 active:scale-95"
                  title="الانتقال للحديث"
                >
                  <ExternalLink size={14} />
                  <span>عرض الحديث</span>
                </button>
              </div>

              {/* Source + Grade Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-4 border-t border-navy-100 dark:border-navy-700">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] sm:text-xs text-navy-500 dark:text-navy-400 font-bold bg-navy-50 dark:bg-navy-900 px-3 py-1.5 rounded-lg border border-navy-100 dark:border-navy-700">
                    📖 {dailyHadith.bookName}
                  </span>
                  {(() => {
                    const badge = getGradeBadge(dailyHadith.hadith.grades);
                    return badge ? (
                      <span className={`text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1 ${badge.color}`}>
                        <Award size={11} />
                        {badge.label}
                      </span>
                    ) : null;
                  })()}
                </div>
                <span className="text-[10px] text-navy-400 dark:text-navy-500">
                  حديث رقم {toArabicDigits(dailyHadith.hadith.hadithnumber || dailyHadith.hadith.id)}
                </span>
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
