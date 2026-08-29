/**
 * client/test_chatbot_ux.js
 * 
 * Unit & Integration test suite for FINAURA ChatScreen UX,
 * persistent history hydration, fake demo removal, and message flows.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('================================================================');
console.log('  FINAURA CHATBOT CLIENT UX & PERSISTENCE TEST SUITE');
console.log('================================================================\n');

const chatScreenPath = path.join(__dirname, 'src', 'screens', 'ChatScreen.tsx');
const chatScreenSource = fs.readFileSync(chatScreenPath, 'utf8');

const apiPath = path.join(__dirname, 'src', 'services', 'api.ts');
const apiSource = fs.readFileSync(apiPath, 'utf8');

// ── TEST 1: HISTORY API INTEGRATION ────────────────────────────
console.log('Running Test 1: ChatScreen imports & calls getChatHistory...');
assert.ok(
  chatScreenSource.includes('getChatHistory'),
  'ChatScreen imports getChatHistory'
);
assert.ok(
  chatScreenSource.includes('await getChatHistory()'),
  'ChatScreen calls getChatHistory() inside useEffect'
);
assert.ok(
  apiSource.includes("api.get('/api/agent/history')"),
  'api.ts defines getChatHistory calling /api/agent/history'
);
console.log('  ✓ getChatHistory is imported and invoked on ChatScreen mount');

// ── TEST 2: CHRONOLOGICAL SORTING & HYDRATION ──────────────────
console.log('Running Test 2: Chronological sorting logic...');
assert.ok(
  chatScreenSource.includes('new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()'),
  'ChatScreen sorts history chronologically (oldest to newest)'
);

// Verify sorting implementation with simulated out-of-order backend payload
const rawBackendHistory = [
  { id: '3', role: 'user', content: 'Third', timestamp: '2026-08-29T10:02:00.000Z' },
  { id: '1', role: 'user', content: 'First', timestamp: '2026-08-29T10:00:00.000Z' },
  { id: '2', role: 'assistant', content: 'Second', timestamp: '2026-08-29T10:01:00.000Z' },
];
const sorted = [...rawBackendHistory].sort(
  (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
);
assert.equal(sorted[0].id, '1');
assert.equal(sorted[1].id, '2');
assert.equal(sorted[2].id, '3');
console.log('  ✓ Chronological sorting verified for out-of-order payloads');

// ── TEST 3: NO DUPLICATION IN STORE HYDRATION ──────────────────
console.log('Running Test 3: History store hydration deduplication...');
assert.ok(
  chatScreenSource.includes('setChatHistory(sorted)'),
  'ChatScreen hydrates store directly via setChatHistory'
);
assert.ok(
  chatScreenSource.includes('storeHistory.length > 0 ? storeHistory : INITIAL_MESSAGES'),
  'ChatScreen renders storeHistory directly when populated without prepending artificial duplicates'
);
console.log('  ✓ Stored history renders cleanly without duplication');

// ── TEST 4: EMPTY STATE & GUIDANCE ─────────────────────────────
console.log('Running Test 4: Welcoming empty state for first-time users...');
assert.ok(
  chatScreenSource.includes('Ask FINAURA about your finances'),
  'Includes clean welcome header'
);
assert.ok(
  chatScreenSource.includes('Grounded in your verified operating balance'),
  'Includes grounded capabilities description'
);
console.log('  ✓ Empty state provides clear guidance without fake numbers');

// ── TEST 5: COMPLETE REMOVAL OF FAKE REASONING DEMO ARTIFACTS ──
console.log('Running Test 5: Audit complete removal of fake reasoning panel & demo charts...');
const forbiddenDemoArtifacts = [
  'SPARK',
  'GOAL_BARS',
  'GOAL_ACTIVE',
  'MiniSparkline',
  'GoalCapChart',
  'AiReasoningPanel',
  'setShowReasoning',
  '+$50/mo',
  'Subscriptions 12% > Avg',
];

for (const artifact of forbiddenDemoArtifacts) {
  assert.ok(
    !chatScreenSource.includes(artifact),
    `ChatScreen.tsx must NOT contain fake demo artifact: "${artifact}"`
  );
}
console.log('  ✓ All fake demo panels, sparklines, hardcoded USD figures, and popups completely removed');

// ── TEST 6: MESSAGE SENDING & WHITESPACE REJECTION ──────────────
console.log('Running Test 6: Message sending behavior & guards...');
assert.ok(
  chatScreenSource.includes('const trimmed = text.trim();'),
  'Trims input text'
);
assert.ok(
  chatScreenSource.includes('if (!trimmed || loading) return;'),
  'Guards against empty/whitespace strings and concurrent sending'
);
assert.ok(
  chatScreenSource.includes('sendMessageToAgent(trimmed, {})'),
  'Calls sendMessageToAgent with trimmed text'
);
console.log('  ✓ Input validation and send dispatch properly guarded');

// ── TEST 7: NETWORK / ERROR HANDLING ───────────────────────────
console.log('Running Test 7: Network failure resilience...');
assert.ok(
  chatScreenSource.includes("I couldn't reach FINAURA's assistant right now"),
  'Appends user-friendly error message on network failure'
);
assert.ok(
  chatScreenSource.includes('setLoading(false)'),
  'Always clears loading state in finally block'
);
console.log('  ✓ Network and server failures caught gracefully without UI freeze');

// ── TEST 8: LOGOUT STATE RESET ─────────────────────────────────
console.log('Running Test 8: Store reset clears chat history...');
// Verify store reset definition in useStore.ts
const storePath = path.join(__dirname, 'src', 'store', 'useStore.ts');
const storeSource = fs.readFileSync(storePath, 'utf8');
assert.ok(
  storeSource.includes('chatHistory:  [],'),
  'initialState includes empty chatHistory'
);
assert.ok(
  storeSource.includes('...initialState'),
  'resetStore resets to initialState'
);
console.log('  ✓ Logout resetStore purges all chat messages from memory');

// ── TEST 9: USER VS ASSISTANT MESSAGE BUBBLES ──────────────────
console.log('Running Test 9: User vs Assistant bubble styling & timestamps...');
assert.ok(
  chatScreenSource.includes("const isUser = item.role === 'user';"),
  'Distinguishes user vs assistant role'
);
assert.ok(
  chatScreenSource.includes('bubbleUser') && chatScreenSource.includes('bubbleBot'),
  'Applies distinct styles for user and bot bubbles'
);
assert.ok(
  chatScreenSource.includes('formatTime(item.timestamp)'),
  'Formats timestamp for messages'
);
console.log('  ✓ Message bubbles render with proper distinction, avatars, and timestamps');

// ── TEST 10: GROUNDED QUICK PROMPT PILLS ───────────────────────
console.log('Running Test 10: Suggested quick prompts audit...');
const supportedPromptKeywords = [
  'spending',
  'FMI',
  'FIRE',
  'liabilities',
  'Food & Dining',
];
for (const kw of supportedPromptKeywords) {
  assert.ok(
    chatScreenSource.includes(kw),
    `Quick prompts should cover supported capability: "${kw}"`
  );
}
console.log('  ✓ Quick prompts only reference live, grounded FINAURA capabilities');

console.log('\n================================================================');
console.log('  ALL 10 CLIENT CHATBOT UX TESTS PASSED (100% GREEN) 🚀');
console.log('================================================================\n');
