const fs = require('fs');
const glob = require('glob'); // Note: if glob is not installed, we can just use native recursive readdir
const path = require('path');

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

// 1. Refactor TransactionsList.jsx
replaceInFile('src/where-it-went/components/TransactionsList.jsx', [
  { from: `import { Briefcase, MoreHorizontal, PiggyBank, Landmark, Home, Heart, ShoppingCart, Smile, Plane, Car, Coffee, Utensils, Lightbulb, Gift, Tag } from 'lucide-react';`, to: `import { CategoryIcon } from './CategoryIcon';` },
  { from: /const CATEGORY_ICONS = \{[\s\S]*?\};\nconst getCategoryIcon = \(name\) => \{\n[\s\S]*?\};\n/, to: '' },
  { from: `{getCategoryIcon(cat.name)}`, to: `<CategoryIcon name={cat.name} style={{ marginRight: '6px' }} />` },
  { from: `import { getCategoryColor } from '../lib/colors';`, to: `import { getCategoryColor } from '../lib/colors';\nimport { CategoryIcon } from './CategoryIcon';` }
]);

// 2. Refactor TransactionForm.jsx
replaceInFile('src/where-it-went/components/TransactionForm.jsx', [
  { from: `import DuplicateReview from './DuplicateReview';`, to: `import DuplicateReview from './DuplicateReview';\nimport { CategorySelect } from './CategorySelect';` },
  { from: /<select id=\{categorySelectId\}[\s\S]*?<\/select>/, to: `<CategorySelect id={categorySelectId} value={categoryId} onChange={e => { manualEdit.current.category = true; setCategoryId(e.target.value); }} required style={selectStyle} categories={availableCategories} />` }
]);

// 3. Refactor TemplateEditorModal.jsx
replaceInFile('src/where-it-went/components/TemplateEditorModal.jsx', [
  { from: `import { Modal } from '../../ds/components/Modal';`, to: `import { Modal } from '../../ds/components/Modal';\nimport { CategorySelect } from './CategorySelect';` },
  { from: /<select id="template-category"[\s\S]*?<\/select>/, to: `<CategorySelect id="template-category" value={categoryId} onChange={e => setCategoryId(e.target.value)} required style={selectStyle} categories={availableCategories} />` }
]);

// 4. Refactor SubscriptionEditorModal.jsx
replaceInFile('src/where-it-went/components/SubscriptionEditorModal.jsx', [
  { from: `import { Modal } from '../../ds/components/Modal';`, to: `import { Modal } from '../../ds/components/Modal';\nimport { CategorySelect } from './CategorySelect';` },
  { from: /<select id="sub-category"[\s\S]*?<\/select>/, to: `<CategorySelect id="sub-category" value={categoryId} onChange={e => setCategoryId(e.target.value)} required style={selectStyle} categories={(data?.categories || []).filter(c => c.type === type)} />` }
]);

// 5. Refactor SplitTransactionModal.jsx
replaceInFile('src/where-it-went/components/SplitTransactionModal.jsx', [
  { from: `import { Button } from '../../ds/components/Button';`, to: `import { Button } from '../../ds/components/Button';\nimport { CategorySelect } from './CategorySelect';` },
  { from: /<select value=\{split\.categoryId\}[\s\S]*?<\/select>/, to: `<CategorySelect value={split.categoryId} onChange={e => updateSplit(idx, 'categoryId', e.target.value)} required style={{ ...selectStyle, padding: '4px 8px', fontSize: 'var(--text-sm)', height: '32px' }} categories={categories.filter(c => c.type === (split.amount < 0 ? 'Expense' : 'Income'))} />` }
]);

