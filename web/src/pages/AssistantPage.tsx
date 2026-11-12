import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Check, History, Mic, Sparkles, Square, SquarePen, X } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../hooks/useAuth';
import { getChatHistory, getChatSessions, sendMessageToAgent } from '../services/api';
import { getUserFirstName } from '../utils/formatters';
import type { ChatMessage, ChatSession } from '../types';
import { getAppTimezone } from '../utils/timezone';
import { useSpeechInput } from '../hooks/useSpeechInput';

// Starters shown before the first message of a session. Same list as the mobile assistant.
const QUICK_PROMPTS = [
  'How am I doing overall?',
  'How is my spending this month?',
  'Where did most of my money go this month?',
  'Am I within my 50/30/20 budget?',
  'What is my balance right now?',
  'How much can I safely spend this week?',
  'Why is my FMI changing?',
  'What would raise my FMI the fastest?',
  'What liabilities are due soon?',
  'Which wants could I cut back on?',
  'How much have I spent on Food & Dining?',
  'How much did I invest this month?',
  'How can I improve my savings rate?',
  'When could I reach FIRE?',
  'How much more should I invest each month for FIRE?',
  'Are my goals on track?',
  'What spending habits do you see?',
  'I spent ₹250 on chai and snacks',
  'Aaj 500 ka petrol dalwaya',
  'Add ₹5,000 invested in a mutual fund SIP',
];

