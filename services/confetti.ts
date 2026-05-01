import confetti from 'canvas-confetti';

/**
 * Light celebration for single prayer completion
 * Optimized for smooth performance with fewer particles
 */
export const triggerPrayerSuccess = () => {
    confetti({
        particleCount: 35, // Reduced from 60 for lighter feel
        spread: 60,        // Slightly narrower
        origin: { y: 0.7 },
        colors: ['#F59E0B', '#10B981', '#3B82F6'], // Gold, Emerald, Blue
        zIndex: 9999,
        gravity: 1.2,      // Falls slightly faster
        decay: 0.94,       // Fades smoothly
        scalar: 0.9,       // Slightly smaller particles
        ticks: 150         // Shorter animation duration
    });
};

/**
 * Celebration for completing all 5 daily prayers
 * Dual-sided confetti burst - optimized for smoothness
 */
export const triggerDailyCompletion = () => {
    const duration = 1500; // Reduced from 2000ms
    const end = Date.now() + duration;

    const defaults = {
        gravity: 1.1,
        decay: 0.93,
        scalar: 0.85,
        ticks: 120
    };

    (function frame() {
        confetti({
            ...defaults,
            particleCount: 3, // Reduced from 5
            angle: 60,
            spread: 50,
            origin: { x: 0 },
            colors: ['#F59E0B', '#10B981']
        });
        confetti({
            ...defaults,
            particleCount: 3, // Reduced from 5
            angle: 120,
            spread: 50,
            origin: { x: 1 },
            colors: ['#F59E0B', '#10B981']
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
};

/**
 * Celebration for completing Hifz (memorization) goal
 * Elegant gold & white burst - optimized for performance
 */
export const triggerHifzCompletion = () => {
    const duration = 800; // Reduced from 1000ms
    const end = Date.now() + duration;

    const defaults = {
        gravity: 1.1,
        decay: 0.92,
        scalar: 0.8,
        ticks: 100
    };

    (function frame() {
        confetti({
            ...defaults,
            particleCount: 4, // Reduced from 7
            angle: 60,
            spread: 45,
            origin: { x: 0 },
            colors: ['#F59E0B', '#ffffff'] // Gold & White
        });
        confetti({
            ...defaults,
            particleCount: 4, // Reduced from 7
            angle: 120,
            spread: 45,
            origin: { x: 1 },
            colors: ['#F59E0B', '#ffffff']
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
};

/**
 * Subtle celebration for smaller achievements
 * Single gentle burst
 */
export const triggerSubtleCelebration = () => {
    confetti({
        particleCount: 20,
        spread: 40,
        origin: { y: 0.6, x: 0.5 },
        colors: ['#F59E0B', '#D97706'],
        zIndex: 9999,
        gravity: 1.3,
        decay: 0.95,
        scalar: 0.7,
        ticks: 100,
        startVelocity: 20
    });
};
