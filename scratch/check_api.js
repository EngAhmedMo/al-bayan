const checkApi = async () => {
  try {
    const res = await fetch('https://api.alquran.cloud/v1/ayah/2:24/quran-uthmani');
    const json = await res.json();
    const text = json.data.text;
    console.log("Raw text:", text);
    
    // Log each character and its code point
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const code = text.charCodeAt(i);
      console.log(`Index ${i}: '${char}' (U+${code.toString(16).toUpperCase()})`);
    }
  } catch (e) {
    console.error("Error:", e);
  }
};

checkApi();
