const fs = require('fs');
let code = fs.readFileSync('pages/TafsirReader.tsx', 'utf8');

// 1. Imports
code = code.replace(
  "import { ChevronRight, ChevronLeft, List, Plus, Minus, X, Book, RotateCcw, Search } from 'lucide-react';",
  "import { ChevronRight, ChevronLeft, List, Plus, Minus, X, Book, RotateCcw, Search } from 'lucide-react';\nimport { Virtuoso, VirtuosoHandle } from 'react-virtuoso';"
);

// 2. State
code = code.replace(
  "    const [displayCount, setDisplayCount] = useState(20);",
  "    const virtuosoRef = useRef<VirtuosoHandle>(null);"
);

// 3. Scroll logic
const scrollOld = code.substring(code.indexOf("    // Handle deep linking scroll and progressive rendering expansion"), code.indexOf("    // Handle smooth lazy loading on scroll"));
const scrollNew = `    // Handle deep linking scroll and highlighting
    useEffect(() => {
        if (currentSurahData && targetAyah && currentSurahNumber === targetSurah) {
            const index = currentSurahData.ayahs.findIndex((a: any) => a.numberInSurah === targetAyah);
            if (index !== -1) {
                setTimeout(() => {
                    virtuosoRef.current?.scrollToIndex({ index, align: 'center', behavior: 'smooth' });
                    setTimeout(() => {
                        const element = document.getElementById(\`ayah-\${targetAyah}\`);
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
    }, [currentSurahData, targetAyah, targetSurah, currentSurahNumber]);\n\n`;
code = code.replace(scrollOld, scrollNew);

const smoothScrollOld = code.substring(code.indexOf("    // Handle smooth lazy loading on scroll"), code.indexOf("    useEffect(() => {\n        const loadData"));
code = code.replace(smoothScrollOld, "");

code = code.replace("                        setDisplayCount(20);", "");
code = code.replace("                        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });", "                        virtuosoRef.current?.scrollToIndex({ index: 0, align: 'start' });");

// The Virtuoso replacement
const oldMainContent = `            {/* Main Content */}
            <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative scroll-smooth">`;
const newMainContent = `            {/* Main Content */}
            <div className="flex-1 relative">`;
code = code.replace(oldMainContent, newMainContent);

const versesStart = code.indexOf('                        {/* Verses List */}');
const contentEnd = code.indexOf('                    </div>\n                ) : null}');
const oldVersesBlock = code.substring(versesStart, contentEnd);

const virtuosoImplementation = `                        <div className="absolute inset-0">
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
                                                    className={\`flex items-center justify-between gap-3 p-4 rounded-2xl border transition-all group \${currentSurahNumber >= 114
                                                        ? 'opacity-50 cursor-not-allowed border-transparent bg-gray-100 dark:bg-navy-900 text-gray-400'
                                                        : 'border-navy-100 dark:border-navy-800 bg-white dark:bg-navy-900 hover:border-gold-400 dark:hover:border-gold-500 hover:shadow-lg hover:-translate-y-1'
                                                        }\`}
                                                >
                                                    <div className="w-10 h-10 rounded-full bg-navy-50 dark:bg-navy-800 flex items-center justify-center group-hover:bg-gold-500 group-hover:text-white transition-colors">
                                                        <ChevronRight size={20} />
                                                    </div>
                                                    <div className="text-left flex-1">
                                                        <span className="block text-[10px] text-gray-400 font-bold uppercase">السورة التالية</span>
                                                        <span className="font-bold text-navy-800 dark:text-white truncate max-w-[100px]">
                                                            {currentSurahNumber < 114 ? \`سورة \${QURAN_CHAPTERS[currentSurahNumber]?.name_arabic}\` : 'النهاية'}
                                                        </span>
                                                    </div>
                                                </button>
                                                <button
                                                    onClick={handlePrevSurah}
                                                    disabled={currentSurahNumber <= 1}
                                                    className={\`flex items-center justify-between gap-3 p-4 rounded-2xl border transition-all group \${currentSurahNumber <= 1
                                                        ? 'opacity-50 cursor-not-allowed border-transparent bg-gray-100 dark:bg-navy-900 text-gray-400'
                                                        : 'border-navy-100 dark:border-navy-800 bg-white dark:bg-navy-900 hover:border-gold-400 dark:hover:border-gold-500 hover:shadow-lg hover:-translate-y-1'
                                                        }\`}
                                                >
                                                    <div className="text-right flex-1">
                                                        <span className="block text-[10px] text-gray-400 font-bold uppercase">السورة السابقة</span>
                                                        <span className="font-bold text-navy-800 dark:text-white truncate max-w-[100px]">
                                                            {currentSurahNumber > 1 ? \`سورة \${QURAN_CHAPTERS[currentSurahNumber - 2]?.name_arabic}\` : 'البداية'}
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
                                        <div id={\`ayah-\${ayah.numberInSurah}\`} className="bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm p-5 md:p-8 rounded-3xl border border-gold-100/50 dark:border-navy-700 shadow-lg shadow-navy-900/5 dark:shadow-navy-950/30 hover:shadow-xl hover:shadow-gold-500/5 transition-all duration-300">
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
                                                    style={{ fontSize: \`\${fontSize * 1.5}px\` }}
                                                >
                                                    {quranVerseMap[ayah.numberInSurah]}
                                                </p>
                                            )}

                                            <div className="bg-gradient-to-br from-gold-50/80 to-amber-50/50 dark:from-navy-950/80 dark:to-navy-900/50 p-5 md:p-6 rounded-2xl border border-gold-100/50 dark:border-navy-700">
                                                <p
                                                    className="text-justify leading-[2.2] text-navy-800 dark:text-gray-200 font-quran"
                                                    style={{ fontSize: \`\${fontSize}px\` }}
                                                >
                                                    {ayah.text || 'لا يوجد تفسير متاح'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            />
                        </div>
`;

code = code.replace(oldVersesBlock, virtuosoImplementation);

// Remove the inline Title Header since it is now inside the Virtuoso Header
const oldHeader = code.substring(code.indexOf("                        {/* Title Header */}"), code.indexOf("                        <div className=\"absolute inset-0\">"));
code = code.replace(oldHeader, "");

fs.writeFileSync('pages/TafsirReader.tsx', code);
console.log('Successfully updated TafsirReader.tsx');
