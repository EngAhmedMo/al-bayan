import React from 'react';
import { cleanTajweedTags } from '../services/normalization';

export { cleanTajweedTags };

interface TajweedTextProps {
    text: string;
    className?: string;
}

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
