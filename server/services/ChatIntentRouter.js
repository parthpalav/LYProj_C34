/**
 * server/services/ChatIntentRouter.js
 * 
 * Deterministic Intent Routing Layer for FINAURA AI Chatbot.
 * Intercepts common factual queries (balances, exact FMI scores, category spending,
 * total outflows, FIRE targets, liabilities, assets, and incomes) and answers
 * directly from verified FINAURA financial data without making external LLM calls.
 * 
 * Invariants:
 *  - Conservative matching: Only factual, unambiguous queries are handled deterministically.
 *  - Advice & interpretation escalation: Queries with 'why', 'should I', 'can I afford',
 *    'recommend', 'explain', etc. immediately escalate to Gemini.
 *  - Canonical taxonomy: Uses CANONICAL_V3_CATEGORIES exclusively.
 *  - Grounded numbers: Uses authoritative data from ChatContextService.
 */

// Canonical FINAURA V3 categories
export const CANONICAL_V3_CATEGORIES = [
  'Food & Dining', 'Groceries', 'Transport & Travel', 'Housing',
  'Utilities & Bills', 'Debt & Loan Payments', 'Shopping', 'Entertainment',
  'Health', 'Education', 'Personal Care', 'Insurance', 'Investments', 'Misc'
];

// Alias mapping to canonical categories
const CATEGORY_ALIASES = {
  // Food & Dining
  'food': 'Food & Dining',
  'food & dining': 'Food & Dining',
  'food and dining': 'Food & Dining',
  'dining': 'Food & Dining',
  'restaurant': 'Food & Dining',
  'restaurants': 'Food & Dining',
  'eating out': 'Food & Dining',
  'takeout': 'Food & Dining',
  'swiggy': 'Food & Dining',
  'zomato': 'Food & Dining',

  // Groceries
  'groceries': 'Groceries',
  'grocery': 'Groceries',
  'supermarket': 'Groceries',

  // Transport & Travel
  'transport': 'Transport & Travel',
  'transportation': 'Transport & Travel',
  'transport & travel': 'Transport & Travel',
  'transport and travel': 'Transport & Travel',
  'travel': 'Transport & Travel',
  'commute': 'Transport & Travel',
  'uber': 'Transport & Travel',
  'ola': 'Transport & Travel',
  'cab': 'Transport & Travel',
  'cabs': 'Transport & Travel',
  'fuel': 'Transport & Travel',
  'petrol': 'Transport & Travel',
  'flight': 'Transport & Travel',
  'flights': 'Transport & Travel',

  // Housing
  'housing': 'Housing',
  'rent': 'Housing',
  'mortgage': 'Housing',

  // Utilities & Bills
  'utilities': 'Utilities & Bills',
  'bills': 'Utilities & Bills',
  'utilities & bills': 'Utilities & Bills',
  'utilities and bills': 'Utilities & Bills',
  'electricity': 'Utilities & Bills',
  'wifi': 'Utilities & Bills',
  'broadband': 'Utilities & Bills',
  'water bill': 'Utilities & Bills',

  // Debt & Loan Payments
  'debt': 'Debt & Loan Payments',
  'loan': 'Debt & Loan Payments',
  'loans': 'Debt & Loan Payments',
  'debt & loan payments': 'Debt & Loan Payments',
  'debt and loan payments': 'Debt & Loan Payments',
  'emi': 'Debt & Loan Payments',
  'emis': 'Debt & Loan Payments',

  // Shopping
  'shopping': 'Shopping',
  'clothes': 'Shopping',
  'clothing': 'Shopping',
  'apparel': 'Shopping',
  'amazon': 'Shopping',
  'flipkart': 'Shopping',

  // Entertainment
  'entertainment': 'Entertainment',
  'movies': 'Entertainment',
  'cinema': 'Entertainment',
  'netflix': 'Entertainment',
  'spotify': 'Entertainment',
  'games': 'Entertainment',
  'party': 'Entertainment',

  // Health
  'health': 'Health',
  'medical': 'Health',
  'doctor': 'Health',
  'hospital': 'Health',
  'pharmacy': 'Health',
  'medicine': 'Health',
  'medicines': 'Health',

  // Education
  'education': 'Education',
  'tuition': 'Education',
  'course': 'Education',
  'courses': 'Education',
  'books': 'Education',
  'college': 'Education',

  // Personal Care
  'personal care': 'Personal Care',
  'salon': 'Personal Care',
  'spa': 'Personal Care',
  'haircut': 'Personal Care',
  'grooming': 'Personal Care',

  // Insurance
  'insurance': 'Insurance',
  'life insurance': 'Insurance',
  'health insurance': 'Insurance',

  // Investments
  'investments': 'Investments',
  'investment': 'Investments',
  'mutual funds': 'Investments',
  'stocks': 'Investments',
  'sip': 'Investments',
  'fixed deposit': 'Investments',

  // Misc
  'misc': 'Misc',
  'miscellaneous': 'Misc',
  'other': 'Misc'
};

