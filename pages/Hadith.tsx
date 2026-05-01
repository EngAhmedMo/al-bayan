import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Book, Bookmark, Filter, AlertCircle, ArrowRight, ChevronDown, X, Info, Loader2, Sparkles, FileText, Copy, Share2, Check, List, Clock } from 'lucide-react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { getBooks, fetchHadiths, getBookInfo, Hadith, SearchResult, normalizeArabic } from '../services/hadithApi';
import { toArabicDigits } from '../services/normalization';
import { isHadithBookmarked, toggleHadithBookmark, getHadithBookmarks, saveHadithReadingPosition, getHadithReadingPosition, getSearchHistory, saveSearchQuery, removeSearchQuery, clearSearchHistory } from '../services/storage';
import { HadithBookmark } from '../types';
import { Share } from '@capacitor/share';
import { isStrictMatch } from '../services/api';

const BOOKS = getBooks();
const HADITHS_PER_PAGE = 50;

export const HadithPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedBookId = searchParams.get('book');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Book Reading State
  const [allHadiths, setAllHadiths] = useState<Hadith[]>([]);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [bookmarkedHadiths, setBookmarkedHadiths] = useState<Set<string>>(new Set());

  // Search State
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    setRecentSearches(getSearchHistory('hadith'));
  }, []);

  // In-Book Search State
  const [inBookSearchQuery, setInBookSearchQuery] = useState('');
  const [showInBookSearch, setShowInBookSearch] = useState(false);

  // Chapters State
  const [showChapters, setShowChapters] = useState(false);
  const chapters = useMemo(() => {
    const uniqueChapters = new Set<string>();
    const result: { name: string; firstHadithId: string; count: number }[] = [];
    
    allHadiths.forEach(h => {
      if (h.chapter && !uniqueChapters.has(h.chapter)) {
        uniqueChapters.add(h.chapter);
        result.push({ name: h.chapter, firstHadithId: String(h.id || h.hadithnumber), count: 1 });
      } else if (h.chapter) {
        const chapter = result.find(c => c.name === h.chapter);
        if (chapter) chapter.count++;
      }
    });
    
    return result;
  }, [allHadiths]);

  // Navigation and Highlight State
  const [targetHadithId, setTargetHadithId] = useState<string | null>(searchParams.get('target'));
  const [highlightQuery, setHighlightQuery] = useState<string>('');

  // Sync state if URL changes
  useEffect(() => {
    const targetIdFromUrl = searchParams.get('target');
    if (targetIdFromUrl !== targetHadithId) {
      setTargetHadithId(targetIdFromUrl);
    }
  }, [searchParams]);

  // Decoupled scrolling and highlighting logic
  useEffect(() => {
    if (allHadiths.length > 0 && targetHadithId) {
      const targetIndex = allHadiths.findIndex((h) =>
        String(h.id) === targetHadithId || String(h.hadithnumber) === targetHadithId
      );
      
      if (targetIndex >= 0) {
        setTimeout(() => {
          virtuosoRef.current?.scrollToIndex({ index: targetIndex, align: 'center', behavior: 'smooth' });
          setTimeout(() => {
            const element = document.getElementById(`hadith-${targetHadithId}`);
            if (element) {
              element.classList.add('ring-4', 'ring-gold-400', 'ring-opacity-50');
              setTimeout(() => {
                element.classList.remove('ring-4', 'ring-gold-400', 'ring-opacity-50');
              }, 3000);
            }
          }, 500);
        }, 100);
      }
    }
  }, [allHadiths, targetHadithId]);

  // Scroll Position Preservation
  const scrollPositionRef = useRef<number>(0);
  const lastSelectedSearchResultRef = useRef<string | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Book Info Modal
  const [showBookInfo, setShowBookInfo] = useState(false);

  // Web Worker for Search
  const workerRef = useRef<Worker>();
  const latestSearchIdRef = useRef<number>(0);

  useEffect(() => {
    try {
      workerRef.current = new Worker(new URL('../services/search.worker.ts', import.meta.url), {
        type: 'module'
      });

      workerRef.current.onmessage = (e) => {
        const { type, results, error, messageId } = e.data;
        // Ignore stale results from older searches
        if (messageId !== latestSearchIdRef.current) return;

        if (type === 'SUCCESS') {
          setSearchResults(results);
          setShowSearchResults(true);
          setIsSearching(false);
        } else if (type === 'ERROR') {
          console.error('Worker Search error:', error);
          setIsSearching(false);
        }
      };

      workerRef.current.onerror = (err) => {
        console.error('Search Worker failed:', err);
        workerRef.current = undefined; // Mark as unavailable, fallback will be used
      };
    } catch (err) {
      console.warn('Web Worker not supported, using main-thread fallback.', err);
      workerRef.current = undefined;
    }

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Share and Copy State
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const navigate = useNavigate();

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error('Failed to copy text', e);
    }
  };

  const handleShare = async (text: string, bookName: string, hadithNumber: number) => {
    const shareText = `${text}\n\n[ ${bookName} - حديث رقم ${hadithNumber} ]\nتمت المشاركة من تطبيق البيان`;
    try {
      await Share.share({
        title: 'مشاركة حديث',
        text: shareText,
        dialogTitle: 'مشاركة الحديث عبر',
      });
    } catch (e) {
      console.error('Failed to share', e);
    }
  };

  const updateBookmarksSet = useCallback(() => {
    if (!selectedBookId) return;
    const list = getHadithBookmarks();
    const ids = list.filter(b => b.bookId === selectedBookId).map(b => b.hadithId);
    setBookmarkedHadiths(new Set(ids));
  }, [selectedBookId]);

  const handleToggleBookmark = (hadith: Hadith, hadithId: string) => {
    if (!selectedBookId) return;
    
    const bookInfo = BOOKS.find(b => b.id === selectedBookId);
    if (!bookInfo) return;

    const snippet = (hadith.arabic || hadith.text || '').substring(0, 100) + '...';
    
    toggleHadithBookmark({
      bookId: selectedBookId,
      hadithId: hadithId,
      bookName: bookInfo.name,
      chapterName: hadith.chapter,
      textSnippet: snippet,
      timestamp: Date.now()
    });
    
    updateBookmarksSet();
  };

  // If book is selected, fetch it
  useEffect(() => {
    if (selectedBookId) {
      loadBook(selectedBookId);
    } else {
      setAllHadiths([]);
      
      
      // We are returning to the main view
      if (searchQuery.trim().length >= 2 && searchResults.length > 0) {
        // Restore search results if they exist
        setShowSearchResults(true);
        // Restore scroll position for search results after render
        setTimeout(() => {
          if (lastSelectedSearchResultRef.current) {
            const elId = `search-result-${lastSelectedSearchResultRef.current}`;
            const el = document.getElementById(elId);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.classList.add('ring-2', 'ring-gold-400', 'ring-opacity-50', 'bg-gold-50/20');
              setTimeout(() => {
                el.classList.remove('ring-2', 'ring-gold-400', 'ring-opacity-50', 'bg-gold-50/20');
              }, 3000);
            } else if (listContainerRef.current) {
              listContainerRef.current.scrollTo({ top: scrollPositionRef.current, behavior: 'auto' });
            }
          } else if (listContainerRef.current) {
            listContainerRef.current.scrollTo({ top: scrollPositionRef.current, behavior: 'auto' });
          }
        }, 300);
      } else {
        // User requested: Always reset scroll to top when returning to library list
        if (listContainerRef.current) {
          listContainerRef.current.scrollTo(0, 0);
        }
        scrollPositionRef.current = 0;
      }
    }
  }, [selectedBookId]);

  const loadBook = async (id: string) => {
    setIsLoading(true);
    
    updateBookmarksSet();

    // Scroll to top when entering a book (unless navigating to specific hadith)
    if (!targetHadithId && listContainerRef.current) {
      listContainerRef.current.scrollTo(0, 0);
    }
    window.scrollTo(0, 0);

    try {
      const data = await fetchHadiths(id);
      setAllHadiths(data);

      // If there is NO target hadith, restore reading position
      if (!targetHadithId) {
        const pos = getHadithReadingPosition();
        if (pos && pos.bookId === id && pos.scrollPos) {
          if (pos.displayCount) {
            
          }
          setTimeout(() => {
            if (listContainerRef.current) {
              listContainerRef.current.scrollTo(0, pos.scrollPos || 0);
            }
          }, 300);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBookClick = (bookId: string) => {
    // Save scroll position before navigating
    if (listContainerRef.current) {
      scrollPositionRef.current = listContainerRef.current.scrollTop;
    }
    setSearchParams({ book: bookId });
  };

  const handleBack = () => {
    // Save reading position before leaving book
    if (selectedBookId && listContainerRef.current) {
      saveHadithReadingPosition({
        bookId: selectedBookId,
        scrollPos: listContainerRef.current.scrollTop,
        displayCount: HADITHS_PER_PAGE
      });
    }

    setSearchParams({});
    setAllHadiths([]);
    
    setTargetHadithId(null);
    setHighlightQuery('');
    setInBookSearchQuery('');
    setShowInBookSearch(false);
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchQuery.trim().length >= 2) {
      saveSearchQuery(searchQuery, 'hadith');
      setRecentSearches(getSearchHistory('hadith'));
    }
  };

  // Handle search result click - navigate to book and scroll to hadith
  const handleSearchResultClick = (result: SearchResult) => {
    if (searchQuery.trim().length >= 2) {
      saveSearchQuery(searchQuery, 'hadith');
      setRecentSearches(getSearchHistory('hadith'));
    }

    // Save scroll position before navigating to preserve it when returning
    if (listContainerRef.current) {
      scrollPositionRef.current = listContainerRef.current.scrollTop;
    }
    const hadithId = String(result.hadith.id || result.hadith.hadithnumber);
    lastSelectedSearchResultRef.current = `${result.bookId}-${hadithId}`;
    setTargetHadithId(hadithId);
    setHighlightQuery(searchQuery);
    setShowSearchResults(false);
    setSearchParams({ book: result.bookId });
  };

  // Reading position is managed differently with Virtuoso (omitted for performance)

  // Debounced search
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);

    if (query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce search
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      const searchId = Date.now();
      latestSearchIdRef.current = searchId;

      if (workerRef.current) {
        // Use Web Worker (non-blocking)
        workerRef.current.postMessage({ query, maxResults: 30, messageId: searchId });
      } else {
        // Fallback: main-thread search (blocking but functional)
        try {
          const { searchAllHadiths } = await import('../services/hadithApi');
          const results = await searchAllHadiths(query, 30);
          // Only apply if this is still the latest search
          if (latestSearchIdRef.current === searchId) {
            setSearchResults(results);
            setShowSearchResults(true);
          }
        } catch (e) {
          console.error('Fallback search error:', e);
        } finally {
          if (latestSearchIdRef.current === searchId) {
            setIsSearching(false);
          }
        }
      }
    }, 300);
  }, []);

  // Highlight matching text with colored markers - word-based accurate highlighting
  const highlightMatch = (text: string, query: string, createSnippet: boolean = true): React.ReactNode => {
    if (!query.trim() || !text) return text;

    const normalizedQuery = normalizeArabic(query.toLowerCase());
    const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);

    if (queryWords.length === 0) return text;

    // Split text into words while preserving positions
    // FIX: Included Harakat (\u064B-\u065F), Tatweel (\u0640), Dagger Alef (\u0670), Alef Wasla (\u0671)
    // so words with diacritics aren't split into disconnected letters.
    const wordRegex = /[\u0621-\u064A\u064B-\u065F\u0640\u0670\u0671\u0660-\u0669a-zA-Z0-9]+/g;
    const words: { word: string; start: number; end: number }[] = [];
    let match;

    while ((match = wordRegex.exec(text)) !== null) {
      words.push({
        word: match[0],
        start: match.index,
        end: match.index + match[0].length
      });
    }

    // Find matching word indices
    const matchedIndices = new Set<number>();

    // Check for exact phrase match first
    const normalizedText = normalizeArabic(text.toLowerCase());
    if (normalizedText.includes(normalizedQuery)) {
      const phraseStart = normalizedText.indexOf(normalizedQuery);
      const phraseEnd = phraseStart + normalizedQuery.length;

      let normalizedPos = 0;

      for (let i = 0; i < words.length; i++) {
        const wordNorm = normalizeArabic(words[i].word.toLowerCase());
        const wordNormStart = normalizedText.indexOf(wordNorm, normalizedPos);
        if (wordNormStart !== -1 && wordNormStart < phraseEnd && wordNormStart + wordNorm.length > phraseStart) {
          matchedIndices.add(i);
        }
        normalizedPos = wordNormStart + wordNorm.length;
      }
    }

    // Also check individual words using the same strict morphological logic as the search engine
    if (matchedIndices.size === 0 || matchedIndices.size < queryWords.length) {
      for (let i = 0; i < words.length; i++) {
        const wordNorm = normalizeArabic(words[i].word);

        for (const qWord of queryWords) {
          // Use the same prefix-stripping strict match logic as the search engine
          if (wordNorm === qWord || wordNorm.includes(qWord)) {
            matchedIndices.add(i);
            break;
          }
          // Strip longest-matching prefix and check
          const prefixes = ['وال', 'فال', 'بال', 'كال', 'لل', 'ول', 'فل', 'وب', 'وك', 'فس', 'وس', 'ال', 'و', 'ف', 'ب', 'ك', 'ل', 'س'];
          let stripped = wordNorm;
          for (const p of prefixes) {
            if (stripped.startsWith(p)) { stripped = stripped.slice(p.length); break; }
          }
          if (stripped === qWord || stripped.startsWith(qWord)) {
            matchedIndices.add(i);
            break;
          }
        }
      }
    }

    // Create snippet around first match
    let snippetStart = 0;
    let snippetEnd = createSnippet ? Math.min(300, text.length) : text.length;

    if (matchedIndices.size > 0 && createSnippet) {
      const firstMatchIdx = Math.min(...matchedIndices);
      const firstWord = words[firstMatchIdx];
      if (firstWord) {
        snippetStart = Math.max(0, firstWord.start - 60);
        snippetEnd = Math.min(text.length, firstWord.start + 240);
      }
    }

    // Build highlighted output
    const parts: React.ReactNode[] = [];
    let currentPos = snippetStart;

    // Filter words within snippet
    const snippetWords = words.filter(w => w.start >= snippetStart && w.end <= snippetEnd);

    if (createSnippet && snippetStart > 0) {
      parts.push(<span key="prefix">...</span>);
    }

    for (let i = 0; i < snippetWords.length; i++) {
      const wordInfo = snippetWords[i];
      const originalIdx = words.indexOf(wordInfo);
      const isMatched = matchedIndices.has(originalIdx);

      // Add text before this word
      if (wordInfo.start > currentPos) {
        parts.push(<span key={`gap-${i}`}>{text.slice(currentPos, wordInfo.start)}</span>);
      }

      // Add the word (highlighted or not)
      if (isMatched) {
        parts.push(
          <mark key={`match-${i}`} className="relative inline-block mx-0.5 not-italic">
            <span className="absolute inset-0 bg-gradient-to-b from-gold-300/80 to-amber-400/80 dark:from-gold-500/50 dark:to-amber-600/50 rounded-lg blur-[2px]"></span>
            <span className="relative text-navy-950 dark:text-white font-bold px-1 py-0.5">{wordInfo.word}</span>
          </mark>
        );
      } else {
        parts.push(<span key={`word-${i}`}>{wordInfo.word}</span>);
      }

      currentPos = wordInfo.end;
    }

    // Add remaining text
    if (currentPos < snippetEnd) {
      parts.push(<span key="suffix-text">{text.slice(currentPos, snippetEnd)}</span>);
    }

    if (createSnippet && snippetEnd < text.length) {
      parts.push(<span key="suffix">...</span>);
    }

    return <span>{parts}</span>;
  };
  const filteredInBookHadiths = inBookSearchQuery.trim()
    ? allHadiths.filter(h => {
        const text = normalizeArabic(h.arabic || h.text || '');
        const query = normalizeArabic(inBookSearchQuery);
        return text.includes(query) || (h.chapter && normalizeArabic(h.chapter).includes(query));
      })
    : allHadiths;

  const visibleHadiths = filteredInBookHadiths.slice(0, HADITHS_PER_PAGE);
  const hasMore = HADITHS_PER_PAGE < filteredInBookHadiths.length;
  const selectedBook = BOOKS.find(b => b.id === selectedBookId);
  const bookInfo = selectedBookId ? getBookInfo(selectedBookId) : null;

  // Filter books by search query (when not in search results mode)
  const filteredBooks = searchQuery && !showSearchResults
    ? BOOKS.filter(b => b.name.includes(searchQuery) || normalizeArabic(b.name).includes(normalizeArabic(searchQuery)))
    : BOOKS;

  return (
    <div className="flex flex-col min-h-full bg-gradient-to-b from-stone-50 via-gold-50/30 to-stone-100 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 transition-colors duration-500">

      {/* Header */}
      <header className="flex items-center gap-4 p-4 border-b border-gold-100/50 dark:border-navy-700 bg-white/80 dark:bg-navy-900/80 backdrop-blur-md sticky top-0 z-10 h-[70px] shadow-sm">
        {selectedBookId ? (
          <button onClick={handleBack} className="p-2.5 rounded-xl bg-white dark:bg-navy-800 border border-gold-200 dark:border-navy-700 hover:bg-gold-50 dark:hover:bg-navy-700 text-navy-600 dark:text-navy-300 transition-all shadow-sm">
            <ArrowRight size={20} />
          </button>
        ) : (
          <div className="w-12 h-12 bg-gradient-to-br from-gold-500 to-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-gold-500/20">
            <Book size={22} />
          </div>
        )}

        <div className="flex-1">
          <h1 className="text-xl font-bold text-navy-900 dark:text-white font-quran tracking-tight">
            {selectedBookId ? selectedBook?.name : 'المكتبة الحديثية'}
          </h1>
          <p className="text-xs text-gold-600 dark:text-gold-400 font-bold">
            {selectedBookId ? `${toArabicDigits(allHadiths.length)} حديث` : 'كتب السنة النبوية'}
          </p>
        </div>

        {/* Book Info and Search Buttons */}
        {selectedBookId && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowInBookSearch(!showInBookSearch)}
              className={`p-2.5 rounded-xl transition-all border shadow-sm hover:shadow-md ${
                showInBookSearch 
                  ? 'bg-gold-500 text-white border-gold-500' 
                  : 'bg-gradient-to-br from-gold-50 to-amber-50 dark:from-navy-800 dark:to-navy-900 text-gold-600 dark:text-gold-400 border-gold-200 dark:border-navy-700'
              }`}
            >
              <Search size={20} />
            </button>
            {chapters.length > 0 && (
              <button
                onClick={() => setShowChapters(true)}
                className="p-2.5 rounded-xl bg-gradient-to-br from-gold-50 to-amber-50 dark:from-navy-800 dark:to-navy-900 text-gold-600 dark:text-gold-400 border border-gold-200 dark:border-navy-700 shadow-sm hover:shadow-md transition-all"
                title="فهرس الأبواب"
              >
                <List size={20} />
              </button>
            )}
            {bookInfo && (
              <button
                onClick={() => setShowBookInfo(true)}
                className="p-2.5 rounded-xl bg-gradient-to-br from-gold-50 to-amber-50 dark:from-navy-800 dark:to-navy-900 text-gold-600 dark:text-gold-400 border border-gold-200 dark:border-navy-700 shadow-sm hover:shadow-md transition-all"
              >
                <Info size={20} />
              </button>
            )}
          </div>
        )}

        {!selectedBookId && (
          <button className="p-2.5 rounded-xl bg-white dark:bg-navy-800 border border-gold-200 dark:border-navy-700 text-navy-600 dark:text-navy-400 shadow-sm hover:shadow-md transition-all">
            <Filter size={20} />
          </button>
        )}
      </header>

      {/* Main Content */}
      <main ref={listContainerRef} className={`flex-1 flex flex-col relative ${selectedBookId ? 'overflow-hidden' : 'overflow-y-auto p-4 custom-scrollbar'}`}>

        {/* Book View */}
        {selectedBookId ? (
          <div className="flex-1 relative">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 h-full">
                <div className="relative">
                  <div className="w-14 h-14 border-4 border-gold-200 dark:border-gold-800 border-t-gold-500 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Book size={22} className="text-gold-500" />
                  </div>
                </div>
                <span className="mt-6 text-sm font-bold text-navy-500 dark:text-navy-400">جاري تحميل الكتاب...</span>
                <span className="text-xs text-navy-400 dark:text-navy-500 mt-1">يرجى الانتظار</span>
              </div>
            ) : (
              <div className="absolute inset-0">
                <Virtuoso
                  ref={virtuosoRef}
                  style={{ height: '100%' }}
                  data={filteredInBookHadiths}
                  initialTopMostItemIndex={targetHadithId ? Math.max(0, filteredInBookHadiths.findIndex((h) => String(h.id) === targetHadithId || String(h.hadithnumber) === targetHadithId)) : 0}
                  components={{
                    Header: () => (
                      <div className="max-w-3xl mx-auto px-4 space-y-5 pt-4">
                        {/* In-Book Search Bar */}
                        {showInBookSearch && (
                          <div className="relative mb-4 animate-in fade-in slide-in-from-top-2">
                            <input
                              type="text"
                              placeholder={`البحث داخل ${selectedBook?.name}...`}
                              value={inBookSearchQuery}
                              onChange={(e) => setInBookSearchQuery(e.target.value)}
                              className="w-full h-14 bg-white/90 dark:bg-navy-900/90 backdrop-blur-sm border-2 border-gold-200 dark:border-navy-700 focus:border-gold-500 rounded-2xl pr-12 pl-12 text-navy-900 dark:text-white font-bold placeholder:text-navy-300 dark:placeholder:text-navy-600 shadow-lg shadow-navy-900/5 transition-all outline-none"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gold-500">
                              <Search size={20} />
                            </div>
                            {inBookSearchQuery && (
                              <button
                                onClick={() => setInBookSearchQuery('')}
                                className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 bg-navy-50 dark:bg-navy-800 hover:bg-navy-100 dark:hover:bg-navy-700 rounded-xl transition-colors"
                              >
                                <X size={16} className="text-navy-400" />
                              </button>
                            )}
                          </div>
                        )}

                        {/* Progress Indicator */}
                        {filteredInBookHadiths.length > 0 && (
                          <div className="bg-white/90 dark:bg-navy-900/90 backdrop-blur-sm p-4 rounded-2xl border border-gold-100/50 dark:border-navy-700 flex items-center justify-between shadow-lg shadow-navy-900/5 mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-gold-500 to-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-gold-500/20">
                                <Book size={18} />
                              </div>
                              <span className="text-sm font-bold text-navy-600 dark:text-navy-300">
                                نتائج {toArabicDigits(filteredInBookHadiths.length)} حديث
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ),
                    Footer: () => (
                      <div className="pb-24 pt-12"></div>
                    )
                  }}
                  itemContent={(index, h) => {
                    const hadithId = String(h.id || h.hadithnumber || index);
                    const isTargetHadith = targetHadithId === hadithId;
                    return (
                      <div className="max-w-3xl mx-auto px-4 pb-6">
                        <div
                          id={`hadith-${hadithId}`}
                          className={`bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm p-5 md:p-6 rounded-3xl border shadow-lg shadow-navy-900/5 dark:shadow-navy-950/30 hover:shadow-xl transition-all duration-300 ${isTargetHadith ? 'border-gold-400 dark:border-gold-500 ring-2 ring-gold-400/50' : 'border-gold-100/50 dark:border-navy-700'}`}
                        >
                          <div className="flex justify-between items-start mb-4 pb-3 border-b border-gold-100/50 dark:border-navy-700">
                            <span className="text-xs font-bold text-gold-600 dark:text-gold-400 bg-gradient-to-r from-gold-50 to-amber-50 dark:from-gold-900/20 dark:to-amber-900/10 px-3 py-1.5 rounded-xl border border-gold-100/50 dark:border-gold-700/30">
                              حديث رقم {toArabicDigits(h.hadithnumber || index + 1)}
                            </span>
                            {h.grades && h.grades.length > 0 && (
                              <span className={`text-xs font-bold px-3 py-1.5 rounded-xl ${h.grades[0].grade.toLowerCase().includes('sahih') || h.grades[0].grade.includes('صحيح')
                                ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-700/30'
                                : h.grades[0].grade.toLowerCase().includes('hasan') || h.grades[0].grade.includes('حسن')
                                  ? 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-700/30'
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                                }`}>
                                {h.grades[0].grade}
                              </span>
                            )}
                          </div>
                          <p className="text-right font-quran text-xl md:text-2xl leading-[2.2] text-navy-800 dark:text-gray-100 mb-6" dir="rtl">
                            {highlightQuery 
                              ? highlightMatch(h.arabic || h.text || '', highlightQuery, false) 
                              : inBookSearchQuery 
                                ? highlightMatch(h.arabic || h.text || '', inBookSearchQuery, false)
                                : (h.arabic || h.text)}
                          </p>

                          {/* Chapter info */}
                          {h.chapter && (
                            <p className="text-xs text-gold-600 dark:text-gold-400 mb-4 bg-gold-50/80 dark:bg-gold-900/20 px-3 py-2 rounded-xl inline-block">
                              📖 {h.chapter}
                            </p>
                          )}

                          {/* Controls */}
                          <div className="flex gap-2 justify-end pt-4 border-t border-gold-100/50 dark:border-navy-700">
                            <button 
                              onClick={() => handleCopy(h.arabic || h.text || '', hadithId)}
                              className="p-2.5 rounded-xl bg-gold-50/80 dark:bg-navy-800 hover:bg-gold-100 dark:hover:bg-navy-700 text-navy-400 hover:text-gold-600 transition-all border border-gold-100/50 dark:border-navy-700"
                              title="نسخ الحديث"
                            >
                              {copiedId === hadithId ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                            </button>
                            
                            <button 
                              onClick={() => {
                                const bookName = BOOKS.find(b => b.id === selectedBookId)?.name || 'كتاب الحديث';
                                handleShare(h.arabic || h.text || '', bookName, index + 1);
                              }}
                              className="p-2.5 rounded-xl bg-gold-50/80 dark:bg-navy-800 hover:bg-gold-100 dark:hover:bg-navy-700 text-navy-400 hover:text-gold-600 transition-all border border-gold-100/50 dark:border-navy-700"
                              title="مشاركة الحديث"
                            >
                              <Share2 size={18} />
                            </button>

                            <button 
                              onClick={() => handleToggleBookmark(h, hadithId)}
                              className={`p-2.5 rounded-xl transition-all border ${
                                bookmarkedHadiths.has(hadithId)
                                  ? 'bg-gold-500 text-white border-gold-500 shadow-lg shadow-gold-500/30'
                                  : 'bg-gold-50/80 dark:bg-navy-800 hover:bg-gold-100 dark:hover:bg-navy-700 text-navy-400 hover:text-gold-600 border-gold-100/50 dark:border-navy-700'
                              }`}
                              title={bookmarkedHadiths.has(hadithId) ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                            >
                              <Bookmark size={18} fill={bookmarkedHadiths.has(hadithId) ? "currentColor" : "none"} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
              </div>
            )}
          </div>
        ) : (
          /* Library View */
          <div className="space-y-6 max-w-5xl mx-auto pb-24">

            {/* Search */}
            <form onSubmit={handleSearchSubmit} className="relative group">
              <input
                type="search"
                placeholder="ابحث في جميع الأحاديث والكتب..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full h-14 bg-white/90 dark:bg-navy-900/90 backdrop-blur-sm border-2 border-gold-100/50 dark:border-navy-700 focus:border-gold-500 rounded-2xl pr-14 pl-14 text-navy-900 dark:text-white font-bold placeholder:text-navy-300 dark:placeholder:text-navy-600 shadow-lg shadow-navy-900/5 transition-all outline-none"
                enterKeyHint="search"
              />
              <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-gradient-to-br from-gold-500 to-amber-500 rounded-lg flex items-center justify-center">
                <Search className="text-white" size={16} />
              </button>

              {/* Clear button */}
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setShowSearchResults(false);
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-navy-50 dark:bg-navy-800 hover:bg-navy-100 dark:hover:bg-navy-700 rounded-xl transition-colors"
                >
                  <X size={16} className="text-navy-400" />
                </button>
              )}

              {/* Loading indicator */}
              {isSearching && (
                <div className="absolute left-14 top-1/2 -translate-y-1/2">
                  <Loader2 size={18} className="text-gold-500 animate-spin" />
                </div>
              )}
            </form>

            {/* Recent Searches */}
            {!searchQuery && recentSearches.length > 0 && (
              <div className="animate-in fade-in duration-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-stone-500 dark:text-navy-400">
                    <Clock size={16} />
                    <span className="text-sm font-bold">عمليات البحث الأخيرة</span>
                  </div>
                  <button 
                    onClick={() => {
                      clearSearchHistory('hadith');
                      setRecentSearches([]);
                    }}
                    className="text-xs text-red-500 hover:text-red-600 dark:hover:text-red-400 transition-colors bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg"
                  >
                    مسح السجل
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mb-8">
                  {recentSearches.map(term => (
                    <div key={term} className="flex items-center bg-white dark:bg-navy-900 rounded-xl border border-stone-200 dark:border-navy-700 shadow-sm overflow-hidden group">
                      <button
                        onClick={() => handleSearch(term)}
                        className="px-3 py-2 text-xs font-bold text-stone-600 dark:text-navy-300 hover:text-gold-600 dark:hover:text-gold-400 transition-colors"
                      >
                        {term}
                      </button>
                      <button
                        onClick={() => {
                          removeSearchQuery(term, 'hadith');
                          setRecentSearches(getSearchHistory('hadith'));
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

            {/* Search Results */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-gold-100 dark:bg-gold-900/30 rounded-xl">
                      <FileText size={16} className="text-gold-600 dark:text-gold-400" />
                    </div>
                    <h3 className="font-bold text-stone-800 dark:text-white text-sm">نتائج البحث</h3>
                    <span className="text-xs text-stone-400 dark:text-navy-500 bg-stone-100 dark:bg-navy-800 px-2 py-0.5 rounded-full">
                      {toArabicDigits(searchResults.length)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-gold-600 dark:text-gold-400 bg-gold-50 dark:bg-gold-900/20 px-3 py-1.5 rounded-full border border-gold-200/50 dark:border-gold-800/30">
                      <Sparkles size={12} />
                      <span>بحث ذكي</span>
                    </div>
                    <button
                      onClick={() => {
                        setShowSearchResults(false);
                        setSearchQuery('');
                        setSearchResults([]);
                      }}
                      className="text-xs text-stone-500 dark:text-navy-400 font-bold hover:text-gold-600 dark:hover:text-gold-400 transition-colors"
                    >
                      عرض الكتب
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {searchResults.map((result, idx) => (
                    <div
                      key={`${result.bookId}-${result.hadith.id || idx}`}
                      id={`search-result-${result.bookId}-${result.hadith.id || result.hadith.hadithnumber}`}
                      onClick={() => handleSearchResultClick(result)}
                      className="bg-white dark:bg-navy-900 rounded-2xl border border-stone-200/80 dark:border-navy-700 hover:border-gold-300 dark:hover:border-gold-600/50 shadow-lg shadow-stone-200/50 dark:shadow-black/20 hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden group"
                    >
                      {/* Card Header */}
                      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-l from-stone-50 to-transparent dark:from-navy-800/50 dark:to-transparent border-b border-stone-100 dark:border-navy-800">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-stone-700 dark:text-stone-200 bg-gradient-to-br from-gold-100 to-amber-100 dark:from-gold-900/40 dark:to-amber-900/30 px-3 py-1.5 rounded-lg shadow-sm">
                            {result.bookName}
                          </span>
                          <span className="text-xs text-stone-500 dark:text-navy-400 font-bold">
                            حديث {toArabicDigits(result.hadith.hadithnumber || 0)}
                          </span>
                        </div>
                        <ArrowRight size={16} className="text-stone-300 dark:text-navy-500 group-hover:text-gold-500 group-hover:-translate-x-1 transition-all rtl:rotate-180" />
                      </div>

                      {/* Hadith Text */}
                      <div className="p-4">
                        <p className="font-quran text-base sm:text-lg text-stone-800 dark:text-stone-200 leading-[2.2] line-clamp-3" dir="rtl">
                          {highlightMatch(result.hadith.arabic || result.hadith.text || '', searchQuery)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No Search Results */}
            {showSearchResults && searchResults.length === 0 && searchQuery.length >= 2 && !isSearching && (
              <div className="text-center py-10 text-navy-400">
                <Search className="mx-auto mb-2 opacity-50" size={32} />
                <p>لا توجد نتائج لـ "{searchQuery}"</p>
              </div>
            )}

            {/* Books Grid */}
            {!showSearchResults && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                {filteredBooks.map(book => (
                  <div
                    key={book.id}
                    onClick={() => handleBookClick(book.id)}
                    className="bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm p-5 md:p-6 rounded-3xl border border-gold-100/50 dark:border-navy-700 hover:border-gold-400 dark:hover:border-gold-600/50 shadow-lg shadow-navy-900/5 dark:shadow-navy-950/30 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-gold-500/10 to-amber-500/5 rounded-br-full -translate-x-12 -translate-y-12 group-hover:scale-150 transition-transform duration-500"></div>

                    <div className="flex items-start justify-between relative z-10">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gold-50 to-amber-50 dark:from-navy-800 dark:to-navy-900 flex items-center justify-center text-gold-600 dark:text-gold-400 group-hover:from-gold-500 group-hover:to-amber-500 group-hover:text-white transition-all duration-300 shadow-sm group-hover:shadow-lg border border-gold-100/50 dark:border-navy-700">
                        <Book size={26} />
                      </div>
                      {/* Status Badge */}
                      <div className="flex gap-1">
                        {['bukhari', 'muslim'].includes(book.id) && (
                          <span className="text-xs font-bold bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/20 text-green-600 dark:text-green-400 px-3 py-1.5 rounded-xl border border-green-200 dark:border-green-700/30">صحيح</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 relative z-10">
                      <h3 className="font-bold text-lg text-navy-900 dark:text-white mb-2 group-hover:text-gold-600 dark:group-hover:text-gold-400 transition-colors">{book.name}</h3>
                      <p className="text-sm text-gold-600 dark:text-gold-400 font-bold bg-gold-50/80 dark:bg-gold-900/20 px-3 py-1.5 rounded-xl inline-block">{book.count.toLocaleString('ar-EG')} حديث</p>
                    </div>

                    <div className="mt-5 pt-4 border-t border-gold-100/50 dark:border-navy-700 flex items-center justify-between text-sm font-bold text-navy-400 group-hover:text-gold-600 dark:group-hover:text-gold-400 transition-colors">
                      <span>تصفح الكتاب</span>
                      <div className="w-8 h-8 bg-gold-50 dark:bg-navy-800 rounded-xl flex items-center justify-center group-hover:bg-gold-100 dark:group-hover:bg-navy-700 transition-colors">
                        <ArrowRight size={16} className="rtl:rotate-180" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}
      </main>

      {/* Book Info Modal */}
      {showBookInfo && bookInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm" onClick={() => setShowBookInfo(false)}></div>
          <div className="relative w-full max-w-md bg-white dark:bg-navy-900 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 border border-navy-100 dark:border-navy-700">
            {/* Header */}
            <div className="p-5 bg-gradient-to-br from-gold-500 to-amber-500 text-white">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold">{bookInfo.name}</h2>
                <button onClick={() => setShowBookInfo(false)} className="p-1 hover:bg-white/20 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <p className="text-sm opacity-90">{bookInfo.author}</p>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              <div>
                <h4 className="text-xs font-bold text-navy-400 mb-2">عن الكتاب</h4>
                <p className="text-sm text-navy-700 dark:text-navy-200 leading-relaxed">
                  {bookInfo.description}
                </p>
              </div>

              <div className="flex items-center justify-between p-3 bg-navy-50 dark:bg-navy-800 rounded-xl">
                <span className="text-sm text-navy-600 dark:text-navy-300">عدد الأحاديث</span>
                <span className="font-bold text-gold-600">{toArabicDigits(bookInfo.count)}</span>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                  <strong>تنويه:</strong> أعداد الأحاديث المعروضة تعتمد على أشهر طبعات التحقيق المعتمدة عند أهل العلم، وقد تختلف الأرقام باختلاف طريقة العدّ.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Chapters Drawer */}
      {showChapters && (
        <div className="fixed inset-0 z-50 flex justify-end bg-navy-900/50 backdrop-blur-sm transition-opacity" onClick={() => setShowChapters(false)}>
          <div className="w-full max-w-sm h-full bg-white dark:bg-navy-900 shadow-2xl animate-in slide-in-from-right-full flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gold-100/50 dark:border-navy-700 flex justify-between items-center bg-gold-50 dark:bg-navy-800">
              <h2 className="font-bold text-navy-900 dark:text-white flex items-center gap-2">
                <List size={20} className="text-gold-500" />
                فهرس الأبواب
              </h2>
              <button onClick={() => setShowChapters(false)} className="p-2 hover:bg-gold-100 dark:hover:bg-navy-700 rounded-xl transition-colors">
                <X size={20} className="text-navy-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {chapters.length > 0 ? chapters.map((c, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setTargetHadithId(c.firstHadithId);
                    
                    // We need to trigger the scrolling manually since targetHadithId effect only runs on load
                    const targetIndex = allHadiths.findIndex((h: Hadith) =>
                      String(h.id) === c.firstHadithId || String(h.hadithnumber) === c.firstHadithId
                    );
                    
                    if (targetIndex >= 0) {
                      virtuosoRef.current?.scrollToIndex({ index: targetIndex, align: 'center', behavior: 'smooth' });
                      setTimeout(() => {
                        const element = document.getElementById(`hadith-${c.firstHadithId}`);
                        if (element) {
                          element.classList.add('ring-4', 'ring-gold-400', 'ring-opacity-50');
                          setTimeout(() => {
                            element.classList.remove('ring-4', 'ring-gold-400', 'ring-opacity-50');
                          }, 3000);
                        }
                      }, 500);
                    }
                    setShowChapters(false);
                  }}
                  className="w-full text-right p-4 rounded-2xl border border-gold-100 dark:border-navy-700 hover:border-gold-300 dark:hover:border-gold-500 hover:bg-gold-50/50 dark:hover:bg-navy-800 transition-all flex justify-between items-center group"
                >
                  <span className="font-bold text-navy-800 dark:text-stone-200 group-hover:text-gold-600 dark:group-hover:text-gold-400 text-sm max-w-[80%] leading-relaxed">{c.name}</span>
                  <span className="text-xs bg-gold-100 dark:bg-navy-700 text-gold-600 dark:text-gold-400 px-2 py-1 rounded-lg mr-2 shrink-0">{c.count}</span>
                </button>
              )) : (
                <div className="text-center py-10 text-navy-400">
                  <p>لا يوجد تقسيم للأبواب في هذا الكتاب</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
