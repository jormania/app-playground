export const RULES = {
  CATEGORY_SPIKE_PCT: 50,
  CATEGORY_SPIKE_MIN_AMT: 100,
  LARGE_TX_MULTIPLIER: 3, // e.g. 3x larger than average
  LARGE_TX_MIN_AMT: 100,
  LARGE_TX_MIN_HISTORY: 3, // don't call a transaction unusual off one prior sample
  MIN_MONTHS_FOR_BASELINE: 2, // a single month of history is not an average
  MAX_ALERTS: 6,
  SAVINGS_TARGET: 0.20,
  SPORADIC_CATEGORIES: ['travel', 'property', 'gift', 'health', 'taxes & fees', 'tax', 'loan']
};

export const KEYWORDS = {
  NEEDS: ['hous', 'utilit', 'food', 'health', 'transport', 'propert', 'tax', 'loan', 'educat', 'personal'],
  WANTS: ['din', 'leisure', 'shop', 'travel', 'nora', 'gift', 'other', 'entertain', 'subscript'],
  SAVINGS: ['invest', 'savin']
};

export const TIME = {
  HISTORICAL_MONTHS_LOOKBACK: 3 // e.g. average of last 3 months
};

/**
 * Keyword matching used by every classifier.
 *
 * Plain entries match at a **word start**, so stems keep working (`propert` →
 * "Property", "Properties") without the substring accidents the old
 * `text.includes(kw)` produced: `ac` matched "contract", `art` matched
 * "apartment", `din` matched "building".
 *
 * An entry prefixed with `=` must match a **whole word** — for short, common
 * strings where even a word-start match over-fires (`=bar` must not match
 * "Barcelona", `=budget` must not match the word budget in a note).
 */
const regexCache = new Map();

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toRegex(keyword) {
  if (regexCache.has(keyword)) return regexCache.get(keyword);
  const exact = keyword.startsWith('=');
  const body = escapeRegExp(exact ? keyword.slice(1) : keyword);
  // \b before; \b after only for exact matches, so stems still match longer words.
  const re = new RegExp(exact ? `\\b${body}\\b` : `\\b${body}`, 'i');
  regexCache.set(keyword, re);
  return re;
}

export function matchesKeyword(text, keyword) {
  if (!text || !keyword) return false;
  return toRegex(keyword).test(text);
}

export function matchesAny(text, keywords) {
  if (!text || !keywords) return false;
  return keywords.some(k => matchesKeyword(text, k));
}

/**
 * Travel sub-classification. Order matters — the first bucket that matches wins —
 * so the more specific lists come first. `nora`, `kid` and `child` used to live in
 * the activities list, which leaked family spending into travel analytics.
 */
export const TRAVEL_KEYWORDS = {
  accommodation: ['hotel', 'resort', 'airbnb', 'lodg', 'accom', 'motel', 'booking', 'expedia', 'marriott', 'hilton', 'radisson', 'sheraton', 'hyatt', 'hostel', 'villa', 'chalet', 'apartment', 'vrbo', 'agoda', '=room', '=stay'],
  transit: ['flight', 'train', 'uber', 'bolt', 'taxi', 'rental car', 'car rental', 'fuel', 'transit', 'airport', '=bus', 'metro', 'subway', 'coach', 'ferry', '=boat', '=toll', 'vignette', 'parking', 'ryanair', 'wizz', 'tarom', 'lufthansa', '=klm', 'air france', 'british airways', 'emirates', 'qatar', 'hertz', 'sixt', 'avis', 'europcar', '=rail', '=obb', '=cfr', '=cab', 'airline', 'airways', '=gas station', '=petrol'],
  dining: ['restaur', 'café', 'cafe', 'lunch', 'dinner', 'breakfast', 'brunch', 'meal', 'snack', '=bar', '=pub', 'drink', 'bistro', 'pizzeria', 'gelato', 'ice cream', 'bakery', 'patisserie', 'supermarket', 'grocer', 'market', 'mega image', 'carrefour', 'lidl', 'kaufland', '=spar', 'billa', '=rewe', 'tesco', 'coffee', 'starbucks', 'costa', 'mcdonald', 'burger', 'pizza', 'sushi'],
  activities: ['ticket', 'museum', '=zoo', '=tour', 'palace', '=park', '=pass', '=ski', '=show', 'excursion', 'guide', 'attraction', 'gallery', 'castle', 'cathedral', 'church', 'monument', 'aquarium', 'concert', 'theatre', 'theater', 'cinema', 'boat trip', 'cruise', 'cable car', 'gondola', 'entertainment', 'adventure'],
  shopping: ['shop', 'souvenir', 'gift', 'duty free', 'chocolat', 'cloth', '=mall', 'store', 'boutique', 'craft', 'handicraft', 'merchandise', '=merch', 'fashion', 'zara', '=h&m']
};

/**
 * Property sub-classification. `=ac` (air conditioning) is an exact-word match —
 * as a substring it matched "contract", "vacation" and "farmacie". `gas` and
 * `electric` intentionally appear only under utilities; maintenance keeps the
 * repair verbs.
 */
export const PROPERTY_KEYWORDS = {
  mortgage: ['mortgage', '=loan', '=rate', 'credit', 'interest', 'banca'],
  maintenance: ['repair', '=fix', 'plumb', 'mainten', 'boiler', '=ac', 'paint', '=leak', 'handyman', 'contractor', 'renovat'],
  taxes: ['=tax', '=taxes', 'impozit', 'asigurare', 'insurance', '=pad', '=fee', '=fees', '=duty'],
  utilities: ['utilit', '=hoa', 'water', '=gas', 'electric', 'internet', 'administratie', 'gunoi', 'curatenie', 'heating']
};

/** Child/family-support sub-classification. */
export const NORA_KEYWORDS = {
  education: ['school', 'tuition', 'support', 'alimony', 'kindergarten', 'afterschool', 'educat', '=book', '=books', 'course', '=class'],
  activities: ['swim', 'tennis', 'sport', '=club', 'workshop', 'activit', '=camp', 'piano', 'dance', '=gym', '=zoo', '=park', 'attraction'],
  health: ['doctor', 'pediatric', 'health', '=med', 'medic', 'pharmac', 'dentist', 'clinic', 'checkup'],
  clothes: ['cloth', '=shoe', '=shoes', 'jacket', '=coat', 'dress', 'fashion', 'zara', '=h&m'],
  gifts: ['=toy', '=toys', 'gift', '=game', '=games', 'lego', '=doll', 'birthday', 'christmas', 'party']
};

/** Descriptions that mark a mandatory family obligation rather than a discretionary want. */
export const OBLIGATION_KEYWORDS = ['alimony', 'child support', 'maintenance', 'tuition', 'child care'];
