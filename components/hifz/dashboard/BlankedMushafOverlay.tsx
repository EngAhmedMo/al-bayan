import React, { useState, useEffect, useRef } from 'react';
import { X, Eye, EyeOff, ChevronRight, ChevronLeft, Maximize2, Minimize2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toArabicDigits } from '../../../services/normalization';
import { getStaticPage } from '../../../services/quranStaticData';

// Framer Motion REMOVED - causing Android freeze

interface BlankedMushafOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    mushafPages: { page: number, ayahs: any[] }[];
    currentBlankedPageIndex: number;
    revealedAyahs: Set<number>;
    setRevealedAyahs: React.Dispatch<React.SetStateAction<Set<number>>>;
}

// --- Internal Error Boundary for Safety ---
class ErrorBoundary extends React.Component<{ children: React.ReactNode, fallback: React.ReactNode }, { hasError: boolean }> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError(error: any) {
        return { hasError: true };
    }
    componentDidCatch(error: any, errorInfo: any) {
        console.error("BlankedMushafOverlay Crash:", error, errorInfo);
    }
    render() {
        if (this.state.hasError) return this.props.fallback;
        return this.props.children;
    }
}

export const BlankedMushafOverlay: React.FC<BlankedMushafOverlayProps> = ({
    isOpen,
    onClose,
    mushafPages,
    currentBlankedPageIndex: initialIndex,
    revealedAyahs,
    setRevealedAyahs
}) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [localPages, setLocalPages] = useState(mushafPages);
    const [isLoading, setIsLoading] = useState(false);
    const [isFocusMode, setIsFocusMode] = useState(false);
    const [isVisible, setIsVisible] = useState(false); // For CSS transition
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Initialize state only once when opening, AND when mushafPages changes while open
    useEffect(() => {
        if (isOpen && mushafPages && mushafPages.length > 0) {
            console.log("[BlankedMushaf] Data received:", mushafPages.length, "pages");

            // Detailed diagnostic logging
            const firstPage = mushafPages[0];
            console.log("[BlankedMushaf] Diagnostic:", {
                pageNumber: firstPage?.page,
                ayahCount: firstPage?.ayahs?.length,
                firstAyahText: firstPage?.ayahs?.[0]?.aya_text?.substring(0, 50),
                hasText: !!firstPage?.ayahs?.[0]?.aya_text
            });

            setLocalPages(mushafPages);
            // Ensure index is valid
            if (initialIndex >= 0 && initialIndex < mushafPages.length) {
                setCurrentIndex(initialIndex);
            } else {
                setCurrentIndex(0);
            }
        }
    }, [isOpen, mushafPages]);

    // Trigger visibility animation after mount
    useEffect(() => {
        if (isOpen) {
            // Small delay to allow CSS transition to work
            const timer = setTimeout(() => setIsVisible(true), 50);
            return () => clearTimeout(timer);
        } else {
            setIsVisible(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // Safety: Ensure index is within bounds
    const safeIndex = Math.min(Math.max(0, currentIndex), Math.max(0, localPages.length - 1));
    const currentPageData = localPages[safeIndex];

    // Fallback UI
    const ErrorFallback = (
        <div className="fixed inset-0 z-[100] bg-[#FDFBF7] dark:bg-navy-950 flex flex-col items-center justify-center">
            <button onClick={onClose} className="absolute top-10 right-10 p-3 bg-red-100 rounded-full text-red-500 z-[120]">
                <X size={24} />
            </button>
            <div className="flex flex-col items-center gap-4 text-center p-6">
                <AlertTriangle size={48} className="text-red-500" />
                <p className="text-gray-500 font-bold">حدث خطأ غير متوقع في العرض.</p>
                <button onClick={onClose} className="px-6 py-2 bg-red-500 text-white rounded-xl font-bold">إغلاق</button>
            </div>
        </div>
    );

    // CRITICAL FIX: If no page data is available even after safety checks
    if (!currentPageData || !currentPageData.ayahs || currentPageData.ayahs.length === 0) {
        const isAwaitingData = localPages.length === 0;

        return (
            <div className="fixed inset-0 z-[100] bg-[#FDFBF7] dark:bg-navy-950 flex flex-col items-center justify-center">
                <button onClick={onClose} className="absolute top-10 left-10 p-2 bg-red-100/50 rounded-full text-red-500 z-[120]">
                    <X size={24} />
                </button>

                {isLoading || isAwaitingData ? (
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-gray-500 font-bold">جارٍ تحميل الصفحة...</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4 text-center p-6">
                        <AlertTriangle size={48} className="text-amber-500" />
                        <p className="text-gray-500 font-bold">عذراً، حدث خطأ في تحميل الصفحة.</p>
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-colors"
                        >
                            إغلاق
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // Get Surah Name safely
    const surahName = currentPageData.ayahs[0]?.surah?.name || 'القرآن الكريم';

    // Calculate Progress
    const pageAyahIds = currentPageData.ayahs.map((a: any) => a.number);
    const revealedCount = pageAyahIds.filter((id: number) => revealedAyahs.has(id)).length;
    const progressPercent = (revealedCount / pageAyahIds.length) * 100;
    const isPageCompleted = progressPercent === 100;

    // Navigation Handlers
    const handleNext = async () => {
        if (isLoading) return;
        setIsLoading(true);
        try {
            if (currentIndex < localPages.length - 1) {
                setCurrentIndex(prev => prev + 1);
            } else {
                const lastPage = localPages[localPages.length - 1].page;
                const nextPageNum = lastPage + 1;

                if (nextPageNum <= 604) {
                    const nextAyahs = await getStaticPage(nextPageNum);
                    if (nextAyahs && nextAyahs.length > 0) {
                        setLocalPages(prev => {
                            if (prev.some(p => p.page === nextPageNum)) return prev;
                            return [...prev, { page: nextPageNum, ayahs: nextAyahs }];
                        });
                        setCurrentIndex(prev => prev + 1);
                    } else {
                        console.warn("Next page data is empty");
                    }
                }
            }
        } catch (e) {
            console.error("Failed to load next page", e);
        } finally {
            setIsLoading(false);
            if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
        }
    };

    const handlePrev = async () => {
        if (isLoading) return;
        setIsLoading(true);
        try {
            if (currentIndex > 0) {
                setCurrentIndex(prev => prev - 1);
            } else {
                const firstPage = localPages[0].page;
                const prevPageNum = firstPage - 1;

                if (prevPageNum >= 1) {
                    const prevAyahs = await getStaticPage(prevPageNum);
                    if (prevAyahs && prevAyahs.length > 0) {
                        setLocalPages(prev => {
                            if (prev.some(p => p.page === prevPageNum)) return prev;
                            return [{ page: prevPageNum, ayahs: prevAyahs }, ...prev];
                        });
                        setCurrentIndex(0);
                    }
                }
            }
        } catch (e) {
            console.error("Failed to load prev page", e);
        } finally {
            setIsLoading(false);
        }
    };

    // Force Scroll to Top on Index Change
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [currentIndex]);

    const toggleAyah = (id: number) => {
        setRevealedAyahs(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
        if (navigator.vibrate) navigator.vibrate(10);
    };

    const toggleAll = () => {
        const ids = currentPageData.ayahs.map((a: any) => a.number);
        const allRevealed = ids.every((id: number) => revealedAyahs.has(id));

        setRevealedAyahs(prev => {
            const next = new Set(prev);
            ids.forEach((id: number) => {
                if (allRevealed) next.delete(id);
                else next.add(id);
            });
            return next;
        });
    };

    const [touchStart, setTouchStart] = useState<{ x: number, y: number } | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchStart({
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY
        });
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!touchStart || isLoading) return;

        const touchEnd = {
            x: e.changedTouches[0].clientX,
            y: e.changedTouches[0].clientY
        };

        const diffX = touchEnd.x - touchStart.x;
        const diffY = touchEnd.y - touchStart.y;

        if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX < 0) {
                // Swipe Left -> Previous Page
                handlePrev();
            } else {
                // Swipe Right -> Next Page
                handleNext();
            }
        }
        setTouchStart(null);
    };

    return (
        <ErrorBoundary fallback={ErrorFallback}>
            <div className={`fixed inset-0 z-[100] bg-[#FDFBF7] dark:bg-navy-950 flex flex-col transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>

                {/* Top Bar - Pure CSS, NO Framer Motion */}
                {!isFocusMode && (
                    <div className="absolute top-0 left-0 right-0 z-50 p-4 flex items-center justify-between pointer-events-none transition-transform duration-300">
                        <div className="pointer-events-auto flex items-center gap-3 bg-white dark:bg-navy-900 px-4 py-2 rounded-2xl border border-gray-200 dark:border-navy-700">
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-navy-800 text-gray-400 hover:text-red-500 transition-colors">
                                <X size={20} />
                            </button>
                            <div className="h-6 w-px bg-gray-200 dark:bg-navy-700 mx-2"></div>
                            <div className="flex flex-col">
                                <span className="font-bold text-sm text-navy-800 dark:text-white leading-none">
                                    سورة {surahName}
                                </span>
                                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold mt-1">
                                    صفحة {toArabicDigits(currentPageData.page)}
                                </span>
                            </div>
                        </div>

                        <div className="pointer-events-auto bg-white dark:bg-navy-900 p-2 rounded-2xl border border-gray-200 dark:border-navy-700 flex gap-2">
                            <button
                                onClick={toggleAll}
                                className={`p-2.5 rounded-xl transition-all ${isPageCompleted
                                    ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                                    : 'bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-navy-700 hover:text-indigo-600'}`}
                            >
                                {isPageCompleted ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                            <button
                                onClick={() => setIsFocusMode(true)}
                                className="p-2.5 rounded-xl bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-navy-700 hover:text-indigo-600 transition-colors"
                            >
                                <Maximize2 size={20} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Exit Focus Mode Button - Pure CSS */}
                {isFocusMode && (
                    <button
                        onClick={() => setIsFocusMode(false)}
                        className="absolute top-6 right-6 z-50 p-3 rounded-full bg-black/5 hover:bg-black/10 text-gray-400 transition-all duration-300"
                    >
                        <Minimize2 size={24} />
                    </button>
                )}

                {/* Main Content Area */}
                <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-y-auto relative flex items-center justify-center py-20 px-2 md:px-0 scroll-smooth"
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    <div role="presentation" className="relative w-full max-w-2xl mx-auto my-auto min-h-[90vh] md:aspect-[1/1.4] transition-all duration-300">

                        {/* The Page Itself */}
                        <div
                            className="w-full h-full bg-white dark:bg-[#1a1a1a] shadow-lg rounded-[2px] relative overflow-hidden flex flex-col p-[20px] md:p-[40px] border border-gray-100 dark:border-navy-800"
                        >
                            {/* Inner Decorative Frame */}
                            <div className="absolute inset-3 border border-gray-900/10 dark:border-white/10 rounded-[1px] pointer-events-none"></div>
                            <div className="absolute inset-[14px] border border-gray-900/5 dark:border-white/5 rounded-[1px] pointer-events-none"></div>

                            {isLoading && (
                                <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/90 dark:bg-navy-900/90 transition-all duration-300">
                                    <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}

                            {/* Text Container */}
                            <div className="flex-1 w-full relative z-10 flex flex-col justify-start">
                                <div
                                    className="quran-text text-[22px] md:text-[28px] leading-[2.6] md:leading-[3.0] text-justify"
                                    style={{ textAlignLast: 'center' }}
                                    dir="rtl"
                                >
                                    {currentPageData.ayahs.map((ayah: any) => {
                                        const isRevealed = revealedAyahs.has(ayah.number);
                                        const sNum = ayah.surah?.number;
                                        const isFirstAyah = ayah.numberInSurah === 1;
                                        const showBismillah = isFirstAyah && sNum !== 1 && sNum !== 9;

                                        return (
                                            <React.Fragment key={ayah.number}>
                                                {showBismillah && (
                                                    <div className="w-full text-center my-4 opacity-90">
                                                        <span className="text-navy-900 dark:text-gray-100/90 text-[85%]">
                                                            بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                                                        </span>
                                                    </div>
                                                )}

                                                <span
                                                    onClick={() => toggleAyah(ayah.number)}
                                                    className={`
                                                    cursor-pointer select-none transition-all duration-300 ease-in-out inline px-1 rounded-[3px] decoration-clone box-decoration-clone leading-[2.8]
                                                    ${isRevealed
                                                            ? 'text-navy-900 dark:text-gray-100 bg-transparent'
                                                            : 'text-transparent bg-gray-200/80 dark:bg-navy-700/80 select-none'
                                                        }
                                                `}
                                                >
                                                    {ayah.aya_text || ayah.text || ayah.aya_text_emlaey || '...'}
                                                </span>

                                                {/* Ayah Marker */}
                                                <span className="inline-flex mx-1.5 align-middle select-none">
                                                    <span className="flex items-center justify-center w-[30px] h-[30px] border border-emerald-500/40 rounded-full bg-emerald-50/50 dark:bg-emerald-900/20 text-[11px] font-sans font-bold text-emerald-700 dark:text-emerald-400 pt-0.5">
                                                        {toArabicDigits(ayah.numberInSurah)}
                                                    </span>
                                                </span>
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Page Number */}
                            <div className="mt-8 text-center text-sm font-bold text-gray-400 dark:text-navy-600 font-sans">
                                {toArabicDigits(currentPageData.page)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Controls - Pure CSS, NO Framer Motion */}
                {!isFocusMode && (
                    <div className="absolute bottom-8 left-0 right-0 z-50 flex justify-center items-center gap-6 pointer-events-none transition-transform duration-300">
                        <button
                            onClick={handlePrev}
                            disabled={isLoading}
                            className="pointer-events-auto w-12 h-12 rounded-full bg-white dark:bg-navy-800 border-2 border-gray-100 dark:border-navy-700 flex items-center justify-center text-navy-600 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-navy-700 hover:text-emerald-600 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                        >
                            <ChevronRight size={24} />
                        </button>

                        <div className="pointer-events-auto bg-white dark:bg-navy-800 px-5 py-2.5 rounded-full border-2 border-gray-100 dark:border-navy-700 flex items-center gap-3 min-w-[140px]">
                            <div className="text-xs font-bold text-navy-400 dark:text-navy-500">الإنجاز</div>
                            <div className="flex-1 h-1.5 bg-gray-100 dark:bg-navy-900 rounded-full overflow-hidden w-24">
                                {/* Pure CSS Progress Bar - NO Framer Motion */}
                                <div
                                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500 ease-out"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 w-6 text-center">{Math.round(progressPercent)}%</span>
                        </div>

                        <button
                            onClick={handleNext}
                            disabled={isLoading}
                            className="pointer-events-auto w-12 h-12 rounded-full bg-white dark:bg-navy-800 border-2 border-gray-100 dark:border-navy-700 flex items-center justify-center text-navy-600 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-navy-700 hover:text-emerald-600 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                        >
                            <ChevronLeft size={24} />
                        </button>
                    </div>
                )}

                {/* Success Message - Pure CSS, NO Framer Motion */}
                {isPageCompleted && !isFocusMode && (
                    <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-fade-in">
                        <div className="bg-emerald-500 text-white px-5 py-2 rounded-full shadow-lg shadow-emerald-500/30 flex items-center gap-2 text-sm font-bold">
                            <CheckCircle2 size={18} />
                            <span>أحسنت! أتممت الصفحة</span>
                        </div>
                    </div>
                )}

            </div>
        </ErrorBoundary>
    );
};
