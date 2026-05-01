
// Simulation of TajweedText parser logic
const inputText = "\u0630[n[\u064e\u0670]\u0644\u0650\u0643\u064e [h:11[\u0671]\u0644\u0652\u0643\u0650\u062a\u064e[n[\u0640\u0670]\u0628\u064f"; // using \u0670 because we replace it

function parse(text) {
    const elements = [];
    const regex = /\[([a-z]+)(?::\d+)?\[([^\]]*)\]/g;
    let lastIndex = 0;
    let match;

    console.log("Input Text:", text);

    while ((match = regex.exec(text)) !== null) {
        console.log("Match Found:", match[0]);
        console.log("  Tag:", match[1]);
        console.log("  Content:", match[2]);
        console.log("  Index:", match.index);
        console.log("  LastIndex (regex):", regex.lastIndex);

        if (match.index > lastIndex) {
            const before = text.substring(lastIndex, match.index);
            elements.push({ type: 'text', content: before });
        }

        elements.push({ type: 'tag', tag: match[1], content: match[2] });

        lastIndex = regex.lastIndex;
        // Double bracket logic
        if (text[lastIndex] === ']') {
            console.log("  Skipping double bracket at", lastIndex);
            lastIndex++;
        }
    }

    if (lastIndex < text.length) {
        elements.push({ type: 'text', content: text.substring(lastIndex) });
    }

    console.log("Parsed Elements:", JSON.stringify(elements, null, 2));
}

parse(inputText);
