import React, { useState, useEffect } from 'react';
import { TopBar } from '../components/TopBar';
import { RADIO_STATIONS } from '../services/radioData';
import { RadioStation } from '../types';
import { Play, Pause, Radio as RadioIcon, Volume2, Globe, User, RefreshCw, Star, Info, WifiOff, Signal, Timer, X, Check, Disc, SkipForward, SkipBack } from 'lucide-react';
import { useRadio, useNetwork } from '../components/Layout';
import { Capacitor } from '@capacitor/core';
import { MediaBridge } from '../services/mediaBridge';

const CATEGORIES = [
  { id: 'all', label: 'الكل', icon: <RadioIcon size={16} /> },
  { id: 'reciters', label: 'أصوات القراء', icon: <User size={16} /> },
  { id: 'other', label: 'إذاعات متنوعة', icon: <Globe size={16} /> },
] as const;

export const Radio: React.FC = () => {
  // Use Global Context
  const { activeStation, isPlaying, isLoading, error, playStation, toggleRadio, sleepTimerEnd, setSleepTimer, playNextStation, playPrevStation } = useRadio();
  const { isOnline } = useNetwork();

  const [category, setCategory] = useState<'all' | 'reciters' | 'other'>('all');
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

  // Filter stations based on selected category
  const filteredStations = category === 'all' 
    ? RADIO_STATIONS 
    : RADIO_STATIONS.filter(s => s.category === category);

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
    <div className="flex flex-col h-full bg-gradient-to-b from-navy-50 via-white to-navy-50 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 font-sans relative overflow-hidden">
      {/* Background Decorative Elements (Lightened for performance) */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-400/5 dark:bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gold-400/5 dark:bg-gold-500/5 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3"></div>
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

      {/* Main Container - Scrollable on mobile, Hidden on LG */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden relative z-10 custom-scrollbar pb-32 lg:pb-0">
        
        {/* Left/Top Column (Hero Player) */}
        <div className="w-full lg:w-[400px] xl:w-[450px] shrink-0 p-4 md:p-6 lg:border-l border-navy-100 dark:border-navy-800/50 lg:bg-white/40 dark:lg:bg-navy-900/20 lg:backdrop-blur-md overflow-y-visible lg:overflow-y-auto custom-scrollbar flex flex-col">
          
          {/* Offline Warning */}
          {!isOnline && (
            <div className="mb-6 animate-in slide-in-from-top-4">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-amber-50/90 dark:bg-amber-900/20 backdrop-blur-md border border-amber-200/50 dark:border-amber-700/50 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/30">
                  <WifiOff size={22} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-sm text-amber-800 dark:text-amber-200">لا يوجد اتصال بالإنترنت</p>
                  <p className="text-xs text-amber-600 dark:text-amber-300/70 mt-0.5">الإذاعة تتطلب اتصال بالإنترنت للعمل</p>
                </div>
              </div>
            </div>
          )}

          {/* Active Player Card (Hero) */}
          {activeStation ? (
            <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-b from-navy-800 to-navy-950 text-white p-6 sm:p-8 shadow-xl shadow-navy-900/40 border border-white/5 animate-in zoom-in-95 duration-500 flex flex-col min-h-[350px] lg:flex-1">
              {/* Premium Arabesque Background */}
              <div className="absolute inset-0 opacity-10 mix-blend-overlay pointer-events-none">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/arabesque.png')]"></div>
              </div>

              {/* Glowing Ambient Light - Optimized */}
              {isPlaying && !error && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-emerald-500/10 rounded-full blur-[60px] pointer-events-none will-change-transform"></div>
              )}

              <div className="relative z-10 flex flex-col items-center text-center flex-1 justify-center">
                
                {/* Spinning Vinyl Station Icon */}
                <div className={`relative w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 rounded-full p-1.5 bg-gradient-to-br from-gold-400 via-amber-300 to-gold-600 mb-6 shadow-[0_0_20px_rgba(198,173,115,0.2)] transition-transform will-change-transform duration-700 ${isPlaying && !error ? 'animate-[spin_12s_linear_infinite]' : 'scale-95 grayscale-[30%]'}`}>
                  <div className="w-full h-full rounded-full bg-navy-950 p-1 relative overflow-hidden">
                    {/* Vinyl grooves effect */}
                    <div className="absolute inset-0 rounded-full border-[8px] sm:border-[10px] border-white/5 pointer-events-none"></div>
                    <div className="absolute inset-0 rounded-full border-[16px] sm:border-[20px] border-white/5 pointer-events-none"></div>
                    <div className="absolute inset-0 rounded-full border-[24px] sm:border-[30px] border-white/5 pointer-events-none"></div>
                    
                    <div className="w-full h-full rounded-full overflow-hidden relative border-[3px] border-navy-900">
                      {activeStation.img ? (
                        <img
                          src={activeStation.img}
                          alt={activeStation.name}
                          className="w-full h-full object-cover rounded-full"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-navy-700 to-navy-900 flex items-center justify-center">
                          <Disc size={36} className="text-gold-400/50 sm:w-12 sm:h-12" />
                        </div>
                      )}
                    </div>

                    {/* Center Vinyl Hole */}
                    <div className="absolute inset-0 m-auto w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-navy-950 border border-gold-500/50 flex items-center justify-center z-20 shadow-inner">
                      <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-white/50"></div>
                    </div>
                  </div>
                </div>

                {/* Station Info */}
                <h2 className="text-xl sm:text-2xl font-bold mb-3 px-4 leading-tight tracking-tight drop-shadow-md text-white">
                  {activeStation.name}
                </h2>

                {/* Status Indicator */}
                {error ? (
                  <div className="flex items-center gap-2 text-red-300 bg-red-500/10 backdrop-blur-sm px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold mb-6 mt-1 border border-red-500/20 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                    {error}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-white/5 backdrop-blur-sm px-4 py-1.5 rounded-full mb-6 mt-1 border border-white/10 shadow-sm">
                    <span className={`w-2 h-2 rounded-full ${isLoading ? 'bg-amber-400' : isPlaying ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-500'} animate-pulse`}></span>
                    <span className="text-[10px] sm:text-xs font-bold text-white/90 tracking-wide">
                      {isLoading ? 'جاري الاتصال...' : (isPlaying ? 'البث المباشر يعمل' : 'البث متوقف')}
                    </span>
                  </div>
                )}

                {/* Main Controls */}
                <div className="flex items-center justify-center gap-4 sm:gap-6 w-full mt-auto mb-8 sm:mb-10 relative z-20">
                  <button
                    onClick={() => playPrevStation?.()}
                    className="w-12 h-12 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all backdrop-blur-sm border border-white/5 hover:scale-105 active:scale-95"
                    title="المحطة السابقة"
                  >
                    <SkipForward size={20} className="mr-0.5" />
                  </button>

                  <button
                    onClick={() => toggleRadio()}
                    className={`relative group w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 hover:scale-105 shadow-xl ${isPlaying ? 'bg-white text-navy-900' : 'bg-gradient-to-br from-gold-400 to-gold-600 text-white'}`}
                  >
                    {/* Glow ring */}
                    <div className={`absolute inset-0 rounded-full transition-opacity duration-300 ${isPlaying ? 'opacity-10 shadow-[0_0_20px_rgba(255,255,255,1)]' : 'opacity-0 shadow-[0_0_20px_rgba(198,173,115,1)] group-hover:opacity-40'}`}></div>
                    
                    {isLoading ? (
                      <div className="w-6 h-6 sm:w-8 sm:h-8 border-3 border-current border-t-transparent rounded-full animate-spin"></div>
                    ) : isPlaying ? (
                      <Pause size={28} fill="currentColor" className="sm:w-9 sm:h-9" />
                    ) : (
                      <Play size={28} fill="currentColor" className="ml-1 sm:ml-2 sm:w-9 sm:h-9" />
                    )}
                  </button>

                  <button
                    onClick={() => playNextStation?.()}
                    className="w-12 h-12 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all backdrop-blur-sm border border-white/5 hover:scale-105 active:scale-95"
                    title="المحطة التالية"
                  >
                    <SkipBack size={20} className="ml-0.5" />
                  </button>
                </div>

                {/* Equalizer Visualizer (Bottom edge) */}
                {isPlaying && !error && (
                  <div className="absolute bottom-0 left-0 right-0 h-12 sm:h-16 flex items-end justify-center gap-1 opacity-20 px-8 pointer-events-none">
                    {[...Array(24)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 sm:w-1.5 bg-gradient-to-t from-emerald-400 to-gold-300 rounded-t-full will-change-transform"
                        style={{
                          height: `${10 + Math.random() * 90}%`,
                          animationDelay: `${i * 0.05}s`,
                          animation: 'music-bar 0.6s ease-in-out infinite alternate'
                        }}
                      ></div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-navy-200 dark:border-navy-700 rounded-[2.5rem] bg-white/50 dark:bg-navy-800/50 min-h-[300px]">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-navy-50 dark:bg-navy-900 flex items-center justify-center mb-4 text-navy-300 dark:text-navy-600">
                <RadioIcon size={32} className="sm:w-10 sm:h-10" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-navy-900 dark:text-white mb-2">لا يوجد محطة نشطة</h3>
              <p className="text-xs sm:text-sm text-navy-500 dark:text-navy-400">الرجاء اختيار إذاعة من القائمة للبدء بالاستماع</p>
            </div>
          )}

          {/* Helper Tip (Desktop Only) */}
          <div className="hidden lg:flex mt-6 items-start gap-3 p-4 rounded-2xl bg-white/80 dark:bg-navy-800/80 backdrop-blur-sm border border-navy-100 dark:border-navy-700 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-gold-100 dark:bg-gold-500/20 flex items-center justify-center shrink-0">
              <Info size={16} className="text-gold-600 dark:text-gold-400" />
            </div>
            <p className="text-xs text-navy-600 dark:text-navy-300 leading-relaxed font-medium pt-1">
              يمكنك تصغير هذه الصفحة وتصفح المصحف، وسيستمر البث الإذاعي في الخلفية دون انقطاع.
            </p>
          </div>
        </div>

        {/* Right/Bottom Column (Stations List) */}
        <div className="flex-1 overflow-y-visible lg:overflow-y-auto p-4 md:p-6 lg:pb-32 custom-scrollbar relative z-10 flex flex-col">
          
          <div className="mb-6 flex flex-col gap-4">
            <h3 className="font-bold text-lg sm:text-xl text-navy-900 dark:text-white flex items-center gap-2">
              <Disc className="text-gold-500" />
              المحطات المتاحة
            </h3>

            {/* Premium Category Tabs */}
            <div className="flex overflow-x-auto custom-scrollbar pb-2 -mx-4 px-4 md:mx-0 md:px-0 scroll-smooth">
              <div className="flex items-center gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap font-bold text-[13px] sm:text-sm transition-all duration-300 border ${
                      category === cat.id
                        ? 'bg-navy-900 dark:bg-gold-500 text-white border-transparent shadow-md shadow-navy-900/20 dark:shadow-gold-500/20 scale-[1.02]'
                        : 'bg-white dark:bg-navy-800 text-navy-600 dark:text-navy-300 border-navy-100 dark:border-navy-700 hover:bg-navy-50 dark:hover:bg-navy-700'
                    }`}
                  >
                    <span className={category === cat.id ? 'opacity-100' : 'opacity-70'}>
                      {cat.icon}
                    </span>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Stations Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3 sm:gap-4 pb-8">
            {filteredStations.map((station) => {
              const isActive = activeStation?.id === station.id;
              return (
                <div
                  key={station.id}
                  onClick={() => handleStationClick(station)}
                  className={`relative p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all duration-300 cursor-pointer group hover:-translate-y-1 flex items-center gap-3 sm:gap-4 min-h-[85px] sm:min-h-[100px] overflow-hidden ${isActive
                    ? 'bg-white dark:bg-navy-800 border-emerald-400/50 dark:border-emerald-500/50 shadow-lg shadow-emerald-500/10 scale-[1.02]'
                    : 'bg-white/80 dark:bg-navy-800/80 backdrop-blur-sm border-navy-100 dark:border-navy-700 hover:border-gold-300 dark:hover:border-gold-500/40 hover:shadow-md'
                    }`}
                >
                  {/* Active Indicator Glow */}
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-transparent pointer-events-none"></div>
                  )}

                  {/* Station Icon with Hover Rotation */}
                  <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500 shadow-sm ${isActive
                    ? 'bg-emerald-500 text-white shadow-emerald-500/40 rotate-3'
                    : 'bg-navy-50 dark:bg-navy-900 text-navy-400 dark:text-navy-400 group-hover:bg-gold-100 dark:group-hover:bg-gold-500/20 group-hover:text-gold-600 dark:group-hover:text-gold-400 group-hover:-rotate-3'}`}
                  >
                    {station.category === 'reciters' ? <User size={20} className="sm:w-6 sm:h-6" /> : station.category === 'cairo' ? <RadioIcon size={20} className="sm:w-6 sm:h-6" /> : <Globe size={20} className="sm:w-6 sm:h-6" />}
                  </div>

                  {/* Station Info */}
                  <div className="flex-1 min-w-0 text-right">
                    <h3 className={`font-bold text-[13px] sm:text-base leading-tight mb-1 flex items-center gap-1.5 justify-end transition-colors ${isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-navy-900 dark:text-white group-hover:text-gold-600 dark:group-hover:text-gold-400'}`}>
                      {station.id === 'mustafa_ismail' && <Star size={12} className="text-gold-500 fill-gold-500 animate-pulse sm:w-3.5 sm:h-3.5" />}
                      <span className="truncate">{station.name}</span>
                    </h3>
                    <div className="flex items-center gap-1.5 justify-end">
                      {isActive && isLoading && (
                        <RefreshCw size={10} className="animate-spin text-amber-500 sm:w-3 sm:h-3" />
                      )}
                      <p className={`text-[10px] sm:text-xs font-medium transition-colors ${isActive && error
                        ? 'text-red-500'
                        : isActive
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-navy-400 dark:text-navy-500 group-hover:text-navy-500 dark:group-hover:text-navy-400'}`}
                      >
                        {isActive
                          ? (error ? 'خطأ في الاتصال' : (isPlaying ? 'جاري التشغيل' : (isLoading ? 'جاري الاتصال...' : 'متوقف')))
                          : 'اضغط للتشغيل'}
                      </p>
                    </div>
                  </div>

                  {/* Playing Indicator Bars */}
                  {isActive && isPlaying && !error && (
                    <div className="flex items-center gap-0.5 shrink-0 ml-1.5 sm:ml-2">
                      <div className="w-1 h-2 sm:h-3 bg-emerald-500 rounded-full animate-[music-bar_0.5s_ease-in-out_infinite_alternate]"></div>
                      <div className="w-1 h-3.5 sm:h-5 bg-emerald-500 rounded-full animate-[music-bar_0.5s_ease-in-out_infinite_alternate_0.2s]"></div>
                      <div className="w-1 h-2.5 sm:h-4 bg-emerald-500 rounded-full animate-[music-bar_0.5s_ease-in-out_infinite_alternate_0.4s]"></div>
                    </div>
                  )}
                </div>
              );
            })}
            
            {filteredStations.length === 0 && (
              <div className="col-span-full py-12 text-center text-navy-400 dark:text-navy-500">
                <Disc size={40} className="mx-auto mb-3 opacity-20 sm:w-12 sm:h-12" />
                <p className="text-sm">لا توجد محطات في هذا التصنيف</p>
              </div>
            )}
          </div>
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
