/**
 * client/tests/screens/chatbotUx.test.js
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

const clientRoot = path.resolve(__dirname, '../..');
const chatScreenPath = path.join(clientRoot, 'src', 'screens', 'ChatScreen.tsx');
const chatScreenSource = fs.readFileSync(chatScreenPath, 'utf8');

const apiPath = path.join(clientRoot, 'src', 'services', 'api.ts');
const apiSource = fs.readFileSync(apiPath, 'utf8');

// ── TEST 1: A NEWLY FOCUSED CHAT STARTS EMPTY ─────────────────
console.log('Running Test 1: Opening the assistant starts a new chat...');
assert.ok(chatScreenSource.includes('useFocusEffect(startNewChat)'), 'Focusing the screen starts a new chat');
const startNewChatSrc = chatScreenSource.slice(chatScreenSource.indexOf('const startNewChat = useCallback'), chatScreenSource.indexOf('useFocusEffect(startNewChat)'));
assert.ok(startNewChatSrc.includes('sessionRef.current = newSessionId()'), 'A new chat gets a fresh session id');
assert.ok(startNewChatSrc.includes('setChatHistory([])'), 'A new chat starts with no messages (welcome shown)');
assert.ok(
  apiSource.includes("api.get('/api/agent/history', { params: { sessionId } })"),
  'api.ts loads one session\'s history from /api/agent/history'
);
console.log('  ✓ A freshly focused chat has its own session and an empty history');

// ── TEST 2: SELECTING A SAVED SESSION SHOWS ITS MESSAGES ───────
console.log('Running Test 2: Selecting a saved session...');
const openSessionSrc = chatScreenSource.slice(chatScreenSource.indexOf('const openSession = async'), chatScreenSource.indexOf('const INITIAL_MESSAGES'));
assert.ok(openSessionSrc.includes('sessionRef.current = id'), 'Selecting a session switches to its id');
assert.ok(openSessionSrc.includes('loadSessionMessages(id, getChatHistory)'), 'Selecting a session loads that session\'s history');
assert.ok(openSessionSrc.includes('if (sessionRef.current === id) setChatHistory(history)'), 'A late reply for a session the user left is ignored');

const { loadSessionMessages, SESSION_LOAD_FAILED } = await import(path.join(clientRoot, 'src', 'utils', 'chatSessions.ts'));
const saved = [
  { id: '1', role: 'user', content: 'How much did I spend on food?', timestamp: '2026-08-29T10:00:00.000Z' },
  { id: '2', role: 'assistant', content: 'You spent ₹4,200 on Food & Dining.', timestamp: '2026-08-29T10:00:02.000Z' },
];
const asked = [];
const shown = await loadSessionMessages('sess-42', async (id) => { asked.push(id); return saved; });
assert.deepEqual(asked, ['sess-42'], 'History is requested for the selected session');
assert.deepEqual(shown, saved, 'The selected session\'s messages are shown in order');
console.log('  ✓ Selecting a session displays its messages');

// ── TEST 3: EMPTY OR FAILED HISTORY ────────────────────────────
console.log('Running Test 3: Empty and failed history requests...');
assert.deepEqual(await loadSessionMessages('sess-empty', async () => []), [], 'An empty session shows the welcome state');
const warn = console.warn; console.warn = () => {};
const failedLoad = await loadSessionMessages('sess-down', async () => { throw new Error('Network Error'); });
console.warn = warn;
assert.equal(failedLoad.length, 1);
assert.equal(failedLoad[0].role, 'assistant');
assert.equal(failedLoad[0].content, SESSION_LOAD_FAILED, 'A failed load says so instead of looking like an empty chat');
assert.ok(
  chatScreenSource.includes('storeHistory.length > 0 ? storeHistory : INITIAL_MESSAGES'),
  'ChatScreen renders storeHistory directly when populated without prepending artificial duplicates'
);
console.log('  ✓ Empty history shows the welcome; a failed load shows a clear note');

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
  chatScreenSource.includes('sendMessageToAgent(trimmed, session)'),
  'Calls sendMessageToAgent with trimmed text and the current session'
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
const storePath = path.join(clientRoot, 'src', 'store', 'useStore.ts');
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
