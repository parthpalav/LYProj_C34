import React, { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { getChatHistory, sendMessageToAgent } from '../services/api';
import { getUserFirstName } from '../utils/formatters';
import type { ChatMessage } from '../types';
import { getAppTimezone } from '../utils/timezone';

// Same grounded prompts as the mobile assistant.
const QUICK_PROMPTS = [
  'How is my spending this month?',
  'Why is my FMI changing?',
  'When could I reach FIRE?',
  'What liabilities are due soon?',
  'How much have I spent on Food & Dining?',
];

/** Renders the assistant's light markdown: **bold**, "- " / "• " bullets and "1. " numbered lines. */
function RichText({ text }: { text: string }) {
  const inline = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
    );
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{inline(it)}</li>);
    blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
    list = null;
  };
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-•*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flush();
      list = list ?? { ordered, items: [] };
      list.items.push((bullet ? bullet[1] : numbered![1]));
      continue;
    }
    flush();
    if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line)}</p>);
  }
  flush();
  return <>{blocks}</>;
}

const time = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { timeZone: getAppTimezone(), hour: '2-digit', minute: '2-digit' });
};

export const AssistantPage: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [failed, setFailed] = useState<{ id: string; text: string } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    getChatHistory()
      .then((history) => {
        if (!mounted) return;
        setMessages([...history].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
      })
      .catch(() => { /* empty history is fine; the greeting still shows */ })
      .finally(() => mounted && setLoadingHistory(false));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, sending]);

  const greeting: ChatMessage = {
    id: 'greeting',
    role: 'assistant',
    content: `Hi ${getUserFirstName(user) || 'there'}! I'm FINAURA, your money copilot. Ask me about your balance, spending, **FMI score**, bills, or when you could reach FIRE.`,
    timestamp: '',
  };
  const shown = messages.length ? messages : [greeting];

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    if (trimmed.length > 2000) return; // server rejects longer messages
    setMessages((m) => [...m.filter((x) => x.id !== failed?.id), { id: `u-${Date.now()}`, role: 'user', content: trimmed, timestamp: new Date().toISOString() }]);
    setInput('');
    setFailed(null);
    setSending(true);
    try {
      const reply = await sendMessageToAgent(trimmed);
      setMessages((m) => [...m, reply]);
    } catch {
      const id = `e-${Date.now()}`;
      setFailed({ id, text: trimmed });
      setMessages((m) => [...m, { id, role: 'assistant', content: "I couldn't reach FINAURA's assistant right now. Please check your connection and try again.", timestamp: new Date().toISOString() }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="parity-page">
      <PageHeader title="Assistant" category="AI COPILOT" description="Ask about your money. Answers use your own transactions, bills and forecasts." />
      <section className="parity-card chat-shell" aria-label="Conversation with FINAURA">
        <div className="chat-log" ref={logRef} aria-live="polite">
          {loadingHistory ? (
            <p className="parity-muted">Loading your conversation…</p>
          ) : (
            shown.map((m) => (
              <div key={m.id} className={`chat-bubble-row ${m.role}`}>
                <div className="chat-bubble">{m.role === 'assistant' ? <RichText text={m.content} /> : m.content}</div>
                {failed?.id === m.id ? (
                  <button type="button" className="chat-retry" onClick={() => send(failed.text)}>Try again</button>
                ) : (
                  time(m.timestamp) && <span className="chat-time">{time(m.timestamp)}</span>
                )}
              </div>
            ))
          )}
          {sending && (
            <div className="chat-bubble-row assistant" aria-label="FINAURA is typing">
              <div className="chat-bubble"><span className="chat-typing"><i /><i /><i /></span></div>
            </div>
          )}
        </div>
        {!loadingHistory && messages.length === 0 && (
          <div className="chat-prompts">
            {QUICK_PROMPTS.map((p) => (
              <button key={p} type="button" className="parity-chip" onClick={() => send(p)} disabled={sending}>{p}</button>
            ))}
          </div>
        )}
        <form className="chat-composer" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <label htmlFor="chat-input" className="sr-only">Message</label>
          <textarea
            id="chat-input"
            className="form-input"
            rows={1}
            maxLength={2000}
            placeholder="Ask FINAURA anything about your money…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
            }}
          />
          <Button type="submit" disabled={!input.trim() || sending} leftIcon={<Send size={15} />}>Send</Button>
        </form>
      </section>
    </div>
  );
};

export default AssistantPage;
