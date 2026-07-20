const fs = require('fs');
const https = require('https');
const code = fs.readFileSync('src/click-deck/lib/seed-data.js', 'utf8');

const titles = [];
const lines = code.split('\n');
let currentTitle = null;
for(let i=0; i<lines.length; i++) {
  const line = lines[i];
  if(line.includes('title: ')) {
    const match = line.match(/title:\s*'([^']+)'|title:\s*"([^"]+)"/);
    if(match) currentTitle = match[1] || match[2];
  }
  if(line.includes('coverUrl: ')) {
    const match = line.match(/coverUrl:\s*'([^']+)'|coverUrl:\s*"([^"]+)"/);
    const url = match ? (match[1] || match[2]) : null;
    titles.push({title: currentTitle, url});
    currentTitle = null;
  }
}
async function checkUrl(url) {
  if (!url) return false;
  return new Promise((resolve) => {
    https.get(url, (res) => resolve(res.statusCode === 200)).on('error', () => resolve(false));
  });
}
async function run() {
  for (const item of titles) {
    const ok = await checkUrl(item.url);
    if(!ok) console.log(item.title + ' -> ' + item.url);
  }
  console.log('Done testing URLs');
}
run();
