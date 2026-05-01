const fs = require('fs');
let code = fs.readFileSync('pages/TafsirReader.tsx', 'utf8');

// 1. Replace Refs
code = code.replace(
  '    // Cache the full quran data in a ref to avoid re-fetching\n    const quranDataRef = useRef<any[] | null>(null);',
  '    // Worker for background quran parsing\n    const quranFilterWorkerRef = useRef<Worker | null>(null);'
);

// 2. Initialize the worker alongside search worker
const searchWorkerInitStr = `        workerRef.current = new Worker(new URL('../services/tafsirSearchWorker.ts', import.meta.url), { type: 'module' });`;
code = code.replace(
  searchWorkerInitStr,
  `        workerRef.current = new Worker(new URL('../services/tafsirSearchWorker.ts', import.meta.url), { type: 'module' });\n        quranFilterWorkerRef.current = new Worker(new URL('../services/quranWorker.ts', import.meta.url), { type: 'module' });`
);

const searchWorkerTermStr = `            workerRef.current?.terminate();`;
code = code.replace(
  searchWorkerTermStr,
  `            workerRef.current?.terminate();\n            quranFilterWorkerRef.current?.terminate();`
);

// 3. Rewrite loadData
const loadDataStart = code.indexOf('    useEffect(() => {\n        const loadData = async () => {');
const loadDataEnd = code.indexOf('    const handleNextSurah = () => {');
const oldLoadData = code.substring(loadDataStart, loadDataEnd);

const newLoadData = `    useEffect(() => {
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

`;
code = code.replace(oldLoadData, newLoadData);

fs.writeFileSync('pages/TafsirReader.tsx', code);
console.log('Successfully updated TafsirReader.tsx');
