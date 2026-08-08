const fs = require('fs');
const wordsData = require('../src/lexi5/data/words.json');

const isValidGuess = (word) => wordsData.guesses.includes(word);

function simulateAppLogic(rawClaudeOutput, wordCount) {
  let words = [];
  const match = rawClaudeOutput.match(/\[([\s\S]*?)\]/);
  if (match) {
    try {
      words = JSON.parse(match[0]);
    } catch {
      words = [...rawClaudeOutput.matchAll(/"([a-zA-Z]+)"/g)].map(m => m[1]);
    }
  } else {
    words = [...rawClaudeOutput.matchAll(/"([a-zA-Z]+)"/g)].map(m => m[1]);
  }
  
  // App filtering logic exactly as it is in Settings.jsx
  words = [...new Set(words.map(w => w.toLowerCase()))].filter(w => w.length === 5 && /^[a-z]+$/.test(w));
  
  const validWords = words.filter(w => isValidGuess(w));
  const discardedCount = words.length - validWords.length;
  
  return {
    rawLength: words.length + discardedCount, // length before valid filter (but after length filter)
    finalLength: validWords.length,
    discardedCount,
    discardedWords: words.filter(w => !isValidGuess(w)),
    sample: validWords.slice(0, 5)
  };
}

const scenarios = {
  '1. Ideal Vanilla Output': JSON.stringify(['apple', 'crane', 'hello', 'world', 'tiger', 'sweet', 'heart']),
  '2. Panic Padding (Claude runs out of space words)': JSON.stringify([
    'alien', 'orbit', 'stars', 'moons', 'comet', 
    'spsce', // hallucinated typo
    'galxy', // fake 5-letter string to hit quota
    'starr', // hallucinated
    'planet', // 6 letters (will be stripped silently by regex filter)
    'mars1' // invalid chars (stripped by regex filter)
  ]),
  '3. Chatty Degradation (Claude forgets to output pure JSON)': `Here is the list you requested:
[
  "Brave", "CRAZY", "hello", "W0rld", "super", "duper"
]
I hope this helps!`
};

console.log("=========================================");
console.log("   LEXI5 AI CURATION PIPELINE TESTS   ");
console.log("=========================================\n");

for (const [name, raw] of Object.entries(scenarios)) {
  console.log(`[SCENARIO] ${name}`);
  console.log(`Raw Claude Output:\n${raw.length > 100 ? raw.substring(0, 100) + '...' : raw}\n`);
  
  const res = simulateAppLogic(raw, 50);
  console.log(`- Words that made it past regex format/length filters: ${res.rawLength}`);
  console.log(`- Discarded (fake/invalid English words): ${res.discardedCount} ${res.discardedWords.length > 0 ? '(' + res.discardedWords.join(', ') + ')' : ''}`);
  console.log(`- FINAL ACCEPTED WORDS: ${res.finalLength}`);
  console.log(`- Accepted Sample: [${res.sample.join(', ')}]`);
  console.log("\n-----------------------------------------\n");
}
