import React, { useEffect, useRef, useState } from 'react';
import { Check, Mic, Send, Square, X } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { getChatHistory, sendMessageToAgent } from '../services/api';
import { getUserFirstName } from '../utils/formatters';
import type { ChatMessage } from '../types';
import { getAppTimezone } from '../utils/timezone';
import { useSpeechInput } from '../hooks/useSpeechInput';

// Same grounded prompts as the mobile assistant.
const QUICK_PROMPTS = [
  'I spent ₹250 on chai and snacks',
  'Aaj 500 ka petrol dalwaya',
  'How is my spending this month?',
  'Why is my FMI changing?',
  'When could I reach FIRE?',
  'What liabilities are due soon?',
  'How much have I spent on Food & Dining?',
];

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

  useEffect(() => { sendRef.current = send; });

  return (
    <div className="parity-page">
      <PageHeader title="Assistant" category="AI COPILOT" description="Ask about your money or tell it what you spent. It can add, edit and remove your records." />
      <section className="parity-card chat-shell" aria-label="Conversation with FINAURA">
        <div className="chat-log" ref={logRef} aria-live="polite">
          {loadingHistory ? (
            <p className="parity-muted">Loading your conversation…</p>
          ) : (
            shown.map((m) => (
              <div key={m.id} className={`chat-bubble-row ${m.role}`}>
                <div className="chat-bubble">{m.role === 'assistant' ? <RichText text={m.content} /> : m.content}</div>
                {m.actions && m.actions.length > 0 && (
                  <ul className="chat-actions" aria-label="Changes made">
                    {m.actions.map((a, i) => (
                      <li key={i} className={a.ok ? 'ok' : 'failed'}>
                        {a.ok ? <Check size={13} aria-hidden /> : <X size={13} aria-hidden />}
                        {a.label}
                      </li>
                    ))}
                  </ul>
                )}
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
          <Button type="submit" disabled={!input.trim() || sending} leftIcon={<Send size={15} />}>Send</Button>
        </form>
        {speech.error && <p className="chat-voice-error" role="alert">{speech.error}</p>}
      </section>
    </div>
  );
};

export default AssistantPage;
