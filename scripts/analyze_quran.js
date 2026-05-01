
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define paths - adjust relative to script location
const quranPath = path.join(__dirname, '../public/data/quran/quran-tajweed.json');

async function analyze() {
    console.log(`Reading ${quranPath}...`);
    try {
        const rawData = fs.readFileSync(quranPath, 'utf8');
        const data = JSON.parse(rawData);

        console.log("Analyzing text...");

        let stats = {
            totalAyahs: 0,
            found0672: 0,
            found0670: 0,
            otherAnomalies: 0
        };

        // Fix: Access the correct property based on JSON structure
        const surahs = data.data.surahs;

        if (!Array.isArray(surahs)) {
            console.error("Error: 'surahs' is not an array. Check JSON structure.");
            return;
        }

        for (const surah of surahs) {
            for (const ayah of surah.ayahs) {
                stats.totalAyahs++;
                const text = ayah.text;

                // Check for \u0672 (Alef with Wavy Hamza) - The problem char
                const matches0672 = text.match(/\u0672/g);
                if (matches0672) {
                    stats.found0672 += matches0672.length;
                }

                // Check for \u0670 (Superscript Alef) - The standard char
                const matches0670 = text.match(/\u0670/g);
                if (matches0670) {
                    stats.found0670 += matches0670.length;
                }
            }
        }

        console.log("Analysis Complete:");
        console.log("Total Ayahs checked:", stats.totalAyahs);
        console.log("Occurrences of \\u0672 (Problematic 'Extra Alif'):", stats.found0672);
        console.log("Occurrences of \\u0670 (Standard Dagger Alif):", stats.found0670);

        if (stats.found0672 > 0) {
            console.log("\nCONCLUSION: The file contains", stats.found0672, "instances of the problematic character.");
            console.log("The patch in TajweedText.tsx is ESSENTIAL.");
        } else {
            console.log("\nCONCLUSION: No problematic characters found.");
        }

    } catch (err) {
        console.error("Analysis failed:", err);
    }
}

analyze();
