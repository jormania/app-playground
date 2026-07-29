// 24 hues, spread around the wheel and alternating in value so neighbours stay
// distinguishable. The old 15-colour list collided constantly once a user had
// ~20 categories — two categories sharing one colour across the doughnut, the
// badges and the row edge at the same time.
export const CHART_COLORS = [
  'hsl(348, 83%, 60%)', 'hsl(217, 91%, 60%)', 'hsl(43, 96%, 56%)', 'hsl(142, 71%, 45%)',
  'hsl(280, 65%, 60%)', 'hsl(199, 89%, 48%)', 'hsl(25, 95%, 53%)', 'hsl(316, 70%, 55%)',
  'hsl(160, 65%, 45%)', 'hsl(13, 90%, 58%)', 'hsl(240, 60%, 65%)', 'hsl(60, 80%, 45%)',
  'hsl(330, 75%, 55%)', 'hsl(180, 60%, 45%)', 'hsl(290, 65%, 55%)', 'hsl(95, 55%, 45%)',
  'hsl(5, 70%, 50%)', 'hsl(205, 70%, 40%)', 'hsl(35, 85%, 45%)', 'hsl(265, 55%, 50%)',
  'hsl(125, 45%, 40%)', 'hsl(300, 45%, 45%)', 'hsl(20, 60%, 45%)', 'hsl(170, 75%, 35%)'
];

export function getCategoryColor(categoryName) {
  if (!categoryName) return 'var(--color-muted)';
  let hash = 0;
  for (let i = 0; i < categoryName.length; i++) {
    hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % CHART_COLORS.length;
  return CHART_COLORS[index];
}
