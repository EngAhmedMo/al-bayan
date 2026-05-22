import React, { useState, useEffect } from 'react';
import { Heart, X } from 'lucide-react';

export const SadaqahBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const checkBannerStatus = () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const lastShown = localStorage.getItem('last_sadaqah_date');

        if (lastShown !== today) {
          // It's a new day, show banner
          setTimeout(() => {
            setIsVisible(true);
            localStorage.setItem('last_sadaqah_date', today);
            
            // Auto hide after 8 seconds
            setTimeout(() => {
              setIsVisible(false);
            }, 8000);
          }, 1500); // Delay showing it slightly after app load
        }
      } catch (e) {
        console.error("Failed to read localStorage for SadaqahBanner", e);
      }
    };

    checkBannerStatus();
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] px-4 py-3 sm:px-6 md:py-4 pointer-events-none">
      <div 
        className={`max-w-2xl mx-auto transform transition-all duration-700 ease-out pointer-events-auto
          ${isVisible ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-full opacity-0 scale-95'}
        `}
      >
        <div className="bg-gradient-to-r from-navy-900 via-navy-800 to-navy-900 dark:from-[#DFCD92] dark:via-[#C6AD73] dark:to-[#9A7B3C] rounded-2xl p-4 sm:p-5 shadow-2xl border border-gold-500/30 dark:border-white/20 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-right relative overflow-hidden group">
          
          {/* Decorative background */}
          <div className="absolute inset-0 opacity-10 dark:opacity-20 pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/arabesque.png")' }} />
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-gold-400/20 dark:bg-white/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-1000" />
          <div className="absolute -left-10 -bottom-10 w-24 h-24 bg-blue-400/20 dark:bg-black/10 rounded-full blur-xl" />

          {/* Icon */}
          <div className="relative z-10 shrink-0 p-3 bg-gradient-to-br from-[#DFCD92] to-[#9A7B3C] dark:from-navy-900 dark:to-navy-800 rounded-xl shadow-lg border border-white/20">
            <Heart className="text-navy-900 dark:text-gold-400 fill-navy-900/30 dark:fill-gold-400/30 animate-pulse" size={24} />
          </div>

          {/* Text Content */}
          <div className="relative z-10 flex-1">
            <h3 className="text-gold-400 dark:text-navy-900 font-bold text-base sm:text-lg font-quran tracking-wide mb-1">
              صدقة جارية
            </h3>
            <p className="text-white/95 dark:text-navy-800 font-bold text-xs sm:text-sm leading-relaxed">
              نسألكم الدعاء بالمغفرة والرحمة لوالدي الحاج/ محمد صلاح عامر وجميع أموات المسلمين
            </p>
          </div>

          {/* Optional Close Button for immediate dismissal if wanted */}
          <button 
            onClick={() => setIsVisible(false)}
            className="relative z-10 p-2 text-white/50 hover:text-white dark:text-navy-900/50 dark:hover:text-navy-900 bg-white/5 hover:bg-white/10 dark:bg-black/5 dark:hover:bg-black/10 rounded-full transition-colors shrink-0"
            aria-label="إغلاق"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
