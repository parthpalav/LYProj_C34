import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExpoSpeechRecognitionModule as SpeechModule } from 'expo-speech-recognition';

// The native module only exists in builds made after expo-speech-recognition was added.
// In an older dev client the require throws, and the mic button is simply hidden.
let Speech: typeof SpeechModule | null = null;
try {
  Speech = require('expo-speech-recognition').ExpoSpeechRecognitionModule;
} catch {
  Speech = null;
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone or speech access is off. Turn it on in Settings.',
  'service-not-allowed': 'Speech recognition is not available on this device.',
  'language-not-supported': 'This voice language is not installed on the device.',
  'audio-capture': 'The microphone is not available.',
  network: 'Speech recognition needs an internet connection.',
  'no-speech': "I didn't hear anything. Tap the mic and try again.",
};

/**
 * Device speech-to-text. `onText` gets the live transcript while the user talks;
 * `onDone` gets the final transcript once they stop.
 */
export function useSpeechInput(lang: string, onText: (text: string) => void, onDone: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const heard = useRef('');
  const handlers = useRef({ onText, onDone });
  useEffect(() => { handlers.current = { onText, onDone }; });

  useEffect(() => {
    if (!Speech) return;
    const subs = [
      Speech.addListener('result', (e) => {
        heard.current = (e.results[0]?.transcript ?? '').trim();
        handlers.current.onText(heard.current);
      }),
      Speech.addListener('error', (e) => {
        if (e.error !== 'aborted') setError(ERRORS[e.error] ?? 'Speech recognition failed. Try again or type instead.');
      }),
      Speech.addListener('end', () => {
        setListening(false);
        if (heard.current) handlers.current.onDone(heard.current);
        heard.current = '';
      }),
    ];
    return () => {
      subs.forEach((s) => s.remove());
      Speech?.abort();
    };
  }, []);

  const start = useCallback(async () => {
    if (!Speech) return;
    setError('');
    heard.current = '';
    try {
      const { granted } = await Speech.requestPermissionsAsync();
      if (!granted) {
        setError(ERRORS['not-allowed']);
        return;
      }
      setListening(true);
      Speech.start({ lang, interimResults: true, continuous: false });
    } catch {
      setListening(false);
      setError('Speech recognition failed. Try again or type instead.');
    }
  }, [lang]);

  const stop = useCallback(() => Speech?.stop(), []);

  return { supported: Boolean(Speech), listening, error, start, stop };
}
