export {};
let cachedQuranData: any[] | null = null;

self.onmessage = async (e: MessageEvent) => {
    const { type, surahNumber, messageId } = e.data;

    if (type !== 'GET_SURAH_VERSES' || !surahNumber) {
        self.postMessage({ messageId, status: 'error', error: 'Invalid request' });
        return;
    }

    try {
        if (!cachedQuranData) {
            const response = await fetch(`${import.meta.env.BASE_URL}data/quran/hafsData_v2-0.json`);
            if (!response.ok) {
                throw new Error('Failed to fetch quran data');
            }
            cachedQuranData = await response.json();
        }

        const verseMap: Record<number, string> = {};
        
        if (cachedQuranData) {
            for (const row of cachedQuranData) {
                if (row.sura_no === surahNumber) {
                    verseMap[row.aya_no] = row.aya_text_emlaey || row.aya_text || '';
                }
            }
        }

        self.postMessage({ messageId, status: 'success', verseMap, surahNumber });
    } catch (error: any) {
        self.postMessage({ messageId, status: 'error', error: error.message });
    }
};
