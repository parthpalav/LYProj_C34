import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createStyles, radius, tabular, typeScale, useTheme } from '../../theme';

type Props = {
  /** The request finished: the ring fills to 100% and shows doneLabel. */
  done: boolean;
  fileName: string;
  /** PDFs take longer: sets how fast the ring creeps while waiting. */
  slow: boolean;
  doneLabel: string;
  onCancel: () => void;
  /** Called once the finish has played. The parent unmounts the overlay here. */
  onFinished: () => void;
};

const SIZE = 200;
const STROKE = 14;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const FINISH_MS = 1100;

// Stage text follows elapsed time; the server reports nothing until it is done.
const stageFor = (ms: number, slow: boolean) => {
  if (!slow) return ms < 400 ? 'Reading the statement' : ms < 900 ? 'Classifying transactions' : 'Checking for duplicates';
  if (ms < 3000) return 'Reading the PDF';
  if (ms < 8000) return 'Finding transactions';
  if (ms < 15000) return 'Classifying transactions';
  return 'Taking longer than usual. If Gemini is slow, the offline reader takes over.';
};

/**
 * Full-screen blurred wait screen for statement reading + classification. Mount it while
 * reading. The server answers in one response, so the ring eases toward 92% while waiting
 * and completes when the response arrives.
 */
export function ImportProgressOverlay({ done, fileName, slow, doneLabel, onCancel, onFinished }: Props): React.ReactElement {
  const s = useStyles();
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [elapsed, setElapsed] = useState(0);
  const onFinishedRef = useRef(onFinished);
  useEffect(() => { onFinishedRef.current = onFinished; });

  // Creep: p(t) = 0.92 · (1 − e^(−t/τ)). τ is about a third of the expected wait.
  useEffect(() => {
    if (done) return undefined;
    const start = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - start), 50);
    return () => clearInterval(id);
  }, [done]);

  useEffect(() => {
    if (!done) return undefined;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const t = setTimeout(() => onFinishedRef.current(), FINISH_MS);
    return () => clearTimeout(t);
  }, [done]);

  const shown = done ? 1 : 0.92 * (1 - Math.exp(-elapsed / (slow ? 7000 : 900)));
  const pct = Math.round(shown * 100);

  return (
    <Modal transparent animationType="fade" statusBarTranslucent onRequestClose={() => { if (!done) onCancel(); }}>
      <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
        <BlurView intensity={60} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, s.scrim]} />
        <View style={s.center}>
          <View
            style={s.ring}
            accessibilityRole="progressbar"
            accessibilityLabel="Statement progress"
            accessibilityValue={{ min: 0, max: 100, now: pct }}
          >
            <Svg width={SIZE} height={SIZE}>
              <Defs>
                <LinearGradient id="importRing" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={c.accent[0]} />
                  <Stop offset="1" stopColor={c.accent[2]} />
                </LinearGradient>
              </Defs>
              <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={c.border} strokeWidth={STROKE} fill="none" />
              <Circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                stroke={done ? c.success : 'url(#importRing)'}
                strokeWidth={STROKE}
                fill="none"
                // Round caps overlap into a notch on a full circle.
                strokeLinecap={done ? 'butt' : 'round'}
                strokeDasharray={`${CIRC} ${CIRC}`}
                strokeDashoffset={CIRC * (1 - shown)}
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              />
            </Svg>
            <View style={s.ringLabel}>
              {done
                ? <Ionicons name="checkmark" size={72} color={c.success} />
                : <Text style={s.pct}>{pct}<Text style={s.pctSign}>%</Text></Text>}
            </View>
          </View>
          <Text style={s.title} accessibilityRole="header">{done ? 'All set' : 'Importing your statement'}</Text>
          <Text style={s.stage} accessibilityLiveRegion="polite">{done ? doneLabel : stageFor(elapsed, slow)}</Text>
          <Text style={s.file} numberOfLines={1}>{fileName}</Text>
        </View>
        {!done && (
          <Pressable
            onPress={onCancel}
            style={({ pressed }) => [s.cancel, { bottom: insets.bottom + 20 }, pressed && s.cancelPressed]}
            accessibilityRole="button"
            accessibilityLabel="Cancel import"
            hitSlop={8}
          >
            <Ionicons name="close" size={16} color={c.text} />
            <Text style={s.cancelText}>Cancel</Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

const useStyles = createStyles((c) => ({
  scrim: { backgroundColor: c.bg, opacity: 0.55 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  ring: { width: SIZE, height: SIZE, marginBottom: 16 },
  ringLabel: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  pct: { fontSize: 46, fontWeight: '800', letterSpacing: -1, color: c.text, ...tabular },
  pctSign: { fontSize: 20, fontWeight: '700', color: c.textMuted },
  title: { ...typeScale.title, color: c.text, textAlign: 'center' },
  stage: { ...typeScale.body, color: c.textMuted, textAlign: 'center' },
  file: { ...typeScale.caption, color: c.textSubtle, maxWidth: 280 },
  cancel: { position: 'absolute', right: 20, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surface },
  cancelPressed: { opacity: 0.7 },
  cancelText: { ...typeScale.label, fontSize: 14, color: c.text },
}));
