import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the 'dist/audio' directory
const audioDir = path.join(__dirname, '../dist/audio');

console.log('--- Android Optimization ---');

if (fs.existsSync(audioDir)) {
    console.log(`Removing ${audioDir} to save space on Android...`);
    try {
        fs.rmSync(audioDir, { recursive: true, force: true });
        console.log('✅ Successfully removed duplicate audio assets.');
    } catch (err) {
        console.error('❌ Error removing audio directory:', err);
        process.exit(1);
    }
} else {
    console.log('⚠️ Audio directory not found in dist. Skipping removal.');
}

console.log('----------------------------');
