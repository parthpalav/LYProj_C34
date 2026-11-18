// Keyword fallback classifier, used when the ML service is unreachable.
// Canonical V3 Keyword Map for fallback classification
export const KEYWORD_CATEGORY_MAP = {
  'Food & Dining': [
    'pizza','burger','biryani','pasta','noodles','sandwich','dosa','idli',
    'chai','coffee','restaurant','cafe','zomato','swiggy','dinner','lunch',
    'breakfast','starbucks','mcdonalds','dominos','kfc','subway','haldirams',
    'faasos','behrouz','chaayos','buffet','dhaba','eating out','food delivery'
  ],
  Groceries: [
    'vegetables','fruits','milk','eggs','bread','butter','curd','grocery','supermarket',
    'dmart','big bazaar','reliance fresh','more supermarket','ration','flour','sugar','salt',
    'cooking oil','spices','masala','lentils','pulses','cereal','oats','instant food',
    'blinkit','zepto','instamart','bigbasket','nature basket'
  ],
  'Transport & Travel': [
    'uber','ola','rapido','metro','train','flight','bus','cab','auto fare','commute',
    'petrol','diesel','cng','fastag','toll','irctc','indigo','air india','spicejet','vistara',
    'makemytrip','goibibo','hotel stay','hotel booking','airbnb','redbus','zoomcar'
  ],
  Housing: [
    'house rent','apartment rent','flat rent','rent payment','society maintenance',
    'building maintenance','residential maintenance','property tax','plumber','electrician',
    'carpenter','pest control','house painting','water tank cleaning','maid salary','cook salary'
  ],
  'Utilities & Bills': [
    'electricity bill','electricity','light bill','power bill','water bill','piped gas','gas bill',
    'lpg cylinder','internet','wifi bill','broadband','mobile recharge','phone bill','postpaid bill',
    'dth recharge','tata play','airtel broadband','jio fiber','act fibernet'
  ],
  'Debt & Loan Payments': [
    'home loan emi','car loan emi','personal loan emi','education loan emi','bike loan emi',
    'loan emi','loan installment','loan repayment','credit card bill','credit card payment',
    'bajaj finserv emi','simpl bill','lazypay','kreditbee','zestmoney'
  ],
  Shopping: [
    'dress','clothes','shirt','jeans','shoes','sandals','sneakers','bag','purse','wallet',
    'jewellery','watch','sunglasses','perfume','amazon','flipkart','myntra','ajio','nykaa',
    'zara','h&m','uniqlo','ikea','croma','reliance digital','gift','headphones','electronics'
  ],
  Entertainment: [
    'movie','netflix','amazon prime','hotstar','spotify','youtube premium','gaming','ps5','xbox',
    'concert','comedy show','event ticket','theme park','bowling','multiplex','pvr','inox',
    'party','birthday party','nightclub','pub','bar','brewery','celebration','clubbing'
  ],
  Health: [
    'doctor','hospital','clinic','medicine','pharmacy','tablets','health checkup','blood test',
    'pathlab','dr lal pathlabs','metropolis','apollo pharmacy','medplus','tata 1mg','pharmeasy',
    'dentist','dental','optician','physiotherapy','vaccination','vitamin','therapy','counselling'
  ],
  Education: [
    'books','textbook','course','online course','udemy','coursera','upgrad','tuition','coaching',
    'college fees','school fees','university fees','semester fees','exam fees','certification',
    'study material','library','byjus','unacademy'
  ],
  'Personal Care': [
    'haircut','barbershop','barber','hair salon','beauty parlour','hair spa','facial','threading',
    'waxing','manicure','pedicure','nail art','body massage','spa','enrich salon','jawed habib',
    'skincare','cosmetics','sunscreen','moisturizer','shampoo','beard oil','grooming'
  ],
  Insurance: [
    'health insurance','star health','care health','hdfc ergo','niva bupa','icici lombard',
    'term insurance','life insurance','max life','lic premium','lic policy','car insurance',
    'bike insurance','vehicle insurance','motor insurance','travel insurance','policybazaar','insurance premium'
  ],
  Investments: [
    'nifty50','nifty 50','nifty etf','nifty index','nifty bees','nifty',
    'sensex','s&p 500','nasdaq',
    'mutual fund sip','mutual fund','mutual funds','sip investment','sip payment','sip deduction','sip',
    'zerodha kite','zerodha stocks','zerodha','groww mutual fund','groww stocks','groww investment','groww',
    'upstox','angel one','kuvera','smallcase','etmoney','indmoney','demat account','demat',
    'index fund','stocks investment','stock purchase','stocks','shares purchase','equity shares','equity investment','equity trading',
    'nvidia shares','apple stock','bought stock','bought shares','shares',
    'reliance shares','tcs shares','hdfc mutual fund','sbi nifty',
    'nps contribution','nps deposit','nps tier','nps',
    'ppf deposit','ppf contribution','ppf account','ppf',
    'epf contribution','epf deposit','epf',
    'provident fund','sovereign gold bond','sgb',
    'government bond purchase','government bond investment','government bond','govt bond','corporate bond','treasury bill','securities investment'
  ],
  Misc: [
    'miscellaneous','unclassified','general expense','cash withdrawal','petty cash'
  ],
};

