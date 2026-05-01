
import React, { useContext } from 'react';
import { useTheme, NavigationContext } from './Layout';
import { Moon, Sun, ArrowRight, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TopBarProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void; // Optional custom back handler
  extra?: React.ReactNode;
}

export const TopBar: React.FC<TopBarProps> = ({ title, showBack, onBack, extra }) => {
  const { isDark, toggleTheme } = useTheme();
  const { openSidebar } = useContext(NavigationContext);
  const navigate = useNavigate();

  // Unified button style class for consistency - Premium Gold Update
  const btnClass = "w-10 h-10 flex items-center justify-center rounded-xl bg-white/80 dark:bg-navy-900/40 backdrop-blur-sm border border-navy-100 dark:border-[#C6AD73]/60 text-navy-600 dark:text-[#C6AD73] hover:border-gold-400 dark:hover:border-[#C6AD73] hover:text-gold-600 dark:hover:text-[#F0CF85] hover:bg-white dark:hover:bg-[#C6AD73]/10 shadow-sm hover:shadow-md transition-all duration-200 active:scale-95 relative overflow-hidden";

  return (
    <header className="sticky top-0 z-40 w-full bg-gold-50/95 dark:bg-navy-950/95 backdrop-blur-md border-b border-navy-100 dark:border-navy-800 px-4 h-16 flex items-center justify-between shadow-sm transition-colors duration-500">
      <div className="flex items-center gap-3">
        {showBack ? (
          <button onClick={() => onBack ? onBack() : navigate(-1)} className={btnClass} title="رجوع">
            <ArrowRight size={20} />
          </button>
        ) : (
          <button onClick={openSidebar} className={`${btnClass} xl:hidden`} title="القائمة">
            <Menu size={20} />
          </button>
        )}
        <h1 className="text-xl font-bold text-navy-900 dark:text-white font-sans tracking-tight">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        {extra}
        <button
          onClick={toggleTheme}
          className={`${btnClass} relative overflow-hidden`}
          aria-label="تبديل الوضع"
          title={isDark ? "التحويل للوضع النهاري" : "التحويل للوضع الليلي"}
        >
          {/* 
             LOGIC FIX:
             If Dark (isDark=true) -> Show Sun (to switch to Light)
             If Light (isDark=false) -> Show Moon (to switch to Dark)
          */}
          <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 transform ${isDark ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 rotate-90'}`}>
            <Sun size={20} className="text-gold-500" fill="currentColor" />
          </div>
          <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 transform ${!isDark ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-90'}`}>
            <Moon size={20} className="text-navy-600" />
          </div>
        </button>
      </div>
    </header>
  );
};
