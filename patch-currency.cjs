const fs = require('fs');
function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  for (const rep of replacements) {
    content = content.replace(rep.from, rep.to);
  }
  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath}`);
  }
}

replaceInFile('src/where-it-went/components/TransactionForm.jsx', [
  { from: `import { AccountSelect } from './AccountSelect';`, to: `import { AccountSelect } from './AccountSelect';\nimport { CurrencySelect } from './CurrencySelect';\nimport { CURRENCIES } from '../lib/fx';` },
  { 
    from: /<select\s+id=\{currencySelectId\}\s+aria-label="Currency"\s+value=\{activeCurrency\}\s+onChange=\{e => \{\s+setCurrency\(e\.target\.value\);\s+currencyTouched\.current = true;[\s\S]*?\}\}\s+style=\{\{[\s\S]*?\}\}\s*>\s*\{orderedCurrencies\(priorityCurrency\)\.map\(code => \(\s*<option key=\{code\} value=\{code\}>\{code\}<\/option>\s*\)\}\s*<\/select>/,
    to: `<CurrencySelect id={currencySelectId} value={activeCurrency} onChange={e => { setCurrency(e.target.value); currencyTouched.current = true; baseTouched.current = false; initialAmount.current = null; }} currencies={orderedCurrencies(priorityCurrency)} style={{ flex: 'none', outline: 'none', background: 'transparent', border: 'none', borderLeft: '1px solid var(--color-border-2)', color: 'var(--color-ink)', fontSize: 'var(--text-base)', fontFamily: 'inherit', padding: '0 0 0 6px', cursor: 'pointer' }} />`
  }
]);

// Wait, I should also check if the TemplateEditorModal has a currency. I ran a search earlier, let's look at it if needed.
console.log('Currency patch complete.');
