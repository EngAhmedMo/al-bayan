import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { App } from '@capacitor/app';
import { hapticTap, hapticSuccess } from '../services/haptics';
import { TopBar } from '../components/TopBar';
import { ADHKAR_DATA } from '../services/adhkarData';
import { CATEGORY_GROUPS, countAdhkarInGroup, getSubCategoriesForGroup } from '../services/categoryGroups';
import { Zekr } from '../types';
import {
  ArrowLeft, CheckCircle2, Heart, Plus, Trash2, PenTool, Shield, Star, Grid,
  Moon, Sun, Sunrise, Sunset, Edit2, Book, Coffee, Home, Plane, Info, AlertTriangle, Sparkles,
  Users, Map, Leaf, Stethoscope, BookOpen, Smile, Utensils, X, Search as SearchIcon
} from 'lucide-react';
import { toArabicDigits, normalizeArabic, cleanDhikrText } from '../services/normalization';
import { useSettings } from '../components/Layout';
import {
  getFavoriteAdhkarIds,
  toggleFavoriteAdhkar,
  getCustomAdhkar,
  addCustomAdhkar,
  updateCustomAdhkar,
  deleteCustomAdhkar,
  getLastUsedCategory,
  setLastUsedCategory,
  getLastUsedZekrId,
  setLastUsedZekrId
} from '../services/storage';

// Icon mapping for category groups
const ICON_MAP: Record<string, React.ReactNode> = {
  'star': <Star size={28} className="text-gold-500 dark:text-gold-400" />,
  'moon': <Moon size={28} className="text-indigo-500 dark:text-indigo-400" />,
  'book': <BookOpen size={28} className="text-blue-500 dark:text-blue-400" />,
  'home': <Home size={28} className="text-emerald-500 dark:text-emerald-400" />,
  'coffee': <Utensils size={28} className="text-amber-600 dark:text-amber-400" />,
  'plane': <Plane size={28} className="text-sky-500 dark:text-sky-400" />,
  'smile': <Smile size={28} className="text-rose-500 dark:text-rose-400" />,
  'sparkles': <Sparkles size={28} className="text-purple-500 dark:text-purple-400" />,
  'users': <Users size={28} className="text-teal-500 dark:text-teal-400" />,
  'map': <Map size={28} className="text-gold-600 dark:text-amber-700" />, // Significantly darkened for Dark Mode
  'leaf': <Leaf size={28} className="text-green-500 dark:text-green-400" />,
  'stethoscope': <Stethoscope size={28} className="text-slate-500 dark:text-slate-400" />,
  'edit': <PenTool size={28} className="text-pink-500 dark:text-pink-400" />,
};

