
import { useState, useEffect, useRef } from 'react';

// Kaaba Coordinates
const KAABA_LAT = 21.422487;
const KAABA_LNG = 39.826206;

/**
 * Calculates the Qibla direction (bearing) from a given location.
 * Uses the Spherical Law of Cosines.
 * @param lat Current Latitude
 * @param lng Current Longitude
 * @returns Heading in degrees (0-360) from True North
 */
export const calculateQibla = (lat: number, lng: number): number => {
    const PI = Math.PI;
    const latk = (KAABA_LAT * PI) / 180.0;
    const longk = (KAABA_LNG * PI) / 180.0;
    const phi = (lat * PI) / 180.0;
    const lambda = (lng * PI) / 180.0;

    const numerator = Math.sin(longk - lambda);
    const denominator =
        Math.cos(phi) * Math.tan(latk) - Math.sin(phi) * Math.cos(longk - lambda);

    let qibla = (Math.atan2(numerator, denominator) * 180.0) / PI;

    // Normalize to 0-360
    if (qibla < 0) {
        qibla += 360;
    }

    return qibla;
};

/**
 * Estimates Magnetic Declination based on approximate location.
 * For Egypt (around Cairo): ~4° East declination
 * This is a simplified estimation - for production, you'd use WMM2020 model
 * @param lat Latitude
 * @param lng Longitude
 * @returns Declination in degrees (positive = East, negative = West)
 */
export const estimateMagneticDeclination = (lat: number, lng: number): number => {
    // Simplified declination estimation for Middle East / North Africa region
    // Egypt: approximately 3-5° East
    // Gulf: approximately 2-3° East
    // Turkey: approximately 4-6° East

    // Very rough approximation based on longitude (for this region)
    // More accurate would be to use NOAA's World Magnetic Model API
    if (lat >= 22 && lat <= 32 && lng >= 25 && lng <= 37) {
        // Egypt region: ~4° East
        return 4.0;
    } else if (lat >= 12 && lat <= 32 && lng >= 35 && lng <= 60) {
        // Saudi Arabia / Gulf region: ~2-3° East
        return 2.5;
    } else if (lat >= 36 && lat <= 42 && lng >= 26 && lng <= 45) {
        // Turkey region: ~5° East
        return 5.0;
    }
    // Default: 0° (no correction)
    return 0;
};

/**
 * Applies magnetic declination correction to compass heading
 * @param magneticHeading Heading from compass (magnetic north)
 * @param declination Magnetic declination in degrees
 * @returns True heading (relative to true north)
 */
export const applyMagneticDeclination = (magneticHeading: number, declination: number): number => {
    let trueHeading = magneticHeading + declination;
    // Normalize to 0-360
    if (trueHeading < 0) trueHeading += 360;
    if (trueHeading >= 360) trueHeading -= 360;
    return trueHeading;
};

/**
 * Interface for Compass Data
 */
interface CompassData {
    heading: number | null;        // Magnetic Heading (0-360)
    trueHeading: number | null;    // True Heading (with declination correction)
    accuracy: 'high' | 'medium' | 'low' | 'unknown'; // Accuracy level
    accuracyDegrees: number | null; // Accuracy in degrees (if available)
    isAvailable: boolean;          // Is device orientation supported?
    permissionGranted: boolean;    // Has user granted permission (iOS 13+)?
    needsCalibration: boolean;     // Does compass need calibration?
    error: string | null;
}

/**
 * Low-Pass Filter to smooth out jittery sensor data.
 * @param current The new raw value
 * @param previous The last smoothed value
 * @param alpha Smoothing factor (0 = infinite smooth/static, 1 = raw/no smooth). 0.1-0.2 is good for compass.
 */
const lowPassFilter = (current: number, previous: number | null, alpha: number = 0.15): number => {
    if (previous === null) return current;

    // Handle 360-degree wrap-around (e.g., transition from 359 to 1)
    let diff = current - previous;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    const smoothed = previous + alpha * diff;

    // Normalize back to 0-360
    return (smoothed + 360) % 360;
};

/**
 * Custom Hook to handle Device Compass with Smoothing and Accuracy
 * @param userLat User's latitude (for declination calculation)
 * @param userLng User's longitude (for declination calculation)
 */