// 6. Refactor FilterSheet.jsx
replaceInFile('src/where-it-went/components/FilterSheet.jsx', [
  { from: `import { Button } from '../../ds/components/Button';`, to: `import { Button } from '../../ds/components/Button';\nimport { CategorySelect } from './CategorySelect';` },
  { from: /<select id="cat-filter"[\s\S]*?<\/select>/, to: `<CategorySelect id="cat-filter" value={categoryFilter === 'All' ? '' : categoryFilter} onChange={e => updateFilter('categoryFilter', e.target.value || 'All')} style={selectStyle} categories={[{id: '', name: 'All Categories'}, ...categories]} />` }
]);

// 7. Refactor BudgetEditorModal.jsx
replaceInFile('src/where-it-went/components/BudgetEditorModal.jsx', [
  { from: `import { Button } from '../../ds/components/Button';`, to: `import { Button } from '../../ds/components/Button';\nimport { CategoryIcon } from './CategoryIcon';` },
  { from: `label={\`\${c.icon ? \`\${c.icon} \` : ''}\${c.name}\`}`, to: `label={<span style={{display: 'flex', alignItems: 'center'}}><CategoryIcon name={c.name} style={{marginRight: '6px'}} />{c.name}</span>}` }
]);

// 8. Refactor DuplicateReview.jsx
replaceInFile('src/where-it-went/components/DuplicateReview.jsx', [
  { from: `import { Button } from '../../ds/components/Button';`, to: `import { Button } from '../../ds/components/Button';\nimport { CategoryIcon } from './CategoryIcon';` },
  { from: `{cat?.icon ? \`\${cat.icon} \` : ''}{t.description}`, to: `<>{cat && <CategoryIcon name={cat.name} style={{ marginRight: '4px' }} />}{t.description}</>` }
]);

// 9. Refactor UpcomingBanner.jsx
replaceInFile('src/where-it-went/components/UpcomingBanner.jsx', [
  { from: `import { Button } from '../../ds/components/Button';`, to: `import { Button } from '../../ds/components/Button';\nimport { CategoryIcon } from './CategoryIcon';` },
  { from: `const soonestIcon = categoriesById?.get(soonest.sub.categoryId)?.icon || '';`, to: `const soonestIcon = <CategoryIcon name={categoriesById?.get(soonest.sub.categoryId)?.name} style={{ marginRight: '4px' }} />;` },
  { from: `<span style={{ fontSize: 'var(--text-lg)' }}>{soonestIcon}</span>`, to: `<span style={{ fontSize: 'var(--text-lg)', display: 'flex', alignItems: 'center' }}>{soonestIcon}</span>` }
]);

// 10. Refactor UpcomingBills.jsx
replaceInFile('src/where-it-went/components/UpcomingBills.jsx', [
  { from: `import { cx } from '../../ds/lib/cx';`, to: `import { cx } from '../../ds/lib/cx';\nimport { CategoryIcon } from './CategoryIcon';` },
  { from: `{cat?.icon || (item.kind === 'transaction' ? '📌' : '🔁')}`, to: `cat ? <CategoryIcon name={cat.name} size={16} /> : (item.kind === 'transaction' ? '📌' : '🔁')` }
]);

// 11. Refactor Dashboard.jsx
replaceInFile('src/where-it-went/components/Dashboard.jsx', [
  { from: `import { filterByPeriod,`, to: `import { CategoryIcon } from './CategoryIcon';\nimport { filterByPeriod,` },
  { from: `<span style={{ fontWeight: 'var(--weight-medium)' }}>{b.icon ? \`\${b.icon} \` : ''}{b.name}</span>`, to: `<span style={{ fontWeight: 'var(--weight-medium)', display: 'flex', alignItems: 'center' }}><CategoryIcon name={b.name} style={{marginRight: '6px'}}/>{b.name}</span>` }
]);

// 12. Refactor notionClient.js
replaceInFile('src/where-it-went/lib/notionClient.js', [
  { from: `icon: row.icon?.type === 'emoji' ? row.icon.emoji : null,`, to: `icon: null, // Legacy emojis disabled in favor of Lucide SVGs` }
]);

console.log('Patch complete.');
