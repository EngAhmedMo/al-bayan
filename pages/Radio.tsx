
import React, { useState, useEffect } from 'react';
import { TopBar } from '../components/TopBar';
import { RADIO_STATIONS } from '../services/radioData';
import { RadioStation } from '../types';
import { Play, Pause, Radio as RadioIcon, Volume2, Globe, User, RefreshCw, Star, Info, WifiOff, Signal, Timer, X, Check } from 'lucide-react';
import { useRadio, useNetwork } from '../components/Layout';
import { Capacitor } from '@capacitor/core';
import { MediaBridge } from '../services/mediaBridge';

export const Radio: React.FC = () => {
  // Use Global Context
  const { activeStation, isPlaying, isLoading, error, playStation, toggleRadio, sleepTimerEnd, setSleepTimer } = useRadio();
  const { isOnline } = useNetwork();

  const [category, setCategory] = useState<'all' | 'quran' | 'cairo' | 'reciters'>('all');
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [remainingTime, setRemainingTime] = useState<string>('');

  // Countdown calculation
  useEffect(() => {
    if (!sleepTimerEnd) {
      setRemainingTime('');
      return;
    }
    const updateTime = () => {
      const remaining = sleepTimerEnd - Date.now();
      if (remaining <= 0) {
        setRemainingTime('');
      } else {
        const m = Math.floor(remaining / 60000);
        const s = Math.floor((remaining % 60000) / 1000);
        setRemainingTime(`${m}:${s.toString().padStart(2, '0')}`);
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerEnd]);

  // Show all stations
  const filteredStations = RADIO_STATIONS;

  // STATION NAVIGATION: Sync station list with native layer for notification controls
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;

    // Send station list to native layer for next/prev functionality
    const syncStations = async () => {
      try {
        const currentIndex = activeStation
          ? RADIO_STATIONS.findIndex(s => s.id === activeStation.id)
          : 0;

        await MediaBridge.setRadioStationsList({
          stations: RADIO_STATIONS.map(s => ({
            id: s.id,
            name: s.name,
            urls: Array.isArray(s.url) ? s.url : [s.url]
          })),
          currentIndex: Math.max(0, currentIndex)
        });
        console.log('[Radio] Station list synced with native layer');
      } catch (e) {
        console.warn('[Radio] Failed to sync station list:', e);
      }
    };

    syncStations();
  }, [activeStation]);

  // Listen for notification control events (next/prev station)
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;

    const listener = MediaBridge.addListener('controlNotification', (data: any) => {
      console.log('[Radio] controlNotification received:', data);

      if (data.action === 'next' || data.action === 'prev') {
        // Calculate station index based on active station
        const currentIndex = activeStation
          ? RADIO_STATIONS.findIndex(s => s.id === activeStation.id)
          : 0;

        let newIndex: number;
        if (data.action === 'next') {
          newIndex = (currentIndex + 1) % RADIO_STATIONS.length;
        } else {
          newIndex = currentIndex === 0 ? RADIO_STATIONS.length - 1 : currentIndex - 1;
        }

        const targetStation = RADIO_STATIONS[newIndex];
        console.log(`[Radio] 📻 Skip ${data.action}: ${activeStation?.name} -> ${targetStation.name} (index: ${currentIndex} -> ${newIndex})`);
        playStation(targetStation);
      }
    });

    return () => {
      listener.then(h => h.remove());
    };
  }, [activeStation, playStation]);

  const handleStationClick = (station: RadioStation) => {
    if (activeStation?.id === station.id) {
      toggleRadio();
    } else {
      playStation(station);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-gold-50 via-white to-gold-50/50 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 font-sans relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-400/10 dark:bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-1/4 left-0 w-64 h-64 bg-gold-400/10 dark:bg-gold-500/5 rounded-full blur-3xl -translate-x-1/2"></div>
      </div>

      <TopBar 
        title="الإذاعة المباشرة" 
        extra={
          <button
            onClick={() => setShowTimerMenu(true)}
            className={`flex items-center gap-1.5 h-8 sm:h-10 px-2.5 sm:px-3 rounded-xl transition-all duration-300 shadow-sm hover:shadow-md border active:scale-95 ${
              sleepTimerEnd 
                ? 'bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                : 'bg-white/80 dark:bg-navy-900/40 backdrop-blur-sm border-navy-100 dark:border-[#C6AD73]/60 text-navy-600 dark:text-[#C6AD73] hover:border-gold-400 dark:hover:border-[#C6AD73] hover:text-gold-600 dark:hover:text-[#F0CF85]'
            }`}
            title="مؤقت الإيقاف"
          >
            <Timer size={18} className={sleepTimerEnd ? 'animate-pulse' : ''} />
            {remainingTime && (
              <span className="text-xs sm:text-sm font-bold tracking-widest font-mono select-none" dir="ltr">
                {remainingTime}
              </span>
            )}
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 custom-scrollbar relative z-10">

        {/* Helper Tip - Enhanced */}
        <div className="mb-6">
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/80 dark:bg-navy-800/80 backdrop-blur-xl border border-gold-200/50 dark:border-navy-700 shadow-lg shadow-gold-500/5 dark:shadow-navy-950/50 animate-in fade-in">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-amber-500 flex items-center justify-center shrink-0 shadow-lg shadow-gold-500/30">
              <Info size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-navy-800 dark:text-white mb-1">استمع أثناء التصفح</p>
              <p className="text-xs text-navy-500 dark:text-navy-400 leading-relaxed">
                يمكنك تصفح باقي أقسام التطبيق أثناء الاستماع. سيظهر شريط التحكم في الأسفل.
              </p>
            </div>
          </div>
        </div>

        {/* Offline Warning - Enhanced */}
        {!isOnline && (
          <div className="mb-6 animate-in slide-in-from-top-4">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-amber-50/90 dark:bg-amber-900/20 backdrop-blur-xl border border-amber-200/50 dark:border-amber-700/50 shadow-lg">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/30">
                <WifiOff size={22} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-sm text-amber-800 dark:text-amber-200">لا يوجد اتصال بالإنترنت</p>
                <p className="text-xs text-amber-600 dark:text-amber-300/70 mt-0.5">الإذاعة تتطلب اتصال بالإنترنت للعمل</p>
              </div>
            </div>
          </div>
        )}

        {/* Active Player Card (Hero) - Enhanced */}
        {activeStation && (
          <div className="mb-8 relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-800 via-navy-900 to-navy-950 text-white p-6 sm:p-8 shadow-2xl shadow-navy-950/50 animate-in zoom-in-95 duration-500 border border-white/5">
            {/* Animated Background Pattern */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/arabesque.png')] opacity-30"></div>
            </div>

            {/* Visualizer Background Effect */}
            {isPlaying && !error && (
              <div className="absolute inset-0 flex items-end justify-center gap-1 opacity-20 pointer-events-none px-8 pb-4">
                {[...Array(24)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1.5 sm:w-2 bg-gradient-to-t from-emerald-500 to-emerald-300 rounded-full"
                    style={{
                      height: `${20 + Math.random() * 60}%`,
                      animationDelay: `${i * 0.08}s`,
                      animation: 'music-bar 0.8s ease-in-out infinite alternate'
                    }}
                  ></div>
                ))}
              </div>
            )}

            <div className="relative z-10 flex flex-col items-center text-center">
              {/* Station Icon */}
              <div className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-emerald-500/30 flex items-center justify-center mb-5 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl shadow-2xl ${isPlaying && !error ? 'animate-pulse' : ''}`}>
                {activeStation.img ? (
                  <img
                    src={activeStation.img}
                    alt={activeStation.name}
                    className="w-full h-full object-cover rounded-full"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                    <RadioIcon size={32} className="text-white" />
                  </div>
                )}
              </div>

              {/* Station Name */}
              <h2 className="text-2xl sm:text-3xl font-bold mb-2 px-4 leading-tight">{activeStation.name}</h2>

              {/* Status Badge */}
              {error ? (
                <div className="flex items-center gap-2 text-red-300 bg-red-900/30 px-4 py-2 rounded-full text-xs font-bold mb-6 mt-1 animate-in fade-in border border-red-500/30">
                  {error}
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full mb-6 border border-white/10">
                  <span className={`w-2.5 h-2.5 rounded-full ${isLoading ? 'bg-amber-400' : isPlaying ? 'bg-emerald-400' : 'bg-slate-400'} animate-pulse`}></span>
                  <span className="text-xs font-bold text-white/80">
                    {isLoading ? 'جاري الاتصال...' : (isPlaying ? 'بث مباشر' : 'متوقف')}
                  </span>
                </div>
              )}

              {/* Play/Pause Button */}
              <button
                onClick={() => toggleRadio()}
                className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 text-white flex items-center justify-center shadow-2xl shadow-emerald-500/40 transition-all duration-300 active:scale-95 hover:scale-105"
              >
                {isLoading ? (
                  <div className="w-7 h-7 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : isPlaying ? (
                  <Pause size={32} fill="currentColor" />
                ) : (
                  <Play size={32} fill="currentColor" className="ml-1" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Section Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Signal size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-base text-navy-900 dark:text-white">المحطات المتاحة</h3>
            <p className="text-xs text-navy-500 dark:text-navy-400">{filteredStations.length} محطة</p>
          </div>
        </div>

        {/* Stations Grid - Enhanced */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredStations.map((station) => {
            const isActive = activeStation?.id === station.id;
            return (
              <div
                key={station.id}
                onClick={() => handleStationClick(station)}
                className={`relative p-4 sm:p-5 rounded-2xl border transition-all duration-300 cursor-pointer group hover:shadow-xl hover:-translate-y-1 flex items-center gap-4 min-h-[90px] overflow-hidden ${isActive
                  ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-900/10 border-emerald-400 dark:border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                  : 'bg-white/90 dark:bg-navy-800/90 backdrop-blur-xl border-gold-100 dark:border-navy-700 hover:border-emerald-300 dark:hover:border-emerald-500/30'
                  }`}
              >
                {/* Active Indicator Glow */}
                {isActive && isPlaying && (
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent pointer-events-none"></div>
                )}

                {/* Station Icon */}
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all shadow-lg ${isActive
                  ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-emerald-500/30'
                  : 'bg-gradient-to-br from-navy-50 to-navy-100 dark:from-navy-700 dark:to-navy-800 text-navy-400 dark:text-navy-300 group-hover:from-emerald-50 group-hover:to-emerald-100 dark:group-hover:from-emerald-900/30 dark:group-hover:to-emerald-900/20 group-hover:text-emerald-500'}`}
                >
                  {station.category === 'reciters' ? <User size={22} /> : station.category === 'cairo' ? <RadioIcon size={22} /> : <Globe size={22} />}
                </div>

                {/* Station Info */}
                <div className="flex-1 min-w-0 text-right">
                  <h3 className={`font-bold text-sm sm:text-base leading-tight mb-1.5 flex items-center gap-1.5 justify-end ${isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-navy-800 dark:text-white'}`}>
                    {station.id === 'mustafa_ismail' && <Star size={14} className="text-gold-500 fill-gold-500" />}
                    <span className="truncate">{station.name}</span>
                  </h3>
                  <div className="flex items-center gap-1.5 justify-end">
                    {isActive && isLoading && (
                      <RefreshCw size={12} className="animate-spin text-amber-500" />
                    )}
                    <p className={`text-xs font-medium ${isActive && error
                      ? 'text-red-500'
                      : isActive
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-navy-400 dark:text-navy-500'}`}
                    >
                      {isActive
                        ? (error ? 'خطأ في الاتصال' : (isPlaying ? 'جاري التشغيل' : (isLoading ? 'جاري الاتصال...' : 'متوقف')))
                        : 'اضغط للتشغيل'}
                    </p>
                  </div>
                </div>

                {/* Playing Indicator */}
                {isActive && isPlaying && !error && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <div className="w-1 h-4 bg-emerald-500 rounded-full animate-[music-bar_0.5s_ease-in-out_infinite_alternate]"></div>
                    <div className="w-1 h-6 bg-emerald-500 rounded-full animate-[music-bar_0.5s_ease-in-out_infinite_alternate_0.2s]"></div>
                    <div className="w-1 h-3 bg-emerald-500 rounded-full animate-[music-bar_0.5s_ease-in-out_infinite_alternate_0.4s]"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sleep Timer Modal */}
      {showTimerMenu && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4">
          <div 
            className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm transition-opacity"
            onClick={() => setShowTimerMenu(false)}
          ></div>
          <div className="bg-white dark:bg-navy-900 rounded-3xl w-full max-w-sm shadow-2xl relative z-10 animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 border border-gold-100 dark:border-navy-700 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Timer size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-navy-900 dark:text-white">مؤقت النوم</h3>
                    <p className="text-xs text-navy-500 dark:text-navy-400">إيقاف الإذاعة تلقائياً بعد فترة</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowTimerMenu(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-navy-50 dark:bg-navy-800 text-navy-500 dark:text-navy-400 hover:text-navy-900 dark:hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                {[15, 30, 45, 60, 90, 120].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => {
                      setSleepTimer(mins);
                      setShowTimerMenu(false);
                    }}
                    className="p-3 rounded-2xl border border-gold-100 dark:border-navy-700 hover:border-emerald-300 dark:hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 flex flex-col items-center gap-1 transition-colors group"
                  >
                    <span className="text-xl font-bold text-navy-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {mins}
                    </span>
                    <span className="text-xs text-navy-500 dark:text-navy-400">دقيقة</span>
                  </button>
                ))}
              </div>

              {sleepTimerEnd && (
                <button
                  onClick={() => {
                    setSleepTimer(0);
                    setShowTimerMenu(false);
                  }}
                  className="w-full py-3.5 rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-bold text-sm border border-red-100 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
                >
                  <X size={18} />
                  إلغاء المؤقت الحالي
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
