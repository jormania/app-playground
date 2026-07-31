const fs = require('fs');

let content = fs.readFileSync('src/where-it-went/components/TransactionsList.jsx', 'utf8');

const regex = /<Modal open=\{showBulkCategoryModal\}.*?\{(data\.categories \|\| \[\])\.map\(cat => \(/s;

const newModal = `<Modal open={showBulkCategoryModal} onClose={() => setShowBulkCategoryModal(false)} title="Bulk Categorize">
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', padding: '12px' }}>
               {(data.categories || []).filter(cat => {
                 const selectedTypes = new Set(Array.from(selectedTxs).map(id => data.transactions.find(t => t.id === id)?.type).filter(t => t && t !== 'Transfer'));
                 return selectedTypes.size === 0 || selectedTypes.has(cat.type);
               }).map(cat => (`;

content = content.replace(regex, newModal);
fs.writeFileSync('src/where-it-went/components/TransactionsList.jsx', content);
