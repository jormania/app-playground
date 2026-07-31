const fs = require('fs');
function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  for (const rep of replacements) {
    if (typeof rep.from === 'string') {
      content = content.split(rep.from).join(rep.to);
    } else {
      content = content.replace(rep.from, rep.to);
    }
  }
  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath}`);
  }
}

// 1. Modify src/where-it-went/lib/accounts.js
replaceInFile('src/where-it-went/lib/accounts.js', [
  { from: `const icon = account.icon ? \`\${account.icon} \` : '';`, to: `const icon = ''; // SVG used in components instead` }
]);

// 2. Refactor TransactionForm.jsx
replaceInFile('src/where-it-went/components/TransactionForm.jsx', [
  { from: `import { CategorySelect } from './CategorySelect';`, to: `import { CategorySelect } from './CategorySelect';\nimport { AccountSelect } from './AccountSelect';` },
  { from: /<select\s+id=\{accountSelectId\}\s+value=\{accountId\}\s+onChange=\{e => \{\s+manualEdit\.current\.account = true;\s+setAccountId\(e\.target\.value\);\s+\}\}\s+required\s+style=\{selectStyle\}\s*>\s*<option value="" disabled>Select…<\/option>\s*\{sortedAccounts\.map\(a => \(\s*<option key=\{a\.id\} value=\{a\.id\}>\{formatAccountLabel\(a\)\}<\/option>\s*\)\}\s*<\/select>/g, to: `<AccountSelect id={accountSelectId} value={accountId} onChange={e => { manualEdit.current.account = true; setAccountId(e.target.value); }} required style={selectStyle} accounts={sortedAccounts} />` },
  { from: /<select id=\{toAccountSelectId\}\s+value=\{toAccountId\}\s+onChange=\{e => setToAccountId\(e\.target\.value\)\}\s+required\s+style=\{selectStyle\}\s*>\s*<option value="">Select…<\/option>\s*\{sortedAccounts\.filter\(a => a\.id !== accountId\)\.map\(a => \(\s*<option key=\{a\.id\} value=\{a\.id\}>\{formatAccountLabel\(a\)\}<\/option>\s*\)\}\s*<\/select>/g, to: `<AccountSelect id={toAccountSelectId} value={toAccountId} onChange={e => setToAccountId(e.target.value)} required style={selectStyle} accounts={sortedAccounts.filter(a => a.id !== accountId)} />` }
]);

// 3. Refactor TemplateEditorModal.jsx
replaceInFile('src/where-it-went/components/TemplateEditorModal.jsx', [
  { from: `import { CategorySelect } from './CategorySelect';`, to: `import { CategorySelect } from './CategorySelect';\nimport { AccountSelect } from './AccountSelect';` },
  { from: /<select id=\{accountSelectId\}\s+value=\{accountId\}\s+onChange=\{e => setAccountId\(e\.target\.value\)\}\s+required\s+style=\{selectStyle\}\s*>\s*<option value="" disabled>Select…<\/option>\s*\{sortedAccounts\.map\(a => \(\s*<option key=\{a\.id\} value=\{a\.id\}>\{formatAccountLabel\(a\)\}<\/option>\s*\)\}\s*<\/select>/g, to: `<AccountSelect id={accountSelectId} value={accountId} onChange={e => setAccountId(e.target.value)} required style={selectStyle} accounts={sortedAccounts} />` }
]);

// 4. Refactor SubscriptionEditorModal.jsx
replaceInFile('src/where-it-went/components/SubscriptionEditorModal.jsx', [
  { from: `import { CategorySelect } from './CategorySelect';`, to: `import { CategorySelect } from './CategorySelect';\nimport { AccountSelect } from './AccountSelect';` },
  { from: /<select id="sub-account"\s+value=\{accountId\}\s+onChange=\{e => setAccountId\(e\.target\.value\)\}\s+required\s+style=\{selectStyle\}\s*>\s*<option value="" disabled>Select…<\/option>\s*\{sortedAccounts\.map\(a => \(\s*<option key=\{a\.id\} value=\{a\.id\}>\{formatAccountLabel\(a\)\}<\/option>\s*\)\}\s*<\/select>/g, to: `<AccountSelect id="sub-account" value={accountId} onChange={e => setAccountId(e.target.value)} required style={selectStyle} accounts={sortedAccounts} />` }
]);

// 5. Refactor TransactionsList.jsx
replaceInFile('src/where-it-went/components/TransactionsList.jsx', [
  { from: `import { CategoryIcon } from './CategoryIcon';`, to: `import { CategoryIcon } from './CategoryIcon';\nimport { AccountIcon } from './AccountIcon';` },
  { from: /<div className="tx-col-account".*?>\s*\{isTransfer && tx\.toAccountId\s*\?\s*`\$\{accountLabelById\(accountsById, tx\.accountId\)\} → \$\{accountLabelById\(accountsById, tx\.toAccountId\)\}`\s*:\s*accountLabelById\(accountsById, tx\.accountId\)\}\s*<\/div>/g, to: `<div className="tx-col-account" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
                      {isTransfer && tx.toAccountId ? (
                        <>
                          <AccountIcon account={accountsById.get(tx.accountId)} style={{ marginRight: '4px' }} />
                          {accountLabelById(accountsById, tx.accountId)}
                          <span style={{ margin: '0 4px' }}>→</span>
                          <AccountIcon account={accountsById.get(tx.toAccountId)} style={{ marginRight: '4px' }} />
                          {accountLabelById(accountsById, tx.toAccountId)}
                        </>
                      ) : (
                        <>
                          <AccountIcon account={accountsById.get(tx.accountId)} style={{ marginRight: '4px' }} />
                          {accountLabelById(accountsById, tx.accountId)}
                        </>
                      )}
                    </div>` }
]);

// 6. Refactor DuplicateReview.jsx
replaceInFile('src/where-it-went/components/DuplicateReview.jsx', [
  { from: `import { CategoryIcon } from './CategoryIcon';`, to: `import { CategoryIcon } from './CategoryIcon';\nimport { AccountIcon } from './AccountIcon';` },
  { from: `const account = accountsById?.get(t.accountId);`, to: `const account = accountsById?.get(t.accountId);` },
  { from: `<span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>\n                            {accountLabelById(accountsById, t.accountId)}\n                          </span>`, to: `<span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
                            {account && <AccountIcon account={account} style={{ marginRight: '4px' }} />}
                            {accountLabelById(accountsById, t.accountId)}
                          </span>` }
]);

console.log('Patch complete.');
