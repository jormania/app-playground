import { Briefcase, MoreHorizontal, PiggyBank, Landmark, Home, Heart, ShoppingCart, Smile, Plane, Car, Coffee, Utensils, Lightbulb, Gift, Tag } from 'lucide-react';

export const CATEGORY_ICONS = {
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

export function CategoryIcon({ name, size = 14, style = {}, ...props }) {
  const n = (name || '').toLowerCase();
  const Icon = CATEGORY_ICONS[n] || Tag;
  return <Icon size={size} style={{ flexShrink: 0, ...style }} {...props} />;
}