const newSessionId = () => `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Speech languages. Hindi mode also copes with mixed Hindi-English speech.
const VOICE_LANGS = [
  { code: 'en-IN', label: 'EN', name: 'English' },
  { code: 'hi-IN', label: 'हिं', name: 'Hindi / Hinglish' },
];
const savedLang = () => {
  try { return localStorage.getItem('finaura.voiceLang') || 'en-IN'; } catch { return 'en-IN'; }
};

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

/** Reveals a fresh reply a few words at a time, as the mobile assistant does; instant under reduced motion. */
function useTypewriter(text: string, active: boolean) {
  const words = useMemo(() => text.split(/(\s+)/), [text]);
  const animate = active && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [count, setCount] = useState(animate ? 0 : words.length);
  useEffect(() => {
    if (!animate) return;
    const timer = setInterval(() => setCount((n) => {
      if (n >= words.length) { clearInterval(timer); return n; }
      return n + 2;
    }), 28);
    return () => clearInterval(timer);
  }, [animate, words.length]);
  if (count >= words.length) return text;
  const partial = words.slice(0, count).join('');
  // Close a bold marker that is still being typed so the raw ** never shows.
  return partial.split('**').length % 2 === 0 ? `${partial}**` : partial;
}

const time = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { timeZone: getAppTimezone(), hour: '2-digit', minute: '2-digit' });
};

interface MessageProps {
  message: ChatMessage;
  /** arrived in this session, so it types out */
  fresh: boolean;
  failedText?: string;
  onRetry: (text: string) => void;
  onGrow: () => void;
}

const Message: React.FC<MessageProps> = ({ message: m, fresh, failedText, onRetry, onGrow }) => {
  const isAssistant = m.role === 'assistant';
  const text = useTypewriter(m.content, isAssistant && fresh);
  useEffect(() => { if (fresh) onGrow(); }, [text, fresh, onGrow]);

  return (
    <div className={`chat-bubble-row ${m.role}`}>
      {isAssistant && <span className="chat-orb chat-orb-sm" aria-hidden="true"><Sparkles size={12} /></span>}
      <div className="chat-bubble-col">
        {/* Screen readers get the whole reply once instead of every typed step. */}
        <div className="chat-bubble" aria-hidden={isAssistant && fresh ? true : undefined}>
          {isAssistant ? <RichText text={text} /> : m.content}
        </div>
        {isAssistant && fresh && <span className="sr-only">{m.content}</span>}
        {m.actions && m.actions.length > 0 && (
          <ul className="chat-actions" aria-label="Changes made">
            {m.actions.map((a, i) => (
              <li key={i} className={a.ok ? 'ok' : 'failed'} style={{ '--i': i } as React.CSSProperties}>
                {a.ok ? <Check size={13} aria-hidden /> : <X size={13} aria-hidden />}
                {a.label}
              </li>
            ))}
          </ul>
        )}
        {failedText ? (
          <button type="button" className="chat-retry" onClick={() => onRetry(failedText)}>Try again</button>
        ) : (
          time(m.timestamp) && <span className="chat-time">{time(m.timestamp)}</span>
        )}
      </div>
    </div>
  );
};

export const AssistantPage: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [failed, setFailed] = useState<{ id: string; text: string } | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const settled = useRef(false);
  const stickToEnd = useCallback(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'instant' });
  }, []);
  const [voiceLang, setVoiceLang] = useState(savedLang);
  const sendRef = useRef<(text: string) => void>(() => {});
  // Speaking sends the message when the user stops talking, so adding a purchase is hands-free.
  const speech = useSpeechInput(voiceLang, setInput, (text) => sendRef.current(text));
  const nextLang = VOICE_LANGS[(VOICE_LANGS.findIndex((l) => l.code === voiceLang) + 1) % VOICE_LANGS.length];
  const currentLang = VOICE_LANGS.find((l) => l.code === voiceLang) ?? VOICE_LANGS[0];
  const switchLang = () => {
    setVoiceLang(nextLang.code);
    try { localStorage.setItem('finaura.voiceLang', nextLang.code); } catch { /* preference just won't persist */ }
  };

  // Sessions: opening the assistant starts a new chat; older ones stay saved and can be reopened from the header.
  const sessionRef = useRef(newSessionId());
  const [sessions, setSessions] = useState<ChatSession[] | null>(null); // null = list closed

  const startNewChat = () => {
    sessionRef.current = newSessionId();
    setSessions(null);
    setMessages([]);
    setFailed(null);
    setSending(false);
  };

  const toggleSessions = () => {
    if (sessions) return setSessions(null);
    setSessions([]);
    getChatSessions().then((list) => setSessions((open) => open && list)).catch(() => {});
  };

  const openSession = (id: string) => {
    startNewChat();
    sessionRef.current = id;
    settled.current = false;
    setLoadingHistory(true);
    getChatHistory(id)
      .then((history) => { if (sessionRef.current === id) setMessages(history); })
      .catch(() => { /* empty history is fine; the greeting still shows */ })
      .finally(() => setLoadingHistory(false));
  };

  // Saved history lands at the end at once; later messages glide into view.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: settled.current ? 'smooth' : 'instant' });
    if (!loadingHistory) settled.current = true;
  }, [messages, sending, loadingHistory]);

  const greeting: ChatMessage = {
    id: 'greeting',
    role: 'assistant',
    content: `Hi ${getUserFirstName(user) || 'there'}! I'm FINAURA, your money copilot. Ask me about your balance, spending, **FMI score**, bills or FIRE. You can also tell me what you bought, by typing or with the mic, in English, Hindi or Hinglish, and I'll record it.`,
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
    const session = sessionRef.current;
    try {
      const reply = await sendMessageToAgent(trimmed, session);
      if (sessionRef.current !== session) return; // the user moved to another chat; the reply is saved with its own session
      setFreshId(reply.id);
      setMessages((m) => [...m, reply]);
    } catch {
      if (sessionRef.current !== session) return;
      const id = `e-${Date.now()}`;
      setFailed({ id, text: trimmed });
      setMessages((m) => [...m, { id, role: 'assistant', content: "I couldn't reach FINAURA's assistant right now. Please check your connection and try again.", timestamp: new Date().toISOString() }]);
    } finally {
      if (sessionRef.current === session) setSending(false);
    }
  };

  useEffect(() => { sendRef.current = send; });

  return (
    <div className="parity-page">
      <PageHeader title="Assistant" category="AI COPILOT" description="Ask about your money or tell it what you spent. It can add, edit and remove your records." />
      <section className="parity-card chat-shell" aria-label="Conversation with FINAURA">
        <header className="chat-head">
          <span className={`chat-orb${sending ? ' thinking' : ''}`} aria-hidden="true"><Sparkles size={16} /></span>
          <div className="chat-head-text">
            <strong>FINAURA AI</strong>
            <span className={`chat-status${sending ? ' shimmer' : ''}`}>
              {speech.listening ? 'Listening…' : sending ? 'Thinking…' : 'Answers from your own numbers'}
            </span>
          </div>
          {speech.listening && <span className="chat-wave" aria-hidden="true"><i /><i /><i /><i /><i /></span>}
          <div className="chat-head-actions">
            <button type="button" className="chat-lang" onClick={toggleSessions} aria-expanded={Boolean(sessions)} aria-label="Past chats" title="Past chats">
              <History size={16} />
            </button>
            <button type="button" className="chat-lang" onClick={startNewChat} aria-label="New chat" title="New chat">
              <SquarePen size={16} />
            </button>
          </div>
        </header>
        {sessions && (
          <div className="chat-sessions" aria-label="Past chats">
            {sessions.length === 0 && <p className="parity-muted">No saved chats yet.</p>}
            {sessions.map((x) => (
              <button key={x.id} type="button" onClick={() => openSession(x.id)}>
                <strong>{x.title}</strong>
                <span>{new Date(x.updatedAt).toLocaleDateString('en-IN', { timeZone: getAppTimezone(), day: 'numeric', month: 'short', year: 'numeric' })} · {x.messages} messages</span>
              </button>
            ))}
          </div>
        )}
        <div className="chat-log" ref={logRef} aria-live="polite">
          {loadingHistory ? (
            <p className="parity-muted">Loading your conversation…</p>
          ) : (
            <>
              {messages.length === 0 && (
                <div className="chat-hero">
                  <span className="chat-orb chat-orb-lg" aria-hidden="true"><Sparkles size={26} /></span>
                  <h2>Ask FINAURA about your finances</h2>
                  <p>Grounded in your verified balance, spending habits, FMI pillars and FIRE milestones.</p>
                </div>
              )}
              {shown.map((m) => (
                <Message
                  key={m.id}
                  message={m}
                  fresh={m.id === freshId}
                  failedText={failed?.id === m.id ? failed.text : undefined}
                  onRetry={send}
                  onGrow={stickToEnd}
                />
              ))}
            </>
          )}
          {sending && (
            <div className="chat-bubble-row assistant" aria-label="FINAURA is typing">
              <span className="chat-orb chat-orb-sm thinking" aria-hidden="true"><Sparkles size={12} /></span>
              <div className="chat-bubble chat-thinking">
                <span className="chat-typing"><i /><i /><i /></span>
                <span className="chat-thinking-text">Looking at your numbers…</span>
              </div>
            </div>
          )}
        </div>
        {!loadingHistory && messages.length === 0 && (
          <div className="chat-prompts">
            {QUICK_PROMPTS.map((text, i) => (
              <button key={text} type="button" className="parity-chip" style={{ '--i': i } as React.CSSProperties} onClick={() => send(text)} disabled={sending}>
                {text}
              </button>
            ))}
          </div>
        )}
        <form className={`chat-composer${speech.listening ? ' listening' : ''}`} onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <label htmlFor="chat-input" className="sr-only">Message</label>
          <div className="chat-field">
            <textarea
              id="chat-input"
              className="chat-input"
              rows={1}
              maxLength={2000}
              placeholder={speech.listening ? 'Listening…' : 'Ask a question or say what you spent…'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
              }}
            />
            {speech.supported && (
              <>
                <button
                  type="button"
                  className="chat-lang"
                  onClick={switchLang}
                  disabled={speech.listening}
                  aria-label={`Voice language: ${currentLang.name}. Switch to ${nextLang.name}`}
                  title={`Voice language: ${currentLang.name}`}
                >
                  {currentLang.label}
                </button>
                <button
                  type="button"
                  className={`chat-mic${speech.listening ? ' listening' : ''}`}
                  onClick={speech.listening ? speech.stop : speech.start}
                  disabled={sending}
                  aria-pressed={speech.listening}
                  aria-label={speech.listening ? 'Stop listening' : 'Speak your message'}
                >
                  {speech.listening ? <Square size={15} /> : <Mic size={17} />}
                </button>
              </>
            )}
            <button type="submit" className="chat-send" disabled={!input.trim() || sending} aria-label="Send">
              <ArrowUp size={18} />
            </button>
          </div>
        </form>
        {speech.error && <p className="chat-voice-error" role="alert">{speech.error}</p>}
      </section>
    </div>
  );
};

export default AssistantPage;
