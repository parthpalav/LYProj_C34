import { useCallback, useEffect, useRef, useState } from 'react';

// The Web Speech API is not in TypeScript's DOM lib; this is the part used here.
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

const Ctor: RecognitionCtor | undefined =
  typeof window === 'undefined'
    ? undefined
    : ((window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition);

const ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access is blocked. Allow it in the browser address bar and try again.',
  'service-not-allowed': 'Microphone access is blocked. Allow it in the browser address bar and try again.',
  'audio-capture': 'No microphone was found.',
  network: 'Speech recognition needs an internet connection.',
  'no-speech': "I didn't hear anything. Tap the mic and try again.",
};

/**
 * Browser speech-to-text. `onText` gets the live transcript while the user talks;
 * `onDone` gets the final transcript once they stop.
 */
export function useSpeechInput(lang: string, onText: (text: string) => void, onDone: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const rec = useRef<Recognition | null>(null);
  const handlers = useRef({ onText, onDone });
  useEffect(() => { handlers.current = { onText, onDone }; });

  useEffect(() => () => rec.current?.abort(), []);

  const start = useCallback(() => {
    if (!Ctor) return;
    setError('');
    const r = new Ctor();
    let heard = '';
    r.lang = lang;
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      heard = Array.from(e.results, (res) => res[0].transcript).join(' ').trim();
      handlers.current.onText(heard);
    };
    r.onerror = (e) => { if (e.error !== 'aborted') setError(ERRORS[e.error] ?? 'Speech recognition failed. Try again or type instead.'); };
    r.onend = () => {
      setListening(false);
      rec.current = null;
      if (heard) handlers.current.onDone(heard);
    };
    rec.current = r;
    setListening(true);
    r.start();
  }, [lang]);

  const stop = useCallback(() => rec.current?.stop(), []);

  return { supported: Boolean(Ctor), listening, error, start, stop };
}
