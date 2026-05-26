const https = require('https');

https.get('https://api.alquran.cloud/v1/ayah/2:24/quran-uthmani', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const text = json.data.text;
      console.log('Original Text:', text);
      console.log('Char codes:');
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const code = text.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0');
        console.log(`${char} (U+${code})`);
      }
    } catch (e) {
      console.error(e);
    }
  });
});
