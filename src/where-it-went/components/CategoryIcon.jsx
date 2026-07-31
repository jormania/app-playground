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

import { useContext } from 'react';
import { FeaturesContext } from '../FeaturesContext';

export function CategoryIcon({ category, name, size = 14, style = {}, ...props }) {
  const features = useContext(FeaturesContext);
  const useLucide = features?.flairLucideIcons === true;

  if (useLucide) {
    const catName = (category?.name || name || '').toLowerCase();
    const Icon = CATEGORY_ICONS[catName] || Tag;
    return <Icon size={size} style={{ flexShrink: 0, ...style }} {...props} />;
  }

  // Classical SVG (emoji text)
  const iconText = category?.icon || '📌';
  return (
    <span 
      aria-hidden="true" 
      style={{ fontSize: `${size + 2}px`, width: `${size + 6}px`, textAlign: 'center', flexShrink: 0, display: 'inline-block', lineHeight: 1, ...style }} 
      {...props}
    >
      {iconText}
    </span>
  );
}
