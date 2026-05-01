
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Helper to check if a module is available in node_modules
const isModuleAvailable = (name: string) => {
  try {
    require.resolve(name);
    return true;
  } catch (e) {
    return false;
  }
};

const nativePackages = [
  '@capacitor-firebase/analytics',
  '@capacitor-firebase/crashlytics',
  '@capacitor-firebase/remote-config',
  '@capacitor/local-notifications',
  '@capacitor/geolocation'
];

const aliases: Record<string, string> = {};

// Check if the main package exists. If not, use mocks for all of them.
// We check for one common package, or could iterate all.
// Using mocks ensures the build passes in web/CI environments without native dependencies.
if (!isModuleAvailable('@capacitor-firebase/analytics') || !isModuleAvailable('@capacitor/local-notifications')) {
  console.warn('⚠️  Native Capacitor packages not found. Using mocks for build safety.');
  nativePackages.forEach(pkg => {
    // Corrected path: services/mocks.ts is at the root
    aliases[pkg] = resolve(__dirname, 'services/mocks.ts');
  });
}

// https://vitejs.dev/config/
export default defineConfig({
  // Base path for GitHub Pages: https://<username>.github.io/al-bayan/
  base: '/al-bayan/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      // Ensure we don't treat these as external if we are mocking them
      external: [] 
    }
  },
  resolve: {
    alias: aliases
  }
});
