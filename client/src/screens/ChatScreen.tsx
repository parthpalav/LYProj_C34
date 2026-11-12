import React, { useRef, useState, useEffect, useCallback } from 'react';
import { FlatList, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation, Easing, FadeIn, FadeInLeft, FadeInRight, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { getChatHistory, getChatSessions, sendMessageToAgent } from '../services/api';
import { useStore } from '../store/useStore';
import { ChatMessage, ChatSession } from '../types';
import { duration, easing, enterUp, popIn } from '../motion';
import { PressableScale } from '../components/motion/PressableScale';
import { createStyles, radius, shadow, typeScale, useTheme } from '../theme';
import { useTabBarSpace } from '../components/navigation/TabBar';
import { Chip } from '../components/ui/Bits';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { Sheet } from '../components/ui/Sheet';
import { formatDay } from '../components/ui/DateField';
import { useSpeechInput } from '../utils/useSpeechInput';

const finauraLogo = require('../assets/finaura_logo.png');

/** One dot of the "assistant is typing" indicator: the three hop in a wave. */
function TypingDot({ index, style }: { index: number; style: object }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    const hop = { duration: 280, easing: Easing.inOut(Easing.sin) };
    t.value = withDelay(index * 150, withRepeat(withSequence(withTiming(1, hop), withTiming(0, hop), withTiming(0, { duration: 500 })), -1));
    return () => cancelAnimation(t);
  }, [index, reduced, t]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: 0.35 + 0.65 * t.value, transform: [{ translateY: -4 * t.value }] }));
  return <Animated.View style={[style, animatedStyle]} />;
}

/** A soft ring that swells and fades behind its parent while `active` (thinking, listening). */
function Pulse({ active, color, radius: r }: { active: boolean; color: string; radius: number }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(t);
    t.value = 0;
    if (active && !reduced) t.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.out(Easing.quad) }), -1);
    return () => cancelAnimation(t);
  }, [active, reduced, t]);
  const style = useAnimatedStyle(() => ({ opacity: active ? 0.45 * (1 - t.value) : 0, transform: [{ scale: 1 + 0.7 * t.value }] }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: r, backgroundColor: color }, style]} />;
}

// Bubbles fade in with a 6pt slide from the sender's side.
const enterUser = FadeInRight.duration(duration.base).easing(easing.standard).withInitialValues({ opacity: 0, transform: [{ translateX: 6 }] });
const enterBot = FadeInLeft.duration(duration.base).easing(easing.standard).withInitialValues({ opacity: 0, transform: [{ translateX: -6 }] });

// ── Grounded Quick Prompts ─────────────────────────────────
// Starters shown before the first message of a session: a spread of what the assistant can read and do.
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
  { code: 'hi-IN', label: 'हिं', name: 'Hindi and Hinglish' },
];

