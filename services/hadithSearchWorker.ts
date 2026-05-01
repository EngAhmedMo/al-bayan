import { searchAllHadiths } from './hadithApi';

self.onmessage = async (e: MessageEvent) => {
    const { id, query, maxResults } = e.data;

    try {
        const results = await searchAllHadiths(query, maxResults || 50);
        self.postMessage({ id, results, status: 'success' });
    } catch (error: any) {
        self.postMessage({ id, error: error.message, status: 'error' });
    }
};
