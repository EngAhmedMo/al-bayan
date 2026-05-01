/// <reference lib="webworker" />

import { searchAllHadiths } from './hadithApi';

// Type narrowing for the generic message event
self.onmessage = async (e: MessageEvent) => {
    const { query, maxResults, messageId } = e.data;
    
    if (!query) return;

    try {
        const results = await searchAllHadiths(query, maxResults);
        self.postMessage({ type: 'SUCCESS', results, messageId });
    } catch (error: any) {
        self.postMessage({ type: 'ERROR', error: error.message || 'Unknown error', messageId });
    }
};