function formatTime(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** Renders the assistant's light markdown: **bold**, "- " / "• " bullets and "1. " numbered lines. */
function RichText({ text, style, boldStyle, bulletColor }: { text: string; style: object; boldStyle: object; bulletColor: string }) {
  const inline = (line: string, key: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <Text key={`${key}-${i}`} style={boldStyle}>{part.slice(2, -2)}</Text>
        : part,
    );
  return (
    <View style={{ gap: 4 }}>
      {text.split('\n').filter((l, i, all) => l.trim() || (i > 0 && all[i - 1].trim())).map((raw, i) => {
        const line = raw.trimEnd();
        const bullet = line.match(/^\s*[-•*]\s+(.*)$/);
        const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
        if (bullet || numbered) {
          return (
            <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={[style, { color: bulletColor, fontWeight: '700' }]}>{numbered ? `${numbered[1]}.` : '•'}</Text>
              <Text style={[style, { flex: 1 }]}>{inline(bullet ? bullet[1] : numbered![2], `l${i}`)}</Text>
            </View>
          );
        }
        return <Text key={i} style={style}>{inline(line, `l${i}`)}</Text>;
      })}
    </View>
  );
}

/** Reveals a fresh reply word by word; instant under Reduce Motion. */
function useTypewriter(text: string, active: boolean) {
  const reduced = useReducedMotion();
  const words = text.split(/(\s+)/);
  const [count, setCount] = useState(active && !reduced ? 0 : words.length);
  useEffect(() => {
    if (!active || reduced) return;
    const timer = setInterval(() => setCount((n) => {
      if (n >= words.length) { clearInterval(timer); return n; }
      return n + 2;
    }), 28);
    return () => clearInterval(timer);
  }, [active, reduced, words.length]);
  return words.slice(0, count).join('');
}

/** The assistant's mark: the logo inside a gradient ring that turns slowly, faster with a pulse while it works. */
function Avatar({ size = 30, active = false }: { size?: number; active?: boolean }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    // Restart from the current angle so changing speed never makes the ring jump.
    cancelAnimation(turn);
    turn.value = turn.value % 1;
    turn.value = withRepeat(withTiming(turn.value + 1, { duration: active ? 1600 : 9000, easing: Easing.linear }), -1);
    return () => cancelAnimation(turn);
  }, [active, reduced, turn]);
  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));
  const r = size / 2; // a circle, so the turning ring never shows corners
  return (
    <View style={{ width: size, height: size }}>
      <Pulse active={active} color={c.primary} radius={r} />
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: r, overflow: 'hidden' }, ring]}>
        <LinearGradient colors={['#4F46E5', '#22D3EE', '#A855F7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Image source={finauraLogo} style={{ position: 'absolute', top: 2, left: 2, width: size - 4, height: size - 4, borderRadius: r - 2 }} />
    </View>
  );
}

type BubbleProps = { item: ChatMessage; fresh: boolean; failedText?: string; onRetry: (text: string) => void };

