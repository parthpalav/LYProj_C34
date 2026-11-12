// Agent loop with a scripted model and a fake API. Run: node server/tests/ai/assistantAgent.test.js
import assert from 'node:assert/strict';
import { replyLanguage, runAgent, TOOLS } from '../../services/AssistantAgent.js';

const scripted = (turns) => {
  const seen = [];
  return { seen, messages: { create: async (req) => { seen.push(structuredClone(req)); return turns.shift(); } } };
};
const use = (name, input, id = name) => ({ type: 'tool_use', id, name, input });

// 1. Two purchases in one message: both are added through the API, receipts come back, the final text is returned.
const calls = [];
const api = async (method, path, body) => {
  calls.push({ method, path, body });
  if (path === '/api/transactions' && method === 'POST') return { id: 't1', category: 'Food & Dining' };
  throw new Error('Asset not found');
};
let client = scripted([
  { stop_reason: 'tool_use', content: [use('add_transaction', { amount: 250, description: 'Chai' }, 'a'), use('add_transaction', { amount: 500, description: 'Petrol', date: '2026-11-10' }, 'b')] },
  { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Dono add kar diye.' }] },
]);
let out = await runAgent({ userInput: 'chai 250 aur petrol 500', rawHistory: [{ role: 'assistant', content: 'hi' }, { role: 'user', content: 'hello' }], api, client });
assert.equal(out.text, 'Dono add kar diye.');
assert.deepEqual(calls.map((c) => [c.method, c.path, c.body.amount]), [['POST', '/api/transactions', 250], ['POST', '/api/transactions', 500]]);
assert.equal(calls[0].body.timestamp, undefined, 'no date means now');
assert.equal(calls[1].body.timestamp, '2026-11-10T12:00:00Z');
assert.deepEqual(out.actions.map((a) => a.label), ['Added ₹250 · Chai · Food & Dining', 'Added ₹500 · Petrol · Food & Dining']);
assert.equal(client.seen[0].messages[0].role, 'user', 'history starts on a user turn');
assert.equal(client.seen[1].messages.at(-1).content.length, 2, 'both tool results go back in one user message');
assert.match(client.seen[0].system[1].text, /Today is \w+, \d{4}-\d{2}-\d{2}/);

// 2. A failing API call and a call missing a required field are reported to the model as errors, never as success.
client = scripted([
  { stop_reason: 'tool_use', content: [use('update_asset_value', { id: 'x', currentValue: 1 }, 'a'), use('add_income', { amount: 100 }, 'b')] },
  { stop_reason: 'end_turn', content: [{ type: 'text', text: 'That did not work.' }] },
]);
out = await runAgent({ userInput: 'x', api, client });
const results = client.seen[1].messages.at(-1).content;
assert.ok(results.every((r) => r.is_error));
assert.match(results[1].content, /Missing required field: source/);
assert.ok(out.actions.every((a) => !a.ok));

// 3. A refusal and a tool call cut off by max_tokens both stop without running tools.
calls.length = 0;
out = await runAgent({ userInput: 'x', api, client: scripted([{ stop_reason: 'refusal', content: [] }]) });
assert.match(out.text, /can't help/);
out = await runAgent({ userInput: 'x', api, client: scripted([{ stop_reason: 'max_tokens', content: [use('delete_record', { kind: 'goal', id: 'g' })] }]) });
assert.equal(calls.length, 0);

// 4. Every tool schema is closed and names only real required fields.
for (const t of TOOLS) {
  assert.equal(t.input_schema.additionalProperties, false, t.name);
  for (const k of t.input_schema.required) assert.ok(t.input_schema.properties[k], `${t.name}.${k}`);
}
// 5. Gemini path: a dead first model is skipped before anything runs, tool calls execute, errors go back as errors,
//    and a model that dies after a save still reports the save.
const gemini = (replies) => {
  const tried = [], sent = [];
  const reply = (r) => { if (r instanceof Error) throw r; return { response: { functionCalls: () => r.calls, text: () => r.text || '', candidates: [{ content: { role: 'model', parts: r.calls.map((c) => ({ functionCall: c, thoughtSignature: 'sig' })) } }] } }; };
  return { tried, sent, getModel: (name, system) => { tried.push({ name, system }); return { generateContent: async ({ contents }) => { sent.push(structuredClone(contents)); return reply(replies.shift()); } }; } };
};
calls.length = 0;
let g = gemini([
  Object.assign(new Error('overloaded'), { status: 503 }),
  { calls: [{ name: 'add_transaction', args: { amount: 40, description: 'Chai' } }, { name: 'add_income', args: { amount: 5 } }] },
  { calls: [], text: 'Chai add ho gayi.' },
]);
out = await runAgent({ userInput: '40 ki chai', api, getModel: g.getModel });
assert.equal(out.text, 'Chai add ho gayi.');
assert.equal(g.tried.length, 2, 'second model used after the first failed');
assert.match(g.tried[1].system, /Verified snapshot/);
assert.equal(calls.length, 1, 'the transaction was added exactly once');
const last = g.sent[2];
assert.deepEqual(last.map((c) => c.role), ['user', 'model', 'user'], 'tool results go back as a user turn');
assert.equal(last[1].parts[0].thoughtSignature, 'sig', 'the model turn is replayed untouched');
assert.deepEqual(last[2].parts.map((p) => Object.keys(p.functionResponse.response)[0]), ['result', 'error']);
assert.deepEqual(out.actions.map((a) => a.ok).sort(), [false, true]); // receipts arrive in completion order

g = gemini([{ calls: [{ name: 'add_transaction', args: { amount: 40, description: 'Chai' } }] }, new Error('socket hang up')]);
out = await runAgent({ userInput: 'x', api, getModel: g.getModel });
assert.match(out.text, /lost the connection/);
assert.equal(out.actions.length, 1);

await assert.rejects(runAgent({ userInput: 'x', api, getModel: gemini([Object.assign(new Error('bad key'), { status: 403 })]).getModel }), /bad key/);
// 6. The reply language follows the current message.
assert.equal(replyLanguage('Thanks. When is my next bill due?'), 'English');
assert.match(replyLanguage('aaj 500 ka petrol dalwaya'), /Hinglish/);
assert.match(replyLanguage('आज 60 रुपये का समोसा खाया'), /Devanagari/);
console.log('assistantAgent: all checks passed');
