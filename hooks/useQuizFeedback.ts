import { useCallback } from 'react';

export const useQuizFeedback = () => {
    const playSound = useCallback((type: 'correct' | 'wrong' | 'complete') => {
        if (typeof window === 'undefined') return;

        let file = '';
        switch (type) {
            case 'correct':
                // Using Salawat as a "Success" chime - positive association
                file = '/audio/salawat_two.mp3';
                break;
            case 'wrong':
                // Using Alert as "Error" buzz/attention
                file = '/audio/alert_approaching.mp3';
                break;
            case 'complete':
                // Optional completion sound
                file = '/audio/salawat_three.mp3';
                break;
        }

        if (file) {
            const audio = new Audio(file);
            audio.volume = 0.5; // Moderate volume
            audio.play().catch(e => console.warn('Audio feedback failed:', e));
        }

        // Haptic Feedback for Mobile (Android)
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            if (type === 'correct') navigator.vibrate(50);
            if (type === 'wrong') navigator.vibrate([50, 100, 50]);
            if (type === 'complete') navigator.vibrate([100, 50, 100, 50]);
        }
    }, []);

    return { playSound };
};