export const useCompass = (userLat?: number, userLng?: number) => {
    const [data, setData] = useState<CompassData>({
        heading: null,
        trueHeading: null,
        accuracy: 'unknown',
        accuracyDegrees: null,
        isAvailable: true,
        permissionGranted: false,
        needsCalibration: false,
        error: null,
    });

    // Refs for sensor smoothing state
    const lastHeading = useRef<number | null>(null);
    const lastUpdate = useRef<number>(0);
    const recentReadings = useRef<number[]>([]);

    // Calculate magnetic declination based on user location
    const declination = userLat && userLng ? estimateMagneticDeclination(userLat, userLng) : 0;

    const requestPermission = async () => {
        // Check for iOS 13+ permission API
        if (
            typeof (DeviceOrientationEvent as any).requestPermission === 'function'
        ) {
            try {
                const permissionState = await (DeviceOrientationEvent as any).requestPermission();
                if (permissionState === 'granted') {
                    setData((prev) => ({ ...prev, permissionGranted: true, error: null }));
                    return true;
                } else {
                    setData((prev) => ({ ...prev, error: 'تم رفض إذن البوصلة' }));
                    return false;
                }
            } catch (error) {
                console.error(error);
                setData((prev) => ({ ...prev, error: 'حدث خطأ أثناء طلب الإذن' }));
                return false;
            }
        } else {
            // Non-iOS 13+ devices typically don't need explicit permission request
            setData((prev) => ({ ...prev, permissionGranted: true }));
            return true;
        }
    };

    useEffect(() => {
        // Handler for device orientation
        const handleOrientation = (event: DeviceOrientationEvent) => {
            let heading: number | null = null;
            let webkitAccuracy: number | null = null;
            const now = Date.now();

            // Limit update rate to ~60fps (16ms) to avoid over-processing
            if (now - lastUpdate.current < 16) return;

            // iOS Webkit (alpha is typically relative to north if calibrated)
            // Android/Standard (alpha is 0-360 z-axis)

            // Try to get "True Heading" (webkitCompassHeading) for iOS
            if ((event as any).webkitCompassHeading !== undefined) {
                heading = (event as any).webkitCompassHeading;
                webkitAccuracy = (event as any).webkitCompassAccuracy || null;
            }
            // Standard 'alpha'
            else if (event.alpha !== null) {
                // For standard "Absolute" orientation (Chrome 50+):
                if ('absolute' in event && (event as any).absolute === true) {
                    heading = 360 - event.alpha;
                } else {
                    heading = 360 - event.alpha;
                }
            }

            if (heading !== null) {
                // Normalize
                if (heading < 0) heading += 360;
                if (heading >= 360) heading -= 360;

                // --- APPLY SMOOTHING ---
                // Lower alpha (0.05) = Heavier, smoother pointer (fixes "too fast" issue)
                const smoothedHeading = lowPassFilter(heading, lastHeading.current, 0.05);

                // --- TRACK RECENT READINGS FOR ACCURACY ESTIMATION ---
                recentReadings.current.push(smoothedHeading);
                if (recentReadings.current.length > 30) {
                    recentReadings.current.shift();
                }

                // Estimate accuracy based on variance of recent readings
                let estimatedAccuracy: 'high' | 'medium' | 'low' | 'unknown' = 'unknown';
                let needsCalibration = false;

                if (recentReadings.current.length >= 10) {
                    const readings = recentReadings.current;
                    const mean = readings.reduce((a, b) => a + b, 0) / readings.length;
                    const variance = readings.reduce((sum, r) => {
                        let diff = r - mean;
                        if (diff > 180) diff -= 360;
                        if (diff < -180) diff += 360;
                        return sum + diff * diff;
                    }, 0) / readings.length;
                    const stdDev = Math.sqrt(variance);

                    if (stdDev < 2) { // Stricter threshold for High (Premium feel)
                        estimatedAccuracy = 'high';
                    } else if (stdDev < 8) {
                        estimatedAccuracy = 'medium';
                    } else {
                        estimatedAccuracy = 'low';
                        needsCalibration = true;
                    }
                }

                // If iOS provides accuracy, use it
                if (webkitAccuracy !== null) {
                    if (webkitAccuracy < 0) {
                        needsCalibration = true;
                        estimatedAccuracy = 'low';
                    } else if (webkitAccuracy <= 10) {
                        estimatedAccuracy = 'high';
                    } else if (webkitAccuracy <= 25) {
                        estimatedAccuracy = 'medium';
                    } else {
                        estimatedAccuracy = 'low';
                    }
                }

                // --- APPLY THRESHOLD (DEADBAND) ---
                // Only update if change is significant enough (> 0.2 degrees is enough with strong smoothing)
                if (lastHeading.current === null || Math.abs(smoothedHeading - lastHeading.current) > 0.2) {
                    lastHeading.current = smoothedHeading;
                    lastUpdate.current = now;

                    // Apply magnetic declination ONLY if needed
                    // 1. iOS: webkitCompassHeading is usually Magnetic North -> Apply Declination
                    // 2. Android Absolute: alpha is True North -> Do NOT Apply Declination
                    // 3. Android Relative: alpha is likely Magnetic (if available) -> Apply Declination

                    let trueHeading = smoothedHeading;
                    const isAbsolute = ('absolute' in event && (event as any).absolute === true);
                    const isIOS = (event as any).webkitCompassHeading !== undefined;

                    if (isIOS || !isAbsolute) {
                        // Convert Magnetic -> True
                        trueHeading = applyMagneticDeclination(smoothedHeading, declination);
                    }
                    // Else: If isAbsolute is true, smoothedHeading IS True Heading (0 = True North)

                    setData((prev) => ({
                        ...prev,
                        heading: smoothedHeading, // Raw sensor
                        trueHeading: trueHeading, // Logic-corrected for Qibla
                        accuracy: estimatedAccuracy,
                        accuracyDegrees: webkitAccuracy,
                        isAvailable: true,
                        needsCalibration: needsCalibration,
                    }));
                }
            }
        };

        const isDesktop = typeof window !== 'undefined' && '__TAURI__' in window;
        if (window.DeviceOrientationEvent && !isDesktop) {
            window.addEventListener('deviceorientation', handleOrientation, true);
        } else {
            setData((prev) => ({ ...prev, isAvailable: false, error: 'البوصلة غير مدعومة على الكمبيوتر' }));
        }

        return () => {
            window.removeEventListener('deviceorientation', handleOrientation, true);
        };
    }, [declination]);

    return { ...data, requestPermission, declination };
};
