import React, { useRef, useState, useEffect, useCallback } from 'react';
import { FlatList, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing, FadeIn, FadeInLeft, FadeInRight, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming,
} from 'react-native-reanimated';
import { getChatHistory, sendMessageToAgent } from '../services/api';
import { useStore } from '../store/useStore';
import { ChatMessage } from '../types';
import { duration, easing } from '../motion';
import { createStyles, radius, shadow, typeScale, useTheme } from '../theme';
import { useTabBarSpace } from '../components/navigation/TabBar';
import { Chip } from '../components/ui/Bits';

const finauraLogo = require('../assets/finaura_logo.png');

/** One dot of the "assistant is typing" indicator: a soft staggered opacity pulse. */
function TypingDot({ index, style }: { index: number; style: object }) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(0.35);
  useEffect(() => {
    if (reduced) return;
    opacity.value = withDelay(index * 200, withRepeat(withTiming(1, { duration: 600, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [index, reduced, opacity]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[style, animatedStyle]} />;
}

// Bubbles fade in with a 6pt slide from the sender's side.
const enterUser = FadeInRight.duration(duration.base).easing(easing.standard).withInitialValues({ opacity: 0, transform: [{ translateX: 6 }] });
const enterBot = FadeInLeft.duration(duration.base).easing(easing.standard).withInitialValues({ opacity: 0, transform: [{ translateX: -6 }] });

// ── Grounded Quick Prompts ─────────────────────────────────
const QUICK_PROMPTS = [
  'How is my spending this month?',
  'Why is my FMI changing?',
  'When could I reach FIRE?',
  'What liabilities are due soon?',
  'How much have I spent on Food & Dining?',
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

function Avatar() {
  const s = useSStyles();
  return (
    <View style={s.avatar}>
      <Image source={finauraLogo} style={s.avatarImg} />
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
  const [showPrompts,     setShowPrompts]     = useState(true);
  // Replies that arrived in this session get the typewriter reveal; history renders instantly.
  const [freshId,         setFreshId]         = useState<string | null>(null);
  const [failed,          setFailed]          = useState<{ id: string; text: string } | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const userName = user?.name?.split(' ')[0] ?? 'there';

  // Hydrate chat history from backend on mount
  useEffect(() => {
    let isMounted = true;
    async function loadHistory() {
      try {
        setFetchingHistory(true);
        const history = await getChatHistory();
        if (isMounted && Array.isArray(history) && history.length > 0) {
          const sorted = [...history].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          setChatHistory(sorted);
          setShowPrompts(false);
        }
      } catch (err) {
        console.warn('Failed to load chat history:', err);
      } finally {
        if (isMounted) {
          setFetchingHistory(false);
          setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 150);
        }
      }
    }
    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [setChatHistory]);

  const INITIAL_MESSAGES: ChatMessage[] = [
    {
      id: 'bot-0',
      role: 'assistant',
      content: `Hi ${userName}! I'm FINAURA, your money copilot. Ask me about your balance, spending, **FMI score**, bills, or when you could reach FIRE.`,
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

    try {
      const aiMsg = await sendMessageToAgent(trimmed, {});
      setFreshId(aiMsg.id);
      addChatMessage(aiMsg);
    } catch {
      const errorId = `e-${Date.now()}`;
      setFailed({ id: errorId, text: trimmed });
      addChatMessage({
        id: errorId,
        role: 'assistant',
        content: "I couldn't reach FINAURA's assistant right now. Please check your connection and try again.",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [loading, addChatMessage]);

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
                  <Ionicons name="sparkles" size={22} color={c.primary} />
                </View>
                <Text style={s.emptyTitle}>Ask FINAURA about your finances</Text>
                <Text style={s.emptySub}>
                  Grounded in your verified operating balance, spending habits, FMI pillars, and FIRE milestones.
                </Text>
              </Animated.View>
            ) : undefined
          }
          ListFooterComponent={
            loading ? (
              <View style={s.bubbleRow}>
                <Avatar />
                <View style={[s.bubble, s.bubbleBot]}>
                  <View style={s.typingDots}>
                    {[0, 1, 2].map((i) => <TypingDot key={i} index={i} style={s.dot} />)}
                  </View>
                </View>
              </View>
            ) : undefined
          }
        />

        {/* Composer: sits above the floating tab bar, or right on the keyboard while typing */}
        <View style={[s.composer, { paddingBottom: keyboardOpen ? 10 : tabBarSpace - 6 }]}>
          {showPrompts && !loading ? (
            <Animated.View entering={FadeIn} exiting={FadeOut}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.promptScroll} keyboardShouldPersistTaps="handled">
                {QUICK_PROMPTS.map((p) => (
                  <Chip key={p} label={p} onPress={() => sendMessage(p)} style={s.pill} />
                ))}
              </ScrollView>
            </Animated.View>
          ) : null}

          <View style={s.inputBar}>
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
              placeholder="Ask about spending, FMI, FIRE…"
              placeholderTextColor={c.textSubtle}
              keyboardAppearance={isDark ? 'dark' : 'light'}
              multiline
              accessibilityLabel="Message FINAURA"
            />
            <Pressable
              onPress={() => sendMessage(input)}
              disabled={!input.trim() || loading}
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
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Header */}
      <View style={[s.header, { height: headerHeight, paddingTop: insets.top }]}>
        <BlurView intensity={70} tint={isDark ? 'dark' : 'light'} style={[StyleSheet.absoluteFill, s.headerGlass]} />
        <Avatar />
        <View style={s.flex}>
          <Text style={s.headerTitle}>FINAURA AI</Text>
          <Text style={s.headerSub}>{fetchingHistory && storeHistory.length === 0 ? 'Loading your conversation…' : loading ? 'Thinking…' : 'Answers from your own numbers'}</Text>
        </View>
      </View>
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
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primarySoft,
    marginBottom: 12,
  },
  emptyTitle: { ...typeScale.headline, color: c.text, textAlign: 'center' },
  emptySub: { ...typeScale.body, fontSize: 14, color: c.textMuted, textAlign: 'center', marginTop: 6 },

  list:          { padding: 16, paddingBottom: 12, gap: 14 },
  bubbleRow:     { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubbleRowUser: { flexDirection: 'row-reverse' },
  bubbleRowBot:  {},
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  avatarImg: { width: '100%', height: '100%' },

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
