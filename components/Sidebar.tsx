import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Home, Search, Radio, WifiOff, Activity, Shield, Calendar, BookHeart, Grid, Bookmark, Landmark, Library, Info, X, Settings, Bell, Brain, ShieldCheck } from 'lucide-react';
import { Surah } from '../types';
import { getUnreadCount } from '../services/storage';
import { MediaBridge } from '../services/mediaBridge';
import { SURAH_NAMES_TASHKEEL } from '../services/quranStaticData';

interface SidebarProps {
    isOpen: boolean;
    close: () => void;
    navigateToSurah: (num: number) => void;
    openSettings: () => void;
    surahs: Surah[];
}

export const Sidebar = React.memo(({ isOpen, close, navigateToSurah, openSettings, surahs }: SidebarProps) => {
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();
    const unreadCount = getUnreadCount();

    // Scroll Lock Effect
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Remove Arabic diacritics for search matching
    const removeDiacritics = (text: string) =>
        text.replace(/[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g, '');

    const filteredSurahs = useMemo(() => {
        if (!surahs) return [];

        const normalizedSearch = removeDiacritics(searchTerm.trim());
        if (!normalizedSearch) return surahs;

        return surahs.filter(s => {
            const normalizedName = removeDiacritics(s.name);
            return normalizedName.includes(normalizedSearch) ||
                s.englishName.toLowerCase().includes(searchTerm.toLowerCase());
        });
    }, [surahs, searchTerm]);

    const navItems = useMemo(() => [
        // القائمة الرئيسية
        { label: "الرئيسية", path: "/", icon: <Home size={18} /> },
        { label: "بحث", path: "/search", icon: <Search size={18} /> },
        { label: "الإذاعة", path: "/radio", icon: <Radio size={18} /> },
        { label: "أوفلاين", path: "/downloads", icon: <WifiOff size={18} /> },
        // أدوات المسلم
        { label: "الحفظ", path: "/hifz", icon: <Activity size={18} /> },
        { label: "اختبارات قرآنية", path: "/quiz", icon: <Brain size={18} /> },
        { label: "الأذكار", path: "/adhkar", icon: <Shield size={18} /> },
        { label: "المناسبات", path: "/events", icon: <Calendar size={18} /> },
        { label: "الحديث", path: "/hadith", icon: <BookHeart size={18} /> },
        { label: "السبحة", path: "/tasbih", icon: <Grid size={18} /> },
        { label: "المحفوظات", path: "/bookmarks", icon: <Bookmark size={18} /> },
        { label: "الحج والعمرة", path: "/hajj-umrah", icon: <Landmark size={18} /> },
        { label: "مكتبة التفسير", path: "/tafsir", icon: <Library size={18} /> },
        // معلومات
        { label: "عن التطبيق", path: "/about", icon: <Info size={18} /> },
    ], []);

    // إغلاق القائمة عند الضغط على زر الرجوع في الموبايل
    useEffect(() => {
        if (!isOpen) return;

        const handlePopState = (e: PopStateEvent) => {
            e.preventDefault();
            close();
            // إعادة الحالة للهيستوري لتجنب الخروج من التطبيق
            window.history.pushState(null, '', window.location.pathname);
        };

        // إضافة حالة وهمية للهيستوري عند فتح القائمة
        window.history.pushState(null, '', window.location.pathname);
        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [isOpen, close]);

    // Handle Native Back Button (Android)
    useEffect(() => {
        if (!isOpen) return;

        const handleNativeBack = async () => {
            close();
        };

        const listener = App.addListener('backButton', handleNativeBack);
        return () => {
            listener.then(l => l.remove());
        };
    }, [isOpen, close]);

    return (
        <>
            {/* Overlay - Opacity Only (No Blur for Performance) */}
            <div
                className={`fixed inset-0 bg-navy-950/70 z-50 transition-opacity duration-300 ease-out ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={close}
                aria-hidden="true"
            />

            {/* Drawer - Hardware Accelerated Transform */}
            <div
                className={`fixed inset-y-0 right-0 w-[85%] max-w-sm md:max-w-md lg:max-w-lg bg-gradient-to-b from-white via-white to-gold-50/30 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 shadow-2xl z-50 will-change-transform transform-gpu transition-transform duration-300 ease-out`}
                style={{ transform: isOpen ? 'translate3d(0,0,0)' : 'translate3d(100%,0,0)' }}
            >

                <div className="h-full overflow-y-auto custom-scrollbar overscroll-contain">
                    <div className="flex flex-col min-h-full">

                        {/* Header with Logo */}
                        <div className="relative h-36 bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 shrink-0 overflow-hidden flex items-center px-6">
                            {/* Decorative Pattern - GPU Optimized with opacity */}
                            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIgb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMjAgMEwyMCA0ME0wIDIwTDQwIDIwIiAvPjwvc3ZnPg==')" }}></div>

                            {/* Close Button */}
                            <button
                                onClick={close}
                                className="absolute top-4 left-4 p-2.5 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all z-20 border border-white/10 active:scale-95"
                                aria-label="إغلاق القائمة"
                            >
                                <X size={18} />
                            </button>

                            {/* Logo */}
                            <div className="relative z-10 flex items-center gap-4 cursor-pointer" onClick={() => { navigate('/'); close(); }}>
                                <div className="w-16 h-16 bg-gradient-to-br from-[#D4B978] via-[#C6AD73] to-[#9A7B3C] rounded-2xl flex items-center justify-center text-white shadow-xl shadow-gold-500/40 transform rotate-3 border-2 border-[#F0CF85]/50">
                                    <span className="font-quran text-4xl font-bold mt-2">ب</span>
                                </div>
                                <div>
                                    <h2 className="font-bold text-2xl text-white font-quran">البيان</h2>
                                    <p className="text-[11px] text-gold-300 font-bold tracking-wider mt-1">القرآن والسنة</p>
                                </div>
                            </div>
                        </div>

                        {/* Navigation Grid */}
                        <div className="p-4 grid grid-cols-4 md:grid-cols-5 gap-2.5 shrink-0 bg-gradient-to-b from-gold-50/80 to-white dark:from-navy-900/80 dark:to-navy-900 border-b border-gold-100 dark:border-navy-800">
                            {navItems.map((item) => {
                                const isBookmarks = item.path === '/bookmarks';
                                return (
                                    <button
                                        key={item.path}
                                        onClick={() => { navigate(item.path); close(); }}
                                        className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl border shadow-sm active:scale-95 transition-transform duration-150 group
                                        ${isBookmarks
                                                ? 'bg-gradient-to-br from-gold-50 to-amber-50 dark:from-navy-800 dark:to-navy-800 border-gold-200 dark:border-gold-500/30'
                                                : 'bg-white/95 dark:bg-navy-800/95 border-gold-100/50 dark:border-navy-700'
                                            }`}
                                    >
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-200
                                        ${isBookmarks
                                                ? 'bg-gradient-to-br from-gold-400 to-amber-500 text-white shadow-lg shadow-gold-500/30'
                                                : 'bg-gradient-to-br from-navy-50 to-stone-100 dark:from-navy-700 dark:to-navy-800 text-navy-500 dark:text-navy-400 group-hover:from-gold-100 group-hover:to-amber-100 dark:group-hover:from-gold-900/30 dark:group-hover:to-amber-900/20 group-hover:text-gold-600 dark:group-hover:text-gold-400'
                                            }`}>
                                            {item.icon}
                                        </div>
                                        <span className={`text-[9px] font-bold truncate w-full text-center transition-colors
                                        ${isBookmarks
                                                ? 'text-gold-700 dark:text-gold-400'
                                                : 'text-navy-700 dark:text-navy-300 group-hover:text-gold-700 dark:group-hover:text-gold-400'
                                            }`}>{item.label}</span>
                                    </button>
                                );
                            })}

                            {/* Settings Button */}
                            <button
                                onClick={() => { openSettings(); close(); }}
                                className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl bg-white/95 dark:bg-navy-800/95 border border-gold-100/50 dark:border-navy-700 shadow-sm active:scale-95 transition-transform duration-150 group"
                            >
                                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-navy-50 to-stone-100 dark:from-navy-700 dark:to-navy-800 flex items-center justify-center group-hover:from-gold-100 group-hover:to-amber-100 dark:group-hover:from-gold-900/30 dark:group-hover:to-amber-900/20 transition-colors duration-200">
                                    <div className="text-navy-500 dark:text-navy-400 group-hover:text-gold-600 dark:group-hover:text-gold-400 transition-colors">
                                        <Settings size={18} />
                                    </div>
                                </div>
                                <span className="text-[9px] font-bold text-navy-700 dark:text-navy-300 truncate w-full text-center group-hover:text-gold-700 dark:group-hover:text-gold-400 transition-colors">الإعدادات</span>
                            </button>

                            {/* Notifications Button */}
                            <button onClick={() => { navigate('/notifications'); close(); }} className="col-span-4 flex items-center justify-between px-4 py-3 rounded-xl bg-gradient-to-r from-navy-800 via-navy-700 to-navy-800 text-white shadow-lg shadow-navy-900/20 relative overflow-hidden group active:scale-95 transition-transform">
                                <div className="absolute inset-0 bg-gradient-to-r from-gold-500/10 to-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="flex items-center gap-3 relative z-10">
                                    <div className="w-8 h-8 rounded-lg bg-gold-500/20 flex items-center justify-center">
                                        <Bell size={16} className="text-gold-400" />
                                    </div>
                                    <span className="text-sm font-bold">التنبيهات</span>
                                </div>
                                {unreadCount > 0 && (
                                    <span className="bg-gradient-to-br from-red-500 to-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg shadow-red-500/40 animate-pulse relative z-10">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </button>
                        </div>



                        {/* Surah Search & List */}
                        <div className="flex-1 flex flex-col bg-white dark:bg-navy-950">
                            {/* Search Bar - Removed backdrop-blur for performance */}
                            <div className="p-3 bg-white/95 dark:bg-navy-950/95 z-20 sticky top-0 border-b border-gold-100/50 dark:border-navy-800 shadow-sm">
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="ابحث عن سورة..."
                                        className="w-full h-11 px-4 pl-11 rounded-xl border-2 border-gold-100 dark:border-navy-700 bg-gradient-to-r from-white to-gold-50/30 dark:from-navy-900 dark:to-navy-800 text-navy-900 dark:text-white focus:border-gold-400 dark:focus:border-gold-500 focus:ring-4 focus:ring-gold-500/10 outline-none transition-all text-sm font-medium placeholder:text-navy-300 dark:placeholder:text-navy-500 appearance-none"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-gold-100 dark:bg-navy-700 flex items-center justify-center pointer-events-none">
                                        <Search size={14} className="text-gold-600 dark:text-gold-400" />
                                    </div>
                                </div>
                            </div>

                            {/* Surah List */}
                            <div className="px-3 pb-6 pt-2">
                                <div className="space-y-1">
                                    {filteredSurahs.map(surah => {
                                        // استخدام الاسم المشكّل من القاموس الثابت (الرقم 1-based)
                                        const tashkeelName = SURAH_NAMES_TASHKEEL[surah.number - 1] ?? surah.name;
                                        return (
                                            <button
                                                key={surah.number}
                                                onClick={() => { navigateToSurah(surah.number); close(); }}
                                                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gradient-to-r hover:from-gold-50 hover:to-amber-50/50 dark:hover:from-navy-800 dark:hover:to-navy-800/80 transition-colors duration-200 group border border-transparent hover:border-gold-200/50 dark:hover:border-navy-700"
                                            >
                                                <div className="flex items-center gap-3">
                                                    {/* رقم السورة */}
                                                    <span className="w-9 h-9 flex shrink-0 items-center justify-center bg-gradient-to-br from-navy-100 to-navy-50 dark:from-navy-800 dark:to-navy-900 rounded-xl text-xs font-bold text-navy-600 dark:text-navy-400 group-hover:from-gold-400 group-hover:to-amber-500 group-hover:text-white transition-colors duration-200 font-sans shadow-sm">
                                                        {surah.number}
                                                    </span>
                                                    {/* اسم السورة مع التشكيل + الاسم الإنجليزي */}
                                                    <div className="text-right flex flex-col gap-0.5">
                                                        <div className="font-quran text-[15px] leading-tight font-bold text-navy-800 dark:text-white group-hover:text-gold-700 dark:group-hover:text-gold-400 transition-colors">
                                                            {tashkeelName}
                                                        </div>
                                                        <div className="text-[10px] text-navy-400 dark:text-navy-500 font-medium tracking-wide group-hover:text-gold-500 dark:group-hover:text-gold-600 transition-colors">
                                                            {surah.englishName}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${surah.revelationType === 'Meccan'
                                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                        }`}>
                                                        {surah.revelationType === 'Meccan' ? 'مكية' : 'مدنية'}
                                                    </span>
                                                    <span className="text-[9px] text-navy-400 dark:text-navy-500 font-medium">
                                                        {surah.numberOfAyahs} آية
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 text-center border-t border-gold-100 dark:border-navy-800 bg-gradient-to-r from-gold-50 via-white to-gold-50 dark:from-navy-900 dark:via-navy-900 dark:to-navy-900 text-[10px] text-navy-500 dark:text-navy-400 mt-auto font-medium">
                            © {new Date().getFullYear()} البيان - القرآن والسنة
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
});
