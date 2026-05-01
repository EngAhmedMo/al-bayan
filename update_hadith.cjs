const fs = require('fs');
let code = fs.readFileSync('pages/Hadith.tsx', 'utf8');

// Add import
code = code.replace(
  `import { Share } from '@capacitor/share';`,
  `import { Share } from '@capacitor/share';\nimport { isStrictMatch } from '../services/api';`
);

// Find inBookSearchQuery logic
const filterStart = code.indexOf('  const filteredInBookHadiths = useMemo(() => {');
const filterEnd = code.indexOf('  }, [allHadiths, inBookSearchQuery]);');

if (filterStart !== -1 && filterEnd !== -1) {
  const oldFilter = code.substring(filterStart, filterEnd + 40);
  
  const newFilter = `  const filteredInBookHadiths = useMemo(() => {
    if (!inBookSearchQuery.trim()) return allHadiths;
    const queryTerms = normalizeArabic(inBookSearchQuery).split(/\\s+/).filter(t => t.length > 0);
    
    const results = allHadiths.filter(h => {
        const text = h.arabic || h.text || '';
        const normText = normalizeArabic(text);
        const chapter = h.chapter ? normalizeArabic(h.chapter) : '';
        
        // Match if EVERY query term is found (either strict match OR substring)
        return queryTerms.every(qTerm => {
            // Strict match in words
            const textWords = text.split(/\\s+/);
            const chapterWords = (h.chapter || '').split(/\\s+/);
            const hasStrictMatch = textWords.some(w => isStrictMatch(w, qTerm)) || chapterWords.some(w => isStrictMatch(w, qTerm));
            
            if (hasStrictMatch) return true;
            
            // Fallback to substring match
            return normText.includes(qTerm) || chapter.includes(qTerm);
        });
    });
    
    // Sort exact matches to the top
    const normalizedQuery = normalizeArabic(inBookSearchQuery);
    return results.sort((a, b) => {
        const aText = normalizeArabic(a.arabic || a.text || '');
        const bText = normalizeArabic(b.arabic || b.text || '');
        const aExact = aText.includes(normalizedQuery);
        const bExact = bText.includes(normalizedQuery);
        
        if (aExact && !bExact) return -1;
        if (bExact && !aExact) return 1;
        return 0;
    });
  }, [allHadiths, inBookSearchQuery]);`;
  
  code = code.replace(oldFilter, newFilter);
}

// Fix highlightText function
const highlightStart = code.indexOf('  const highlightText = (text: string, query: string) => {');
const highlightEnd = code.indexOf('  };\n\n  const handleToggleBookmark =');

if (highlightStart !== -1 && highlightEnd !== -1) {
    const oldHighlight = code.substring(highlightStart, highlightEnd + 4);
    
    const newHighlight = `  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const queryTerms = normalizeArabic(query).split(/\\s+/).filter(t => t.length > 0);
    const words = text.split(' ');
    
    return (
        <span>
        {words.map((word, i) => {
            const isMatch = queryTerms.some(term => isStrictMatch(word, term));
            return (
            <React.Fragment key={i}>
                {isMatch ? (
                <mark className="bg-gold-200 dark:bg-gold-900/50 text-navy-900 dark:text-white rounded px-1">{word}</mark>
                ) : word}
                {' '}
            </React.Fragment>
            );
        })}
        </span>
    );
  };
`;
    code = code.replace(oldHighlight, newHighlight);
}

fs.writeFileSync('pages/Hadith.tsx', code);
console.log('Successfully updated Hadith.tsx');
