
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Volume2, VolumeX, Pause, Play, Settings, Check, Loader2, AlertCircle, RefreshCcw, BellRing } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { MUAZZINS } from '../services/azhanData';
import { getStoredAzhan, setStoredAzhan, getNotificationSettings } from '../services/storage';
import { getPlayableAzhanUrl } from '../services/offlineAudio';
import { MediaBridge } from '../services/mediaBridge';
import { toArabicDigits } from '../services/normalization';
import { useTheme } from './Layout';

const isAndroid = Capacitor.getPlatform() === 'android';

interface AzhanModalProps {
  prayerName: string;
  prayerTime: string;
  onClose: () => void;
  initialAzhanId?: string; // New prop for previewing specific muazzin
  isReal?: boolean;
  onAzhanChanged?: (newId: string) => void;
  onSelect?: (id: string, volume: number) => void; // New: Return ID and Volume
  previewVolume?: number;
}

// Helper for formatting time (moved out of component or just kept if needed, but for now cleaning up)
const formatPrayerTime = (timeStr: string) => {
  if (!timeStr) return '';
  // Convert Arabic numerals to English for parsing
  const arabicToEnglish: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
  };
  let normalized = timeStr;
  Object.entries(arabicToEnglish).forEach(([ar, en]) => {
    normalized = normalized.replace(new RegExp(ar, 'g'), en);
  });
  if (timeStr.includes('ص') || timeStr.includes('م')) return timeStr;
  const parts = normalized.split(':');
  if (parts.length < 2) return timeStr;
  let h = parseInt(parts[0], 10);
  let m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const ampm = h >= 12 ? 'م' : 'ص';
  h = h % 12 || 12;
  const formatted = `${h}:${m.toString().padStart(2, '0')}`;
  return `${toArabicDigits(formatted)} ${ampm}`;
};