/**
 * Currency formatter matching FINAURA Indian standard
 */
function formatINR(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '₹0';
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

/**
 * Resolves a text string to a canonical V3 category name using alias map
 * 
 * @param {string} text 
 * @returns {string|null} Canonical category name or null
 */
export function resolveCanonicalCategory(text) {
  if (!text || typeof text !== 'string') return null;
  const clean = text.toLowerCase().trim().replace(/[?!.,]/g, '');

  // Exact alias match
  if (CATEGORY_ALIASES[clean]) {
    return CATEGORY_ALIASES[clean];
  }

  // Multi-word exact checks sorted by longest alias first
  const sortedAliases = Object.keys(CATEGORY_ALIASES).sort((a, b) => b.length - a.length);
  for (const alias of sortedAliases) {
    const regex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(clean)) {
      return CATEGORY_ALIASES[alias];
    }
  }

  return null;
}

/**
 * Checks if a message contains subjective, advice-seeking, or reasoning escalation markers.
 * 
 * @param {string} text 
 * @returns {boolean} True if question should escalate to Gemini
 */
function containsEscalationMarkers(text) {
  const escalationRegex = /\b(why|why's|should\s+i|should\s+we|recommend|recommendation|advice|advise|suggest|suggestion|what\s+do\s+you\s+think|can\s+i\s+afford|how\s+can\s+i|how\s+do\s+i|how\s+should\s+i|how\s+to\s+improve|explain|help\s+me\s+decide|is\s+this\s+good|is\s+this\s+bad|is\s+it\s+good|is\s+it\s+bad|good\s+idea|bad\s+idea|habits|tips|strategy|strategies|pros\s+and\s+cons|what\s+if)\b/i;
  return escalationRegex.test(text);
}

/**
 * Inspects recent conversation history to resolve category follow-ups (e.g. "Is that more than last month?")
 * 
 * @param {Array<Object>} history 
 * @returns {string|null} Resolved canonical category or null if ambiguous
 */
function resolveFollowUpCategory(history = []) {
  if (!Array.isArray(history) || history.length === 0) return null;

  // Search backwards through the last 3 messages
  const recent = history.slice(-3);

  for (let i = recent.length - 1; i >= 0; i--) {
    const msg = recent[i];
    const text = msg?.content || '';
    const clean = text.toLowerCase();

    const matchedCategories = new Set();
    for (const [alias, canonical] of Object.entries(CATEGORY_ALIASES)) {
      const regex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(clean)) {
        matchedCategories.add(canonical);
      }
    }

    // If more than one distinct canonical category is mentioned in this turn, it is ambiguous
    if (matchedCategories.size > 1) {
      return null;
    }

    // If exactly one canonical category is found, that is our unambiguous target
    if (matchedCategories.size === 1) {
      return Array.from(matchedCategories)[0];
    }
  }

  return null;
}