const Bubble = React.memo(function Bubble({ item, fresh, failedText, onRetry }: BubbleProps) {
  const { c } = useTheme();
  const s = useSStyles();
  const isUser = item.role === 'user';
  const timeStr = formatTime(item.timestamp);
  const shown = useTypewriter(item.content, !isUser && fresh);

  return (
    <Animated.View
      entering={isUser ? enterUser : enterBot}
      style={[s.bubbleRow, isUser ? s.bubbleRowUser : s.bubbleRowBot]}
    >
      {!isUser && <Avatar />}
      <View style={[s.bubbleContainer, isUser ? s.bubbleContainerUser : s.bubbleContainerBot]}>
        {isUser ? (
          <LinearGradient colors={c.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.bubble, s.bubbleUser]}>
            <Text style={s.bubbleUserTxt}>{item.content}</Text>
          </LinearGradient>
        ) : (
          <View style={[s.bubble, s.bubbleBot]}>
            <RichText text={shown} style={s.bubbleBotTxt} boldStyle={s.bold} bulletColor={c.primary} />
          </View>
        )}
        {item.actions?.map((a, i) => (
          <Animated.View key={i} entering={fresh ? popIn(200 + i * 90) : undefined} style={s.receipt}>
            <Ionicons name={a.ok ? 'checkmark-circle' : 'close-circle'} size={14} color={a.ok ? c.primary : c.textMuted} />
            <Text style={s.receiptTxt}>{a.label}</Text>
          </Animated.View>
        ))}
        {failedText ? (
          <Pressable onPress={() => onRetry(failedText)} style={s.retry} accessibilityRole="button" accessibilityLabel="Retry message">
            <Ionicons name="refresh" size={13} color={c.primary} />
            <Text style={s.retryTxt}>Try again</Text>
          </Pressable>
        ) : timeStr ? (
          <Text style={[s.timestampTxt, isUser ? s.timestampUser : s.timestampBot]}>
            {timeStr}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════
// CHAT SCREEN
// ═══════════════════════════════════════════════════════════
export function ChatScreen(): React.ReactElement {
  const { c, isDark } = useTheme();
  const s = useSStyles();
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const user = useStore((st) => st.user);
  const storeHistory = useStore((st) => st.chatHistory);
  const addChatMessage = useStore((st) => st.addChatMessage);
  const setChatHistory = useStore((st) => st.setChatHistory);
  const [input,           setInput]           = useState('');
  const [loading,         setLoading]         = useState(false);
  const [fetchingHistory, setFetchingHistory] = useState(false);
  const [showPrompts,     setShowPrompts]     = useState(false);
  // Replies that arrived in this session get the typewriter reveal; history renders instantly.
  const [freshId,         setFreshId]         = useState<string | null>(null);
  const [failed,          setFailed]          = useState<{ id: string; text: string } | null>(null);
  const [focused,         setFocused]         = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const userName = user?.name?.split(' ')[0] ?? 'there';

  // Sessions: opening the assistant starts a new chat; older ones stay saved and can be reopened from the header.
  const sessionRef = useRef(newSessionId());
  const [sessions,    setSessions]    = useState<ChatSession[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const startNewChat = useCallback(() => {
    sessionRef.current = newSessionId();
    setChatHistory([]);
    setShowPrompts(false);
    setFailed(null);
    setLoading(false);
  }, [setChatHistory]);
  useFocusEffect(startNewChat);

  const openHistory = () => {
    setHistoryOpen(true);
    getChatSessions().then(setSessions).catch(() => setSessions([]));
  };

  const openSession = async (id: string) => {
    setHistoryOpen(false);
    startNewChat();
    sessionRef.current = id;
    setFetchingHistory(true);
    try {
      const history = await getChatHistory(id);
      if (sessionRef.current === id) setChatHistory(history);
    } catch (err) {
      console.warn('Failed to load chat session:', err);
    } finally {
      setFetchingHistory(false);
    }
  };

  const INITIAL_MESSAGES: ChatMessage[] = [
    {
      id: 'bot-0',
      role: 'assistant',
      content: `Hi ${userName}! I'm FINAURA, your money copilot. Ask me about your balance, spending, **FMI score**, bills or FIRE. You can also tell me what you bought, by typing or with the mic, in English, Hindi or Hinglish, and I'll record it.`,
      timestamp: new Date().toISOString(),
    },
  ];

  const messages: ChatMessage[] =
    storeHistory.length > 0 ? storeHistory : INITIAL_MESSAGES;

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    addChatMessage(userMsg);
    setInput('');
    setShowPrompts(false);
    setFailed(null);
    setLoading(true);

    const session = sessionRef.current;
    try {
      const aiMsg = await sendMessageToAgent(trimmed, session);
      if (sessionRef.current !== session) return; // the user moved to another chat; the reply is saved with its own session
      setFreshId(aiMsg.id);
      addChatMessage(aiMsg);
    } catch {
      if (sessionRef.current !== session) return;
      const errorId = `e-${Date.now()}`;
      setFailed({ id: errorId, text: trimmed });
      addChatMessage({
        id: errorId,
        role: 'assistant',
        content: "I couldn't reach FINAURA's assistant right now. Please check your connection and try again.",
        timestamp: new Date().toISOString(),
      });
    } finally {
      if (sessionRef.current === session) setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [loading, addChatMessage]);

  // Speaking sends the message when the user stops talking, so adding a purchase is hands-free.
  const [langIndex, setLangIndex] = useState(0);
  const voiceLang = VOICE_LANGS[langIndex];
  const speech = useSpeechInput(voiceLang.code, setInput, sendMessage);

  const headerHeight = insets.top + 64;

  return (
    <View style={s.screen}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Message list */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Bubble item={item} fresh={item.id === freshId} failedText={failed?.id === item.id ? failed.text : undefined} onRetry={sendMessage} />
          )}
          contentContainerStyle={[s.list, { paddingTop: headerHeight + 12 }]}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListHeaderComponent={
            storeHistory.length === 0 ? (
              <Animated.View entering={FadeIn.duration(duration.slow)} style={s.emptyStateCard}>
                <View style={s.emptyIcon}>
                  <Avatar size={52} />
                </View>
                <Text style={s.emptyTitle}>Ask FINAURA about your finances</Text>
                <Text style={s.emptySub}>
                  Grounded in your verified operating balance, spending habits, FMI pillars, and FIRE milestones.
                </Text>
                <View style={s.starters}>
                  {QUICK_PROMPTS.map((p) => (
                    <Chip key={p} label={p} onPress={() => sendMessage(p)} style={s.pill} />
                  ))}
                </View>
              </Animated.View>
            ) : undefined
          }
          ListFooterComponent={
            loading ? (
              <Animated.View entering={enterBot} style={s.bubbleRow}>
                <Avatar active />
                <View style={[s.bubble, s.bubbleBot]}>
                  <View style={s.typingDots}>
                    {[0, 1, 2].map((i) => <TypingDot key={i} index={i} style={s.dot} />)}
                  </View>
                </View>
              </Animated.View>
            ) : undefined
          }
        />

        {/* Composer: sits above the floating tab bar, or right on the keyboard while typing */}
        <View style={[s.composer, { paddingBottom: keyboardOpen ? 10 : tabBarSpace - 6 }]}>
          {showPrompts && !loading ? (
            <Animated.View entering={FadeIn} exiting={FadeOut}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.promptScroll} keyboardShouldPersistTaps="handled">
                {QUICK_PROMPTS.map((p, i) => (
                  <Animated.View key={p} entering={enterUp(i, 55)}>
                    <Chip label={p} onPress={() => sendMessage(p)} style={s.pill} />
                  </Animated.View>
                ))}
              </ScrollView>
            </Animated.View>
          ) : null}

          {speech.error ? <Text style={s.voiceError} accessibilityRole="alert">{speech.error}</Text> : null}
          <View style={[s.inputBar, (focused || speech.listening) && s.inputBarOn, speech.listening && s.inputBarListening]}>
            <Pressable
              onPress={() => setShowPrompts((v) => !v)}
              style={s.ideaBtn}
              accessibilityRole="button"
              accessibilityLabel={showPrompts ? 'Hide suggested questions' : 'Show suggested questions'}
            >
              <Ionicons name={showPrompts ? 'close' : 'bulb-outline'} size={18} color={c.textMuted} />
            </Pressable>
            <TextInput
              style={s.input}
              value={input}
              onChangeText={setInput}
              placeholder={speech.listening ? 'Listening…' : 'Ask, or say what you spent…'}
              placeholderTextColor={c.textSubtle}
              keyboardAppearance={isDark ? 'dark' : 'light'}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              multiline
              accessibilityLabel="Message FINAURA"
            />
            {speech.supported && !input.trim() ? (
              <>
                <Pressable
                  onPress={() => setLangIndex((i) => (i + 1) % VOICE_LANGS.length)}
                  disabled={speech.listening}
                  style={s.ideaBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Voice language: ${voiceLang.name}. Tap to change`}
                >
                  <Text style={s.langTxt}>{voiceLang.label}</Text>
                </Pressable>
                <Pressable
                  onPress={speech.listening ? speech.stop : speech.start}
                  disabled={loading}
                  style={[s.ideaBtn, speech.listening && s.micOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: speech.listening }}
                  accessibilityLabel={speech.listening ? 'Stop listening' : 'Speak your message'}
                >
                  <Pulse active={speech.listening} color={c.danger} radius={19} />
                  <Ionicons name={speech.listening ? 'stop' : 'mic'} size={18} color={speech.listening ? c.onPrimary : c.textMuted} />
                </Pressable>
              </>
            ) : null}
            <PressableScale
              onPress={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              scaleTo={0.88}
              haptic={false}
              accessibilityRole="button"
              accessibilityLabel="Send"
            >
              <LinearGradient
                colors={c.accent}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnDisabled]}
              >
                <Ionicons name="arrow-up" size={18} color={c.onPrimary} />
              </LinearGradient>
            </PressableScale>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Header */}
      <View style={[s.header, { height: headerHeight, paddingTop: insets.top }]}>
        <BlurView intensity={70} tint={isDark ? 'dark' : 'light'} style={[StyleSheet.absoluteFill, s.headerGlass]} />
        <Avatar size={34} active={loading} />
        <View style={s.flex}>
          <Text style={s.headerTitle}>FINAURA AI</Text>
          <Text style={s.headerSub}>{fetchingHistory && storeHistory.length === 0 ? 'Loading your conversation…' : loading ? 'Thinking…' : 'Answers from your own numbers'}</Text>
        </View>
        <Pressable onPress={openHistory} style={s.ideaBtn} accessibilityRole="button" accessibilityLabel="Past chats">
          <Ionicons name="time-outline" size={18} color={c.textMuted} />
        </Pressable>
        <Pressable onPress={startNewChat} style={s.ideaBtn} accessibilityRole="button" accessibilityLabel="New chat">
          <Ionicons name="create-outline" size={18} color={c.textMuted} />
        </Pressable>
        <ThemeToggle />
      </View>

      <Sheet visible={historyOpen} onClose={() => setHistoryOpen(false)} title="Past chats">
        <ScrollView style={s.sessionList}>
          {sessions.length === 0 ? <Text style={s.sessionMeta}>No saved chats yet.</Text> : null}
          {sessions.map((x) => (
            <Pressable key={x.id} onPress={() => openSession(x.id)} style={s.sessionRow} accessibilityRole="button">
              <Text style={s.sessionTitle} numberOfLines={1}>{x.title}</Text>
              <Text style={s.sessionMeta}>{formatDay(new Date(x.updatedAt))} · {x.messages} messages</Text>
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────
const useSStyles = createStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },

  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  headerGlass: {
    backgroundColor: c.glass,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  headerTitle: { ...typeScale.headline, color: c.text },
  headerSub: { ...typeScale.caption, color: c.textMuted, marginTop: 1 },

  emptyStateCard: {
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: 22,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    ...shadow(c, 1),
  },
  emptyIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { ...typeScale.headline, color: c.text, textAlign: 'center' },
  emptySub: { ...typeScale.body, fontSize: 14, color: c.textMuted, textAlign: 'center', marginTop: 6 },

  starters: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 16 },
  sessionList: { maxHeight: 420 },
  sessionRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
  sessionTitle: { ...typeScale.body, fontSize: 15, fontWeight: '600', color: c.text },
  sessionMeta: { ...typeScale.caption, color: c.textMuted, marginTop: 2 },

  list:          { padding: 16, paddingBottom: 12, gap: 14 },
  bubbleRow:     { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubbleRowUser: { flexDirection: 'row-reverse' },
  bubbleRowBot:  {},

  bubbleContainer:     { maxWidth: '80%' },
  bubbleContainerUser: { alignItems: 'flex-end' },
  bubbleContainerBot:  { alignItems: 'flex-start' },

  bubble: {
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  bubbleUser:    { borderBottomRightRadius: 6 },
  bubbleBot:     { backgroundColor: c.surface, borderBottomLeftRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, ...shadow(c, 1) },
  bubbleUserTxt: { fontSize: 15, color: '#FFFFFF', lineHeight: 22 },
  bubbleBotTxt:  { fontSize: 15, color: c.text, lineHeight: 22 },
  bold:          { fontSize: 15, fontWeight: '700', color: c.text },

  timestampTxt:  { fontSize: 10, color: c.textSubtle, marginTop: 4, paddingHorizontal: 4 },
  timestampUser: { textAlign: 'right' },
  timestampBot:  { textAlign: 'left' },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, paddingHorizontal: 4 },
  retryTxt: { fontSize: 12, fontWeight: '700', color: c.primary },
  receipt: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: c.surfaceAlt },
  receiptTxt: { fontSize: 12, color: c.textMuted, flexShrink: 1 },
  langTxt: { fontSize: 13, fontWeight: '700', color: c.textMuted },
  micOn: { backgroundColor: c.danger },
  voiceError: { fontSize: 12, color: c.textMuted, paddingHorizontal: 20 },

  typingDots: { flexDirection: 'row', gap: 5, paddingVertical: 4 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: c.textSubtle },

  composer: {
    paddingTop: 8,
    gap: 10,
  },
  promptScroll:  { paddingHorizontal: 16, gap: 8 },
  pill: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginHorizontal: 16,
    padding: 6,
    borderRadius: 26,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    ...shadow(c, 2),
  },
  // Focus and listening light the field's edge, like the web composer's ring.
  inputBarOn: { borderColor: c.primary, boxShadow: `0px 6px 22px ${c.primary}55` },
  inputBarListening: { borderColor: c.danger, boxShadow: `0px 6px 22px ${c.danger}55` },
  ideaBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceAlt,
  },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 120,
    paddingTop: 9,
    paddingBottom: 9,
    fontSize: 15,
    color: c.text,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.35 },
}));
