const https = require('https');
const fs = require('fs');

const code = fs.readFileSync('src/click-deck/lib/seed-data.js', 'utf8');
const titles = [];
const regex = /title:\s*"([^"]+)"[\s\S]*?(?:coverUrl:\s*"([^"]+)")?/g;
let match;
while ((match = regex.exec(code)) !== null) {
  titles.push({ title: match[1], url: match[2] });
}

async function checkUrl(url) {
  if (!url) return false;
  return new Promise((resolve) => {
    https.get(url, (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => resolve(false));
  });
}

async function run() {
  for (const item of titles) {
    if (item.url) {
      const ok = await checkUrl(item.url);
      console.log(`${item.title}: ${ok ? 'OK' : '404'} (${item.url})`);
    } else {
      console.log(`${item.title}: MISSING`);
    }
  }
}
run();
