const fs = require('fs');
const files = [
  'src/click-deck/components/TimelineView.test.jsx',
  'src/click-deck/components/GameCard.test.jsx',
  'src/click-deck/components/SettingsModal.test.jsx',
  'src/click-deck/components/GameEditorModal.test.jsx'
];
files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/import { render, screen(.*?)} from '@testing-library\/react'/, "import { render, screen$1, cleanup } from '@testing-library/react'");
  c = c.replace(/describe\('(.*?)', \(\) => {/, "import { afterEach } from 'vitest';\n\ndescribe('$1', () => {\n  afterEach(() => cleanup());");
  fs.writeFileSync(f, c);
});
