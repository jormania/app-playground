import { Landmark, CreditCard, PiggyBank, Banknote, TrendingUp, Globe, Wallet } from 'lucide-react';
import { useContext } from 'react';
import { FeaturesContext } from '../FeaturesContext';

export function AccountIcon({ account, size = 14, style = {}, ...props }) {
  const features = useContext(FeaturesContext);
  const useLucide = features?.flairLucideIcons === true;

  if (useLucide) {
    const t = (account?.type || '').toLowerCase();
    const n = (account?.name || '').toLowerCase();
    
    let Icon = Landmark;
    if (n.includes('revolut')) Icon = Globe;
    else if (t.includes('checking')) Icon = Wallet;
    else if (t.includes('credit')) Icon = CreditCard;
    else if (t.includes('savings')) Icon = PiggyBank;
    else if (t.includes('cash')) Icon = Banknote;
    else if (t.includes('investment')) Icon = TrendingUp;

    return <Icon size={size} style={{ flexShrink: 0, ...style }} {...props} />;
  }

  // Classical SVG (emoji text)
  const iconText = account?.icon || '🏦';
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
