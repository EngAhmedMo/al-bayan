async function getStream(url) {
    const res = await fetch(url);
    const text = await res.text();
    const m3u8 = text.match(/https?:\/\/[^\s"'<>]+\.m3u8/i);
    const mp3 = text.match(/https?:\/\/[^\s"'<>]+\.mp3/i);
    const stream = text.match(/https?:\/\/[^\s"'<>]*(stream|live)[^\s"'<>]*/i);
    console.log("For URL", url, "\n  m3u8:", m3u8?.[0], "\n  mp3:", mp3?.[0], "\n  stream:", stream?.[0]);
}

async function main() {
    await getStream('https://radioarabic.org/qatar/quran-radio-qatar');
    await getStream('https://radioarabic.org/kuwait/quran-radio-kuwait');
    await getStream('https://radioarabic.org/uae/zayed-quran');
    await getStream('https://radioarabic.org/algeria/quran-radio-algeria');
    await getStream('https://radioarabic.org/saudi-arabia/quran-radio-saudi');
}
main();
