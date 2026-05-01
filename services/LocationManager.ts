import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { saveLocation, getSavedLocation } from './storage';
import { MediaBridge } from './mediaBridge';

// Accuracy thresholds (in meters)
const ACCURACY_EXCELLENT = 20;  // GPS with clear sky
const ACCURACY_GOOD = 50;       // GPS normal
const ACCURACY_ACCEPTABLE = 100; // GPS with obstruction
const ACCURACY_POOR = 500;      // Cell/WiFi
const AUTO_UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in ms

export type AccuracyLevel = 'excellent' | 'good' | 'acceptable' | 'poor' | 'unknown';

import { EGYPTIAN_CITIES } from './offlineCities';

export interface GeoLocationResult {
    lat: number;
    lng: number;
    cityName: string;
    source: 'gps' | 'cache' | 'default' | 'manual';
    timestamp: number;
    accuracy?: number;
    accuracyLevel?: AccuracyLevel;
    needsUpdate?: boolean;
    error?: string;
}

// City database for manual selection
export interface CityData {
    name: string;
    nameAr: string;
    country: string;
    countryAr: string;
    lat: number;
    lng: number;
}

// Popular cities in Arab and Islamic world
export const POPULAR_CITIES: CityData[] = [
    // --- All Egyptian Cities from Offline Database ---
    ...EGYPTIAN_CITIES.map(city => ({
        name: city.nameAr, // Fallback to Arabic name effectively
        nameAr: city.nameAr,
        country: 'Egypt',
        countryAr: 'مصر',
        lat: city.lat,
        lng: city.lng
    })),

    // السعودية
    { name: 'Makkah', nameAr: 'مكة المكرمة', country: 'Saudi Arabia', countryAr: 'السعودية', lat: 21.4225, lng: 39.8262 },
    { name: 'Madinah', nameAr: 'المدينة المنورة', country: 'Saudi Arabia', countryAr: 'السعودية', lat: 24.5247, lng: 39.5692 },
    { name: 'Riyadh', nameAr: 'الرياض', country: 'Saudi Arabia', countryAr: 'السعودية', lat: 24.7136, lng: 46.6753 },
    { name: 'Jeddah', nameAr: 'جدة', country: 'Saudi Arabia', countryAr: 'السعودية', lat: 21.5433, lng: 39.1728 },
    { name: 'Dammam', nameAr: 'الدمام', country: 'Saudi Arabia', countryAr: 'السعودية', lat: 26.4207, lng: 50.0888 },

    // الإمارات
    { name: 'Dubai', nameAr: 'دبي', country: 'UAE', countryAr: 'الإمارات', lat: 25.2048, lng: 55.2708 },
    { name: 'Abu Dhabi', nameAr: 'أبوظبي', country: 'UAE', countryAr: 'الإمارات', lat: 24.4539, lng: 54.3773 },
    { name: 'Sharjah', nameAr: 'الشارقة', country: 'UAE', countryAr: 'الإمارات', lat: 25.3463, lng: 55.4209 },

    // قطر والكويت والبحرين
    { name: 'Doha', nameAr: 'الدوحة', country: 'Qatar', countryAr: 'قطر', lat: 25.2867, lng: 51.5333 },
    { name: 'Kuwait City', nameAr: 'الكويت', country: 'Kuwait', countryAr: 'الكويت', lat: 29.3759, lng: 47.9774 },
    { name: 'Manama', nameAr: 'المنامة', country: 'Bahrain', countryAr: 'البحرين', lat: 26.2285, lng: 50.5860 },

    // الأردن وفلسطين
    { name: 'Amman', nameAr: 'عمّان', country: 'Jordan', countryAr: 'الأردن', lat: 31.9454, lng: 35.9284 },
    { name: 'Jerusalem', nameAr: 'القدس', country: 'Palestine', countryAr: 'فلسطين', lat: 31.7683, lng: 35.2137 },

    // العراق وسوريا ولبنان
    { name: 'Baghdad', nameAr: 'بغداد', country: 'Iraq', countryAr: 'العراق', lat: 33.3152, lng: 44.3661 },
    { name: 'Damascus', nameAr: 'دمشق', country: 'Syria', countryAr: 'سوريا', lat: 33.5138, lng: 36.2765 },
    { name: 'Beirut', nameAr: 'بيروت', country: 'Lebanon', countryAr: 'لبنان', lat: 33.8938, lng: 35.5018 },

    // المغرب العربي
    { name: 'Casablanca', nameAr: 'الدار البيضاء', country: 'Morocco', countryAr: 'المغرب', lat: 33.5731, lng: -7.5898 },
    { name: 'Rabat', nameAr: 'الرباط', country: 'Morocco', countryAr: 'المغرب', lat: 34.0209, lng: -6.8416 },
    { name: 'Algiers', nameAr: 'الجزائر', country: 'Algeria', countryAr: 'الجزائر', lat: 36.7538, lng: 3.0588 },
    { name: 'Tunis', nameAr: 'تونس', country: 'Tunisia', countryAr: 'تونس', lat: 36.8065, lng: 10.1815 },
    { name: 'Tripoli', nameAr: 'طرابلس', country: 'Libya', countryAr: 'ليبيا', lat: 32.8872, lng: 13.1913 },

    // تركيا
    { name: 'Istanbul', nameAr: 'إسطنبول', country: 'Turkey', countryAr: 'تركيا', lat: 41.0082, lng: 28.9784 },
    { name: 'Ankara', nameAr: 'أنقرة', country: 'Turkey', countryAr: 'تركيا', lat: 39.9334, lng: 32.8597 },

    // آسيا
    { name: 'Kuala Lumpur', nameAr: 'كوالالمبور', country: 'Malaysia', countryAr: 'ماليزيا', lat: 3.1390, lng: 101.6869 },
    { name: 'Jakarta', nameAr: 'جاكرتا', country: 'Indonesia', countryAr: 'إندونيسيا', lat: -6.2088, lng: 106.8456 },
    { name: 'Karachi', nameAr: 'كراتشي', country: 'Pakistan', countryAr: 'باكستان', lat: 24.8607, lng: 67.0011 },
    { name: 'Lahore', nameAr: 'لاهور', country: 'Pakistan', countryAr: 'باكستان', lat: 31.5204, lng: 74.3587 },
    { name: 'Dhaka', nameAr: 'دكا', country: 'Bangladesh', countryAr: 'بنجلاديش', lat: 23.8103, lng: 90.4125 },

    // أوروبا (جاليات مسلمة)
    { name: 'London', nameAr: 'لندن', country: 'UK', countryAr: 'بريطانيا', lat: 51.5074, lng: -0.1278 },
    { name: 'Paris', nameAr: 'باريس', country: 'France', countryAr: 'فرنسا', lat: 48.8566, lng: 2.3522 },
    { name: 'Berlin', nameAr: 'برلين', country: 'Germany', countryAr: 'ألمانيا', lat: 52.5200, lng: 13.4050 },

    // أمريكا (جاليات مسلمة)  
    { name: 'New York', nameAr: 'نيويورك', country: 'USA', countryAr: 'أمريكا', lat: 40.7128, lng: -74.0060 },
    { name: 'Los Angeles', nameAr: 'لوس أنجلوس', country: 'USA', countryAr: 'أمريكا', lat: 34.0522, lng: -118.2437 },
    { name: 'Toronto', nameAr: 'تورنتو', country: 'Canada', countryAr: 'كندا', lat: 43.6532, lng: -79.3832 },
];

