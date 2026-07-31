import { Landmark, CreditCard, PiggyBank, Banknote, TrendingUp, Globe, Wallet } from 'lucide-react';
import { useContext } from 'react';
import { FeaturesContext } from '../FeaturesContext';

export function AccountIcon({ account, size = 14, style = {}, ...props }) {
  const features = useContext(FeaturesContext);
  const useLucide = features?.flairLucideIcons === true;

  const t = (account?.type || '').toLowerCase();
  const n = (account?.name || '').toLowerCase();

  if (useLucide) {
    let Icon = Landmark;
    if (n.includes('revolut')) Icon = Globe;
    else if (t.includes('credit') || n.includes('credit')) Icon = CreditCard;
    else if (t.includes('checking') || n.includes('checking')) Icon = Landmark;
    else if (t.includes('savings') || n.includes('savings')) Icon = PiggyBank;
    else if (t.includes('cash') || n.includes('cash')) Icon = Banknote;
    else if (t.includes('investment') || n.includes('investment')) Icon = TrendingUp;

    return <Icon size={size} style={{ flexShrink: 0, ...style }} {...props} />;
  }

  // Classical SVG (emoji text)
  let fallbackEmoji = '🏦';
  if (n.includes('revolut')) fallbackEmoji = '🌍';
  else if (t.includes('credit') || n.includes('credit')) fallbackEmoji = '💳';
  else if (t.includes('checking') || n.includes('checking')) fallbackEmoji = '🏦';
  else if (t.includes('savings') || n.includes('savings')) fallbackEmoji = '🐷';
  else if (t.includes('cash') || n.includes('cash')) fallbackEmoji = '💵';
  else if (t.includes('investment') || n.includes('investment')) fallbackEmoji = '📈';

  const iconText = account?.icon || fallbackEmoji;
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
