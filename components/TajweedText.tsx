import React from 'react';

interface TajweedTextProps {
    text: string;
    className?: string;
}

// Helper to strip Tajweed tags for clean text
export const cleanTajweedTags = (text: string): string => {
    if (!text) return '';

    // 1. Fix the "Extra Alif" data issue first
    let clean = text.replace(/\u0672/g, '\u0670');

    // 2. Remove all Tajweed tags [x[...]]
    // Logic: The tags wrap content. We want to KEEP the content but REMOVE the wrapper.
    let previous = '';
    while (clean !== previous) {
        previous = clean;
        clean = clean.replace(/\[[a-z]+(?::\d+)?\[([^\]]*)\]/g, '$1');
    }

    // Final cleanup of formatting chars if any remain
    clean = clean.replace(/[\[\]]/g, '');

    return clean;
};

export const TajweedText: React.FC<TajweedTextProps> = ({ text, className = '' }) => {
    // Render PLAIN text purely, honoring the user request to "Remove the colors part entirely".
    // We use a specific class 'quran-text' to ensure it uses the correct font if passed in className,
    // or just pass through className.
    return (
        <span className={`${className} tajweed-text-plain`}>
            {cleanTajweedTags(text)}
        </span>
    );
};
