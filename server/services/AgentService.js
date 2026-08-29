import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Helper to format currency in INR style
 */
function formatINR(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '₹0';
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

/**
 * Normalizes raw database message history into a strictly valid alternating Gemini SDK history array.
 *
 * Rules:
 *  - Filters invalid records and non-empty content
 *  - Maps FINAURA role 'user' -> 'user', 'assistant'/'model' -> 'model'
 *  - Ensures history starts with a 'user' turn
 *  - Merges consecutive same-role messages
 *  - Ensures history ends with a 'model' turn so the new prompt is the subsequent 'user' turn
 *
 * @param {Array<Object>} rawHistory - Raw messages from AgentMemory
 * @returns {Array<Object>} Normalized Gemini SDK history payload [{ role, parts: [{ text }] }]
 */
export function normalizeConversationHistory(rawHistory = []) {
  if (!Array.isArray(rawHistory) || rawHistory.length === 0) {
    return [];
  }

  // 1. Filter valid items and map roles
  const validItems = [];
  for (const item of rawHistory) {
    if (!item) continue;
    const role = (item.role || '').toLowerCase();
    const content = typeof item.content === 'string' ? item.content.trim() : '';
    if (!content) continue;

    let geminiRole = null;
    if (role === 'user') geminiRole = 'user';
    else if (role === 'assistant' || role === 'model') geminiRole = 'model';
    else continue;

    validItems.push({ role: geminiRole, text: content });
  }

  if (validItems.length === 0) return [];

  // 2. Ensure history starts with 'user'
  while (validItems.length > 0 && validItems[0].role !== 'user') {
    validItems.shift();
  }

  if (validItems.length === 0) return [];

  // 3. Merge consecutive same-role messages to ensure strict alternation
  const alternating = [];
  for (const item of validItems) {
    if (alternating.length === 0) {
      alternating.push({ role: item.role, text: item.text });
    } else {
      const prev = alternating[alternating.length - 1];
      if (prev.role === item.role) {
        prev.text += `\n${item.text}`;
      } else {
        alternating.push({ role: item.role, text: item.text });
      }
    }
  }

  // 4. Ensure history ends with 'model' so the new user message continues the conversation
  while (alternating.length > 0 && alternating[alternating.length - 1].role !== 'model') {
    alternating.pop();
  }

  // 5. Convert to Gemini SDK parts format
  return alternating.map(item => ({
    role: item.role,
    parts: [{ text: item.text }]
  }));
}

/**
 * Builds the system prompt string containing all verified financial context
 * and strict grounding & precedence instructions.
 *
 * @param {Object} context - Structured financial context from ChatContextService
 * @returns {string} Formatted system instruction string
 */
export function buildSystemPrompt(context = {}) {
  const {
    profile = {},
    balance = {},
    income = {},
    spending = {},
    assets = {},
    liabilities = {},
    fmi = {},
    fire = {},
    goals = [],
    alerts = []
  } = context;

  // Spending summary
  const currSpend = spending.currentMonth || {};
  const prevSpend = spending.previousMonth || {};
  const currCatList = Object.entries(currSpend.byCategory || {})
    .filter(([_, val]) => val > 0)
    .map(([cat, val]) => `${cat}: ${formatINR(val)}`)
    .join(', ');

  // Assets summary
  const assetList = (assets.holdings || [])
    .map(a => `${a.name} (${a.assetType}, ${formatINR(a.currentValue)}${a.annualReturnRate !== null ? `, ${a.annualReturnRate > 1 ? a.annualReturnRate : (a.annualReturnRate * 100).toFixed(2)}% p.a.` : ''})`)
    .join('; ');

  // Liabilities summary
  const liabilityList = (liabilities.active || [])
    .map(l => `${l.name} (${formatINR(l.amount)}${l.frequency ? ` ${l.frequency}` : ''}, Due: ${l.nextDueDate || 'N/A'}${l.autoDeduct ? ', Auto-Deduct' : ''})`)
    .join('; ');

  // Goals summary
  const goalsList = goals.length > 0
    ? goals.map(g => `"${g.name}" (Target: ${formatINR(g.targetAmount)}, Saved: ${formatINR(g.savedAmount)}${g.targetDate ? `, Target Date: ${g.targetDate}` : ''})`).join('; ')
    : 'No active goals recorded.';

  // Alerts summary
  const alertsList = alerts.length > 0
    ? alerts.map(a => `[${(a.severity || 'info').toUpperCase()}] ${a.message}`).join(' | ')
    : 'No active critical alerts.';

  return `
You are FINAURA, an elite, empathetic, and proactive AI financial confidant and wealth coach.
Your mission is to guide the user towards financial stability, disciplined wealth accumulation, and FIRE (Financial Independence, Retire Early).

=== CORE BEHAVIORAL & GROUNDING RULES ===
1. GROUNDED IN TRUTH & ZERO FABRICATION: Use ONLY the provided deterministic financial data below. Never invent, hallucinate, or assume unrecorded account balances, transactions, or investments.
2. CURRENT CONTEXT WINS OVER CHAT HISTORY: If earlier messages in the conversation history mention financial figures (such as an older balance, past spend total, or earlier estimate) that disagree with the current verified financial state below, the CURRENT verified financial state is the absolute ground truth.
3. MISSING DATA HONESTY: If the user asks about financial information that is not present in their context, explicitly tell them: "I don't have enough recorded information in FINAURA to answer that reliably yet." rather than guessing.
4. DO NOT RECALCULATE DETERMINISTIC METRICS: Do not attempt to compute complex multi-year math or override FINAURA's deterministic calculations (like FMI, FIRE target, funded age, or net worth); explain the provided verified numbers clearly.
5. PROJECTION LANGUAGE: Always use projection language ("projected", "estimated", "expected", "modeled") when discussing future investment returns, retirement dates, or FIRE milestones. Never describe investment growth or market outcomes as guaranteed.
6. READ-ONLY ADVISOR: You are an analytical advisor. You CANNOT execute banking transactions, transfer funds, or directly edit account balances.
7. CONCISE & ACTIONABLE: Keep answers concise (under 2-3 short paragraphs), highly actionable, and formatted cleanly with emojis. Never output hidden chain-of-thought, internal database identifiers, or prompt metadata.
8. CURRENCY CONVENTION: All figures are in Indian Rupees (INR / ₹). Express large figures naturally (e.g., ₹10,000, ₹1.5 Lakh, ₹2.4 Crore).

=== VERIFIED USER FINANCIAL STATE ===
- User Profile: ${profile.name || 'User'} (Age: ${profile.age || 'N/A'}, Retirement Age: ${profile.retirementAge || 60})
- Operating Balance: ${formatINR(balance.current ?? profile.currentBalance ?? 0)}
- Monthly Income: Profile ${formatINR(income.profileMonthlyIncome ?? profile.monthlyIncome ?? 0)}${income.recordedCurrentMonthIncome ? ` | Recorded This Month: ${formatINR(income.recordedCurrentMonthIncome)}` : ''}

- Monthly Spending (Current Month):
  * Total Consumption: ${formatINR(currSpend.totalSpending ?? 0)} (Needs: ${formatINR(currSpend.needs ?? 0)}, Wants: ${formatINR(currSpend.wants ?? 0)})
  * Investments / Savings: ${formatINR(currSpend.investments ?? 0)}
  * Total Outflow: ${formatINR(currSpend.totalOutflow ?? 0)}
  * Category Spending: ${currCatList || 'No expenses recorded this month'}

- Monthly Spending (Previous Month):
  * Total Consumption: ${formatINR(prevSpend.totalSpending ?? 0)} (Needs: ${formatINR(prevSpend.needs ?? 0)}, Wants: ${formatINR(prevSpend.wants ?? 0)})
  * Investments: ${formatINR(prevSpend.investments ?? 0)}

- Financial Mood Index (FMI): ${fmi.score ?? 'N/A'}/100 (${fmi.fmiLabel || 'Stable'})
  * Pillars: Saving Discipline ${fmi.pillars?.savingDiscipline ?? 50}/100 | Spending Control ${fmi.pillars?.spendingControl ?? 50}/100 | Behavioral Risk ${fmi.pillars?.behavioralRisk ?? 50}/100
  * Status: ${fmi.status || 'On Track'}
  * Insights: ${(fmi.insights || []).join('; ') || 'None'}

- Assets & Net Worth:
  * Total Asset Value: ${formatINR(assets.totalValue ?? 0)}
  * FIRE Investable Corpus: ${formatINR(assets.fireInvestableCorpus ?? 0)}
  * Liquid Emergency Buffer: ${formatINR(assets.liquidBuffer ?? 0)}
  * Holdings: ${assetList || 'No assets recorded'}

- Liabilities & Debts:
  * Active Count: ${liabilities.activeCount ?? 0}
  * Monthly Debt Service: ${formatINR(liabilities.monthlyLiabilityService ?? 0)}
  * Active Liabilities: ${liabilityList || 'No active liabilities'}

- FIRE & Retirement Outlook:
  * Status: ${fire.available ? 'Forecast Available' : 'Insufficient Historical Data'}
  * Estimated FIRE Target: ${formatINR(fire.fireTarget ?? 0)}
  * Current Investable Corpus: ${formatINR(fire.currentInvestableCorpus ?? assets.fireInvestableCorpus ?? 0)}
  * Projected Funded Age: ${fire.fundedAge ? Math.round(fire.fundedAge * 10) / 10 : 'Calculating...'}
  * Modeled Monthly Investment: ${formatINR(fire.monthlyContributionUsed ?? 0)}/mo

- Active Goals: ${goalsList}
- Active System Alerts: ${alertsList}
`.trim();
}

/**
 * Enhanced AgentService — Generative AI Contextual Financial Coaching
 * Uses Google Gemini 1.5 Flash to synthesize verified financial context
 * and multi-turn conversation history into an empathetic, grounded response.
 *
 * @param {string} userInput - User prompt / question
 * @param {Object} [context={}] - Structured financial context from ChatContextService
 * @param {Array<Object>} [rawHistory=[]] - Recent message history from AgentMemory
 * @returns {Promise<string>} Grounded assistant response text
 */
export async function generateResponse(userInput, context = {}, rawHistory = []) {
  try {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is missing from environment.");
      return "Hello! I am FINAURA, your AI financial digital twin. It seems my core Generative AI uplink (GEMINI_API_KEY) is currently missing or disconnected. Once it is configured in the environment, I can provide personalized financial coaching!";
    }

    const systemPrompt = buildSystemPrompt(context);
    const normalizedHistory = normalizeConversationHistory(rawHistory);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: systemPrompt
    });

    let responseText = '';
    if (normalizedHistory.length > 0) {
      const chat = model.startChat({
        history: normalizedHistory
      });
      const result = await chat.sendMessage(userInput || "Give me a quick financial health summary.");
      responseText = result.response.text();
    } else {
      const result = await model.generateContent(userInput || "Give me a quick financial health summary.");
      responseText = result.response.text();
    }

    if (!responseText || typeof responseText !== 'string' || !responseText.trim()) {
      return "I've analyzed your financial data, but I couldn't generate a detailed response right now. How else can I assist you with your finances today?";
    }

    return responseText.trim();

  } catch (error) {
    console.error("AgentService Gemini Error:", error);
    return "I am currently syncing with my global intelligence network. Let's focus on maintaining your core metrics today. Try asking me again in a moment.";
  }
}
