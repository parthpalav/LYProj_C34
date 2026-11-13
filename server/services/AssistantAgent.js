import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env.js';
import { CANONICAL_V3_CATEGORIES, VALID_TYPES } from '../models/Transaction.js';
import { buildSystemPrompt, GEMINI_MODELS, normalizeConversationHistory } from './AgentService.js';

/**
 * FINAURA agent: an LLM with tools that call this server's own REST API as the signed-in user.
 * Runs on Claude when ANTHROPIC_API_KEY is set, otherwise on Gemini with GEMINI_API_KEY.
 * Every tool goes through the same routes the apps use, so validation, classification,
 * balance updates and ownership checks are the existing ones, not a second copy.
 */

const MODEL = () => (process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5').trim();
const MAX_STEPS = 8;

const claudeKey = () => (process.env.ANTHROPIC_API_KEY || '').trim();
const geminiKey = () => (process.env.GEMINI_API_KEY || '').trim();
export const agentEnabled = () => Boolean(claudeKey() || geminiKey());

const INSTRUCTIONS = `You are FINAURA, the assistant inside a personal finance app used in India. You talk with one signed-in user and you can read and change that user's own records through your tools.

What you do
- Answer questions about the user's money from the verified snapshot below. For anything about individual transactions (a merchant, a date range, "what did I spend on X"), call search_transactions; the snapshot only has totals.
- Record things for the user. When they tell you about a purchase or payment ("spent 250 on chai", "aaj 500 ka petrol dalwaya"), add it straight away with add_transaction, then confirm in one line what you saved. Do not ask permission first for adding; the user can ask you to undo it.
- One message can hold several purchases. Add each one as its own transaction.
- Money received (salary, refund, gift, pocket money) is income: use add_income, not add_transaction.
- Ask a short question only when you cannot act without the answer, such as a missing amount. If the category is unclear, leave it out and the app's classifier picks it.
- Before deleting anything, or changing an existing record in a way the user did not spell out, say exactly what you will delete or change and wait for a yes.
- To edit or delete, find the record's id with search_transactions or list_records first. Never guess an id and never show ids to the user.

Language
- The user may write or speak English, Hindi, or Hinglish, and speech-to-text may garble words. Work out what they meant.
- Reply in the language and script of the user's latest message only, whatever earlier turns used: an English message gets English, Hindi in Devanagari gets Devanagari, Hinglish in Latin script gets Hinglish in Latin script.
- Store transaction descriptions as short plain English or the merchant name ("Chai", "Petrol", "Zomato"), whatever the user's language.

Accuracy
- Use only the snapshot and tool results. If the records do not hold the answer, say so. Do not invent balances, transactions or returns.
- Amounts mentioned in earlier chat turns may be out of date, because records get added and deleted. Take every figure from the current snapshot or a fresh tool call, never from earlier turns.
- Do not recompute FMI, FIRE or net worth yourself; explain the figures given. Describe forecasts as projections, never as guaranteed.
- You cannot move real money, pay bills at a bank, or change the user's login. Say so if asked.
- A tool error means the action did not happen. Tell the user plainly; never claim success you did not get.

Style
- Short: a sentence or a few bullets. Amounts in rupees with Indian grouping (₹1,50,000). No internal ids, no tool names.`;

const obj = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const str = (description) => ({ type: 'string', description });
const num = (description) => ({ type: 'number', description });
const DATE = 'Calendar date as YYYY-MM-DD in the user\'s timezone. Omit for today.';
const category = { type: 'string', enum: CANONICAL_V3_CATEGORIES };
const spendType = { type: 'string', enum: VALID_TYPES };

// shortcut: a dated entry is stamped at 12:00 UTC so it lands on that calendar day in any timezone within 11 hours of UTC; pass a real time if entries ever need one.
// A date that would land in the future (the model sent today's date before noon UTC) is dropped, so the entry is stamped now.
const stamp = (date) => (date && Date.parse(`${date}T12:00:00Z`) <= Date.now() ? `${date}T12:00:00Z` : undefined);
const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const day = (ts) => new Date(ts).toISOString().slice(0, 10);

const LIST_PATHS = {
  income: '/api/income',
  goals: '/api/goals',
  liabilities: '/api/liabilities',
  assets: '/api/assets',
  payment_methods: '/api/payment-methods',
};
const DELETE_PATHS = {
  transaction: '/api/transactions',
  income: '/api/income',
  goal: '/api/goals',
  liability: '/api/liabilities',
  asset: '/api/assets',
};

/**
 * Each tool: schema for the model, `run(input, api)` that calls the REST API,
 * and for tools that change data a `label(input, result)` shown to the user as a receipt.
 */
export const TOOLS = [
  {
    name: 'search_transactions',
    description: 'Find the user\'s expense transactions, newest first. Filter by text in the description, category and date range. Returns matching rows with ids, plus the count and total of all matches. Use it for any question about specific spending and to find the id of a transaction to edit or delete.',
    input_schema: obj({
      query: str('Text to look for in the description, case-insensitive.'),
      category,
      from: str('Earliest date, YYYY-MM-DD.'),
      to: str('Latest date, YYYY-MM-DD.'),
      limit: { type: 'integer', description: 'Rows to return, default 20, max 50.' },
    }),
    run: async (input, api) => {
      const all = await api('GET', '/api/transactions');
      const q = (input.query || '').toLowerCase();
      const hits = all.filter((t) => {
        const d = day(t.timestamp);
        return (!q || (t.description || '').toLowerCase().includes(q))
          && (!input.category || t.category === input.category)
          && (!input.from || d >= input.from)
          && (!input.to || d <= input.to);
      });
      return {
        matches: hits.length,
        total: hits.reduce((s, t) => s + t.amount, 0),
        rows: hits.slice(0, Math.min(Number(input.limit) || 20, 50)).map((t) => ({
          id: t.id, date: day(t.timestamp), amount: t.amount, description: t.description, category: t.category, type: t.type,
        })),
      };
    },
  },
  {
    name: 'add_transaction',
    description: 'Record one expense the user made. Leave category and type out unless the user stated them or they are obvious; the app classifies the description itself.',
    input_schema: obj({
      amount: num('Amount in rupees, positive.'),
      description: str('Short description or merchant, e.g. "Chai", "Uber to airport".'),
      category,
      type: spendType,
      date: str(DATE),
      paymentMethodId: str('Id from list_records payment_methods, only if the user said how they paid.'),
    }, ['amount', 'description']),
    run: ({ date, ...body }, api) => api('POST', '/api/transactions', { ...body, timestamp: stamp(date) }),
    label: (input, tx) => `Added ${inr(input.amount)} · ${input.description}${tx?.category ? ` · ${tx.category}` : ''}`,
  },
  {
    name: 'update_transaction',
    description: 'Change fields of an existing expense transaction. Send only the fields that change.',
    input_schema: obj({
      id: str('Transaction id from search_transactions.'),
      amount: num('New amount in rupees.'),
      description: str('New description.'),
      category,
      type: spendType,
      date: str('New date, YYYY-MM-DD.'),
    }, ['id']),
    run: ({ id, date, ...body }, api) => api('PUT', `/api/transactions/${encodeURIComponent(id)}`, { ...body, timestamp: stamp(date) }),
    label: () => 'Updated a transaction',
  },
  {
    name: 'add_income',
    description: 'Record money the user received: salary, freelance pay, refund, gift, interest.',
    input_schema: obj({
      amount: num('Amount in rupees, positive.'),
      source: str('Where it came from, e.g. "Salary", "Freelance", "Refund".'),
      description: str('Optional note.'),
      date: str(DATE),
    }, ['amount', 'source']),
    run: ({ date, ...body }, api) => api('POST', '/api/income', { ...body, timestamp: stamp(date) }),
    label: (input) => `Added income ${inr(input.amount)} · ${input.source}`,
  },
  {
    name: 'list_records',
    description: 'List the user\'s records of one kind with their ids: income entries, savings goals, liabilities (bills, EMIs, subscriptions), assets, or payment methods (UPI, cards).',
    input_schema: obj({ kind: { type: 'string', enum: Object.keys(LIST_PATHS) } }, ['kind']),
    run: async ({ kind }, api) => {
      const rows = await api('GET', LIST_PATHS[kind]);
      // Income can run to hundreds of rows; the newest are the ones a chat needs.
      return Array.isArray(rows) ? rows.slice(0, 40) : rows;
    },
  },
  {
    name: 'add_goal',
    description: 'Create a savings goal.',
    input_schema: obj({
      name: str('Goal name.'),
      targetAmount: num('Target in rupees.'),
      targetDate: str('Target date, YYYY-MM-DD.'),
      monthlyContribution: num('Planned monthly saving in rupees.'),
      emoji: str('One emoji for the goal.'),
    }, ['name', 'targetAmount']),
    run: (input, api) => api('POST', '/api/goals', input),
    label: (input) => `Created goal ${input.name} · ${inr(input.targetAmount)}`,
  },
  {
    name: 'update_goal',
    description: 'Change a goal. savedAmount is the new total saved so far, not an increment: to add money, read the current value with list_records and send the sum.',
    input_schema: obj({
      id: str('Goal id from list_records.'),
      savedAmount: num('New total saved, in rupees.'),
      targetAmount: num('New target in rupees.'),
      targetDate: str('New target date, YYYY-MM-DD.'),
      monthlyContribution: num('New monthly saving in rupees.'),
      name: str('New name.'),
    }, ['id']),
    run: ({ id, ...body }, api) => api('PUT', `/api/goals/${encodeURIComponent(id)}`, body),
    label: () => 'Updated a goal',
  },
  {
    name: 'add_liability',
    description: 'Add a recurring bill, subscription, rent or EMI.',
    input_schema: obj({
      name: str('Name, e.g. "Netflix", "Home loan EMI".'),
      amount: num('Amount per payment, in rupees.'),
      category,
      type: spendType,
      frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'yearly'] },
      startDate: str('First due date, YYYY-MM-DD.'),
      dayOfMonth: { type: 'integer', description: 'Day of month it is due (1-31), for monthly and yearly.' },
      autoDeduct: { type: 'boolean', description: 'True if it is paid automatically.' },
    }, ['name', 'amount', 'category', 'type', 'frequency', 'startDate']),
    run: (input, api) => api('POST', '/api/liabilities', input),
    label: (input) => `Added ${input.frequency} bill ${input.name} · ${inr(input.amount)}`,
  },
  {
    name: 'add_asset',
    description: 'Record an asset the user owns. Not for fixed or recurring deposits (FD/RD): those need tenure details, so point the user to the Net worth page.',
    input_schema: obj({
      name: str('Name, e.g. "Nifty 50 index fund".'),
      assetType: str('Kind: Mutual Fund, Equity, Gold, PPF, EPF, Real Estate, Cash, Savings Account, Other.'),
      assetClass: {
        type: 'string',
        enum: ['FIRE_INVESTABLE', 'SEMI_LIQUID', 'NON_INVESTABLE'],
        description: 'FIRE_INVESTABLE for market investments and retirement funds, SEMI_LIQUID for cash, savings and gold, NON_INVESTABLE for the home the user lives in, vehicles and similar.',
      },
      currentValue: num('Current value in rupees.'),
      annualReturnRate: num('Expected yearly return as a percentage, e.g. 12.'),
    }, ['name', 'assetType', 'assetClass', 'currentValue']),
    run: (input, api) => api('POST', '/api/assets', input),
    label: (input) => `Added asset ${input.name} · ${inr(input.currentValue)}`,
  },
  {
    name: 'update_asset_value',
    description: 'Set the current value of an existing asset.',
    input_schema: obj({ id: str('Asset id from list_records.'), currentValue: num('New value in rupees.') }, ['id', 'currentValue']),
    run: ({ id, currentValue }, api) => api('PUT', `/api/assets/${encodeURIComponent(id)}`, { currentValue }),
    label: (input) => `Updated asset value to ${inr(input.currentValue)}`,
  },
  {
    name: 'delete_record',
    description: 'Delete one record by id. Only after the user has confirmed this exact deletion.',
    input_schema: obj({ kind: { type: 'string', enum: Object.keys(DELETE_PATHS) }, id: str('Record id.') }, ['kind', 'id']),
    run: ({ kind, id }, api) => api('DELETE', `${DELETE_PATHS[kind]}/${encodeURIComponent(id)}`),
    label: (input) => `Deleted ${input.kind}`,
  },
];