export const AzhanModal: React.FC<AzhanModalProps> = ({
  prayerName,
  prayerTime,
  onClose,
  initialAzhanId,
  previewVolume,
  isReal,
  onAzhanChanged,
  onSelect
}) => {
  // Theme detection for light/dark mode support
  const { isDark } = useTheme();

  // Use initialAzhanId if provided, otherwise fallback to stored
  const [currentAzhanId, setCurrentAzhanId] = useState(initialAzhanId || getStoredAzhan());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const fadeIntervalRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  // Volume State for Per-Prayer Customization
  const settings = getNotificationSettings();
  const [localVolume, setLocalVolume] = useState(previewVolume !== undefined ? previewVolume : (settings.salah.azhanVolume ?? 80));

  const isMounted = useRef(true);

  const effectiveVolumeInt = localVolume;
  const azhanVolume = effectiveVolumeInt / 100;

  // 1. ميزة التدرج الصوتي (Audio Fade-in) - محدثة لتتوافق مع إعدادات الصوت
  const fadeIn = useCallback(() => {
    if (!audioRef.current) return;

    // Safety check: if volume is very low, just set it directly
    const targetVol = Math.max(0.1, azhanVolume); // Minimum 10%

    // Start at non-zero but low volume if we want fade-in, OR just start at target
    // Some browsers have issues with volume=0. Let's start at 0.1
    audioRef.current.volume = 0.1;

    let vol = 0.1;

    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);

    fadeIntervalRef.current = window.setInterval(() => {
      if (audioRef.current && vol < targetVol) {
        vol = Math.min(vol + 0.1, targetVol); // Faster fade-in (10% per 200ms -> 2 seconds total)
        audioRef.current.volume = vol;
      } else {
        if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
      }
    }, 200);
  }, [azhanVolume]);

  // 2. طلب Wake Lock
  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      } catch (err) { console.warn("WakeLock failed"); }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().then(() => { wakeLockRef.current = null; });
    }
  };

  useEffect(() => {
    isMounted.current = true;
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";
    audioRef.current = audio;

    const onTimeUpdate = () => {
      if (audio.duration && isMounted.current) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const onEnded = () => {
      if (isMounted.current) {
        setIsPlaying(false);
        setProgress(100);
        releaseWakeLock();
        onClose();
      }
    };

    const onError = (e: any) => {
      console.error("Audio Error Event:", e);
      if (isMounted.current) {
        setError("فشل تشغيل الأذان. تحقق من اتصال الشبكة.");
        setIsLoading(false);
        setIsPlaying(false);
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    // Listen for Native Azhan Dismissal (Android)
    let nativeListener: any;
    if (isAndroid) {
      MediaBridge.addListener('azhanDismissed', () => {
        if (isMounted.current) {
          setIsPlaying(false);
          onClose();
        }
      }).then(l => { nativeListener = l; });

      // NEW: Listen for actual playback state changes from native side
      MediaBridge.addListener('onIsPlayingChanged', (data: { isPlaying: boolean }) => {
        if (isMounted.current) {
          setIsPlaying(data.isPlaying);
        }
      }).then(l => { /* Store if needed */ });
    }

    return () => {
      isMounted.current = false;
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
      if (isAndroid) {
        // CRITICAL FIX: For REAL Azhan, do NOT stop playback when Modal closes!
        // The user might just want to dismiss the UI while Azhan continues.
        // Only stop for PREVIEW mode (user testing from settings).
        // isReal is captured from the component props at render time.
        if (!isReal) {
          MediaBridge.stop().catch(e => console.warn("Failed to stop preview", e));
        }
        if (nativeListener) nativeListener.remove();
      } else {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
        }
      }
      releaseWakeLock();
    };
  }, [onClose, isReal]);

  const loadAndPlay = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    setProgress(0);

    try {
      if (isAndroid) {
        // PREVENT CONFLICT: If a real Azhan is currently playing, do NOT interrupt it with a preview
        // This addresses a high-priority risk identified in the Audit Report.
        try {
          const state = await MediaBridge.getCurrentAzhanState();
          if (state?.isPlayingAzhan && state?.isReal && !isReal) {
            setError("الأذان الحقيقي قيد التشغيل حالياً. لا يمكن تشغيل المعاينة الآن.");
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn("[AzhanModal] Polling current state failed, proceeding with safety stop.", e);
        }

        await MediaBridge.stop(); // Clean slate before preview
        // WAIT: Give native side a moment to fully release resources/audio focus
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      const muazzinData = MUAZZINS.find(m => m.id === id);
      const muazzinName = muazzinData?.name || 'الأذان';

      // HANDLE RANDOM PREVIEW: Pick a real ID if 'random' is passed
      let targetId = id;
      if (targetId === 'random') {
        const realMuazzins = MUAZZINS.filter(m => m.id !== 'random');
        if (realMuazzins.length > 0) {
          const randomMuazzin = realMuazzins[Math.floor(Math.random() * realMuazzins.length)];
          targetId = randomMuazzin.id;
          console.log('[AzhanModal] Previewing Random Muazzin:', targetId);
        } else {
          targetId = 'egy_abdulbasit'; // Safety fallback
        }
      }

      // Get the playable URL (works for both web and Android)
      // Use targetId instead of id
      const url = await getPlayableAzhanUrl(targetId);

      if (!url || url.length === 0) {
        throw new Error("Azhan file not found (Invalid URL)");
      }

      if (isAndroid) {
        // Android: Use MediaBridge.playAzhan for specialized Alarm/Azhan channel behavior
        // This ensures volume settings and full-screen compatibility are respected

        // FIXED: Send targetId (the resolved real ID) instead of id (which could be 'random')
        await MediaBridge.playAzhan({
          muazzinId: targetId,
          prayerName: prayerName || 'تجربة الأذان',
          muazzinName: MUAZZINS.find(m => m.id === targetId)?.name || muazzinName,
          azhanUrl: url // Pass the resolved playable URL (file or bundled)
        });

        if (isMounted.current) {
          setIsPlaying(true);
          setIsLoading(false);
          // Haptic Feedback: Gentle vibration pattern for professional feel
          if (navigator.vibrate) {
            navigator.vibrate([50, 30, 50]);
          }
        }
      } else {
        // Web: Use HTML Audio
        if (!audioRef.current) return;

        if (playPromiseRef.current) {
          try { await playPromiseRef.current; } catch (e) { }
        }

        console.log("Loading Azhan URL:", url);
        audioRef.current.src = url;
        audioRef.current.load();

        // Ensure volume is set initially
        audioRef.current.volume = azhanVolume;

        // Try fadeIn if requested, otherwise just play
        fadeIn();

        requestWakeLock();

        // Web Haptic
        if (navigator.vibrate) navigator.vibrate([50]);

        const playPromise = audioRef.current.play();
        playPromiseRef.current = playPromise;

        await playPromise;
        console.log("Azhan playback started");

        if (isMounted.current) {
          setIsPlaying(true);
          setIsLoading(false);
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError' && isMounted.current) {
        console.error("Audio Playback Error:", err);
        // Autoplay Policy Error Detection
        if (err.name === 'NotAllowedError') {
          setError("منع المتصفح التشغيل التلقائي. اضغط على زر التشغيل للاستماع.");
          setIsPlaying(false); // Make sure it's paused so user can click play
        } else {
          setError("تعذر الوصول لصوت المؤذن حالياً (Network/Format Error).");
        }
        setIsLoading(false);
      }
    }
  }, [fadeIn, prayerName, effectiveVolumeInt]);

  useEffect(() => {
    // Register listeners for all Android playback (real or preview)
    if (isAndroid) {
      // CRITICAL FIX: Safety Check for Real Azhan
      // If the app is open, the background alarm might have stopped.
      // We check the state: if NOT playing, we start it manually.
      // CRITICAL FIX: Robust Event-Driven State Synchronization
      // Instead of polling with setTimeout (which is flaky), we rely on the 'isReal' prop
      // and the event stream.
      const syncInitialState = async () => {
        if (isReal) {
          // ✅ CRITICAL FIX: Trust Native 100% for Real Azhan
          // 
          // RATIONALE: If isReal=true, it means:
          // 1. AzhanReceiver received the alarm
          // 2. AudioPlaybackService started playback 
          // 3. AudioPlaybackService sent broadcast ACTION_AZHAN_STARTED
          // 4. MediaBridge received broadcast and notified JS
          // 5. Layout.tsx received event and opened this Modal with isReal=true
          //
          // Therefore: Native IS playing. We don't need to verify.
          // The old checkState polling caused Race Condition because:
          // - getCurrentAzhanState() queries MediaBridge.isAzhanPlaying (local var)
          // - This var is updated by broadcast receiver
          // - But JS receives the event BEFORE broadcast fully processes
          // - So getCurrentAzhanState returns false → Modal closes → cleanup stops audio!
          //
          // NEW APPROACH: Trust the event that opened us. Listen for state changes.
          if (isMounted.current) {
            setIsPlaying(true);
            setIsLoading(false);
          }
          // State changes (pause/mute/end) will be handled by listeners:
          // - azhanProgress → updates progress
          // - azhanStateChanged → updates isPlaying, isMuted  
          // - azhanDismissed → closes Modal
          // No polling needed!

        } else {
          // Preview Mode: We must explicitly start playback
          loadAndPlay(currentAzhanId);
        }
      };

      syncInitialState();

      // Listen for native progress updates
      const progressListener = MediaBridge.addListener('azhanProgress', (data: { progress: number }) => {
        if (isMounted.current) {
          setProgress(data.progress);
        }
      });

      // Listen for native state changes (pause/mute from notification)
      const stateListener = MediaBridge.addListener('azhanStateChanged', (data: { isPlaying: boolean, isMuted: boolean }) => {
        if (isMounted.current) {
          setIsPlaying(data.isPlaying);
          setIsMuted(data.isMuted);
        }
      });

      return () => {
        progressListener.then(h => h.remove());
        stateListener.then(h => h.remove());
      };
    }

    // Web: Call loadAndPlay (this code only runs on non-Android platforms)
    loadAndPlay(currentAzhanId);
  }, [currentAzhanId, loadAndPlay, isReal]);

  const togglePlay = async () => {
    if (isLoading) return; // Removed '|| error' to allow retry on Autoplay policy block

    // Clear autoplay error if user manually interacts
    if (error && error.includes('التشغيل التلقائي')) {
       setError(null);
    }

    try {
      if (isAndroid) {
        // Android: More robust toggle logic
        if (isPlaying) {
          await MediaBridge.pause();
          setIsPlaying(false);
          releaseWakeLock();
        } else {
          await MediaBridge.resume();
          setIsPlaying(true);
          requestWakeLock();
        }
      } else {
        // Web: Use HTML Audio
        if (!audioRef.current) return;
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
          releaseWakeLock();
        } else {
          try {
            fadeIn();
            requestWakeLock();
            await audioRef.current.play();
            setIsPlaying(true);
            setError(null); // Clear any previous error on successful play
          } catch (e) {
            console.error("Web play error:", e);
            setError("فشل استئناف الأذان.");
          }
        }
      }

      // Haptic Feedback for the main golden button
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
    } catch (err) {
      console.error("Toggle Play Error:", err);
      // Fallback: try to re-init if toggle fails
      loadAndPlay(currentAzhanId);
    }
  };

  const changeMuazzin = (id: string) => {
    // If onSelect is provided (Per-Prayer Mode), skip global save
    if (onSelect) {
      onSelect(id, localVolume);
      setShowSettings(false);
      return;
    }

    setStoredAzhan(id);
    setCurrentAzhanId(id);
    setShowSettings(false);
    // Instant Sync: Notify parent to reschedule alarms immediately
    if (onAzhanChanged) {
      onAzhanChanged(id);
    }
  };

  const formattedTime = formatPrayerTime(prayerTime);

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in duration-500 font-sans ${isDark
      ? 'bg-gradient-to-b from-black/95 via-[#0a1628]/98 to-black/95'
      : 'bg-gradient-to-b from-amber-50/95 via-white/98 to-gold-50/95'
      }`}>
      {/* Ambient Glow Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full blur-[100px] animate-pulse ${isDark ? 'bg-[#D4B978]/10' : 'bg-gold-400/20'
          }`} />
        <div className={`absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t to-transparent ${isDark ? 'from-[#D4B978]/5' : 'from-gold-400/10'
          }`} />
      </div>

      <div className="relative w-full max-w-sm animate-in zoom-in-95 duration-500">
        {/* Main Card with Glassmorphism */}
        <div className={`relative rounded-[36px] shadow-[0_30px_100px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col items-center text-center pb-10 backdrop-blur-2xl ${isDark
          ? 'bg-gradient-to-b from-[#0F2238]/95 to-[#0a1628]/98 border border-white/[0.08]'
          : 'bg-gradient-to-b from-white/95 to-gold-50/90 border border-gold-200/50 shadow-gold-500/10'
          }`}>

          {/* Subtle top gradient accent */}
          <div className={`absolute top-0 inset-x-0 h-32 bg-gradient-to-b to-transparent pointer-events-none ${isDark ? 'from-[#D4B978]/10' : 'from-gold-400/20'
            }`} />

          {/* Top Header: Close & Settings */}
          <div className="relative w-full flex justify-between items-center pt-6 px-6 z-10">
            <button onClick={onClose} className={`p-2.5 rounded-full transition-all active:scale-90 ${isDark
              ? 'hover:bg-white/10 text-white/50 hover:text-white/80'
              : 'hover:bg-navy-100 text-navy-400 hover:text-navy-600'
              }`}>
              <X size={22} strokeWidth={2.5} />
            </button>
            {/* إخفاء زر الإعدادات في الأذان الحقيقي - لا حاجة لتغيير المؤذن أثناء الأذان */}
            {!isReal && (
              <button onClick={() => setShowSettings(!showSettings)} className={`p-2.5 rounded-full transition-all active:scale-90 ${isDark
                ? 'hover:bg-white/10 text-white/50 hover:text-white/80'
                : 'hover:bg-navy-100 text-navy-400 hover:text-navy-600'
                }`}>
                <Settings size={22} strokeWidth={2} />
              </button>
            )}
          </div>

          {/* Main Bell in Animated Ring */}
          <div className="relative mt-8 mb-2">
            {/* Outer glow ring */}
            <div className={`absolute inset-0 rounded-full bg-[#D4B978]/20 blur-xl ${isPlaying ? 'animate-ping' : ''}`} style={{ animationDuration: '2s' }} />

            {/* Main ring with gradient border */}
            <div className="relative w-[150px] h-[150px] rounded-full flex items-center justify-center"
              style={{
                background: isDark
                  ? 'linear-gradient(145deg, rgba(212,185,120,0.15), rgba(15,34,56,0.8))'
                  : 'linear-gradient(145deg, rgba(212,185,120,0.3), rgba(255,255,255,0.9))',
                boxShadow: isDark
                  ? '0 0 60px rgba(212,185,120,0.15), inset 0 0 40px rgba(212,185,120,0.05)'
                  : '0 0 60px rgba(212,185,120,0.25), inset 0 0 40px rgba(212,185,120,0.1), 0 8px 32px rgba(0,0,0,0.1)'
              }}
            >
              {/* Animated border ring */}
              <div className="absolute inset-0 rounded-full border-[3px] border-[#D4B978]/80"
                style={{
                  boxShadow: '0 0 20px rgba(212,185,120,0.3), inset 0 0 20px rgba(212,185,120,0.1)'
                }}
              />

              {/* Progress ring overlay */}
              {isPlaying && !isLoading && (
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50" cy="50" r="47"
                    fill="none"
                    stroke="url(#goldGradient)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${progress * 2.95} 295`}
                    className="transition-all duration-300"
                  />
                  <defs>
                    <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#D4B978" />
                      <stop offset="100%" stopColor="#F59E0B" />
                    </linearGradient>
                  </defs>
                </svg>
              )}


              {/* Icon Container */}
              <div className="relative z-10">
                {isLoading ? (
                  <Loader2 size={52} className="text-[#D4B978] animate-spin" />
                ) : error ? (
                  <AlertCircle size={52} className="text-red-400 animate-pulse" />
                ) : (
                  <div className={`transition-transform duration-300 ${isPlaying ? 'animate-[bellSwing_0.8s_ease-in-out_infinite]' : ''}`}>
                    <BellRing
                      size={52}
                      className="text-[#D4B978] drop-shadow-[0_0_10px_rgba(212,185,120,0.5)]"
                      fill="currentColor"
                      strokeWidth={1.5}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Prayer Info */}
          <div className="mt-6 space-y-2 px-6">
            <h2 className={`text-[32px] font-bold tracking-wide ${isDark ? 'text-white' : 'text-navy-800'}`} style={{ textShadow: isDark ? '0 2px 20px rgba(255,255,255,0.1)' : 'none' }}>
              {prayerName}
            </h2>
            <p className="text-[#D4B978] text-2xl font-bold tracking-wider dir-ltr" style={{ textShadow: '0 2px 15px rgba(212,185,120,0.3)' }}>
              {formattedTime}
            </p>

            {/* Muazzin Badge */}
            <div className={`inline-flex items-center gap-2 mt-4 px-4 py-2 backdrop-blur-sm rounded-full border ${isDark
              ? 'bg-white/[0.05] border-white/[0.08]'
              : 'bg-navy-800/10 border-navy-200/50'
              }`}>
              <span className={`text-xs ${isDark ? 'text-white/60' : 'text-navy-500'}`}>بصوت:</span>
              <span className="text-[#D4B978] text-sm font-bold">
                {MUAZZINS.find(m => m.id === currentAzhanId)?.name}
              </span>
            </div>
          </div>

          {error && (
            <div className="mx-6 mt-4 bg-red-500/10 border border-red-500/20 p-3 rounded-2xl flex items-center justify-center gap-3 backdrop-blur-sm">
              <p className="text-xs text-red-300">{error}</p>
              <button onClick={() => loadAndPlay(currentAzhanId)} className="p-1.5 rounded-full bg-red-500/20 text-[#D4B978] hover:bg-red-500/30 transition-colors">
                <RefreshCcw size={14} />
              </button>
            </div>
          )}

          {/* Controls Row */}
          <div className="flex items-center justify-center gap-5 w-full px-6 mt-8">
            {/* Stop Button (Left) - Red bordered like native */}
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl bg-transparent border-2 border-red-500/60 text-red-400 hover:bg-red-500/10 hover:border-red-500 flex items-center justify-center transition-all active:scale-95"
            >
              <span className="text-sm font-bold">إيقاف</span>
            </button>

            {/* Play/Pause (Center - Gold Gradient) */}
            <button
              onClick={togglePlay}
              disabled={isLoading}
              className={`w-[72px] h-[72px] rounded-full flex items-center justify-center transition-all active:scale-90 ${isLoading ? 'opacity-50' : ''}`}
              style={{
                background: 'linear-gradient(145deg, #E8C97A, #C6A870)',
                boxShadow: `
                  0 10px 40px rgba(212,185,120,0.4),
                  0 0 0 4px rgba(212,185,120,0.15),
                  inset 0 2px 0 rgba(255,255,255,0.2)
                `
              }}
            >
              {isPlaying ? (
                <Pause size={32} className="text-[#0a1628]" fill="currentColor" />
              ) : (
                <Play size={32} className="text-[#0a1628] ml-1" fill="currentColor" />
              )}
            </button>

            {/* Volume (Right) - Circular like native */}
            <button
              onClick={async () => {
                // FIXED: Handle mute for both Android (Native) and Web
                if (isAndroid) {
                  try {
                    // Use setAzhanVolume to mute/unmute (0 for mute, restore for unmute)
                    if (isMuted) await MediaBridge.setAzhanVolume({ volume: effectiveVolumeInt });
                    else await MediaBridge.setAzhanVolume({ volume: 0 });
                  } catch { }
                } else if (audioRef.current) {
                  audioRef.current.muted = !isMuted;
                }
                setIsMuted(!isMuted);
              }}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${isMuted
                ? 'bg-red-500/10 text-red-400'
                : isDark
                  ? 'bg-[#1a2d47] text-[#D4B978] hover:bg-[#243754]'
                  : 'bg-gold-100 text-gold-600 hover:bg-gold-200'
                }`}
            >
              {isMuted ? <VolumeX size={22} /> : <Volume2 size={22} />}
            </button>
          </div>

          {/* Muazzin Selection Overlay */}
          {showSettings && (
            <div className={`absolute inset-4 rounded-[28px] z-30 flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 backdrop-blur-xl shadow-[0_30px_80px_rgba(0,0,0,0.4)] ${isDark
              ? 'bg-gradient-to-b from-[#0F2238]/98 to-[#0a1628]/98 border border-white/[0.1]'
              : 'bg-gradient-to-b from-white/98 to-gold-50/98 border border-gold-200/50'
              }`}>
              {/* Header */}
              <div className={`p-4 border-b flex justify-between items-center ${isDark
                ? 'border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent'
                : 'border-gold-200/30 bg-gradient-to-b from-gold-100/30 to-transparent'
                }`}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#D4B978]/20 flex items-center justify-center">
                    <Volume2 size={16} className="text-[#D4B978]" />
                  </div>
                  <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-navy-800'}`}>اختر المؤذن</span>
                </div>
                <button onClick={() => setShowSettings(false)} className={`p-2 rounded-xl transition-all ${isDark
                  ? 'hover:bg-white/10 text-white/50 hover:text-white'
                  : 'hover:bg-navy-100 text-navy-400 hover:text-navy-600'
                  }`}>
                  <X size={18} />
                </button>
              </div>

              {/* Volume Slider for Per-Prayer */}
              <div className={`p-4 border-b flex flex-col gap-2 ${isDark ? 'border-white/[0.06]' : 'border-gold-200/30'}`}>
                <div className="flex justify-between items-center px-1">
                  <span className={`text-[13px] font-bold ${isDark ? 'text-white/70' : 'text-navy-600'}`}>مستوى الصوت لهذه الصلاة</span>
                  <span className={`text-[13px] font-bold font-mono ${isDark ? 'text-[#D4B978]' : 'text-navy-800'}`}>{toArabicDigits(localVolume.toString())}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={localVolume}
                  onChange={(e) => setLocalVolume(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gold-200/30 rounded-lg appearance-none cursor-pointer accent-[#D4B978]"
                />
              </div>

              {/* Muazzin List */}
              <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-2">
                {MUAZZINS.map(m => {
                  const isSelected = currentAzhanId === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => changeMuazzin(m.id)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border ${isSelected
                        ? 'bg-gradient-to-r from-[#D4B978] to-[#C6A870] text-[#0a1628] border-[#D4B978] shadow-lg shadow-[#D4B978]/20'
                        : isDark
                          ? 'text-white/80 hover:bg-white/[0.05] border-white/[0.05] hover:border-white/10'
                          : 'text-navy-700 hover:bg-gold-50 border-gold-200/30 hover:border-gold-300'
                        }`}
                    >
                      <span className={`text-sm font-bold ${isSelected ? '' : isDark ? 'text-white/80' : 'text-navy-700'}`}>{m.name}</span>
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-[#0a1628]/30 flex items-center justify-center">
                          <Check size={14} strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Custom Animation Keyframes */}
      <style>{`
        @keyframes bellSwing {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(12deg); }
          75% { transform: rotate(-12deg); }
        }
      `}</style>
    </div >
  );
};
