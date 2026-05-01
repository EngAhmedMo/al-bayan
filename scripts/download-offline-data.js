import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../public/data');
const TAFSIR_DIR = path.join(DATA_DIR, 'tafsir');
const QURAN_DIR = path.join(DATA_DIR, 'quran');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(TAFSIR_DIR)) fs.mkdirSync(TAFSIR_DIR, { recursive: true });
if (!fs.existsSync(QURAN_DIR)) fs.mkdirSync(QURAN_DIR, { recursive: true });

const RESOURCES = [
    // 1. Tafsir Al-Jalalayn (Reliable API - Single File)
    {
        name: 'Tafsir Al-Jalalayn',
        type: 'single',
        url: 'http://api.alquran.cloud/v1/quran/ar.jalalayn',
        dest: path.join(TAFSIR_DIR, 'ar.jalalayn.json')
    },
    // 2. Tafsir Al-Muyassar (Reliable API - Single File)
    {
        name: 'Tafsir Al-Muyassar',
        type: 'single',
        url: 'http://api.alquran.cloud/v1/quran/ar.muyassar',
        dest: path.join(TAFSIR_DIR, 'ar.muyassar.json')
    },
    // 3. Tafsir Ibn Kathir (Fetched from spa5k/tafsir_api - 114 files merged)
    {
        name: 'Tafsir Ibn Kathir',
        type: 'multi-surah',
        slug: 'ar-tafsir-ibn-kathir',
        dest: path.join(TAFSIR_DIR, 'ar.ibn-kathir.json')
    },
    // 4. Tafsir Al-Tabari (Fetched from spa5k/tafsir_api - 114 files merged)
    {
        name: 'Tafsir Al-Tabari',
        type: 'multi-surah',
        slug: 'ar-tafsir-al-tabari',
        dest: path.join(TAFSIR_DIR, 'ar.tabari.json')
    },
    // 5. Tajweed Data (Hafs)
    {
        name: 'Tajweed Data (Hafs)',
        type: 'single',
        url: 'https://raw.githubusercontent.com/cpfair/quran-tajweed/master/output/tajweed.hafs.uthmani-pause-sajdah.json',
        dest: path.join(QURAN_DIR, 'tajweed.json')
    }
];

const downloadFile = (url, dest) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const protocol = url.startsWith('https') ? https : http;

        const request = protocol.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                file.close();
                downloadFile(response.headers.location, dest).then(resolve).catch(reject);
                return;
            }

            if (response.statusCode !== 200) {
                file.close();
                fs.unlink(dest, () => { });
                reject(new Error(`Status Code ${response.statusCode}`));
                return;
            }

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                resolve();
            });
        });

        request.on('error', (err) => {
            file.close();
            fs.unlink(dest, () => { });
            reject(err);
        });
    });
};

const fetchJson = (url) => {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        protocol.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
};

const processMultiSurahTafsir = async (resource) => {
    console.log(`[START] Processing ${resource.name} (Multi-file download)...`);

    // Check if destination exists
    if (fs.existsSync(resource.dest)) {
        const stats = fs.statSync(resource.dest);
        if (stats.size > 500000) { // > 500KB
            console.log(`[SKIP] ${resource.name} already exists.`);
            return;
        }
    }

    const mergedData = {
        code: 200,
        status: "OK",
        data: {
            surahs: []
        }
    };

    const baseUrl = `https://raw.githubusercontent.com/spa5k/tafsir_api/main/tafsir/${resource.slug}`;

    // Download 114 Surahs sequentially
    for (let i = 1; i <= 114; i++) {
        const url = `${baseUrl}/${i}.json`;
        process.stdout.write(`\rDownloading Surah ${i}/114...`);

        try {
            const surahData = await fetchJson(url);

            // Transform structure to match AlQuran Cloud format
            // spa5k: { ayahs: [ { ayuh: 1, text: "..." } ] }
            // Target: { number: 1, ayahs: [ { numberInSurah: 1, text: "..." } ] } (Simplified for our generic usage, mainly just need text per ayah)

            const transformedSurah = {
                number: i,
                ayahs: surahData.ayahs.map(a => ({
                    numberInSurah: a.ayah,
                    text: a.text // The Tafsir text
                }))
            };

            mergedData.data.surahs.push(transformedSurah);

        } catch (error) {
            console.error(`\n[ERROR] Failed to fetch Surah ${i} for ${resource.name}: ${error.message}`);
            // If a single surah fails, the whole file might be incomplete. 
            // ideally retry, but for now we skip.
        }
    }

    console.log(`\n[MERGE] Saving ${resource.name} to disk...`);
    fs.writeFileSync(resource.dest, JSON.stringify(mergedData, null, 2));
    console.log(`[DONE] ${resource.name} completed.`);
};

const run = async () => {
    console.log('--- Starting Offline Assets Download ---');

    for (const item of RESOURCES) {
        try {
            if (item.type === 'single') {
                // Check if exists
                if (fs.existsSync(item.dest) && fs.statSync(item.dest).size > 1000) {
                    console.log(`[SKIP] ${item.name} already exists.`);
                    continue;
                }
                console.log(`[START] Downloading ${item.name}...`);
                await downloadFile(item.url, item.dest);
                console.log(`[DONE] ${item.name} downloaded.`);
            } else if (item.type === 'multi-surah') {
                await processMultiSurahTafsir(item);
            }
        } catch (e) {
            console.error(`\n[ERROR] Failed ${item.name}: ${e.message}`);
        }
    }

    console.log('\n--- All operations completed ---');
};

run();