/**
 * Main Deterministic Router
 * 
 * Evaluates message and context against deterministic intent handlers.
 * 
 * @param {string} rawMessage - User query text
 * @param {Object} context - Fresh financial context from ChatContextService
 * @param {Array<Object>} [history=[]] - Recent conversation history
 * @returns {Object} { handled: boolean, intent: string|null, response: string|null }
 */
export function routeDeterministicIntent(rawMessage, context = {}, history = []) {
  if (!rawMessage || typeof rawMessage !== 'string') {
    return { handled: false, intent: null, response: null };
  }

  const message = rawMessage.trim();

  // 1. Conservative Escalation: If query requires advice/reasoning, bypass deterministic routing
  if (containsEscalationMarkers(message)) {
    return { handled: false, intent: null, response: null };
  }

  // ── INTENT A: CURRENT_BALANCE ─────────────────────────────────
  if (/^(what('?s| is) (my|the)( current)?( finaura)? balance|how much (money|balance) do i( currently)? have|what is my balance|current balance|check balance)\??$/i.test(message)) {
    const currentBalance = context.balance?.current ?? context.profile?.currentBalance ?? 0;
    return {
      handled: true,
      intent: 'CURRENT_BALANCE',
      response: `Your current recorded FINAURA balance is ${formatINR(currentBalance)}.`
    };
  }

  // ── INTENT B: CURRENT_FMI ─────────────────────────────────────
  if (/^(what('?s| is) my( current)? fmi( score)?|what is my financial mood index|show( me)? my( current)? fmi)\??$/i.test(message)) {
    const score = context.fmi?.score ?? 50;
    const label = context.fmi?.fmiLabel || (score >= 70 ? 'Thriving' : (score >= 50 ? 'Stable' : 'Attention'));
    return {
      handled: true,
      intent: 'CURRENT_FMI',
      response: `Your current FMI is ${score}/100, which is currently rated ${label}.`
    };
  }

  // ── INTENT C: TOTAL_MONTHLY_SPENDING & OUTFLOW ────────────────
  // Total cash outflow (including investments)
  if (/\b(total outflow|all money going out|total money out|spending including investments|total outflow including investments)\b/i.test(message)) {
    const outflow = context.spending?.currentMonth?.totalOutflow ?? 0;
    return {
      handled: true,
      intent: 'TOTAL_OUTFLOW',
      response: `Your total cash outflow this month (including Needs, Wants, and Investments) is ${formatINR(outflow)}.`
    };
  }

  // Previous month total spending
  if (/^(how much (did i spend|have i spent)|what('?s| was) my (total )?(spending|expenses|expenditure)) (last month|in the last month|previous month)\??$/i.test(message)) {
    const totalPrev = context.spending?.previousMonth?.totalSpending ?? 0;
    return {
      handled: true,
      intent: 'TOTAL_PREVIOUS_MONTH_SPENDING',
      response: `Your total consumption spending last month was ${formatINR(totalPrev)}.`
    };
  }

  // Current month total consumption spending
  if (/^(how much (did i spend|have i spent|is my spending)|what('?s| is) my (total )?(spending|expenses|expenditure))( this month| in this month)?\??$/i.test(message)) {
    const totalSpend = context.spending?.currentMonth?.totalSpending ?? 0;
    const needs = context.spending?.currentMonth?.needs ?? 0;
    const wants = context.spending?.currentMonth?.wants ?? 0;
    return {
      handled: true,
      intent: 'TOTAL_MONTHLY_SPENDING',
      response: `Your total consumption spending this month is ${formatINR(totalSpend)} (${formatINR(needs)} on Needs and ${formatINR(wants)} on Wants).`
    };
  }

  // ── INTENT D: NEEDS / WANTS / INVESTMENTS ─────────────────────
  // Needs spending
  if (/^(how much (did i spend|have i spent|spent) on needs|what is my needs (spending|total))( this month)?\??$/i.test(message)) {
    const needs = context.spending?.currentMonth?.needs ?? 0;
    return {
      handled: true,
      intent: 'MONTHLY_NEEDS_SPEND',
      response: `You've spent ${formatINR(needs)} on Needs this month.`
    };
  }

  // Wants spending
  if (/^(how much (did i spend|have i spent|spent) on wants|what is my wants (spending|total))( this month)?\??$/i.test(message)) {
    const wants = context.spending?.currentMonth?.wants ?? 0;
    return {
      handled: true,
      intent: 'MONTHLY_WANTS_SPEND',
      response: `You've spent ${formatINR(wants)} on Wants this month.`
    };
  }

  // Investments
  if (/^(how much (did i invest|have i invested|invested)|what did i invest|investment total)( this month)?\??$/i.test(message)) {
    const inv = context.spending?.currentMonth?.investments ?? 0;
    return {
      handled: true,
      intent: 'MONTHLY_INVESTMENT_AMOUNT',
      response: `You've allocated ${formatINR(inv)} to Investments this month.`
    };
  }

  // Spending Breakdown
  if (/^(give me (my )?spending breakdown|show( my)? (needs vs wants|spending breakdown|budget breakdown)|spending breakdown)\??$/i.test(message)) {
    const curr = context.spending?.currentMonth || {};
    return {
      handled: true,
      intent: 'SPENDING_BREAKDOWN',
      response: `Here is your spending breakdown for this month:\n• Needs: ${formatINR(curr.needs ?? 0)}\n• Wants: ${formatINR(curr.wants ?? 0)}\n• Investments: ${formatINR(curr.investments ?? 0)}\n• Total Outflow: ${formatINR(curr.totalOutflow ?? 0)}`
    };
  }

  // ── INTENT E: HIGHEST_SPENDING_CATEGORY ───────────────────────
  if (/^(what (did i spend the most on|is my highest (spending )?category|cost(ing)? me the most)|which category (has the highest spending|am i spending the most on|is costing me the most))( this month)?\??$/i.test(message)) {
    const catMap = context.spending?.currentMonth?.byCategory || {};
    let highestCat = null;
    let highestAmt = 0;

    for (const [cat, val] of Object.entries(catMap)) {
      if (cat === 'Investments') continue; // Exclude investments from consumption spend
      if (typeof val === 'number' && val > highestAmt) {
        highestAmt = val;
        highestCat = cat;
      }
    }

    if (!highestCat || highestAmt === 0) {
      return {
        handled: true,
        intent: 'HIGHEST_SPENDING_CATEGORY',
        response: "You have no recorded expenses for this month yet."
      };
    }

    return {
      handled: true,
      intent: 'HIGHEST_SPENDING_CATEGORY',
      response: `Your highest spending category this month is ${highestCat} at ${formatINR(highestAmt)}.`
    };
  }

  // ── INTENT F: CATEGORY MONTH COMPARISON & FOLLOW-UPS ──────────
  const isComparisonQuery = /\b(did i spend more|is that more|how does (that|my .+?) compare|compare (my )?.+ (spending )?with last month|how much more did i spend on .+ this month|is that (higher|lower|less))\b/i.test(message);

  if (isComparisonQuery) {
    let resolvedCategory = resolveCanonicalCategory(message);

    // Follow-up resolution from history if message references "that" or lacks explicit category
    if (!resolvedCategory && /\b(that|it)\b/i.test(message)) {
      resolvedCategory = resolveFollowUpCategory(history);
    }

    if (resolvedCategory) {
      const curr = context.spending?.currentMonth?.byCategory?.[resolvedCategory] ?? 0;
      const prev = context.spending?.previousMonth?.byCategory?.[resolvedCategory] ?? 0;
      const diff = curr - prev;

      if (prev === 0) {
        if (curr === 0) {
          return {
            handled: true,
            intent: 'CATEGORY_MONTH_COMPARISON',
            response: `You have ₹0 recorded for ${resolvedCategory} both this month and last month.`
          };
        }
        return {
          handled: true,
          intent: 'CATEGORY_MONTH_COMPARISON',
          response: `You've spent ${formatINR(curr)} on ${resolvedCategory} this month versus ₹0 recorded last month.`
        };
      }

      if (diff === 0) {
        return {
          handled: true,
          intent: 'CATEGORY_MONTH_COMPARISON',
          response: `You've spent ${formatINR(curr)} on ${resolvedCategory} this month, which is the same as last month.`
        };
      }

      if (diff > 0) {
        const pct = ((diff / prev) * 100).toFixed(1);
        return {
          handled: true,
          intent: 'CATEGORY_MONTH_COMPARISON',
          response: `You've spent ${formatINR(curr)} on ${resolvedCategory} this month versus ${formatINR(prev)} last month — ${formatINR(diff)} more, or about ${pct}% higher.`
        };
      } else {
        const absDiff = Math.abs(diff);
        const pct = ((absDiff / prev) * 100).toFixed(1);
        return {
          handled: true,
          intent: 'CATEGORY_MONTH_COMPARISON',
          response: `You've spent ${formatINR(curr)} on ${resolvedCategory} this month versus ${formatINR(prev)} last month — ${formatINR(absDiff)} less, or about ${pct}% lower.`
        };
      }
    }
  }

  // ── INTENT G: PREVIOUS MONTH CATEGORY SPEND ───────────────────
  const isLastMonthCategory = /(last month|previous month|in the last month)/i.test(message);
  if (isLastMonthCategory) {
    const category = resolveCanonicalCategory(message);
    if (category && /^(how much (did i spend|have i spent|spent)|what (did i spend|was my spending)) (on|for)/i.test(message)) {
      const spent = context.spending?.previousMonth?.byCategory?.[category] ?? 0;
      return {
        handled: true,
        intent: 'PREVIOUS_MONTH_CATEGORY_SPEND',
        response: `You spent ${formatINR(spent)} on ${category} last month.`
      };
    }
  }

  // ── INTENT H: CURRENT MONTH CATEGORY SPEND ────────────────────
  const isCurrentMonthSpendQuery = /^(how much (did i spend|have i spent|spent)|what (did i spend|was my spending|were my expenses)) (on|for) (.+?)\??$/i.test(message)
    || /^(category spend(ing)? (on|for) (.+?))\??$/i.test(message);

  if (isCurrentMonthSpendQuery) {
    const category = resolveCanonicalCategory(message);
    if (category) {
      const spent = context.spending?.currentMonth?.byCategory?.[category] ?? 0;
      return {
        handled: true,
        intent: 'MONTHLY_CATEGORY_SPEND',
        response: `You've spent ${formatINR(spent)} on ${category} this month.`
      };
    }
  }

  // ── INTENT I: FIRE STATUS & TARGET ────────────────────────────
  // FIRE target number
  if (/^(what('?s| is) my fire (target|number|goal)|how much do i need (for|to reach) fire)\??$/i.test(message)) {
    const target = context.fire?.fireTarget ?? 0;
    return {
      handled: true,
      intent: 'FIRE_TARGET',
      response: `Your modeled FIRE target is ${formatINR(target)} based on your current retirement parameters.`
    };
  }

  // FIRE corpus accumulated
  if (/^(how much (have i accumulated|is invested|is my corpus) (for|toward|towards) fire|what('?s| is) my fire (investable )?corpus)\??$/i.test(message)) {
    const corpus = context.fire?.currentInvestableCorpus ?? context.assets?.fireInvestableCorpus ?? 0;
    return {
      handled: true,
      intent: 'FIRE_CORPUS',
      response: `Your current FIRE-investable corpus is ${formatINR(corpus)}.`
    };
  }

  // Projected funded age / years to FIRE
  if (/^(when (will|can|could) i reach fire|what is my projected (funded age|fire age)|at what age (will|can|could) i retire)\??$/i.test(message)) {
    const fundedAge = context.fire?.fundedAge;
    if (fundedAge && typeof fundedAge === 'number') {
      return {
        handled: true,
        intent: 'FIRE_FUNDED_AGE',
        response: `Based on FINAURA's current projections, your estimated funded age to achieve FIRE is ${Math.round(fundedAge * 10) / 10} years.`
      };
    }
    return {
      handled: true,
      intent: 'FIRE_FUNDED_AGE',
      response: "FINAURA is currently modeling your historical data to project your funded age. Please ensure your income, spending, and asset records are up to date."
    };
  }

  // ── INTENT J: UPCOMING_LIABILITIES ────────────────────────────
  if (/^(what liabilities (are due|do i have coming up|are coming up)|what emis (are due|do i have coming up|are coming up)|what payments are due|what('?s| is) my next liability|upcoming liabilities|upcoming emis)/i.test(message)) {
    const active = (context.liabilities?.active || []).slice(0, 3);
    if (active.length === 0) {
      return {
        handled: true,
        intent: 'UPCOMING_LIABILITIES',
        response: "You currently have no active upcoming liabilities recorded in FINAURA."
      };
    }
    if (active.length === 1) {
      const l = active[0];
      const dateStr = l.nextDueDate
        ? `, due on ${new Date(l.nextDueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`
        : '';
      const autoStr = l.autoDeduct ? ' (Auto-Deduct enabled)' : '';
      return {
        handled: true,
        intent: 'UPCOMING_LIABILITIES',
        response: `Your next recorded liability is ${l.name} of ${formatINR(l.amount)}${dateStr}${autoStr}.`
      };
    }
    const list = active.map(l => {
      const dateStr = l.nextDueDate
        ? ` (Due: ${new Date(l.nextDueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`
        : '';
      return `• ${l.name}: ${formatINR(l.amount)}${dateStr}`;
    }).join('\n');

    return {
      handled: true,
      intent: 'UPCOMING_LIABILITIES',
      response: `Here are your upcoming recorded liabilities:\n${list}`
    };
  }

  // ── INTENT K: ASSET_SUMMARY ───────────────────────────────────
  if (/^(how much (do i have in assets|are my assets)|what is my total asset value|what are my total assets|total assets)\??$/i.test(message)) {
    const total = context.assets?.totalValue ?? 0;
    const fireCorpus = context.assets?.fireInvestableCorpus ?? 0;
    return {
      handled: true,
      intent: 'ASSET_SUMMARY',
      response: `Your total recorded asset value is ${formatINR(total)} (of which ${formatINR(fireCorpus)} is included in your FIRE investable corpus).`
    };
  }

  // ── INTENT L: INCOME_SUMMARY ──────────────────────────────────
  if (/^(what('?s| is) my (monthly )?income|what income do i have recorded)\??$/i.test(message)) {
    const profileInc = context.income?.profileMonthlyIncome ?? context.profile?.monthlyIncome ?? 0;
    const recordedInc = context.income?.recordedCurrentMonthIncome ?? 0;

    if (recordedInc > 0 && recordedInc !== profileInc) {
      return {
        handled: true,
        intent: 'INCOME_SUMMARY',
        response: `Your profile monthly income baseline is ${formatINR(profileInc)}. FINAURA has ${formatINR(recordedInc)} of recorded income entries for this month.`
      };
    }
    return {
      handled: true,
      intent: 'INCOME_SUMMARY',
      response: `Your profile monthly income is ${formatINR(profileInc)}.`
    };
  }

  // Default: Cannot answer deterministically with high confidence -> escalate to Gemini
  return { handled: false, intent: null, response: null };
}
