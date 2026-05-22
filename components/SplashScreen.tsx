import React, { useEffect, useState } from 'react';
import { Sparkles, Heart } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Start fade out after 2.5 seconds
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 2500);

    // Complete the splash screen after the fade out animation (500ms)
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 3000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-b from-stone-50 via-gold-50/20 to-white dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 transition-opacity duration-500 ease-in-out ${isFadingOut ? 'opacity-0' : 'opacity-100'}`}
      dir="rtl"
    >
      {/* Decorative Gradients */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-gold-400/20 to-amber-300/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-emerald-400/10 to-teal-300/5 rounded-full blur-3xl" />
      <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05]" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/arabesque.png")' }} />

      {/* Main Logo Container */}
      <div className="relative z-10 flex flex-col items-center transform transition-all duration-1000 animate-in slide-in-from-bottom-8 fade-in">
        <div className="relative group mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-gold-400 to-amber-500 rounded-[2rem] blur-xl opacity-40 animate-pulse" />
          <div className="relative w-32 h-32 sm:w-40 sm:h-40 bg-gradient-to-br from-[#DFCD92] via-[#C6AD73] to-[#9A7B3C] rounded-[2rem] flex items-center justify-center shadow-[0_0_30px_rgba(251,191,36,0.3)] border-2 border-white/50 dark:border-gold-300/30">
            <span className="font-quran text-7xl sm:text-8xl font-bold text-white mt-4 drop-shadow-lg">ب</span>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl font-bold text-navy-900 dark:text-white font-quran tracking-wide mb-3 drop-shadow-sm">
          البيان
        </h1>

        {/* Subtitle */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <span className="h-[2px] w-12 sm:w-16 bg-gradient-to-r from-transparent to-gold-500 rounded-full" />
          <div className="flex items-center gap-1.5">
            <Sparkles size={14} className="text-gold-500" />
            <p className="text-sm sm:text-base font-bold text-gold-600 dark:text-gold-400 tracking-widest">القرآن والسنة</p>
            <Sparkles size={14} className="text-gold-500" />
          </div>
          <span className="h-[2px] w-12 sm:w-16 bg-gradient-to-l from-transparent to-gold-500 rounded-full" />
        </div>

        {/* Sadaqah Jariyah Text (Animated) */}
        <div className="mt-8 sm:mt-12 w-full max-w-sm sm:max-w-md mx-auto animate-in slide-in-from-bottom-8 fade-in duration-1000 delay-300">
          <div className="relative p-5 rounded-2xl bg-white/40 dark:bg-navy-900/40 backdrop-blur-md border border-gold-400/30 dark:border-gold-500/20 shadow-xl shadow-gold-500/5 dark:shadow-black/20 flex flex-col items-center justify-center text-center group">
            <div className="absolute inset-0 bg-gradient-to-br from-gold-400/10 to-transparent rounded-2xl pointer-events-none"></div>
            <Heart className="text-gold-500 fill-gold-500/30 mb-3 group-hover:scale-110 transition-transform duration-500" size={28} />
            <p className="relative z-10 text-navy-700 dark:text-navy-100 font-medium text-sm sm:text-base leading-relaxed">
              صدقة جارية على روح والدي<br/>
              <span className="font-bold text-gold-600 dark:text-gold-400 text-lg sm:text-xl mt-1.5 mb-1 inline-block font-quran tracking-wide drop-shadow-sm">الحاج/ محمد صلاح عامر</span><br/>
              وجميع أموات المسلمين
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
