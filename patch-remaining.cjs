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

// 3. Refactor TemplateEditorModal.jsx
replaceInFile('src/where-it-went/components/TemplateEditorModal.jsx', [
  { from: `import { Modal } from '../../ds/components/Modal';`, to: `import { Modal } from '../../ds/components/Modal';\nimport { CategorySelect } from './CategorySelect';` },
  { from: /<select id=\{categorySelectId\}[\s\S]*?<\/select>/, to: `<CategorySelect id={categorySelectId} value={categoryId} onChange={e => setCategoryId(e.target.value)} required style={selectStyle} categories={availableCategories} />` }
]);

// 5. Refactor SplitTransactionModal.jsx
replaceInFile('src/where-it-went/components/SplitTransactionModal.jsx', [
  { from: `import { Button } from '../../ds/components/Button';`, to: `import { Button } from '../../ds/components/Button';\nimport { CategorySelect } from './CategorySelect';` },
  { from: /<select id=\{categorySelectId\}[\s\S]*?<\/select>/, to: `<CategorySelect id={categorySelectId} value={splitCategoryId} onChange={e => setSplitCategoryId(e.target.value)} required style={selectStyle} categories={filteredCategories} />` }
]);
