const fs = require('fs');
let content = fs.readFileSync('src/where-it-went/components/TransactionsList.jsx', 'utf8');

const importStatement = `import { Briefcase, MoreHorizontal, PiggyBank, Landmark, Home, Heart, ShoppingCart, Smile, Plane, Car, Coffee, Utensils, Lightbulb, Gift, Tag } from 'lucide-react';\n`;

content = importStatement + content;

const mapCode = `
const CATEGORY_ICONS = {
  freelance: Briefcase,
  other: MoreHorizontal,
  investing: PiggyBank,
  'taxes & fees': Landmark,
  property: Home,
  health: Heart,
  shopping: ShoppingCart,
  leisure: Smile,
  nora: Smile,
  travel: Plane,
  transport: Car,
  dining: Coffee,
  food: Utensils,
  utilities: Lightbulb,
  housing: Home,
  loan: Landmark,
  gift: Gift,
  rent: Home,
};
const getCategoryIcon = (name) => {
  const n = (name || '').toLowerCase();
  const Icon = CATEGORY_ICONS[n] || Tag;
  return <Icon size={14} style={{ marginRight: '6px', opacity: 0.7, flexShrink: 0 }} />;
};
`;

content = content.replace('export default function TransactionsList', mapCode + '\nexport default function TransactionsList');

// Remove the old Modal (using string match to be precise)
// We will replace it directly to avoid whitespace issues.
const modalRegex = /<Modal open=\{showBulkCategoryModal\}.*?title="Bulk Categorize">.*?<\/Modal>/s;
const newModal = `<Modal open={showBulkCategoryModal} onClose={() => setShowBulkCategoryModal(false)} title="Bulk Categorize">
           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', padding: '12px' }}>
             {(data.categories || []).map(cat => (
               <Button key={cat.id} size="sm" variant="secondary" onClick={() => handleBulkCategorize(cat.id)} disabled={bulkProcessing} style={{ padding: '6px 8px', justifyContent: 'flex-start' }}>
                 {getCategoryIcon(cat.name)}
                 <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</span>
               </Button>
             ))}
           </div>
        </Modal>`;

content = content.replace(modalRegex, newModal);
fs.writeFileSync('src/where-it-went/components/TransactionsList.jsx', content);
