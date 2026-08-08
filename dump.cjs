const fs = require('fs');
const path = require('path');
const out = [];
const walk = d => {
  fs.readdirSync(d).forEach(f => {
    const p = path.join(d, f);
    if (p.includes('data')) return;
    if (fs.statSync(p).isDirectory()) walk(p);
    else out.push(`\n--- ${p} ---\n${fs.readFileSync(p, 'utf8')}`);
  });
};
walk('src/lexi5');
fs.writeFileSync('lexi5_dump.txt', out.join(''));
