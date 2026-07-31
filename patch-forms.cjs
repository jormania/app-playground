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

// TransactionForm.jsx
replaceInFile('src/where-it-went/components/TransactionForm.jsx', [
  { from: `import { CategorySelect } from './CategorySelect';`, to: `import { CategorySelect } from './CategorySelect';\nimport { AccountSelect } from './AccountSelect';` },
  { 
    from: /<select\s+id=\{accountSelectId\}\s+value=\{accountId\}[\s\S]*?<\/select>/, 
    to: `<AccountSelect id={accountSelectId} value={accountId} onChange={e => { manualEdit.current.account = true; setAccountId(e.target.value); currencyTouched.current = false; }} required style={selectStyle} accounts={sortedAccounts.filter(a => !isTransfer || a.id !== toAccountId)} />`
  },
  { 
    from: /<select\s+id=\{toAccountSelectId\}\s+value=\{toAccountId\}[\s\S]*?<\/select>/, 
    to: `<AccountSelect id={toAccountSelectId} value={toAccountId} onChange={e => setToAccountId(e.target.value)} required style={selectStyle} accounts={sortedAccounts.filter(a => a.id !== accountId)} />`
  }
]);

// TemplateEditorModal.jsx
replaceInFile('src/where-it-went/components/TemplateEditorModal.jsx', [
  { from: `import { CategorySelect } from './CategorySelect';`, to: `import { CategorySelect } from './CategorySelect';\nimport { AccountSelect } from './AccountSelect';` },
  { 
    from: /<select\s+id=\{accountSelectId\}\s+value=\{accountId\}[\s\S]*?<\/select>/, 
    to: `<AccountSelect id={accountSelectId} value={accountId} onChange={e => setAccountId(e.target.value)} required style={selectStyle} accounts={sortedAccounts} />`
  }
]);

console.log('Patch complete for TransactionForm and TemplateEditorModal');