const TOOL_DEFS = TOOLS.map(({ name, description, input_schema }) => ({ name, description, input_schema }));

/** Calls this server's API as the user. Throws with the API's own error text on failure. */
export function loopbackApi(authorization) {
  return async (method, path, body) => {
    const res = await fetch(`http://127.0.0.1:${config.PORT || 4000}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: authorization },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
    return data?.data ?? data;
  };
}

/** Stored chat rows to Claude messages. The API merges same-role neighbours; it only needs a user turn first. */
function toMessages(rawHistory, userInput) {
  const past = rawHistory
    .filter((m) => m && typeof m.content === 'string' && m.content.trim() && ['user', 'assistant'].includes(m.role))
    .map((m) => ({ role: m.role, content: m.content.trim() }));
  while (past.length && past[0].role !== 'user') past.shift();
  return [...past, { role: 'user', content: userInput }];
}

function systemBlocks(context, tz) {
  const now = new Date();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(now);
  // Reuse the figures block of the existing prompt so both assistants read the same verified state.
  const state = buildSystemPrompt(context).split('=== VERIFIED USER FINANCIAL STATE ===')[1] || '';
  return [
    { type: 'text', text: INSTRUCTIONS },
    { type: 'text', text: `Today is ${weekday}, ${today} (${tz}).\n\nVerified snapshot of the user's finances:\n${state.trim()}` },
  ];
}

/** Runs one tool call. Records a receipt for tools that change data. Never throws. */
async function runTool(name, input, api, actions) {
  const tool = TOOLS.find((t) => t.name === name);
  try {
    if (!tool) throw new Error(`Unknown tool ${name}`);
    const missing = (tool.input_schema.required || []).filter((k) => input?.[k] === undefined || input[k] === '');
    if (missing.length) throw new Error(`Missing required field: ${missing.join(', ')}`);
    const result = await tool.run(input, api);
    if (tool.label) actions.push({ tool: tool.name, ok: true, label: tool.label(input, result) });
    return { ok: true, result: result ?? { ok: true } };
  } catch (err) {
    if (tool?.label) actions.push({ tool: tool.name, ok: false, label: `Could not complete: ${err.message}` });
    return { ok: false, error: err.message };
  }
}

const OUT_OF_STEPS = 'I did part of that but ran out of steps. Tell me what is still missing and I will finish it.';

async function runClaude({ userInput, rawHistory, system, api, actions, client = new Anthropic({ timeout: 45000, maxRetries: 1 }) }) {
  const messages = toMessages(rawHistory, userInput);
  for (let step = 0; step < MAX_STEPS; step += 1) {
    const response = await client.messages.create({
      model: MODEL(),
      max_tokens: 4096,
      output_config: { effort: process.env.ANTHROPIC_EFFORT || 'low' },
      system,
      tools: TOOL_DEFS,
      messages,
    });

    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (response.stop_reason === 'refusal') {
      return "I can't help with that request. Ask me about your spending, bills, goals or savings instead.";
    }
    const calls = response.content.filter((b) => b.type === 'tool_use');
    // max_tokens can cut a tool call's input short; never run a truncated call.
    if (response.stop_reason !== 'tool_use' || calls.length === 0) return text || 'Done.';

    messages.push({ role: 'assistant', content: response.content });
    const results = await Promise.all(calls.map(async (call) => {
      const r = await runTool(call.name, call.input, api, actions);
      return r.ok
        ? { type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(r.result) }
        : { type: 'tool_result', tool_use_id: call.id, content: r.error, is_error: true };
    }));
    messages.push({ role: 'user', content: results });
  }
  return OUT_OF_STEPS;
}

// Gemini's function schema is an OpenAPI subset without additionalProperties.
const geminiSchema = ({ additionalProperties: _drop, properties, ...rest }) => ({
  ...rest,
  ...(properties ? { properties: Object.fromEntries(Object.entries(properties).map(([k, v]) => [k, geminiSchema(v)])) } : {}),
});
const GEMINI_TOOLS = [{ functionDeclarations: TOOLS.map((t) => ({ name: t.name, description: t.description, parameters: geminiSchema(t.input_schema) })) }];
let workingGemini = null;

const defaultGeminiModel = (model, systemInstruction) =>
  new GoogleGenerativeAI(geminiKey()).getGenerativeModel({ model, systemInstruction, tools: GEMINI_TOOLS }, { timeout: 12000 });

async function runGemini({ userInput, rawHistory, system, api, actions, getModel = defaultGeminiModel }) {
  const systemInstruction = system.map((b) => b.text).join('\n\n');
  // The conversation is kept here and sent whole each step. The SDK's chat helper labels tool results with
  // role "function", which Gemini 3.x rejects; they must go back as a user turn.
  const start = [...normalizeConversationHistory(rawHistory), { role: 'user', parts: [{ text: userInput }] }];
  let lastError;
  for (const name of [...new Set([workingGemini, ...GEMINI_MODELS].filter(Boolean))]) {
    const model = getModel(name, systemInstruction);
    const contents = [...start];
    let result;
    try {
      result = await model.generateContent({ contents });
    } catch (err) {
      // Nothing has run yet, so a retired (404), overloaded (503) or stalled model is safe to swap. Auth and quota errors will repeat.
      lastError = err;
      if ([400, 401, 403, 429].includes(err?.status)) break;
      continue;
    }
    workingGemini = name;
    // Past the first reply tools may have changed data, so never restart on another model.
    for (let step = 0; step < MAX_STEPS; step += 1) {
      const calls = result.response.functionCalls?.() || [];
      if (calls.length === 0) {
        let text = '';
        try { text = result.response.text().trim(); } catch { /* blocked reply has no text */ }
        return text || (actions.length ? 'Done.' : "I couldn't work that one out. Try asking in a different way.");
      }
      const parts = await Promise.all(calls.map(async (call) => {
        const r = await runTool(call.name, call.args || {}, api, actions);
        return { functionResponse: { name: call.name, response: r.ok ? { result: r.result } : { error: r.error } } };
      }));
      // The model's own turn goes back untouched: its parts carry the thought signatures Gemini requires.
      contents.push(result.response.candidates[0].content, { role: 'user', parts });
      result = await model.generateContent({ contents });
    }
    return OUT_OF_STEPS;
  }
  throw lastError || new Error('No Gemini model available');
}

// shortcut: Hinglish is spotted by a short list of very common Hindi words in Latin script; a message using none of them is treated as English. Swap in a language detector if replies come back in the wrong language.
const HINGLISH = /\b(hai|hain|hoon|hu|tha|thi|kya|kitna|kitni|kitne|mera|meri|mere|maine|mujhe|aaj|kal|nahi|nahin|ka|ki|ke|ko|se|aur|liya|diya|kiya|kar|karo|kharcha?|rupaye|paise|wala|bhi|abhi|batao|chahiye)\b/i;
export function replyLanguage(text) {
  if (/[\u0900-\u097F]/.test(text)) return 'Hindi in Devanagari script';
  return HINGLISH.test(text) ? 'Hinglish (Hindi in Latin script)' : 'English';
}

/**
 * Runs one user turn to completion.
 * `client` (Claude) and `getModel` (Gemini) exist so tests can script the model.
 * @returns {Promise<{ text: string, actions: Array<{ tool: string, ok: boolean, label: string }> }>}
 */
export async function runAgent({ userInput, context = {}, rawHistory = [], timezone = 'Asia/Kolkata', api, client, getModel }) {
  const actions = [];
  // Small models copy the language of earlier turns; naming the language next to the message keeps the reply in the user's current one.
  const prompt = `${userInput}\n\n[System note: reply in ${replyLanguage(userInput)}, whatever language earlier turns used.]`;
  const args = { userInput: prompt, rawHistory, system: systemBlocks(context, timezone), api, actions };
  try {
    const text = client || (claudeKey() && !getModel) ? await runClaude({ ...args, client }) : await runGemini({ ...args, getModel });
    return { text, actions };
  } catch (err) {
    // The model dropped out after changes were saved: report them instead of letting the caller answer as if nothing happened.
    if (actions.length === 0) throw err;
    return { text: 'I saved the changes below, then lost the connection to the AI model before I could finish. Tell me what is still missing.', actions };
  }
}
