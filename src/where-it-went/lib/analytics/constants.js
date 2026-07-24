export const RULES = {
  CATEGORY_SPIKE_PCT: 50,
  CATEGORY_SPIKE_MIN_AMT: 100,
  LARGE_TX_MULTIPLIER: 3, // e.g. 3x larger than average
  SAVINGS_TARGET: 0.20,
  SPORADIC_CATEGORIES: ['travel', 'property', 'gift', 'health', 'taxes & fees']
};

export const KEYWORDS = {
  NEEDS: ['hous', 'utilit', 'food', 'health', 'transport', 'propert', 'tax', 'loan'],
  WANTS: ['din', 'leisure', 'shop', 'travel', 'nora', 'gift', 'other'],
  SAVINGS: ['invest']
};

export const TIME = {
  HISTORICAL_MONTHS_LOOKBACK: 3 // e.g. average of last 3 months
};
