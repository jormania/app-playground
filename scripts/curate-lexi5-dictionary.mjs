import fs from 'fs';
import path from 'path';
import https from 'https';

const OUT_PATH = path.join(process.cwd(), 'src', 'lexi5', 'data', 'words.json');
const SGB_PATH = path.join(process.cwd(), 'sgb-words.txt');

const fetchJson = (url) => new Promise((resolve, reject) => {
  https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e);
      }
    });
  }).on('error', reject);
});

async function main() {
  // 'lite' is hand-curated (age-appropriate word selection isn't something the source
  // lists encode) and lives only in the output file — preserve it across regeneration
  // instead of silently dropping it when this script overwrites `dictionaries`.
  let existingLite = [];
  try {
    const existing = JSON.parse(fs.readFileSync(OUT_PATH, 'utf-8'));
    existingLite = existing.dictionaries?.lite || [];
  } catch (_e) {
    // No existing output yet — that's fine, just means no 'lite' list to preserve.
  }

  console.log('Fetching official Wordle lists from stuartpb/wordles...');
  const wordleAnswers = await fetchJson('https://raw.githubusercontent.com/stuartpb/wordles/master/wordles.json');
  const wordleGuesses = await fetchJson('https://raw.githubusercontent.com/stuartpb/wordles/master/nonwordles.json');

  console.log('Reading SGB (Stanford GraphBase) words...');
  const sgbText = fs.readFileSync(SGB_PATH, 'utf-8');
  const sgbWords = sgbText.split('\n').map(w => w.trim().toLowerCase()).filter(w => w.length === 5 && /^[a-z]+$/.test(w));

  const allGuesses = Array.from(new Set([...wordleAnswers, ...wordleGuesses, ...sgbWords]));

  const data = {
    dictionaries: {
      lite: existingLite, // hand-curated, easy 5-letter words — see LEXI5.md
      standard: wordleAnswers, // ~2,300 common words (Official)
      expanded: sgbWords, // ~5,700 words (SGB - more varied)
      expert: allGuesses // ~13,000 words (Includes very obscure words)
    },
    guesses: allGuesses
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8');

  console.log(`Successfully compiled Lexi5 multi-dictionary!`);
  console.log(`Lite (preserved): ${data.dictionaries.lite.length} words`);
  console.log(`Standard (Official): ${data.dictionaries.standard.length} words`);
  console.log(`Expanded (SGB): ${data.dictionaries.expanded.length} words`);
  console.log(`Expert (All): ${data.dictionaries.expert.length} words`);
  console.log(`Total Valid Guesses: ${data.guesses.length} words`);
  console.log(`Saved to ${OUT_PATH}`);
}

main().catch(console.error);
