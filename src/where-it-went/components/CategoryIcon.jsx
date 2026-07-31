import { Briefcase, MoreHorizontal, PiggyBank, Landmark, Home, Heart, ShoppingCart, Smile, Plane, Car, Coffee, Utensils, Lightbulb, Gift, Tag, Building, Key, Hotel, TrainFront, Wrench, GraduationCap, Shirt, Activity } from 'lucide-react';

export const CATEGORY_ICONS = {
  freelance: Briefcase,
  other: MoreHorizontal,
  investing: PiggyBank,
  'taxes & fees': Landmark,
  property: Building,
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
  rent: Key,
  accommodation: Hotel,
  transit: TrainFront,
  activities: Activity,
  mortgage: Landmark,
  maintenance: Wrench,
  taxes: Landmark,
  education: GraduationCap,
  clothes: Shirt,
};

export const CATEGORY_EMOJIS = {
  freelance: '💼',
  other: '🔘',
  investing: '📈',
  'taxes & fees': '🏛️',
  property: '🏢',
  health: '❤️',
  shopping: '🛍️',
  leisure: '🍿',
  nora: '👶',
  travel: '✈️',
  transport: '🚗',
  dining: '🍽️',
  food: '🛒',
  utilities: '💡',
  housing: '🏠',
  loan: '🏦',
  gift: '🎁',
  rent: '🔑',
  accommodation: '🏨',
  transit: '🚇',
  activities: '🏄',
  mortgage: '🏦',
  maintenance: '🛠️',
  taxes: '🏛️',
  education: '🎓',
  clothes: '👕',
};

import { useContext } from 'react';
import { FeaturesContext } from '../FeaturesContext';

export function CategoryIcon({ category, name, size = 14, style = {}, ...props }) {
  const features = useContext(FeaturesContext);
  const useLucide = features?.flairLucideIcons === true;
  const catName = (category?.name || name || '').toLowerCase();

  if (useLucide) {
    const Icon = CATEGORY_ICONS[catName] || Tag;
    return <Icon size={size} style={{ flexShrink: 0, ...style }} {...props} />;
  }

  // Classical SVG (emoji text)
  const iconText = category?.icon || CATEGORY_EMOJIS[catName] || '📌';
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