const DEFAULT_LOCATION = { lat: 30.0444, lng: 31.2357, cityName: 'القاهرة' }; // Cairo default
const KEY_MANUAL_LOCATION = 'manual_location_override';

export const LocationManager = {

    /**
     * Convert accuracy in meters to human-readable level
     */
    getAccuracyLevel(accuracyMeters: number | undefined): AccuracyLevel {
        if (!accuracyMeters) return 'unknown';
        if (accuracyMeters <= ACCURACY_EXCELLENT) return 'excellent';
        if (accuracyMeters <= ACCURACY_GOOD) return 'good';
        if (accuracyMeters <= ACCURACY_ACCEPTABLE) return 'acceptable';
        return 'poor';
    },

    /**
     * Check if location needs update (older than 24 hours)
     */
    isLocationStale(): boolean {
        const savedCoordsRaw = localStorage.getItem('user_location_coords');
        if (!savedCoordsRaw) return true;
        try {
            const { savedAt } = JSON.parse(savedCoordsRaw);
            return Date.now() - savedAt > AUTO_UPDATE_INTERVAL;
        } catch {
            return true;
        }
    },

    /**
     * Set manual location (user selected from city list)
     */
    setManualLocation(city: CityData): void {
        const data = {
            lat: city.lat,
            lng: city.lng,
            cityName: city.nameAr,
            savedAt: Date.now()
        };
        localStorage.setItem(KEY_MANUAL_LOCATION, JSON.stringify(data));
        // Also update main location cache
        saveLocation(city.lat, city.lng);
        localStorage.setItem('user_location_name', city.nameAr);
        localStorage.setItem('user_location_coords', JSON.stringify({
            lat: city.lat, lng: city.lng, accuracy: 0, savedAt: Date.now()
        }));
        console.log(`📍 Manual location set: ${city.nameAr}`);
    },

    /**
     * Get manual location if set
     */
    getManualLocation(): { lat: number; lng: number; cityName: string; savedAt: number } | null {
        const raw = localStorage.getItem(KEY_MANUAL_LOCATION);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    },

    /**
     * Clear manual location (return to GPS)
     */
    clearManualLocation(): void {
        localStorage.removeItem(KEY_MANUAL_LOCATION);
        console.log('📍 Manual location cleared, will use GPS');
    },

    /**
     * Check if manual location is set
     */
    hasManualLocation(): boolean {
        return localStorage.getItem(KEY_MANUAL_LOCATION) !== null;
    },

    /**
     * getSmartLocation: The single source of truth for location.
     * Strategy:
     * 1. If manual location is set, use it (highest priority)
     * 2. Check if cached location is still valid (< 24h).
     * 3. Filter out low-accuracy results (> 100m) with retry.
     * 4. Fetch City Name (Online) with multi-API fallback.
     */
    async getCurrentLocation(forceRefresh = false): Promise<GeoLocationResult> {
        // 1. PRIORITY: Manual location (user override)
        const manual = this.getManualLocation();
        if (manual && !forceRefresh) {
            return {
                lat: manual.lat,
                lng: manual.lng,
                cityName: manual.cityName,
                source: 'manual',
                timestamp: manual.savedAt,
                accuracyLevel: 'excellent', // User selected, so it's accurate
                needsUpdate: false
            };
        }

        let cached = getSavedLocation();
        const needsUpdate = this.isLocationStale();

        // If not forcing and we have a recent cache, use it
        if (!forceRefresh && cached && !needsUpdate) {
            const cachedCity = localStorage.getItem('user_location_name') || 'موقع محفوظ';
            const savedCoordsRaw = localStorage.getItem('user_location_coords');
            let accuracy: number | undefined;
            if (savedCoordsRaw) {
                try {
                    const parsed = JSON.parse(savedCoordsRaw);
                    accuracy = parsed.accuracy;
                } catch { }
            }
            return {
                lat: cached.lat,
                lng: cached.lng,
                cityName: cachedCity,
                source: 'cache',
                timestamp: new Date(cached.savedAt).getTime(),
                accuracy,
                accuracyLevel: this.getAccuracyLevel(accuracy),
                needsUpdate: false
            };
        }

        const isWeb = Capacitor.getPlatform() === 'web';

        try {
            // 1. Check Permissions
            // On web, if we reached here, IP failed or user clicked "forceRefresh".
            // We will request browser permission, but if it fails, we catch it.
            const perm = await Geolocation.checkPermissions();
            if (perm.location !== 'granted') {
                const req = await Geolocation.requestPermissions();
                if (req.location !== 'granted') throw new Error('Permission denied');
            }

            // 2. Fetch GPS with high accuracy (with retry for poor accuracy)
            let bestPos: any = null;
            let attempts = 0;
            const maxAttempts = 2;

            while (attempts < maxAttempts) {
                attempts++;
                const pos = await Geolocation.getCurrentPosition({
                    enableHighAccuracy: true,
                    timeout: 5000, // Optimized: 5s timeout per attempt (Total max ~12s with retry)
                    maximumAge: 0 // Always get fresh location
                });

                const accuracy = pos.coords.accuracy;
                console.log(`📍 GPS Attempt ${attempts}: Accuracy ${accuracy}m`);

                // Smart Timeout Logic:
                // If this is the FIRST attempt and accuracy is "OK" (< 500m), take it to be fast.
                // If it's "Excellent" (< 50m), take it immediately.
                if (accuracy <= ACCURACY_EXCELLENT) {
                    bestPos = pos;
                    break;
                }

                // If it's just "Acceptable" and we have time, maybe wait for next loop? 
                // No, for UX speed, if it's < 100m, just take it.
                if (accuracy <= ACCURACY_ACCEPTABLE) {
                    bestPos = pos;
                    break;
                }

                // If this is the last attempt, take whatever we have
                if (attempts >= maxAttempts) {
                    bestPos = pos;
                    break;
                }

                // Wait a bit before retry for better GPS lock
                await new Promise(r => setTimeout(r, 2000));
            }

            if (!bestPos) throw new Error('Could not get accurate position');

            const lat = bestPos.coords.latitude;
            const lng = bestPos.coords.longitude;
            const accuracy = bestPos.coords.accuracy;
            const accuracyLevel = this.getAccuracyLevel(accuracy);

            // 3. Fetch City Name with fallback strategy
            let cityName = await this.getCityNameWithFallback(lat, lng);

            // 4. Save with accuracy info
            saveLocation(lat, lng);
            localStorage.setItem('user_location_name', cityName);
            localStorage.setItem('user_location_coords', JSON.stringify({
                lat, lng, accuracy, savedAt: Date.now()
            }));

            console.log(`📍 Location saved: ${cityName} (${accuracyLevel} - ${accuracy}m)`);

            return {
                lat,
                lng,
                cityName,
                source: 'gps',
                timestamp: Date.now(),
                accuracy,
                accuracyLevel,
                needsUpdate: false
            };

        } catch (error: any) {
            console.warn("GPS Failed, trying fallback:", error);

            // FALLBACK 0: Try IP Geolocation if we haven't already (e.g. forceRefresh failed)
            if (isWeb) {
                 console.log('📍 GPS Failed on Web, falling back to silent IP Geolocation...');
                 const ipGeo = await this.tryIPGeolocation();
                 if (ipGeo) {
                    let cityName = ipGeo.city;
                    if (!cityName || !/^[\u0600-\u06FF\s]+$/.test(cityName)) { 
                        cityName = await this.getCityNameWithFallback(ipGeo.lat, ipGeo.lng);
                    }
                    saveLocation(ipGeo.lat, ipGeo.lng);
                    localStorage.setItem('user_location_name', cityName);
                    localStorage.setItem('user_location_coords', JSON.stringify({
                        lat: ipGeo.lat, lng: ipGeo.lng, accuracy: 500, savedAt: Date.now()
                    }));
                    
                    return {
                        lat: ipGeo.lat,
                        lng: ipGeo.lng,
                        cityName,
                        source: 'gps',
                        timestamp: Date.now(),
                        accuracy: 500,
                        accuracyLevel: 'acceptable',
                        needsUpdate: false
                    };
                 }
            }

            // FALLBACK 1: Cached Location
            if (cached) {
                const cachedCity = localStorage.getItem('user_location_name') || 'موقع محفوظ';
                const savedCoordsRaw = localStorage.getItem('user_location_coords');
                let accuracy: number | undefined;
                if (savedCoordsRaw) {
                    try {
                        const parsed = JSON.parse(savedCoordsRaw);
                        accuracy = parsed.accuracy;
                    } catch { }
                }
                return {
                    lat: cached.lat,
                    lng: cached.lng,
                    cityName: cachedCity,
                    source: 'cache',
                    timestamp: new Date(cached.savedAt).getTime(),
                    accuracy,
                    accuracyLevel: this.getAccuracyLevel(accuracy),
                    needsUpdate,
                    error: 'gps_failed_used_cache'
                };
            }

            // FALLBACK 2: Default (Cairo)
            return {
                lat: DEFAULT_LOCATION.lat,
                lng: DEFAULT_LOCATION.lng,
                cityName: DEFAULT_LOCATION.cityName,
                source: 'default',
                timestamp: Date.now(),
                accuracyLevel: 'unknown',
                needsUpdate: true,
                error: 'no_location_found'
            };
        }
    },

    /**
     * Enhanced City Name Resolution with Multi-API Fallback
     * Priority: BigDataCloud (Arabic) → OpenStreetMap Nominatim → Cached Name
     */
    async getCityNameWithFallback(lat: number, lng: number): Promise<string> {
        // Try BigDataCloud first (best Arabic support)
        const bigDataResult = await this.tryBigDataCloud(lat, lng);
        if (bigDataResult) return bigDataResult;

        // Fallback to OpenStreetMap Nominatim
        const osmResult = await this.tryOpenStreetMap(lat, lng);
        if (osmResult) return osmResult;

        // Final fallback: Offline Database (Nearest City)
        const offlineCity = this.findNearestCity(lat, lng);
        if (offlineCity) {
            console.log('📍 Offline DB Match:', offlineCity);
            return offlineCity;
        }

        // Ultimate fallback: cached name or generic
        return localStorage.getItem('user_location_name') || 'موقعي الحالي';
    },

    /**
     * Finds the nearest city from the offline database
     * Logic:
     * - Delta/Valley: Radius 5km (Dense)
     * - Other: Radius 30km (Sparse)
     * - If distance < 2km: Exact Name
     * - If distance > 2km: "Near..." (بالقرب من)
     */
    findNearestCity(lat: number, lng: number): string | null {
        let nearestCity: typeof EGYPTIAN_CITIES[0] | null = null;
        let minDist = Infinity;

        // 1. Find Nearest Coordinate
        for (const city of EGYPTIAN_CITIES) {
            const dist = this.calculateDistance(lat, lng, city.lat, city.lng);
            if (dist < minDist) {
                minDist = dist;
                nearestCity = city;
            }
        }

        if (!nearestCity) return null;

        // 2. Dynamic Threshold Logic
        const region = nearestCity.region || 'desert';
        // Delta/Valley are dense -> smaller radius to avoid wrong name
        const maxRadius = (region === 'delta' || region === 'valley') ? 5 : 30;

        if (minDist <= maxRadius) {
            // Very close? Use name directly
            if (minDist <= 2.5) {
                return `${nearestCity.nameAr} (تقريبي)`;
            }
            // Close but not exact? Add prefix
            return `بالقرب من ${nearestCity.nameAr}`;
        }

        return null;
    },

    /**
     * Haversine formula to calculate distance between two points in km
     */
    calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Radius of the earth in km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    },

    deg2rad(deg: number): number {
        return deg * (Math.PI / 180);
    },

    /**
     * BigDataCloud Reverse Geocoding (Primary - Best Arabic Support)
     * Free, no API key needed, supports Arabic localities
     */
    async tryBigDataCloud(lat: number, lng: number): Promise<string | null> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const res = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=ar`,
                { signal: controller.signal }
            );
            clearTimeout(timeoutId);

            if (!res.ok) return null;

            const data = await res.json();

            // Enhanced city extraction with priority order
            // locality is usually the most accurate for neighborhoods/cities
            const city = data.locality || data.city || data.principalSubdivision || null;

            if (city && city.trim()) {
                console.log('📍 BigDataCloud:', city);
                return city;
            }
            return null;

        } catch (e) {
            console.warn("BigDataCloud failed:", e);
            return null;
        }
    },

    /**
     * OpenStreetMap Nominatim Reverse Geocoding (Fallback)
     * Free, community-driven, good global coverage
     */
    async tryOpenStreetMap(lat: number, lng: number): Promise<string | null> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ar`,
                {
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'AlBayan-QuranApp/1.0'
                    }
                }
            );
            clearTimeout(timeoutId);

            if (!res.ok) return null;

            const data = await res.json();

            // Extract city from OSM address components
            const address = data.address || {};
            const city = address.city || address.town || address.village ||
                address.municipality || address.suburb || address.state || null;

            if (city && city.trim()) {
                console.log('📍 OpenStreetMap:', city);
                return city;
            }
            return null;

        } catch (e) {
            console.warn("OpenStreetMap failed:", e);
            return null;
        }
    },

    /**
     * Legacy method for backward compatibility
     */
    async getCityName(lat: number, lng: number): Promise<string> {
        return this.getCityNameWithFallback(lat, lng);
    },

    /**
     * IP Geolocation (Silent, fast fallback for Web/Desktop)
     */
    async tryIPGeolocation(): Promise<{lat: number, lng: number, city: string} | null> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const res = await fetch('https://get.geojs.io/v1/ip/geo.json', { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!res.ok) return null;
            
            const data = await res.json();
            if (data && data.latitude && data.longitude) {
                return {
                    lat: parseFloat(data.latitude),
                    lng: parseFloat(data.longitude),
                    city: data.city || ''
                };
            }
            return null;
        } catch (e) {
            console.warn("IP Geolocation failed:", e);
            return null;
        }
    },

    async openLocationSettings() {
        try {
            await MediaBridge.requestLocationSettings();
        } catch (e) { console.error(e); }
    }
};
