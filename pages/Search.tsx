
import React, { useState, useContext, useEffect, useRef, useCallback } from 'react';
import { TopBar } from '../components/TopBar';
import { normalizeArabic, toArabicDigits } from '../services/normalization';
import { NavigationContext } from '../components/Layout';
import { Search as SearchIcon, ArrowUpLeft, BookOpen, AlertCircle, FileText, ChevronLeft, ArrowDownCircle, X, Sparkles, Clock, Trash2 } from 'lucide-react';
import { Surah, QuranSearchResult } from '../types';
import { fetchSurahs, searchQuranText, isStrictMatch } from '../services/api';
import { getSearchHistory, saveSearchQuery, removeSearchQuery, clearSearchHistory } from '../services/storage';
import { SURAH_START_PAGES } from '../services/quranStaticData';
import { useSearchParams } from 'react-router-dom';

export const Search: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<QuranSearchResult[]>([]);
  const [displayedResults, setDisplayedResults] = useState<QuranSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const { navigateToAyah } = useContext(NavigationContext);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const PAGE_SIZE = 20;

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSurahs().then(setSurahs);
    setRecentSearches(getSearchHistory('quran'));
  }, []);

  useEffect(() => {
    const savedStateStr = sessionStorage.getItem('search_state');
    if (savedStateStr && displayedResults.length > 0) {
      try {
        const savedState = JSON.parse(savedStateStr);
        if (savedState.query === query) {
          setTimeout(() => {
            const elId = `search-result-${savedState.selectedSurah}-${savedState.selectedAyah}`;
            const el = document.getElementById(elId);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.classList.add('ring-2', 'ring-gold-400', 'ring-opacity-50', 'bg-gold-50/20');
              setTimeout(() => {
                el.classList.remove('ring-2', 'ring-gold-400', 'ring-opacity-50', 'bg-gold-50/20');
              }, 3000);
            } else if (containerRef.current && savedState.scrollPos) {
              containerRef.current.scrollTo({ top: savedState.scrollPos, behavior: 'auto' });
            }
          }, 300);
        }
      } catch (e) {}
    }
  }, [displayedResults, query]);

  const performSearch = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setResults([]);
      setDisplayedResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const data = await searchQuranText(searchTerm);

      const sortedData = data.sort((a, b) => {
        if (a.matchType === 'exact' && b.matchType !== 'exact') return -1;
        if (b.matchType === 'exact' && a.matchType !== 'exact') return 1;
        if (a.surah.number !== b.surah.number) {
          return a.surah.number - b.surah.number;
        }
        return a.ayah.numberInSurah - b.ayah.numberInSurah;
      });

      setResults(sortedData);
      
      let loadedCount = PAGE_SIZE;
      const savedStateStr = sessionStorage.getItem('search_state');
      if (savedStateStr) {
        try {
          const savedState = JSON.parse(savedStateStr);
          if (savedState.query === searchTerm && savedState.loadedCount) {
            loadedCount = Math.max(PAGE_SIZE, savedState.loadedCount);
          }
        } catch (e) {}
      }
      
      setDisplayedResults(sortedData.slice(0, loadedCount));
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, []);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (query.trim().length > 1) {
      saveSearchQuery(query, 'quran');
      setRecentSearches(getSearchHistory('quran'));
      inputRef.current?.blur();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (val === '') {
      setHasSearched(false);
      setResults([]);
      setSearchParams({}, { replace: true });
      return;
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      setSearchParams({ q: val }, { replace: true });
      performSearch(val);
    }, 500);
  };

  const handleResultClick = (surahNum: number, ayahNum: number, pageNum: number) => {
    if (query.trim().length > 1) {
      saveSearchQuery(query, 'quran');
      setRecentSearches(getSearchHistory('quran'));
    }

    if (containerRef.current) {
      const stateToSave = {
        scrollPos: containerRef.current.scrollTop,
        loadedCount: displayedResults.length,
        query: query,
        selectedSurah: surahNum,
        selectedAyah: ayahNum
      };
      sessionStorage.setItem('search_state', JSON.stringify(stateToSave));
    }
    navigateToAyah(surahNum, ayahNum, pageNum > 0 ? pageNum : undefined);
  };

  const handleLoadMore = () => {
    setDisplayedResults(results.slice(0, displayedResults.length + PAGE_SIZE));
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setDisplayedResults([]);
    setHasSearched(false);
    setSearchParams({}, { replace: true });
    inputRef.current?.focus();
  };

  const matchedSurahs = query ? surahs.filter(s =>
    s.name.includes(query) ||
    s.number.toString() === query ||
    normalizeArabic(s.name).includes(normalizeArabic(query))
  ) : [];

  // Enhanced Highlighting with premium design
  const HighlightText = ({ text, term }: { text: string, term: string }) => {
    if (!term.trim()) return <>{text}</>;

    const normTerm = normalizeArabic(term);
    const termParts = normTerm.split(/\s+/).filter(t => t.length > 0);
    const words = text.split(' ');

    return (
      <span>
        {words.map((word, i) => {
          const isMatch = termParts.some(part => isStrictMatch(word, part));

          return (
            <React.Fragment key={i}>
              {isMatch ? (
                <mark className="relative inline-block mx-0.5 not-italic">
                  <span className="absolute inset-0 bg-gradient-to-b from-gold-300/80 to-amber-400/80 dark:from-gold-500/50 dark:to-amber-600/50 rounded-lg blur-[2px]"></span>
                  <span className="relative text-navy-950 dark:text-white font-bold px-1 py-0.5">{word}</span>
                </mark>
              ) : word}
              {' '}
            </React.Fragment>
          );
        })}
      </span>
    );
  };

  return (
    <div className="flex flex-col min-h-full bg-gradient-to-b from-stone-50 via-gold-50/30 to-stone-100 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 font-sans">
      <TopBar title="البحث في المصحف" showBack />

      <div ref={containerRef} className="flex-1 overflow-y-auto pb-24 custom-scrollbar">

        {/* Premium Search Header */}
        <div className="sticky top-0 z-30 bg-gradient-to-b from-stone-50 via-stone-50/98 to-stone-50/95 dark:from-navy-950 dark:via-navy-950/98 dark:to-navy-950/95 backdrop-blur-xl px-4 py-5 border-b border-stone-200/50 dark:border-navy-800 shadow-sm">
          <div className="relative max-w-2xl mx-auto">
            {/* Decorative Glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-gold-400/20 via-amber-300/10 to-gold-400/20 rounded-2xl blur-xl opacity-0 transition-opacity duration-500" style={{ opacity: query ? 0.6 : 0 }}></div>

            <form onSubmit={handleSearchSubmit} className="relative">
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={handleInputChange}
                placeholder="ابحث عن آية أو كلمة..."
                className="w-full h-14 pl-14 pr-14 rounded-2xl border-2 border-stone-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-navy-900 dark:text-white shadow-lg shadow-stone-200/50 dark:shadow-black/20 focus:border-gold-500 focus:shadow-gold-500/20 focus:ring-0 outline-none transition-all duration-300 text-lg font-bold placeholder:font-normal placeholder:text-stone-400 dark:placeholder:text-navy-500 [&::-webkit-search-cancel-button]:hidden"
                autoFocus={!initialQuery}
                enterKeyHint="search"
              />
              <button type="submit" className="absolute right-4 top-4">
                <div className="p-1 bg-gradient-to-br from-gold-500 to-amber-500 rounded-lg text-white shadow-sm">
                  <SearchIcon size={18} />
                </div>
              </button>
              {query && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute left-3 top-3 p-2 bg-stone-100 dark:bg-navy-800 text-stone-500 dark:text-navy-400 rounded-xl hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-all duration-200"
                >
                  <X size={18} />
                </button>
              )}
            </form>

          </div>
        </div>

        <div className="px-4 py-5 max-w-2xl mx-auto space-y-6">

          {/* Recent Searches */}
          {!query && recentSearches.length > 0 && (
            <div className="animate-in fade-in duration-300 bg-white/50 dark:bg-navy-900/50 backdrop-blur-sm p-4 rounded-3xl border border-stone-200/50 dark:border-navy-700/50">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2 text-stone-500 dark:text-navy-400">
                  <Clock size={16} />
                  <span className="text-sm font-bold">عمليات البحث الأخيرة</span>
                </div>
                <button 
                  onClick={() => {
                    clearSearchHistory('quran');
                    setRecentSearches([]);
                  }}
                  className="text-xs text-red-500 hover:text-red-600 dark:hover:text-red-400 transition-colors bg-red-50 dark:bg-red-900/20 px-2.5 py-1.5 rounded-lg"
                >
                  مسح السجل
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map(term => (
                  <div key={term} className="flex items-center bg-white dark:bg-navy-800 rounded-xl border border-stone-200 dark:border-navy-700 shadow-sm hover:shadow-md hover:border-gold-300 dark:hover:border-gold-600/50 transition-all overflow-hidden group">
                    <button
                      onClick={() => {
                        if (timeoutRef.current) clearTimeout(timeoutRef.current);
                        setQuery(term);
                        setSearchParams({ q: term }, { replace: true });
                        performSearch(term);
                      }}
                      className="px-3 py-2 text-xs font-bold text-stone-700 dark:text-stone-300 hover:text-gold-600 dark:hover:text-gold-400 transition-colors"
                    >
                      {term}
                    </button>
                    <button
                      onClick={() => {
                        removeSearchQuery(term, 'quran');
                        setRecentSearches(getSearchHistory('quran'));
                      }}
                      className="pr-1 pl-2 py-2 text-stone-300 hover:text-red-500 transition-colors"
                      title="إزالة"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loading State */}
          {isSearching && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="relative">
                <div className="absolute inset-0 bg-gold-400/30 rounded-full blur-xl animate-pulse"></div>
                <div className="relative w-20 h-20 bg-gradient-to-br from-gold-100 to-amber-100 dark:from-navy-800 dark:to-navy-700 rounded-full flex items-center justify-center shadow-lg">
                  <SearchIcon size={36} className="text-gold-600 dark:text-gold-400 animate-pulse" />
                </div>
              </div>
              <p className="text-stone-600 dark:text-navy-300 font-bold mt-6">جاري البحث في القرآن الكريم...</p>
              <p className="text-xs text-stone-400 dark:text-navy-500 mt-1">يرجى الانتظار</p>
            </div>
          )}

          {/* Results State */}
          {!isSearching && (query.trim() !== '') && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">

              {/* Surah Matches */}
              {matchedSurahs.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                      <BookOpen size={16} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="font-bold text-stone-800 dark:text-white text-sm">السور المطابقة</h3>
                    <span className="text-xs text-stone-400 dark:text-navy-500 bg-stone-100 dark:bg-navy-800 px-2 py-0.5 rounded-full">{toArabicDigits(matchedSurahs.length)}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {matchedSurahs.map(s => (
                      <button
                        key={s.number}
                        onClick={() => handleResultClick(s.number, 1, SURAH_START_PAGES[s.number] || 1)}
                        className="flex items-center justify-between p-4 bg-white dark:bg-navy-900 rounded-2xl border border-stone-200/80 dark:border-navy-700 hover:border-emerald-400 dark:hover:border-emerald-600/50 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300 group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/30 rounded-xl flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold group-hover:scale-110 transition-transform">
                            {toArabicDigits(s.number)}
                          </div>
                          <span className="text-base font-bold text-stone-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{s.name}</span>
                        </div>
                        <ChevronLeft size={20} className="text-stone-300 dark:text-navy-500 group-hover:text-emerald-500 group-hover:-translate-x-1 transition-all" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Ayah Results */}
              {displayedResults.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-gold-100 dark:bg-gold-900/30 rounded-xl">
                        <FileText size={16} className="text-gold-600 dark:text-gold-400" />
                      </div>
                      <h3 className="font-bold text-stone-800 dark:text-white text-sm">نتائج الآيات</h3>
                      <span className="text-xs text-stone-400 dark:text-navy-500 bg-stone-100 dark:bg-navy-800 px-2 py-0.5 rounded-full">{toArabicDigits(results.length)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-gold-600 dark:text-gold-400 bg-gold-50 dark:bg-gold-900/20 px-3 py-1.5 rounded-full border border-gold-200/50 dark:border-gold-800/30">
                      <Sparkles size={12} />
                      <span>بحث ذكي</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {displayedResults.map((res, idx) => (
                      <div
                        key={`${res.surah.number}-${res.ayah.number}-${idx}`}
                        id={`search-result-${res.surah.number}-${res.ayah.numberInSurah}`}
                        className="bg-white dark:bg-navy-900 rounded-3xl shadow-lg shadow-stone-200/50 dark:shadow-black/20 border border-stone-200/80 dark:border-navy-700 hover:border-gold-300 dark:hover:border-gold-600/50 transition-all duration-300 overflow-hidden group"
                      >
                        {/* Card Header */}
                        <div className="flex justify-between items-center px-5 py-3 bg-gradient-to-l from-stone-50 to-transparent dark:from-navy-800/50 dark:to-transparent border-b border-stone-100 dark:border-navy-800">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-stone-700 dark:text-stone-200 bg-gradient-to-br from-gold-100 to-amber-100 dark:from-gold-900/40 dark:to-amber-900/30 px-3 py-1.5 rounded-lg shadow-sm">
                              {res.surah.name}
                            </span>
                            <span className="text-xs text-stone-500 dark:text-navy-400 font-bold">
                              الآية {toArabicDigits(res.ayah.numberInSurah)}
                            </span>
                          </div>
                          <button
                            onClick={() => handleResultClick(res.surah.number, res.ayah.numberInSurah, res.ayah.page)}
                            className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-gold-500 to-amber-500 hover:from-gold-600 hover:to-amber-600 px-4 py-2 rounded-xl transition-all shadow-lg shadow-gold-500/20 group-hover:shadow-gold-500/40"
                          >
                            <span>اذهب للآية</span>
                            <ArrowUpLeft size={14} />
                          </button>
                        </div>

                        {/* Ayah Text - Mushaf Style */}
                        <div className="p-5 md:p-6">
                          <p className="font-quran text-xl sm:text-2xl md:text-[1.7rem] text-stone-900 dark:text-stone-100 leading-[2.4] sm:leading-[2.6] text-justify" dir="rtl">
                            <HighlightText text={res.ayah.text} term={query} />
                            <span className="inline-flex items-center justify-center w-7 h-7 mx-1 text-[10px] font-bold text-gold-700 dark:text-gold-400 bg-gold-100/50 dark:bg-gold-900/20 rounded-full border border-gold-200 dark:border-gold-800/30 font-sans align-middle">
                              {toArabicDigits(res.ayah.numberInSurah)}
                            </span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {displayedResults.length < results.length && (
                    <button
                      onClick={handleLoadMore}
                      className="w-full py-4 mt-6 bg-gradient-to-r from-stone-100 to-stone-200 dark:from-navy-800 dark:to-navy-800 text-stone-700 dark:text-stone-300 rounded-2xl font-bold flex items-center justify-center gap-2 hover:from-gold-100 hover:to-amber-100 dark:hover:from-gold-900/30 dark:hover:to-amber-900/20 hover:text-gold-700 dark:hover:text-gold-400 transition-all shadow-sm"
                    >
                      <ArrowDownCircle size={20} />
                      عرض المزيد ({toArabicDigits(results.length - displayedResults.length)})
                    </button>
                  )}
                </div>
              ) : (
                hasSearched && matchedSurahs.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="relative">
                      <div className="absolute inset-0 bg-stone-300/30 dark:bg-navy-700/50 rounded-full blur-xl"></div>
                      <div className="relative bg-gradient-to-br from-white to-stone-50 dark:from-navy-800 dark:to-navy-900 p-5 rounded-2xl shadow-lg">
                        <AlertCircle size={40} className="text-stone-400 dark:text-navy-500" />
                      </div>
                    </div>
                    <h3 className="text-base font-bold text-stone-700 dark:text-stone-300 mt-6">لم يتم العثور على نتائج</h3>
                    <p className="text-xs text-stone-500 dark:text-navy-400 mt-2 max-w-xs">جرب البحث بكلمات مختلفة أو تأكد من الإملاء الصحيح</p>
                  </div>
                )
              )}
            </div>
          )}

          {/* Empty State - Surah Index */}
          {!hasSearched && !query && (
            <div className="animate-in fade-in duration-500">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-gold-100 dark:bg-gold-900/30 rounded-xl">
                  <BookOpen size={16} className="text-gold-600 dark:text-gold-400" />
                </div>
                <h3 className="font-bold text-stone-800 dark:text-white text-sm">فهرس السور</h3>
                <span className="text-xs text-stone-400 dark:text-navy-500">(اضغط للانتقال)</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {surahs.map(s => (
                  <button
                    key={s.number}
                    onClick={() => handleResultClick(s.number, 1, SURAH_START_PAGES[s.number] || 1)}
                    className="flex items-center justify-between p-3 bg-white dark:bg-navy-900 rounded-xl border border-stone-200/80 dark:border-navy-700 hover:border-gold-400 dark:hover:border-gold-600/50 hover:shadow-md transition-all duration-200 group text-right"
                  >
                    <span className="text-sm font-bold text-stone-700 dark:text-stone-200 group-hover:text-gold-600 dark:group-hover:text-gold-400 transition-colors truncate">{s.name}</span>
                    <span className="text-xs text-stone-400 dark:text-navy-500 bg-stone-100 dark:bg-navy-800 px-1.5 py-0.5 rounded font-sans flex-shrink-0 ml-2">{s.number}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
