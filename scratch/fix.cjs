const fs = require('fs');
let code = fs.readFileSync('services/hadithApi.ts', 'utf8');
code = code.replace(/url:\s*'\/data\/(.*?)'/g, 'url: `${import.meta.env.BASE_URL}data/$1`');
fs.writeFileSync('services/hadithApi.ts', code);
console.log('Fixed URLs successfully!');
