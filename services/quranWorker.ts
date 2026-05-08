export {};
let cachedQuranData: any[] | null = null;
let cachedQcfData: Record<string, string> | null = null;

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

        if (!cachedQcfData) {
            try {
                const qcfResponse = await fetch(`${import.meta.env.BASE_URL}data/quran/qcf_ayahs.json`);
                if (qcfResponse.ok) {
                    cachedQcfData = await qcfResponse.json();
                } else {
                    cachedQcfData = {};
                }
            } catch (err) {
                console.warn('Failed to load QCF data', err);
                cachedQcfData = {};
            }
        }

        // Return a map of ayah_no to an object containing text and qcf_text
        const verseMap: Record<number, { text: string; qcf_text?: string }> = {};
        
        if (cachedQuranData) {
            for (const row of cachedQuranData) {
                if (row.sura_no === surahNumber) {
                    const qcfKey = `${surahNumber}:${row.aya_no}`;
                    verseMap[row.aya_no] = {
                        text: row.aya_text_emlaey || row.aya_text || '',
                        qcf_text: cachedQcfData ? cachedQcfData[qcfKey] : undefined
                    };
                }
            }
        }

        self.postMessage({ messageId, status: 'success', verseMap, surahNumber });
    } catch (error: any) {
        self.postMessage({ messageId, status: 'error', error: error.message });
    }
};
