import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { toArabicDigits } from '../services/normalization';
import { loadTafsirSurah, getTafsirTitle } from '../services/tafsirService';
import { QURAN_CHAPTERS } from '../services/quranData';
import { SURAH_NAMES_TASHKEEL } from '../services/quranStaticData';
import { ChevronRight, ChevronLeft, List, Plus, Minus, X, Book, RotateCcw, Search } from 'lucide-react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';

export const TafsirReader: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    
    const targetSurah = searchParams.get('surah') ? parseInt(searchParams.get('surah')!, 10) : null;
    const targetAyah = searchParams.get('ayah') ? parseInt(searchParams.get('ayah')!, 10) : null;

    const [fontSize, setFontSize] = useState(() => {
        const savedSize = localStorage.getItem('tafsir_font_size');
        return savedSize ? parseInt(savedSize, 10) : 20;
    });
    const [currentSurahData, setCurrentSurahData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    
    const [currentSurahNumber, setCurrentSurahNumber] = useState(() => {
        if (targetSurah) return targetSurah;
        const saved = localStorage.getItem(`tafsir_last_surah_${slug}`);
        return saved ? parseInt(saved, 10) : 1;
    });
    
    // Quran verse text map: ayah number -> verse text (loaded from local quran file)
    const [quranVerseMap, setQuranVerseMap] = useState<Record<number, string>>({});

    const scrollRef = useRef<HTMLDivElement>(null);
    const virtuosoRef = useRef<VirtuosoHandle>(null);

    // Worker for background quran parsing
    const quranFilterWorkerRef = useRef<Worker | null>(null);

    // Web Worker for Search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        workerRef.current = new Worker(new URL('../services/tafsirSearchWorker.ts', import.meta.url), { type: 'module' });
        quranFilterWorkerRef.current = new Worker(new URL('../services/quranWorker.ts', import.meta.url), { type: 'module' });
        
        workerRef.current.onmessage = (e) => {
            const { results, status, error } = e.data;
            setIsSearching(false);
            if (status === 'success') {
                setSearchResults(results);
            } else {
                console.error('Search error:', error);
            }
        };

        return () => {
            workerRef.current?.terminate();
            quranFilterWorkerRef.current?.terminate();
        };
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        
        setIsSearching(true);
        workerRef.current?.postMessage({
            id: Date.now(),
            query: searchQuery,
            slug: slug || 'ar.muyassar'
        });
    };

    const handleResultClick = (surahNum: number, ayahNum: number) => {
        setIsSearchOpen(false);
        navigate(`/tafsir/${slug}?surah=${surahNum}&ayah=${ayahNum}`, { replace: true });
        setCurrentSurahNumber(surahNum);
    };

    // Save reading progress and font size
    useEffect(() => {
        localStorage.setItem(`tafsir_last_surah_${slug}`, currentSurahNumber.toString());
        localStorage.setItem('tafsir_font_size', fontSize.toString());
    }, [currentSurahNumber, slug, fontSize]);

    // Handle deep linking scroll and highlighting
    useEffect(() => {
        if (currentSurahData && targetAyah && currentSurahNumber === targetSurah) {
            const index = currentSurahData.ayahs.findIndex((a: any) => a.numberInSurah === targetAyah);
            if (index !== -1) {
                // Use a small timeout to let Virtuoso initialize if it hasn't
                setTimeout(() => {
                    virtuosoRef.current?.scrollToIndex({ index, align: 'center', behavior: 'smooth' });
                    
                    // Highlight the element
                    setTimeout(() => {
                        const element = document.getElementById(`ayah-${targetAyah}`);
                        if (element) {
                            element.classList.add('ring-2', 'ring-gold-500', 'bg-gold-50/50', 'dark:bg-gold-900/20');
                            setTimeout(() => {
                                element.classList.remove('ring-2', 'ring-gold-500', 'bg-gold-50/50', 'dark:bg-gold-900/20');
                            }, 3000);
                        }
                    }, 500);
                }, 100);
            }
        }
    }, [currentSurahData, targetAyah, targetSurah, currentSurahNumber]);


    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError(null);
            try {
                // Fetch tafsir chunk
                const tafsirPromise = loadTafsirSurah(slug || 'ar.muyassar', currentSurahNumber);
                
                // Fetch and filter Quran via Web Worker
                const quranVerseMapPromise = new Promise<Record<number, string>>((resolve, reject) => {
                    if (!quranFilterWorkerRef.current) {
                        reject('Worker not initialized');
                        return;
                    }
                    const messageId = Date.now() + Math.random();
                    const handleMessage = (e: MessageEvent) => {
                        if (e.data.messageId === messageId) {
                            quranFilterWorkerRef.current?.removeEventListener('message', handleMessage);
                            if (e.data.status === 'success') {
                                resolve(e.data.verseMap);
                            } else {
                                reject(e.data.error);
                            }
                        }
                    };
                    quranFilterWorkerRef.current.addEventListener('message', handleMessage);
                    quranFilterWorkerRef.current.postMessage({
                        type: 'GET_SURAH_VERSES',
                        surahNumber: currentSurahNumber,
                        messageId
                    });
                });
                
                const [data, verseMap] = await Promise.all([
                    tafsirPromise,
                    quranVerseMapPromise
                ]);
                
                if (data) {
                    setCurrentSurahData(data);
                    setQuranVerseMap(verseMap);
                    
                    // Don't reset scroll if we are navigating to a deep link target
                    if (!(targetAyah && currentSurahNumber === targetSurah)) {
                        virtuosoRef.current?.scrollToIndex({ index: 0, align: 'start' });
                    }

                } else {
                    setError('لم يتم العثور على البيانات');
                }
            } catch (err) {
                console.error("Tafsir load error", err);
                setError('تعذر تحميل التفسير. تأكد من اتصالك بالإنترنت.');
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [slug, currentSurahNumber]);

    const handleNextSurah = () => {
        if (currentSurahNumber < 114) {
            setCurrentSurahNumber(p => p + 1);
        }
    };

    const handlePrevSurah = () => {
        if (currentSurahNumber > 1) {
            setCurrentSurahNumber(p => p - 1);
        }
    };

    const jumpToSurah = (id: number) => {
        setCurrentSurahNumber(id);
        setIsSidebarOpen(false);
    };

    if (loading && !currentSurahData) {
        return (
            <div className="flex flex-col h-screen bg-gradient-to-b from-gold-50 via-white to-gold-50/30 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 items-center justify-center">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-gold-200 dark:border-gold-800 border-t-gold-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Book size={24} className="text-gold-500" />
                    </div>
                </div>
                <p className="mt-6 text-navy-600 dark:text-navy-300 font-bold text-lg">جاري فتح الكتاب...</p>
                <p className="text-xs text-navy-400 dark:text-navy-500 mt-1">يرجى الانتظار</p>
            </div>
        );
    }

    // Determine titles using service or fallback
    const bookTitle = getTafsirTitle(slug || '');

    return (
        <div className="flex flex-col h-screen bg-gradient-to-b from-gold-50/80 via-[#FAF9F6] to-gold-50/50 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 transition-colors duration-300 overflow-hidden">
            <TopBar
                title={bookTitle}
                showBack={true}
                onBack={() => navigate('/tafsir')}
                extra={
                    <div className="flex gap-2">
                        <button onClick={() => setIsSearchOpen(true)} className="p-2.5 text-navy-600 dark:text-navy-300 hover:bg-gold-100 dark:hover:bg-navy-800 rounded-xl transition-all border border-transparent hover:border-gold-200 dark:hover:border-navy-700 hover:shadow-sm" title="بحث في الكتاب"><Search size={18} /></button>
                        <button onClick={() => setFontSize(Math.min(fontSize + 2, 32))} className="p-2.5 text-navy-600 dark:text-navy-300 hover:bg-gold-100 dark:hover:bg-navy-800 rounded-xl transition-all border border-transparent hover:border-gold-200 dark:hover:border-navy-700 hover:shadow-sm" title="تكبير الخط"><Plus size={18} /></button>
                        <button onClick={() => setFontSize(Math.max(fontSize - 2, 14))} className="p-2.5 text-navy-600 dark:text-navy-300 hover:bg-gold-100 dark:hover:bg-navy-800 rounded-xl transition-all border border-transparent hover:border-gold-200 dark:hover:border-navy-700 hover:shadow-sm" title="تصغير الخط"><Minus size={18} /></button>
                        <button onClick={() => setIsSidebarOpen(true)} className="p-2.5 text-gold-600 dark:text-gold-400 bg-gradient-to-br from-gold-50 to-amber-50 dark:from-navy-800 dark:to-navy-900 hover:from-gold-100 hover:to-amber-100 dark:hover:from-navy-700 dark:hover:to-navy-800 rounded-xl border border-gold-200 dark:border-navy-700 shadow-sm transition-all hover:shadow-md" title="فهرس السور">
                            <List size={20} />
                        </button>
                    </div>
                }
            />

            {/* Sidebar Drawer */}
            {isSidebarOpen && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-navy-900/70 backdrop-blur-sm transition-opacity" onClick={() => setIsSidebarOpen(false)}></div>
                    <div className="relative w-80 md:w-96 h-full bg-white dark:bg-navy-950 shadow-2xl shadow-navy-950/50 animate-in slide-in-from-right duration-300 flex flex-col border-l border-gold-100/50 dark:border-navy-800">
                        <div className="p-4 md:p-5 border-b border-gold-100/50 dark:border-navy-800 bg-gradient-to-r from-gold-50 to-amber-50 dark:from-navy-900 dark:to-navy-950 flex justify-between items-center">
                            <h3 className="font-bold text-navy-800 dark:text-white flex items-center gap-3">
                                <div className="w-8 h-8 bg-gradient-to-br from-gold-500 to-amber-500 rounded-lg flex items-center justify-center text-white shadow-lg shadow-gold-500/20">
                                    <List size={16} />
                                </div>
                                <span>فهرس السور</span>
                            </h3>
                            <button onClick={() => setIsSidebarOpen(false)} className="p-2 rounded-xl hover:bg-gold-100 dark:hover:bg-navy-800 text-navy-500 dark:text-navy-400 transition-colors"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
                            {/* Quick Return to Fatihah Button */}
                            {currentSurahNumber !== 1 && (
                                <button
                                    onClick={() => jumpToSurah(1)}
                                    className="w-full mb-4 px-4 py-3.5 rounded-xl flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold shadow-lg shadow-emerald-500/30 hover:-translate-y-0.5 transition-all duration-300"
                                >
                                    <RotateCcw size={18} />
                                    <span>العودة السريعة لسورة الفاتحة</span>
                                </button>
                            )}
                            
                            {QURAN_CHAPTERS.map((surah) => (
                                <button
                                    key={surah.id}
                                    onClick={() => jumpToSurah(surah.id)}
                                    className={`w-full text-right px-4 py-3.5 rounded-xl flex items-center justify-between transition-all duration-300 group ${currentSurahNumber === surah.id
                                        ? 'bg-gradient-to-r from-gold-500 to-amber-500 text-white shadow-lg shadow-gold-500/30'
                                        : 'hover:bg-gold-50 dark:hover:bg-navy-900 text-navy-700 dark:text-navy-300 border border-transparent hover:border-gold-200/50 dark:hover:border-navy-700'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={`text-xs w-7 h-7 flex items-center justify-center rounded-lg font-sans font-bold ${currentSurahNumber === surah.id ? 'bg-white/20' : 'bg-gold-50 dark:bg-navy-800 text-gold-600 dark:text-gold-400'}`}>{toArabicDigits(surah.id)}</span>
                                        <span className="font-bold font-quran text-lg">سورة {surah.name_arabic}</span>
                                    </div>
                                    {currentSurahNumber === surah.id && <ChevronLeft size={18} className="text-white/80" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Search Modal */}
            {isSearchOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
                    <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsSearchOpen(false)}></div>
                    <div className="relative w-full max-w-2xl bg-white dark:bg-navy-900 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b border-gray-100 dark:border-navy-800 flex items-center justify-between">
                            <h3 className="font-bold text-navy-800 dark:text-white flex items-center gap-2">
                                <Search size={18} className="text-gold-500" />
                                <span>البحث في {bookTitle}</span>
                            </h3>
                            <button onClick={() => setIsSearchOpen(false)} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-navy-800 rounded-xl transition-colors"><X size={20} /></button>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-navy-950/50">
                            <form onSubmit={handleSearch} className="relative">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="ابحث عن آية أو كلمة في التفسير..."
                                    className="w-full bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-xl py-3 px-12 text-navy-800 dark:text-gray-100 focus:ring-2 focus:ring-gold-500 outline-none"
                                    autoFocus
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                                    <Search size={18} />
                                </div>
                                <button type="submit" disabled={isSearching} className="absolute left-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-gold-500 text-white rounded-lg text-sm font-bold disabled:opacity-50">
                                    {isSearching ? 'جاري...' : 'بحث'}
                                </button>
                            </form>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                            {isSearching ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <div className="w-10 h-10 border-4 border-gold-200 border-t-gold-500 rounded-full animate-spin mb-4"></div>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm">جاري البحث في {bookTitle}...</p>
                                </div>
                            ) : searchResults.length > 0 ? (
                                <div>
                                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-4 px-1">تم العثور على {searchResults.length} نتيجة</p>
                                    <div className="space-y-3">
                                        {searchResults.map((result, idx) => (
                                            <div 
                                                key={idx}
                                                onClick={() => handleResultClick(result.surah.number, result.ayah.numberInSurah)}
                                                className="p-4 bg-white dark:bg-navy-800 border border-gray-100 dark:border-navy-700 rounded-2xl cursor-pointer hover:border-gold-400 dark:hover:border-gold-500 hover:shadow-md transition-all group"
                                            >
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-xs font-bold bg-gold-50 dark:bg-gold-900/30 text-gold-700 dark:text-gold-400 px-2 py-1 rounded-md">
                                                        سورة {result.surah.name} - آية {result.ayah.numberInSurah}
                                                    </span>
                                                    <ChevronLeft size={16} className="text-gray-400 group-hover:text-gold-500 transition-colors" />
                                                </div>
                                                <p className="font-quran text-lg text-navy-900 dark:text-white mb-2 leading-loose text-center">{result.ayah.text}</p>
                                                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed bg-gray-50 dark:bg-navy-900/50 p-2 rounded-lg border border-dashed border-gray-200 dark:border-navy-700">{result.snippet}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : searchQuery && !isSearching ? (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-gray-50 dark:bg-navy-800 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                                        <Search size={24} />
                                    </div>
                                    <p className="text-gray-500 dark:text-gray-400">لم يتم العثور على نتائج مطابقة لـ "{searchQuery}"</p>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 relative">
                {/* Inline Loading Overlay for Surah Transitions */}
                {loading && currentSurahData && (
                    <div className="absolute inset-0 bg-white/80 dark:bg-navy-950/80 backdrop-blur-sm z-20 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-4 border-gold-200 dark:border-gold-800 border-t-gold-500 rounded-full animate-spin"></div>
                            <p className="text-navy-600 dark:text-navy-300 font-bold">جاري تحميل السورة...</p>
                        </div>
                    </div>
                )}
                {error ? (
                    <div className="flex flex-col h-full items-center justify-center text-center p-6">
                        <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-4">
                            <X size={32} className="text-red-500" />
                        </div>
                        <p className="text-red-500 font-bold text-lg mb-2">{error}</p>
                        <button onClick={() => window.location.reload()} className="px-6 py-3 bg-gradient-to-r from-navy-800 to-navy-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5">إعادة المحاولة</button>
                    </div>
                ) : currentSurahData ? (
                    <div className="h-full w-full">
                        <Virtuoso
                            ref={virtuosoRef}
                            style={{ height: '100%' }}
                            data={currentSurahData.ayahs}
                            initialTopMostItemIndex={targetAyah && currentSurahNumber === targetSurah ? Math.max(0, currentSurahData.ayahs.findIndex((a: any) => a.numberInSurah === targetAyah)) : 0}
                            components={{
                                Header: () => (
                                    <div className="max-w-3xl mx-auto px-4 md:px-6 lg:px-8">
                                        <div className="relative py-8 md:py-10 mb-8 text-center">
                                            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-gold-400 to-transparent opacity-60"></div>
                                            <div className="inline-block bg-white/80 dark:bg-navy-900/80 backdrop-blur-sm px-8 py-4 rounded-2xl relative z-10 border border-gold-200/50 dark:border-navy-700 shadow-lg shadow-gold-500/5">
                                                <span className="block text-xs font-bold text-gold-600 dark:text-gold-400 mb-2 tracking-widest uppercase">
                                                    {bookTitle}
                                                </span>
                                                <h1 className="font-quran text-3xl md:text-4xl text-navy-900 dark:text-white">
                                                    سُورَةُ {SURAH_NAMES_TASHKEEL[currentSurahNumber - 1]}
                                                </h1>
                                            </div>
                                        </div>
                                    </div>
                                ),
                                Footer: () => (
                                    <div className="max-w-3xl mx-auto px-4 md:px-6 lg:px-8 pb-24">
                                        <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-gray-200 dark:border-navy-800">
                                            <button
                                                onClick={handleNextSurah}
                                                disabled={currentSurahNumber >= 114}
                                                className={`flex items-center justify-between gap-3 p-4 rounded-2xl border transition-all group ${currentSurahNumber >= 114
                                                    ? 'opacity-50 cursor-not-allowed border-transparent bg-gray-100 dark:bg-navy-900 text-gray-400'
                                                    : 'border-navy-100 dark:border-navy-800 bg-white dark:bg-navy-900 hover:border-gold-400 dark:hover:border-gold-500 hover:shadow-lg hover:-translate-y-1'
                                                    }`}
                                            >
                                                <div className="w-10 h-10 rounded-full bg-navy-50 dark:bg-navy-800 flex items-center justify-center group-hover:bg-gold-500 group-hover:text-white transition-colors">
                                                    <ChevronRight size={20} />
                                                </div>
                                                <div className="text-left flex-1">
                                                    <span className="block text-[10px] text-gray-400 font-bold uppercase">السورة التالية</span>
                                                    <span className="font-bold text-navy-800 dark:text-white truncate max-w-[100px]">
                                                        {currentSurahNumber < 114 ? `سورة ${QURAN_CHAPTERS[currentSurahNumber]?.name_arabic}` : 'النهاية'}
                                                    </span>
                                                </div>
                                            </button>

                                            <button
                                                onClick={handlePrevSurah}
                                                disabled={currentSurahNumber <= 1}
                                                className={`flex items-center justify-between gap-3 p-4 rounded-2xl border transition-all group ${currentSurahNumber <= 1
                                                    ? 'opacity-50 cursor-not-allowed border-transparent bg-gray-100 dark:bg-navy-900 text-gray-400'
                                                    : 'border-navy-100 dark:border-navy-800 bg-white dark:bg-navy-900 hover:border-gold-400 dark:hover:border-gold-500 hover:shadow-lg hover:-translate-y-1'
                                                    }`}
                                            >
                                                <div className="text-right flex-1">
                                                    <span className="block text-[10px] text-gray-400 font-bold uppercase">السورة السابقة</span>
                                                    <span className="font-bold text-navy-800 dark:text-white truncate max-w-[100px]">
                                                        {currentSurahNumber > 1 ? `سورة ${QURAN_CHAPTERS[currentSurahNumber - 2]?.name_arabic}` : 'البداية'}
                                                    </span>
                                                </div>
                                                <div className="w-10 h-10 rounded-full bg-navy-50 dark:bg-navy-800 flex items-center justify-center group-hover:bg-gold-500 group-hover:text-white transition-colors">
                                                    <ChevronLeft size={20} />
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                )
                            }}
                            itemContent={(index, ayah: any) => (
                                <div className="max-w-3xl mx-auto px-4 md:px-6 lg:px-8 py-3 md:py-4">
                                    <div id={`ayah-${ayah.numberInSurah}`} className="bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm p-5 md:p-8 rounded-3xl border border-gold-100/50 dark:border-navy-700 shadow-lg shadow-navy-900/5 dark:shadow-navy-950/30 hover:shadow-xl hover:shadow-gold-500/5 transition-all duration-300">
                                        <div className="flex items-center gap-4 mb-6 pb-4 border-b border-dashed border-gold-100/50 dark:border-navy-700">
                                            <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-gold-50 to-amber-50 dark:from-gold-900/30 dark:to-amber-900/20 flex items-center justify-center text-gold-600 dark:text-gold-400 font-bold border border-gold-200/50 dark:border-gold-700/30 shadow-sm">
                                                <span className="font-sans text-lg md:text-xl">{toArabicDigits(ayah.numberInSurah)}</span>
                                            </div>
                                            <div className="flex-1">
                                                <span className="text-[10px] md:text-xs text-gold-600 dark:text-gold-400 font-bold uppercase tracking-wider bg-gold-50/80 dark:bg-gold-900/20 px-3 py-1 rounded-lg">الآية {toArabicDigits(ayah.numberInSurah)}</span>
                                            </div>
                                        </div>

                                        {quranVerseMap[ayah.numberInSurah] && (
                                            <p 
                                                className="font-quran text-center leading-[2.2] text-navy-900 dark:text-white mb-6 px-2 md:px-4 transition-all duration-300"
                                                style={{ fontSize: `${fontSize * 1.5}px` }}
                                            >
                                                {quranVerseMap[ayah.numberInSurah]}
                                            </p>
                                        )}

                                        <div className="bg-gradient-to-br from-gold-50/80 to-amber-50/50 dark:from-navy-950/80 dark:to-navy-900/50 p-5 md:p-6 rounded-2xl border border-gold-100/50 dark:border-navy-700">
                                            <p
                                                className="text-justify leading-[2.2] text-navy-800 dark:text-gray-200 font-quran"
                                                style={{ fontSize: `${fontSize}px` }}
                                            >
                                                {ayah.text || 'لا يوجد تفسير متاح'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        />
                    </div>
                ) : null}
            </div>
        </div>
    );
};