export const Adhkar: React.FC = () => {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<'all' | 'favorites'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [favIds, setFavIds] = useState<number[]>([]);
  const [customAdhkar, setCustomAdhkar] = useState<Zekr[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingZekr, setEditingZekr] = useState<Zekr | undefined>(undefined);

  const [favoriteCompletedIds, setFavoriteCompletedIds] = useState<Set<number>>(new Set());
  const favoriteCompletedIdsRef = useRef<Set<number>>(favoriteCompletedIds);

  // Touch Swipe State for tabs
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const deltaX = touchStartX.current - touchEndX;
    const deltaY = touchStartY.current - touchEndY;

    // Ignore if touch gesture originated or ended on interactive elements to prevent conflicts
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('a')
    ) {
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }

    // Check if it's a horizontal swipe (more horizontal than vertical, with a threshold of 50px)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        // Swipe Left (finger drags left -> next tab/favorites in RTL)
        setViewMode('favorites');
      } else {
        // Swipe Right (finger drags right -> prev tab/all in RTL)
        setViewMode('all');
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Keyboard navigation for main tabs (Arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if viewing subcategories or categories or modal is open
      if (selectedGroupId !== null || selectedCategory !== null || isModalOpen) return;
      // Ignore if typing in search or any input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setViewMode('favorites');
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setViewMode('all');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedGroupId, selectedCategory, isModalOpen]);

  useEffect(() => {
    favoriteCompletedIdsRef.current = favoriteCompletedIds;
  }, [favoriteCompletedIds]);

  useEffect(() => {
    if (viewMode === 'favorites') {
      setFavoriteCompletedIds(new Set());
    }
  }, [viewMode]);

  const refreshData = () => {
    setFavIds(getFavoriteAdhkarIds());
    setCustomAdhkar(getCustomAdhkar());
  };

  useEffect(() => { refreshData(); }, []);

  // History API for Mobile Back Button
  useEffect(() => {
    const handlePopState = () => {
      // NOTE: selectedCategory handling is delegated to CategoryDetail component
      // to allow for exit confirmation interception.
      if (selectedCategory === null && selectedGroupId !== null) {
        setSelectedGroupId(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedCategory, selectedGroupId]);

  // Handle Deep Links (Query Params)
  const location = useLocation();

  useEffect(() => {
    let categoryParam = searchParams.get('category');

    // Fallback: Check hash directly if search is empty (Legacy/Manual Hash updates)
    if (!categoryParam && window.location.hash.includes('?')) {
      categoryParam = new URLSearchParams(window.location.hash.split('?')[1]).get('category');
    }

    if (categoryParam) {
      const decodedCat = decodeURIComponent(categoryParam);
      // Ensure we switch to component view if currently in CategoryDetail or GroupView
      if (selectedCategory !== decodedCat) {
        handleCategorySelect(decodedCat);
      }

      // Clear the category search parameter so it doesn't trigger again on subsequent renders/popstates
      setSearchParams(prev => {
        const newParams = new URLSearchParams(prev);
        newParams.delete('category');
        return newParams;
      }, { replace: true });

      // If we also had manual hash query params, clear them too
      if (window.location.hash.includes('?')) {
        const hashWithoutQuery = window.location.hash.split('?')[0];
        window.history.replaceState(null, '', hashWithoutQuery);
      }
    }
  }, [searchParams, selectedCategory, setSearchParams]);

  const handleGroupSelect = (groupId: string) => {
    window.history.pushState({ group: groupId }, '');
    setSelectedGroupId(groupId);

    // For custom group, go directly to adhkar list (skip subcategory view)
    if (groupId === 'custom') {
      window.history.pushState({ category: 'أذكاري الخاصة' }, '');
      setSelectedCategory('أذكاري الخاصة');
    }

    // Scroll to top when selecting a group
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleCategorySelect = (cat: string) => {
    window.history.pushState({ category: cat }, '');
    setLastUsedCategory(cat);
    setSelectedCategory(cat);
    // Scroll to top when selecting a category
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleBackToGroups = () => {
    setSelectedGroupId(null);
    setSelectedCategory(null);
    window.history.back();
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
    window.history.back();
  };

  const allAdhkarCombined = useMemo(() => [...customAdhkar, ...ADHKAR_DATA], [customAdhkar]);
  const favoriteAdhkarList = useMemo(() => allAdhkarCombined.filter(item => favIds.includes(item.id)), [favIds, allAdhkarCombined]);

  const handleFavoriteComplete = useCallback((id: number) => {
    setFavoriteCompletedIds(prev => new Set([...prev, id]));
    
    // Auto-scroll to the next uncompleted Zekr after animations finish
    setTimeout(() => {
      const currentIndex = favoriteAdhkarList.findIndex(z => z.id === id);
      if (currentIndex !== -1) {
        let nextZekr = null;
        for (let i = currentIndex + 1; i < favoriteAdhkarList.length; i++) {
          if (!favoriteCompletedIdsRef.current.has(favoriteAdhkarList[i].id) && favoriteAdhkarList[i].id !== id) {
            nextZekr = favoriteAdhkarList[i];
            break;
          }
        }
        
        if (nextZekr) {
          const nextElement = document.getElementById(`zekr-${nextZekr.id}`);
          if (nextElement) {
            nextElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Briefly highlight the next card
            nextElement.classList.add('ring-2', 'ring-gold-500', 'ring-offset-2', 'dark:ring-offset-navy-900', 'transition-all', 'duration-500');
            setTimeout(() => {
              nextElement.classList.remove('ring-2', 'ring-gold-500', 'ring-offset-2', 'dark:ring-offset-navy-900');
            }, 1500);
          }
        }
      }
    }, 800);
  }, [favoriteAdhkarList]);

  const handleSaveZekr = (zekrData: any) => {
    if (editingZekr) {
      updateCustomAdhkar(editingZekr.id, zekrData);
    } else {
      addCustomAdhkar({ ...zekrData, category: "أذكاري الخاصة" });
    }
    refreshData();
    setIsModalOpen(false);
  };

  // Get categories for selected group
  const groupCategories = useMemo(() => {
    if (!selectedGroupId) return [];
    if (selectedGroupId === 'all') {
      // Return all unique categories
      return Array.from(new Set(allAdhkarCombined.map(a => a.category)));
    }
    return getSubCategoriesForGroup(selectedGroupId);
  }, [selectedGroupId, allAdhkarCombined]);

  // If viewing a specific category
  if (selectedCategory !== null) {
    return (
      <CategoryDetail
        category={selectedCategory}
        onBack={handleBackToCategories}
        onDismiss={() => setSelectedCategory(null)}
        favIds={favIds}
        customAdhkar={customAdhkar}
        onToggleFav={(id) => { toggleFavoriteAdhkar(id); refreshData(); }}
        onDeleteCustom={(id) => { deleteCustomAdhkar(id); refreshData(); }}
        onEditCustom={(z) => { setEditingZekr(z); setIsModalOpen(true); }}
      />
    );
  }

  // If viewing categories within a group
  if (selectedGroupId !== null) {
    const group = CATEGORY_GROUPS.find(g => g.id === selectedGroupId);
    return (
      <div className="flex flex-col h-full bg-gradient-to-b from-gold-50 via-white to-gold-50/50 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 font-sans">
        <TopBar
          title={group?.name || 'الأذكار'}
          showBack={false}
          extra={
            <button onClick={handleBackToGroups} className="p-2.5 bg-white dark:bg-navy-800 rounded-xl border border-gold-200 dark:border-navy-700 shadow-sm hover:shadow-md transition-all">
              <ArrowLeft size={20} className="text-navy-600 dark:text-navy-300" />
            </button>
          }
        />

        {/* Header Badge */}
        <div className="px-4 pt-4 pb-2">
          <div className="inline-flex items-center gap-3 bg-white/80 dark:bg-navy-900/80 backdrop-blur-sm px-4 py-2 rounded-xl border border-gold-200/50 dark:border-navy-700 shadow-sm">
            <div className="w-8 h-8 bg-gradient-to-br from-gold-500 to-amber-500 rounded-lg flex items-center justify-center text-white shadow-lg shadow-gold-500/20">
              {ICON_MAP[group?.icon || 'star'] ? React.cloneElement(ICON_MAP[group?.icon || 'star'] as React.ReactElement, { size: 16, className: 'text-white' }) : <Sparkles size={16} className="text-white" />}
            </div>
            <span className="text-sm font-bold text-navy-700 dark:text-white">{groupCategories.length} فئة</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 pb-24 custom-scrollbar">
          <div className="grid grid-cols-1 gap-3">
            {groupCategories.map((cat, idx) => {
              const count = allAdhkarCombined.filter(a => a.category === cat).length;
              if (count === 0) return null;
              return (
                <button
                  key={idx}
                  onClick={() => handleCategorySelect(cat)}
                  className="p-4 md:p-5 rounded-2xl bg-white/90 dark:bg-navy-900/90 backdrop-blur-sm border border-gold-100/50 dark:border-navy-700 hover:border-gold-400 dark:hover:border-gold-600/50 transition-all text-right flex items-center gap-4 group shadow-lg shadow-navy-900/5 dark:shadow-navy-950/30 hover:shadow-xl hover:-translate-y-0.5"
                >
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gold-50 to-amber-50 dark:from-navy-800 dark:to-navy-900 flex items-center justify-center shrink-0 border border-gold-100/50 dark:border-navy-700 shadow-sm group-hover:shadow-md transition-all">
                    {ICON_MAP[group?.icon || 'star'] || <Sparkles size={24} className="text-gold-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base text-navy-900 dark:text-white truncate group-hover:text-gold-700 dark:group-hover:text-gold-400 transition-colors">{cat}</h3>
                    <p className="text-xs font-bold text-gold-600 dark:text-gold-400 mt-1 flex items-center gap-1">
                      <span className="bg-gold-50 dark:bg-gold-900/20 px-2 py-0.5 rounded-lg">{toArabicDigits(count)} ذكر</span>
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-gold-50 dark:bg-navy-800 flex items-center justify-center group-hover:bg-gold-100 dark:group-hover:bg-navy-700 transition-colors">
                    <ArrowLeft size={18} className="text-navy-400 group-hover:text-gold-600 dark:group-hover:text-gold-400 transition-colors rotate-180" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Main Grid View
  return (
    <div 
      className="flex flex-col h-full bg-gradient-to-b from-gold-50 via-white to-gold-50/50 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 font-sans"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: 'pan-y' }}
    >
      <TopBar title="حصن المسلم" />

      {/* Toggle Buttons */}
      <div className="px-4 pt-4">
        <div className="bg-white/90 dark:bg-navy-900/90 backdrop-blur-sm p-1.5 rounded-2xl border border-gold-100/50 dark:border-navy-700 shadow-lg shadow-navy-900/5 dark:shadow-navy-950/30 flex">
          <button onClick={() => setViewMode('all')} className={`flex-1 py-3.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${viewMode === 'all' ? 'bg-gradient-to-br from-navy-800 to-navy-900 text-white shadow-lg' : 'text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800'}`}>
            <Grid size={18} /> التصنيفات
          </button>
          <button onClick={() => setViewMode('favorites')} className={`flex-1 py-3.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${viewMode === 'favorites' ? 'bg-gradient-to-br from-gold-500 to-amber-500 text-white shadow-lg shadow-gold-500/30' : 'text-navy-400 hover:bg-gold-50 dark:hover:bg-navy-800'}`}>
            <Heart size={18} fill={viewMode === 'favorites' ? "currentColor" : "none"} /> المفضلة
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-4 mt-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن ذكر..."
            className="w-full h-12 pl-12 pr-12 rounded-xl border border-gold-200/50 dark:border-navy-700 bg-white/90 dark:bg-navy-900/90 text-navy-900 dark:text-white shadow-sm focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-all duration-300 font-bold placeholder:font-normal placeholder:text-navy-400"
          />
          <SearchIcon size={18} className="absolute right-4 top-3.5 text-navy-400" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-2.5 p-1.5 bg-stone-100 dark:bg-navy-800 text-stone-500 dark:text-navy-400 rounded-lg hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto pb-24 custom-scrollbar">
        {searchQuery.trim() !== '' ? (
          <div className="space-y-6 pt-2">
            {(() => {
              const query = normalizeArabic(searchQuery);
              const matched = allAdhkarCombined.filter(z => normalizeArabic(z.zekr).includes(query));
              if (matched.length === 0) return <div className="text-center text-navy-400 py-10 font-bold">لا توجد نتائج مطابقة</div>;
              return matched.map(zekr => (
                <div key={zekr.id} className="relative">
                  <div className="absolute -top-3 right-4 z-20">
                    <span className="bg-gradient-to-r from-gold-100 to-amber-100 dark:from-gold-900/50 dark:to-amber-900/50 text-gold-800 dark:text-gold-300 text-[10px] font-bold px-3 py-1 rounded-full border border-gold-200 dark:border-gold-800/50 shadow-sm">{zekr.category}</span>
                  </div>
                  <ZekrCard 
                    data={zekr} 
                    isFav={favIds.includes(zekr.id)} 
                    onToggleFav={(id) => { toggleFavoriteAdhkar(id); refreshData(); }} 
                    onEdit={zekr.category === "أذكاري الخاصة" ? () => { setEditingZekr(zekr); setIsModalOpen(true); } : undefined}
                  />
                </div>
              ));
            })()}
          </div>
        ) : viewMode === 'all' ? (
          <div className="space-y-5">
            {/* Add Custom Button */}
            <button onClick={() => { setEditingZekr(undefined); setIsModalOpen(true); }} className="w-full p-5 rounded-2xl border-2 border-dashed border-gold-300 dark:border-navy-700 text-gold-600 dark:text-gold-400 hover:border-gold-500 hover:bg-gold-50/50 dark:hover:bg-navy-800/50 transition-all font-bold flex items-center justify-center gap-3 group bg-white/50 dark:bg-navy-900/30 backdrop-blur-sm">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-100 to-amber-100 dark:from-gold-900/30 dark:to-amber-900/20 flex items-center justify-center group-hover:from-gold-200 group-hover:to-amber-200 transition-all">
                <Plus size={22} className="group-hover:scale-110 transition-transform" />
              </div>
              <span>إضافة ذكر جديد</span>
            </button>

            {/* Category Groups Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
              {CATEGORY_GROUPS.map((group) => {
                const count = countAdhkarInGroup(group.id, allAdhkarCombined);
                const isCustom = group.id === 'custom';
                const isAll = group.id === 'all';

                return (
                  <button
                    key={group.id}
                    onClick={() => handleGroupSelect(group.id)}
                    className={`p-4 md:p-5 rounded-2xl border transition-all flex flex-col items-center text-center group overflow-hidden relative ${isAll
                      ? 'bg-gradient-to-br from-gold-50 to-amber-50 dark:from-navy-800 dark:to-navy-900 border-gold-400 dark:border-gold-600 border-2 text-navy-900 dark:text-white shadow-xl shadow-gold-500/20'
                      : isCustom
                        ? 'bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950/30 dark:to-pink-900/20 border-pink-200 dark:border-pink-800 hover:border-pink-400 hover:shadow-lg shadow-md'
                        : 'bg-white/90 dark:bg-navy-900/90 backdrop-blur-sm border-gold-100/50 dark:border-navy-700 hover:border-gold-400 dark:hover:border-gold-600/50 hover:shadow-xl shadow-lg shadow-navy-900/5 dark:shadow-navy-950/30'
                      } hover:-translate-y-1`}
                  >
                    <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mb-3 transition-all group-hover:shadow-md ${isAll ? 'bg-white/80 dark:bg-navy-700' : isCustom ? 'bg-pink-100 dark:bg-pink-900/30' : 'bg-gradient-to-br from-gold-50 to-amber-50 dark:from-navy-800 dark:to-navy-900'
                      }`}>
                      {ICON_MAP[group.icon] || <Sparkles size={28} className="text-gold-500" />}
                    </div>
                    <h3 className={`font-bold text-xs md:text-sm leading-tight mb-1 ${isAll ? 'text-navy-900 dark:text-white' : 'text-navy-800 dark:text-white'}`}>
                      {group.name}
                    </h3>
                    <p className={`text-[10px] md:text-xs font-bold ${isAll ? 'text-gold-600 dark:text-gold-400' : isCustom ? 'text-pink-500' : 'text-navy-400 dark:text-navy-400'
                      }`}>
                      {isCustom
                        ? (count > 0 ? `${toArabicDigits(count)} ذكر` : 'لا يوجد أذكار')
                        : `${toArabicDigits(count)} فئة`
                      }
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {favoriteAdhkarList.length > 0 ? (
              favoriteAdhkarList.map(zekr => (
                <div key={zekr.id} id={`zekr-${zekr.id}`} className="rounded-3xl">
                  <ZekrCard
                    data={zekr}
                    isFav={true}
                    onToggleFav={(id) => { toggleFavoriteAdhkar(id); refreshData(); }}
                    onComplete={handleFavoriteComplete}
                  />
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-gold-100 to-amber-50 dark:from-navy-800 dark:to-navy-900 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-gold-500/10">
                  <Heart size={36} className="text-gold-400" />
                </div>
                <h3 className="font-bold text-lg text-navy-600 dark:text-navy-300 mb-2">قائمة المفضلة فارغة</h3>
                <p className="text-sm text-navy-400 dark:text-navy-500 max-w-xs">أضف أذكارك المفضلة بالضغط على قلب ❤️ لتظهر هنا.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {
        isModalOpen && (
          <AddZekrModal
            onClose={() => setIsModalOpen(false)}
            onSave={handleSaveZekr}
            initialData={editingZekr}
          />
        )
      }
    </div >
  );
};

// Enhanced Exit Confirmation Logic
const CategoryDetail: React.FC<{
  category: string;
  onBack: () => void;
  onDismiss: () => void;
  favIds: number[];
  customAdhkar: Zekr[];
  onToggleFav: (id: number) => void;
  onDeleteCustom: (id: number) => void;
  onEditCustom: (zekr: Zekr) => void;
}> = ({ category, onBack, onDismiss, favIds, customAdhkar, onToggleFav, onDeleteCustom, onEditCustom }) => {
  const allList = useMemo(() => [...customAdhkar, ...ADHKAR_DATA], [customAdhkar]);
  const adhkarList = useMemo(() => {
    return allList.filter(i => i.category === category).sort((a, b) => a.zekr.length - b.zekr.length);
  }, [category, allList]);

  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Track completion state for exit confirmation
  // We track individual Zekr progress to know if "started"
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());
  const completedIdsRef = useRef<Set<number>>(completedIds);
  const [startedIds, setStartedIds] = useState<Set<number>>(new Set());
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Keyboard navigation: track which zekr is "focused" for Space/Arrow
  const [activeZekrIndex, setActiveZekrIndex] = useState(0);
  const [showKeyboardHint, setShowKeyboardHint] = useState(false);
  const [showShortcutsPanel, setShowShortcutsPanel] = useState(false);
  const spaceCountRef = useRef<((id: number) => void) | null>(null);
  const resetCountRef = useRef<(() => void) | null>(null);

  // Detect desktop for keyboard UX and hint
  const [isDesktopMode, setIsDesktopMode] = useState(false);
  useEffect(() => {
    const isDesktop = window.matchMedia('(pointer: fine) and (min-width: 768px)').matches;
    setIsDesktopMode(isDesktop);
    if (isDesktop) {
      const usedBefore = localStorage.getItem('adhkar_kb_hint_seen');
      setShowKeyboardHint(!usedBefore);
    }
  }, []);

  const hasStarted = startedIds.size > 0 || completedIds.size > 0;
  const allCompleted = completedIds.size >= adhkarList.length;

  const isExitingRef = useRef(false);
  const hasStartedRef = useRef(false);
  const allCompletedRef = useRef(false);

  useEffect(() => {
    hasStartedRef.current = hasStarted;
  }, [hasStarted]);

  useEffect(() => {
    allCompletedRef.current = allCompleted;
  }, [allCompleted]);

  const handleTapProgress = useCallback((id: number) => {
    setStartedIds(prev => new Set([...prev, id]));
  }, []);

  const handleComplete = useCallback((id: number) => {
    setCompletedIds(prev => new Set([...prev, id]));
    
    // Auto-scroll to the next uncompleted Zekr after animations finish
    setTimeout(() => {
      const currentIndex = adhkarList.findIndex(z => z.id === id);
      if (currentIndex !== -1) {
        let nextZekr = null;
        for (let i = currentIndex + 1; i < adhkarList.length; i++) {
          if (!completedIdsRef.current.has(adhkarList[i].id) && adhkarList[i].id !== id) {
            nextZekr = adhkarList[i];
            break;
          }
        }
        
        if (nextZekr) {
          const nextElement = document.getElementById(`zekr-${nextZekr.id}`);
          if (nextElement) {
            nextElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Briefly highlight the next card
            nextElement.classList.add('ring-2', 'ring-gold-500', 'ring-offset-2', 'dark:ring-offset-navy-900', 'transition-all', 'duration-500');
            setTimeout(() => {
              nextElement.classList.remove('ring-2', 'ring-gold-500', 'ring-offset-2', 'dark:ring-offset-navy-900');
            }, 1500);
          }
        } else {
          // If no nextZekr, check if ALL are completed.
          // By this time, completedIdsRef should have the updated values.
          if (completedIdsRef.current.size >= adhkarList.length) {
            const completionCard = document.getElementById('completion-card');
            if (completionCard) {
               completionCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        }
      }
    }, 800);
  }, [adhkarList]);

  const handleBackClick = useCallback(() => {
    // Logic: If user has STARTED (interacted) but NOT completed ALL items -> Confirm
    if (hasStartedRef.current && !allCompletedRef.current) {
      setShowExitConfirm(true);
    } else {
      isExitingRef.current = true;
      onBack();
    }
  }, [onBack]);

  const handleConfirmExit = useCallback(() => {
    isExitingRef.current = true;
    setShowExitConfirm(false);
    onBack();
  }, [onBack]);

  useEffect(() => {
    completedIdsRef.current = completedIds;
  }, [completedIds]);

  // Sync activeZekrIndex to first uncompleted zekr
  useEffect(() => {
    if (completedIds.size > 0) {
      const nextIdx = adhkarList.findIndex(z => !completedIds.has(z.id));
      if (nextIdx !== -1) setActiveZekrIndex(nextIdx);
    }
  }, [completedIds, adhkarList]);

  // Latest state ref for event listeners to avoid stale closures
  const latestStateRef = useRef({
    activeZekrIndex,
    adhkarList,
    showExitConfirm,
    showShortcutsPanel,
    showKeyboardHint
  });

  useEffect(() => {
    latestStateRef.current = {
      activeZekrIndex,
      adhkarList,
      showExitConfirm,
      showShortcutsPanel,
      showKeyboardHint
    };
  });

  // Keyboard listener: Space/Enter = count, ArrowDown/Up = navigate, R = reset, Esc = back, ? = help
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't fire when typing in inputs/textareas
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Prevent multiple increments on long-press (key repeat)
      if (e.repeat) return;

      const state = latestStateRef.current;

      // Help panel toggle
      if (e.key === '?') {
        e.preventDefault();
        setShowShortcutsPanel(prev => !prev);
        return;
      }

      // If Exit Confirmation modal is open, handle its shortcuts
      if (state.showExitConfirm) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowExitConfirm(false);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          handleConfirmExit();
        }
        return;
      }

      if (state.showShortcutsPanel) {
        if (e.key === 'Escape') setShowShortcutsPanel(false);
        return;
      }

      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        if (spaceCountRef.current && state.adhkarList[state.activeZekrIndex]) {
          spaceCountRef.current(state.adhkarList[state.activeZekrIndex].id);
          // Hide hint after first use
          if (state.showKeyboardHint) {
            localStorage.setItem('adhkar_kb_hint_seen', '1');
            setShowKeyboardHint(false);
          }
        }
      } else if (e.code === 'ArrowDown' || e.code === 'ArrowLeft') {
        e.preventDefault();
        setActiveZekrIndex(prev => {
          const next = Math.min(prev + 1, state.adhkarList.length - 1);
          const el = document.getElementById(`zekr-${state.adhkarList[next]?.id}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return next;
        });
      } else if (e.code === 'ArrowUp' || e.code === 'ArrowRight') {
        e.preventDefault();
        setActiveZekrIndex(prev => {
          const next = Math.max(prev - 1, 0);
          const el = document.getElementById(`zekr-${state.adhkarList[next]?.id}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return next;
        });
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        if (resetCountRef.current) resetCountRef.current();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleBackClick();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleBackClick, handleConfirmExit]);

  useEffect(() => {
    // Reset Scroll on Mount/Category Change
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Reset tracking
    setCompletedIds(new Set());
    setStartedIds(new Set());
    setActiveZekrIndex(0);
  }, [category]);

  // Handle Hardware Back Button - Must intercept to show confirmation
  useEffect(() => {
    if (!category) return;

    // Push a state when entering category detail so we can intercept back
    window.history.pushState({ view: 'adhkar-detail', category }, '');

    const handlePopState = (e: PopStateEvent) => {
      if (isExitingRef.current) {
        onDismiss();
        return;
      }

      // User pressed back button
      if (hasStartedRef.current && !allCompletedRef.current) {
        // Prevent default back navigation by pushing state again
        window.history.pushState({ view: 'adhkar-detail', category }, '');
        setShowExitConfirm(true);
      } else {
        // Allow exit - call onDismiss to clear state (history already popped)
        onDismiss();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [category, onDismiss]);

  // Handle Native Back Button (Capacitor/Android)
  useEffect(() => {
    if (!category) return;

    const listenerPromise = App.addListener('backButton', ({ canGoBack }) => {
      // CONFLICT PREVENTION:
      // If sidebar is open (body overflow is hidden), IGNORE this back press
      // because Sidebar.tsx will handle it (closing itself).
      if (document.body.style.overflow === 'hidden') {
        return;
      }

      // 1. If Confirmation Modal is OPEN -> Close it only.
      if (showExitConfirm) {
        setShowExitConfirm(false);
        return; // STOP EXECUTION
      }

      // 2. If User has STARTED READING but NOT FINISHED -> Show Modal.
      if (hasStarted && !allCompleted) {
        setShowExitConfirm(true);
        return; // STOP EXECUTION - Do NOT call onBack()
      }

      // 3. Otherwise -> Proceed with normal back
      onBack();
    });

    return () => {
      listenerPromise.then(l => l.remove());
    };
  }, [category, hasStarted, allCompleted, onBack, showExitConfirm]);


  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-gold-50 via-white to-gold-50/50 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 font-sans">
      <TopBar
        title={category}
        showBack={false}
        extra={
          <button onClick={handleBackClick} className="p-2.5 bg-white dark:bg-navy-800 rounded-xl border border-gold-200 dark:border-navy-700 shadow-sm hover:shadow-md transition-all">
            <ArrowLeft size={20} className="text-navy-600 dark:text-navy-300" />
          </button>
        }
      />

      {/* Progress indicator */}
      <div className="px-4 py-3 bg-white/80 dark:bg-navy-900/80 backdrop-blur-sm border-b border-gold-100/50 dark:border-navy-700 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-gold-500 to-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-gold-500/20">
              <Shield size={18} />
            </div>
            <div>
              <span className="text-xs font-bold text-navy-500 dark:text-navy-400">
                التقدم: {toArabicDigits(completedIds.size)} / {toArabicDigits(adhkarList.length)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showKeyboardHint && !allCompleted && (
              <div className="hidden md:flex items-center gap-1.5 bg-navy-50 dark:bg-navy-800 border border-navy-200 dark:border-navy-700 px-2.5 py-1.5 rounded-xl shadow-sm">
                <kbd className="bg-white dark:bg-navy-900 text-navy-600 dark:text-navy-300 text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-navy-200 dark:border-navy-600 shadow-sm">Space</kbd>
                <span className="text-[10px] font-bold text-navy-400">للعد</span>
                <span className="text-navy-200 dark:text-navy-600">|</span>
                <kbd className="bg-white dark:bg-navy-900 text-navy-600 dark:text-navy-300 text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-navy-200 dark:border-navy-600 shadow-sm">↑↓</kbd>
                <span className="text-[10px] font-bold text-navy-400">للتنقل</span>
              </div>
            )}
            {/* ? Help button — desktop only */}
            <button
              onClick={() => setShowShortcutsPanel(true)}
              className="hidden md:flex w-7 h-7 items-center justify-center rounded-lg bg-navy-50 dark:bg-navy-800 border border-navy-200 dark:border-navy-700 text-navy-400 hover:text-gold-600 hover:border-gold-400 transition-all text-xs font-black shadow-sm"
              title="اختصارات لوحة المفاتيح"
            >؟</button>
            {allCompleted && (
              <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-2 rounded-xl text-white shadow-lg shadow-emerald-500/30">
                <CheckCircle2 size={16} />
                <span className="text-xs font-bold">أحسنت!</span>
              </div>
            )}
          </div>
        </div>
        <div className="h-2 bg-gold-100 dark:bg-navy-800 rounded-full overflow-hidden shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-gold-500 via-amber-500 to-emerald-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${(completedIds.size / adhkarList.length) * 100}%` }}
          />
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 md:space-y-6 pb-24 custom-scrollbar">
        {adhkarList.map((zekr, idx) => (
          <div key={zekr.id} id={`zekr-${zekr.id}`} className="rounded-3xl">
            <ZekrCard
              data={zekr}
              isFav={favIds.includes(zekr.id)}
              onToggleFav={onToggleFav}
              onComplete={handleComplete}
              onProgress={handleTapProgress}
              onDelete={category === "أذكاري الخاصة" ? () => onDeleteCustom(zekr.id) : undefined}
              onEdit={category === "أذكاري الخاصة" ? () => onEditCustom(zekr) : undefined}
              isKeyboardActive={idx === activeZekrIndex && isDesktopMode}
              onSpaceHandlerReady={(fn) => { if (idx === activeZekrIndex) spaceCountRef.current = fn; }}
              onResetHandlerReady={(fn) => { if (idx === activeZekrIndex) resetCountRef.current = fn; }}
              onCardClick={() => setActiveZekrIndex(idx)}
            />
          </div>
        ))}

        {allCompleted && (
          <CategoryCompletionCard onBack={onBack} />
        )}

        {/* Keyboard Shortcuts Panel */}
        {showShortcutsPanel && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm" onClick={() => setShowShortcutsPanel(false)}>
            <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-gold-100/50 dark:border-navy-700 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-lg text-navy-900 dark:text-white">⌨️ اختصارات لوحة المفاتيح</h3>
                <button onClick={() => setShowShortcutsPanel(false)} className="p-2 text-navy-400 hover:text-red-500"><X size={18} /></button>
              </div>
              <div className="space-y-3">
                {[
                  { key: 'Space / Enter / NumpadEnter', desc: 'عد الذكر النشط' },
                  { key: '↑ →', desc: 'الذكر السابق' },
                  { key: '↓ ←', desc: 'الذكر التالي' },
                  { key: 'R', desc: 'إعادة تعيين العداد' },
                  { key: 'Esc', desc: 'العودة للتصنيفات' },
                  { key: 'Esc / Enter', desc: 'إلغاء / تأكيد الخروج (عند التنبيه)' },
                  { key: '?', desc: 'فتح/إغلاق هذه القائمة' },
                ].map(({ key, desc }) => (
                  <div key={key} className="flex items-center justify-between gap-4 py-2 border-b border-navy-100 dark:border-navy-800 last:border-0">
                    <span className="text-sm text-navy-600 dark:text-navy-300">{desc}</span>
                    <kbd className="bg-navy-50 dark:bg-navy-800 text-navy-700 dark:text-navy-200 text-xs font-bold px-2.5 py-1 rounded-lg border border-navy-200 dark:border-navy-700 shadow-sm whitespace-nowrap">{key}</kbd>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Helper Padding at bottom */}
        <div className="h-8"></div>
      </div>

      {/* Professional Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl shadow-navy-950/50 border border-gold-100/50 dark:border-navy-700 transform scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              {/* Warning Icon */}
              <div className="w-18 h-18 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/30 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-amber-500/20 p-4">
                <AlertTriangle size={36} className="text-amber-600 dark:text-amber-400" />
              </div>

              <h3 className="text-xl font-bold text-navy-900 dark:text-white mb-3">
                ⚠️ تنبيه الخروج
              </h3>

              <p className="text-sm text-navy-600 dark:text-navy-300 mb-6 leading-relaxed bg-amber-50/80 dark:bg-amber-900/20 px-4 py-3 rounded-xl border border-amber-100/50 dark:border-amber-700/30">
                لم تكمل قراءة الورد كاملاً.
                <br />
                <span className="text-amber-600 dark:text-amber-400 font-bold">سيتم فقدان تقدمك الحالي.</span>
              </p>

              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 py-4 bg-gradient-to-r from-gold-500 to-amber-500 hover:from-gold-600 hover:to-amber-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-gold-500/30 hover:shadow-xl hover:-translate-y-0.5"
                >
                  متابعة الأذكار ✓
                </button>
                <button
                  onClick={handleConfirmExit}
                  className="flex-1 py-4 bg-navy-50 dark:bg-navy-800 hover:bg-navy-100 dark:hover:bg-navy-700 text-navy-700 dark:text-navy-200 font-bold rounded-2xl transition-all border border-navy-100 dark:border-navy-700"
                >
                  خروج
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────────
// Burst Particles Component — shown on ZekrCard completion
// ────────────────────────────────────────────────────────────
const BURST_COLORS = ['#f59e0b','#10b981','#6366f1','#ef4444','#8b5cf6','#0ea5e9','#f97316','#14b8a6'];
const ZekrBurst: React.FC = () => (
  <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20 overflow-hidden rounded-3xl">
    {Array.from({ length: 8 }, (_, i) => (
      <div
        key={i}
        className="absolute w-2.5 h-2.5 rounded-full animate-burst-particle"
        style={{
          backgroundColor: BURST_COLORS[i % BURST_COLORS.length],
          ['--burst-angle' as string]: `${i * 45}deg`,
          animationDelay: `${i * 25}ms`,
        }}
      />
    ))}
  </div>
);

// ────────────────────────────────────────────────────────────
// ZekrCard — Interactive Dhikr Card
// ────────────────────────────────────────────────────────────
const COMPLETION_MESSAGES = [
  'أحسنتَ! 🌟', 'بارك الله فيك ✨', 'جزاك الله خيراً 💚',
  'ما شاء الله 🤲', 'تقبّل الله منك 🌙', 'الله يكتب لك أجره 🌿',
  'واصل ولا تتوقف 🏆', 'اللهم تقبّل 🤍',
];

const ZekrCard: React.FC<{
  data: Zekr;
  isFav: boolean;
  onToggleFav: (id: number) => void;
  onComplete?: (id: number) => void;
  onProgress?: (id: number) => void;
  onDelete?: () => void;
  onEdit?: () => void;
  isKeyboardActive?: boolean;
  onSpaceHandlerReady?: (fn: (id: number) => void) => void;
  onResetHandlerReady?: (fn: () => void) => void;
  onCardClick?: () => void;
}> = React.memo(({ data, isFav, onToggleFav, onComplete, onProgress, onDelete, onEdit, isKeyboardActive, onSpaceHandlerReady, onResetHandlerReady, onCardClick }) => {
  const target = parseInt(data.count) || 1;
  const [count, setCount]         = useState(0);
  const [isPressed, setIsPressed] = useState(false);
  const [showBurst, setShowBurst] = useState(false);
  const [countKey, setCountKey]   = useState(0);   // retriggers count-pop animation
  const [glowing,  setGlowing]    = useState(false);
  const completed = count >= target;
  const { fontSize } = useSettings();
  const pressRef = useRef<ReturnType<typeof setTimeout>>();

  // Smart text cleaner + Allah diacritics restoration + Comma formatting
  const cleanText = useCallback((text: string): React.ReactNode => {
    const cleaned = cleanDhikrText(text);
    const parts = cleaned.split('،');
    if (parts.length === 1) return cleaned;

    return (
      <>
        {parts.map((part, index) => (
          <React.Fragment key={index}>
            {part}
            {index < parts.length - 1 && (
              <span className="text-gold-600 dark:text-gold-400 mx-0.5" style={{ fontFamily: "'Amiri', 'Lateef', 'Times New Roman', serif", fontWeight: 'bold' }} dir="rtl">،</span>
            )}
          </React.Fragment>
        ))}
      </>
    );
  }, []);

  const completionMsg = COMPLETION_MESSAGES[data.id % COMPLETION_MESSAGES.length];
  const progressPercent = Math.min(100, (count / target) * 100);

  // SVG circular progress ring dimensions
  const RING_R = 24;
  const RING_C = 2 * Math.PI * RING_R;
  const ringOffset = RING_C * (1 - progressPercent / 100);
  const gradId = `zg-${data.id}`;

  const handleTap = useCallback(() => {
    if (onProgress) onProgress(data.id);
    if (completed) return;

    // Visual press feedback
    setIsPressed(true);
    clearTimeout(pressRef.current);
    pressRef.current = setTimeout(() => setIsPressed(false), 130);

    // Animate count badge
    setCountKey(k => k + 1);

    setCount(prev => {
      const next = prev + 1;
      // Haptic
      if (next >= target) hapticSuccess(); else hapticTap();
      if (next >= target) {
        setLastUsedZekrId(data.id);
        if (onComplete) onComplete(data.id);
        // Completion celebrations
        setShowBurst(true);
        setGlowing(true);
        setTimeout(() => setShowBurst(false), 700);
        setTimeout(() => setGlowing(false),   800);
      }
      return next;
    });
  }, [completed, target, data.id, onComplete, onProgress]);

  // Expose handleTap to parent for Space key support
  useEffect(() => {
    if (onSpaceHandlerReady) onSpaceHandlerReady(handleTap);
  }, [isKeyboardActive, handleTap, onSpaceHandlerReady]);

  // Expose reset handler for R key support
  const handleReset = useCallback(() => {
    setCount(0);
    setCountKey(k => k + 1);
    hapticTap();
  }, []);

  useEffect(() => {
    if (onResetHandlerReady) onResetHandlerReady(handleReset);
  }, [isKeyboardActive, handleReset, onResetHandlerReady]);

  // Cleanup timeout on unmount
  useEffect(() => () => { clearTimeout(pressRef.current); }, []);

  return (
    <div
      onClick={(e) => { if (onCardClick) onCardClick(); handleTap(); }}
      className={[
        'relative rounded-3xl transition-all duration-300 cursor-pointer select-none overflow-hidden border-2',
        completed
          ? 'bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/20 border-emerald-300 dark:border-emerald-700 shadow-xl shadow-emerald-500/10'
          : 'bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm border-gold-100 dark:border-navy-700 shadow-lg shadow-navy-900/5 dark:shadow-navy-950/30 hover:shadow-xl hover:shadow-gold-500/10 hover:border-gold-300 dark:hover:border-gold-600/50 animate-card-breathe',
        isPressed ? 'scale-[0.984]' : 'scale-100',
        glowing   ? 'animate-completion-glow' : '',
        isKeyboardActive && !completed ? 'ring-2 ring-gold-400 dark:ring-gold-500 ring-offset-2 dark:ring-offset-navy-950 animate-pulse-ring' : '',
      ].join(' ')}
    >
      {/* ── Completion confetti burst ── */}
      {showBurst && <ZekrBurst />}

      {/* ── Press ripple overlay ── */}
      {isPressed && (
        <div className="absolute inset-0 pointer-events-none rounded-3xl bg-gold-300/10 dark:bg-gold-400/5 animate-ping-once z-10" />
      )}

      {/* ── Subtle emerald overlay when done ── */}
      {completed && (
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-green-500/5 pointer-events-none" />
      )}

      {/* ── Bottom Progress Bar ── */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gold-100/50 dark:bg-navy-800/50 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ease-out ${completed ? 'bg-gradient-to-r from-emerald-500 to-green-500' : 'bg-gradient-to-r from-gold-500 to-amber-500'}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* ══════════════ HEADER ══════════════ */}
      <div className="flex justify-between items-center px-4 md:px-6 pt-5 mb-2 relative z-10">

        {/* Left: action buttons */}
        <div className="flex gap-2">
          <button
            onClick={e => { e.stopPropagation(); onToggleFav(data.id); }}
            className={`p-2.5 rounded-xl transition-all shadow-sm border ${
              isFav
                ? 'bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/30 dark:to-pink-900/20 text-rose-500 border-rose-200 dark:border-rose-700'
                : 'bg-gold-50/80 dark:bg-navy-800 text-navy-400 border-gold-100/50 dark:border-navy-700 hover:text-rose-400'
            }`}
          >
            <Heart size={18} fill={isFav ? 'currentColor' : 'none'} />
          </button>
          {onEdit && (
            <button
              onClick={e => { e.stopPropagation(); onEdit(); }}
              className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-500 shadow-sm border border-blue-100 dark:border-blue-800"
            >
              <Edit2 size={18} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={e => { e.stopPropagation(); if (confirm('حذف الذكر؟')) onDelete(); }}
              className="p-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 shadow-sm border border-red-100 dark:border-red-800"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>

        {/* Right: Circular SVG Progress Ring + Count */}
        <div className="relative w-[72px] h-[72px] flex items-center justify-center shrink-0 group/circle select-none">
          {/* Glassmorphic background for the inner circle */}
          <div className="absolute inset-[3px] rounded-full bg-gradient-to-br from-gold-50/50 via-white/80 to-amber-50/30 dark:from-navy-850 dark:via-navy-900 dark:to-navy-950/80 backdrop-blur-sm border border-gold-200/20 dark:border-navy-800/40 shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),0_4px_12px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_4px_12px_rgba(0,0,0,0.3)] transition-transform duration-300 group-hover/circle:scale-105" />

          <svg
            className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none transition-transform duration-300 group-hover/circle:scale-105"
            viewBox="0 0 60 60"
          >
            {/* Track ring */}
            <circle
              cx="30" cy="30" r={RING_R}
              fill="none" stroke="currentColor" strokeWidth="3.5"
              className="text-gold-100/50 dark:text-navy-800/70"
            />
            {/* Progress ring */}
            <circle
              cx="30" cy="30" r={RING_R}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth="4"
              strokeDasharray={RING_C}
              strokeDashoffset={ringOffset}
              strokeLinecap="round"
              className="transition-all duration-500 ease-out drop-shadow-[0_2px_4px_rgba(245,158,11,0.15)] dark:drop-shadow-[0_3px_6px_rgba(0,0,0,0.4)]"
            />
            <defs>
              <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor={completed ? '#10b981' : '#F0CF85'} />
                <stop offset="100%" stopColor={completed ? '#059669' : '#C6AD73'} />
              </linearGradient>
            </defs>
          </svg>

          {/* Count display inside the ring */}
          <div
            key={countKey}
            className={`relative z-10 flex flex-col items-center justify-center leading-none transition-transform duration-300 group-hover/circle:scale-110 ${countKey > 0 ? 'animate-count-pop' : ''}`}
          >
            {completed ? (
              <div className="animate-check-bounce">
                <CheckCircle2 size={28} className="text-emerald-500 dark:text-emerald-400" />
              </div>
            ) : (
              <span className="text-xl font-extrabold text-navy-800 dark:text-white font-sans tracking-tight drop-shadow-sm tabular-nums">
                {toArabicDigits(count)}
              </span>
            )}
          </div>

          {/* Floating Target Badge (Capsule) at the bottom */}
          {!completed && (
            <div className="absolute -bottom-1 bg-gradient-to-r from-gold-400 to-amber-500 dark:from-[#C6AD73] dark:to-[#E5C07B] text-white text-[9px] font-black px-2 py-0.5 rounded-full border-2 border-white dark:border-navy-900 shadow-md flex items-center justify-center min-w-[22px] h-[16px] leading-none select-none animate-in zoom-in-50 duration-300">
              <span className="font-sans leading-none">{toArabicDigits(target)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════ BODY ══════════════ */}
      <div className="px-4 md:px-6 pb-7 text-center relative z-10">

        {/* Dhikr text */}
        <p
          className="font-quran text-navy-900 dark:text-white mb-5 leading-[2.5] text-center"
          style={{ fontSize: `${fontSize}px` }}
        >
          {cleanText(data.zekr)}
        </p>

        {/* Completion motivational message */}
        {completed && (
          <div className="mb-4 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/30 animate-msg-slide-up flex items-center justify-center gap-2">
            <CheckCircle2 size={15} />
            <span>{completionMsg}</span>
          </div>
        )}

        {/* Description / virtue */}
        {data.description && !completed && (
          <div className="flex gap-3 items-start text-right bg-gradient-to-r from-gold-50/80 to-amber-50/50 dark:from-navy-800/80 dark:to-navy-900/50 p-3.5 rounded-2xl border border-gold-100/50 dark:border-navy-700 mb-4 shadow-sm">
            <div className="w-5 h-5 bg-gradient-to-br from-gold-400 to-amber-400 rounded-md flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <Star size={10} className="text-white fill-white" />
            </div>
            <span className="text-xs font-bold text-navy-600 dark:text-navy-300 leading-relaxed">{data.description}</span>
          </div>
        )}

        {/* Footer: reference + tap hint */}
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-gold-100/50 dark:border-navy-700/60">
          <span className="text-[10px] font-medium text-navy-400 dark:text-navy-500 text-right leading-snug max-w-[60%]">
            {data.reference || 'مرجع غير محدد'}
          </span>
          {!completed ? (
            <span className="text-[11px] text-gold-600 dark:text-gold-400 animate-pulse font-bold bg-gold-50 dark:bg-gold-900/20 px-2.5 py-1 rounded-lg border border-gold-100 dark:border-gold-900/30 whitespace-nowrap">
              {isKeyboardActive ? '⌨️ Space للعد' : 'اضغط للعد 👆'}
            </span>
          ) : (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-lg border border-emerald-100 dark:border-emerald-900/30 whitespace-nowrap">
              ✓ مكتمل
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

const CategoryCompletionCard: React.FC<{
  onBack: () => void;
}> = ({ onBack }) => {
  return (
    <div id="completion-card" className="mt-8 md:mt-10 mb-4 relative rounded-3xl bg-gradient-to-b from-emerald-50/80 to-teal-50/50 dark:from-emerald-950/40 dark:to-teal-950/20 border-2 border-emerald-200/60 dark:border-emerald-800/50 shadow-2xl shadow-emerald-500/10 overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700">
      {/* Background patterns/glows */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400/10 dark:bg-emerald-500/5 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-400/10 dark:bg-teal-500/5 blur-3xl rounded-full pointer-events-none" />

      <div className="relative z-10 p-6 md:p-8 text-center flex flex-col items-center">
        {/* Celebration Icon */}
        <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-[2rem] flex items-center justify-center text-white mb-6 shadow-xl shadow-emerald-500/30 relative">
          <div className="absolute inset-0 bg-white/20 rounded-[2rem] animate-ping-once pointer-events-none" />
          <Sparkles size={40} className="drop-shadow-md" />
        </div>

        {/* Title */}
        <h2 className="text-2xl md:text-3xl font-bold text-emerald-800 dark:text-emerald-400 mb-3 drop-shadow-sm">
          تقبل الله طاعتكم
        </h2>
        <p className="text-sm md:text-base font-bold text-emerald-600/90 dark:text-emerald-300/80 mb-8 max-w-sm leading-relaxed">
          أتممت قراءة ورد الأذكار كاملاً بنجاح، أسأل الله أن يكتب لك الأجر والثواب.
        </p>

        {/* Sunnah Dua */}
        <div className="bg-white/80 dark:bg-navy-900/80 backdrop-blur-md rounded-2xl p-6 md:p-8 mb-8 border border-emerald-100 dark:border-emerald-800/50 shadow-inner w-full relative group hover:shadow-md transition-all">
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-emerald-100 dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold px-4 py-1.5 rounded-full flex items-center gap-2 shadow-sm whitespace-nowrap">
             <BookOpen size={14} />
             <span>كفارة المجلس</span>
          </div>
          <p className="font-quran text-xl md:text-2xl text-navy-900 dark:text-white leading-[2.4] text-center mt-2">
            سُبْحَانَكَ اللَّهُمَّ وَبِحَمْدِكَ، أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا أَنْتَ، أَسْتَغْفِرُكَ وَأَتُوبُ إِلَيْكَ
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={onBack}
          className="w-full md:w-auto md:min-w-[250px] py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-base rounded-2xl transition-all shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:-translate-y-1 flex items-center justify-center gap-3 active:scale-95"
        >
          <span>العودة للتصنيفات</span>
          <Grid size={22} />
        </button>
      </div>
    </div>
  );
};

const AddZekrModal = ({ onClose, onSave, initialData }: any) => {
  const [text, setText] = useState(initialData?.zekr || '');
  const [count, setCount] = useState(initialData?.count || '1');
  const [description, setDescription] = useState(initialData?.description || '');
  const [reference, setReference] = useState(initialData?.reference || '');

  // Handle back button for modal
  useEffect(() => {
    window.history.pushState({ modal: 'add-zekr' }, '');
    const handlePopState = () => onClose();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [onClose]);

  const handleClose = () => {
    if (window.history.state?.modal === 'add-zekr') {
      window.history.back();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-white dark:bg-navy-900 rounded-3xl shadow-2xl shadow-navy-950/50 overflow-hidden border border-gold-100/50 dark:border-navy-700">
        {/* Header */}
        <div className="p-5 md:p-6 border-b border-gold-100/50 dark:border-navy-700 bg-gradient-to-r from-gold-50 to-amber-50 dark:from-navy-950 dark:to-navy-900 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-gold-500 to-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-gold-500/20">
              {initialData ? <Edit2 size={18} /> : <Plus size={18} />}
            </div>
            <h3 className="font-bold text-lg text-navy-900 dark:text-white">{initialData ? 'تعديل الذكر' : 'إضافة ذكر جديد'}</h3>
          </div>
          <button onClick={handleClose} className="p-2.5 bg-white dark:bg-navy-800 rounded-xl shadow-sm border border-gold-100/50 dark:border-navy-700 hover:shadow-md transition-all">
            <X size={20} className="text-navy-500 dark:text-navy-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => { e.preventDefault(); onSave({ zekr: text, count, description, reference }); }} className="p-5 md:p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gold-600 dark:text-gold-400 flex items-center gap-2">
              <BookOpen size={14} /> نص الذكر
            </label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} className="w-full p-4 rounded-2xl border-2 border-gold-100 dark:border-navy-700 bg-white dark:bg-navy-950 focus:border-gold-500 dark:focus:border-gold-500 outline-none h-28 font-quran text-lg shadow-sm transition-colors" placeholder="اكتب الذكر هنا..." required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gold-600 dark:text-gold-400">عدد التكرار</label>
              <input type="number" min="1" value={count} onChange={(e) => setCount(e.target.value)} className="w-full p-3 rounded-xl border-2 border-gold-100 dark:border-navy-700 bg-white dark:bg-navy-950 text-center font-bold focus:border-gold-500 outline-none shadow-sm transition-colors" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gold-600 dark:text-gold-400">المصدر</label>
              <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} className="w-full p-3 rounded-xl border-2 border-gold-100 dark:border-navy-700 bg-white dark:bg-navy-950 focus:border-gold-500 outline-none shadow-sm transition-colors" placeholder="البخاري، مسلم..." />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gold-600 dark:text-gold-400 flex items-center gap-2">
              <Star size={14} /> الفضل أو الملاحظة
            </label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-3 rounded-xl border-2 border-gold-100 dark:border-navy-700 bg-white dark:bg-navy-950 focus:border-gold-500 outline-none shadow-sm transition-colors" placeholder="أجر هذا الذكر..." />
          </div>
          <button type="submit" className="w-full py-4 bg-gradient-to-r from-navy-800 to-navy-900 dark:from-gold-500 dark:to-amber-500 text-white dark:text-navy-900 font-bold rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all">
            حفظ الذكر ✓
          </button>
        </form>
      </div>
    </div>
  );
};