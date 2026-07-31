import { Landmark, CreditCard, PiggyBank, Banknote, TrendingUp, Globe, Wallet } from 'lucide-react';

export function AccountIcon({ account, size = 14, style = {}, ...props }) {
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