// Category → spend-type and sentiment maps for the fallback classifier
export const CATEGORY_TYPE_MAP = {
  'Food & Dining': 'Want',
  Groceries: 'Need',
  'Transport & Travel': 'Want',
  Housing: 'Need',
  'Utilities & Bills': 'Need',
  'Debt & Loan Payments': 'Need',
  Shopping: 'Want',
  Entertainment: 'Want',
  Health: 'Need',
  Education: 'Need',
  'Personal Care': 'Want',
  Insurance: 'Need',
  Investments: 'Investment',
  Misc: 'Need',

  // Legacy mappings for backward compatibility
  Food: 'Want',
  Travel: 'Want',
  Bills: 'Need',
  Party: 'Want',
};

export const CATEGORY_SENTIMENT_MAP = {
  'Food & Dining': 'negative',
  Groceries: 'neutral',
  'Transport & Travel': 'neutral',
  Housing: 'neutral',
  'Utilities & Bills': 'neutral',
  'Debt & Loan Payments': 'neutral',
  Shopping: 'negative',
  Entertainment: 'negative',
  Health: 'positive',
  Education: 'positive',
  'Personal Care': 'neutral',
  Insurance: 'positive',
  Investments: 'positive',
  Misc: 'neutral',

  // Legacy mappings for backward compatibility
  Food: 'negative',
  Travel: 'neutral',
  Bills: 'neutral',
  Party: 'negative',
};

export function classifyLocally(rawText) {
  const text = rawText.toLowerCase()
    .replace(/[₹$]?\s*\d+(\.\d+)?\s*(rs\.?|inr)?/gi, ' ')   // strip amounts
    .replace(/[^a-z\s]/g, ' ')                                 // strip punctuation
    .replace(/\s+/g, ' ').trim();

  let bestCategory = 'Misc';
  let bestScore    = 0;

  for (const [category, keywords] of Object.entries(KEYWORD_CATEGORY_MAP)) {
    // Sort by length descending so longer (more-specific) phrases match first
    const sorted = [...keywords].sort((a, b) => b.length - a.length);
    for (const kw of sorted) {
      if (text.includes(kw)) {
        // Longer keyword matches are higher-confidence
        const score = kw.length;
        if (score > bestScore) {
          bestScore    = score;
          bestCategory = category;
        }
      }
    }
  }

  const confidence = bestScore > 0 ? Math.min(0.95, 0.5 + bestScore * 0.03) : 0.1;
  const sentiment  = CATEGORY_SENTIMENT_MAP[bestCategory] || 'neutral';
  const type       = CATEGORY_TYPE_MAP[bestCategory] || 'Need';
  const needsReview = confidence < 0.60;

  const SENTIMENT_META = {
    positive: { emoji: '💚', label: 'Good Spend',   verdict: 'This is a healthy investment in yourself!' },
    neutral:  { emoji: '🔵', label: 'Neutral Spend', verdict: 'Necessary expense — keep it within budget.' },
    negative: { emoji: '🔴', label: 'Watch Out',     verdict: 'Discretionary spend — think before you pay!' },
  };
  const meta = SENTIMENT_META[sentiment];

  return {
    category:             bestCategory,
    type,
    confidence:           Math.round(confidence * 100) / 100,
    confidenceScore:      Math.round(confidence * 100) / 100,
    categoryConfidence:   Math.round(confidence * 100) / 100,
    typeConfidence:       Math.round(confidence * 100) / 100,
    all_probs:            { [bestCategory]: Math.round(confidence * 100) / 100 },
    classificationSource: 'fallback',
    categorySource:      'fallback',
    typeSource:          'fallback',
    needsReview,
    flagged_for_review:   needsReview,
    sentiment,
    sentiment_emoji:      meta.emoji,
    sentiment_label:      meta.label,
    verdict:              meta.verdict,
    offline:              true,
  };
}
