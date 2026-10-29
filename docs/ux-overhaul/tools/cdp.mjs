// Usage: node cdp.mjs '<js expression>'
// Evaluates an expression inside the running dev-client app through Metro's Hermes inspector.
// Hermes ignores awaitPromise, so kick off async work and read results with a second call.
import WS from 'ws';

const list = await (await fetch('http://127.0.0.1:8081/json/list')).json();
const target = list.find((t) => t.webSocketDebuggerUrl);
if (!target) { console.error('no debuggable app: is Metro running and the app open?'); process.exit(1); }

// Metro rejects inspector clients without a local Origin header.
const ws = new WS(target.webSocketDebuggerUrl.replace('localhost', '127.0.0.1'), { origin: 'http://127.0.0.1:8081' });
setTimeout(() => { console.error('timeout'); process.exit(2); }, 30000);
ws.on('close', (code) => { console.error('closed', code); process.exit(3); });
// Sending right on open gets the socket dropped; give the proxy a moment.
ws.on('open', () => setTimeout(() => ws.send(JSON.stringify({
  id: 1, method: 'Runtime.evaluate', params: { expression: process.argv[2], returnByValue: true },
})), 1200));
ws.on('message', (data) => {
  const msg = JSON.parse(String(data));
  if (msg.id !== 1) return;
  const r = msg.result?.result;
  console.log(r && 'value' in r ? (typeof r.value === 'string' ? r.value : JSON.stringify(r.value, null, 1)) : JSON.stringify(msg.result));
  process.exit(0);
});
