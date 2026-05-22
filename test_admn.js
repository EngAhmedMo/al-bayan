const fetch = globalThis.fetch;
async function extractStream() {
    try {
        const res = await fetch('https://www.admn.ae/ar/brand/4197608/%D8%A5%D8%B0%D8%A7%D8%B9%D8%A9-%D8%A7%D9%84%D9%82%D8%B1%D8%A2%D9%86-%D8%A7%D9%84%D9%83%D8%B1%D9%8A%D9%85');
        const text = await res.text();
        const urls = text.match(/https?:\/\/[^\s"'<>]+\.(m3u8|mp3|aac|stream)[^\s"'<>]*/gi);
        if (urls) {
            console.log('Found possible streams:', [...new Set(urls)]);
        } else {
            console.log('No direct stream URLs found ending in m3u8/mp3. Let us check for general streams or radiotime links.');
            const anyUrls = text.match(/https?:\/\/[^\s"'<>]+/gi);
            const suspicious = anyUrls ? anyUrls.filter(u => /radio|stream|live|audio/i.test(u)) : [];
            console.log('Suspicious URLs:', [...new Set(suspicious)]);
        }
    } catch(e) {
        console.log('FAILED:', e.message);
    }
}
extractStream();
