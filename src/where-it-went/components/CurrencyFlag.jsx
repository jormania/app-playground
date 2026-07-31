import { RO, EU, US, GB, CH, PL, HU, CZ, BG, TR, SE, NO, DK, JP, CA, AU } from 'country-flag-icons/react/3x2';

const FLAG_COMPONENTS = {
  'RON': RO,
  'EUR': EU,
  'USD': US,
  'GBP': GB,
  'CHF': CH,
  'PLN': PL,
  'HUF': HU,
  'CZK': CZ,
  'BGN': BG,
  'TRY': TR,
  'SEK': SE,
  'NOK': NO,
  'DKK': DK,
  'JPY': JP,
  'CAD': CA,
  'AUD': AU,
};

export function CurrencyFlag({ currency, style = {}, className }) {
  const code = (currency || '').toUpperCase();
  const FlagComponent = FLAG_COMPONENTS[code];
  
  if (!FlagComponent) return null;
  
  return (
    <FlagComponent 
      style={{ 
        width: '1.2em', 
        height: '1.2em', 
        objectFit: 'cover', 
        borderRadius: '2px', 
        flexShrink: 0, 
        ...style 
      }} 
      className={className} 
    />
  );
}
