import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { getChatHistory, sendMessageToAgent } from '../services/api';
import { useStore } from '../store/useStore';
import { ChatMessage } from '../types';
import Animated, {
  Easing, FadeInLeft, FadeInRight, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming,
} from 'react-native-reanimated';
import { duration, easing } from '../motion';

import { createStyles, useTheme, Palette } from '../theme';
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

// ── Palette ────────────────────────────────────────────────
const tokens = (c: Palette) => ({ BLUE: c.primary, BLUE_LIGHT: c.primarySoft, TEXT_MAIN: c.text, TEXT_MUTED: c.textMuted, BORDER_CLR: c.surfaceAlt });

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

// ═══════════════════════════════════════════════════════════
// CHAT SCREEN
// ═══════════════════════════════════════════════════════════
export function ChatScreen(): React.ReactElement {
  const { c } = useTheme();
  const { BLUE } = tokens(c);
  const s = useSStyles();
  const { user, chatHistory: storeHistory, addChatMessage, setChatHistory } = useStore();
  const [input,           setInput]           = useState('');
  const [loading,         setLoading]         = useState(false);
  const [fetchingHistory, setFetchingHistory] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const userName = user?.name ?? 'Friend';

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
      content: `Hi ${userName}! 👋 I am FINAURA, your personal AI wealth confidant. Ask me anything about your balance, spending trends, FMI, active liabilities, or FIRE projections.`,
      timestamp: new Date().toISOString(),
    },
  ];

  const messages: ChatMessage[] =
    storeHistory.length > 0 ? storeHistory : INITIAL_MESSAGES;

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    addChatMessage(userMsg);
    setInput('');
    setLoading(true);

    try {
      const aiMsg = await sendMessageToAgent(trimmed, {});
      addChatMessage(aiMsg);
    } catch {
      addChatMessage({
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: "I couldn't reach FINAURA's assistant right now. Please check your connection and try again.",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [loading, addChatMessage]);

  const renderBubble = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    const timeStr = formatTime(item.timestamp);

    return (
      <Animated.View
        entering={isUser ? enterUser : enterBot}
        style={[s.bubbleRow, isUser ? s.bubbleRowUser : s.bubbleRowBot]}
      >
        {!isUser && (
          <View style={s.avatar}>
            <Text style={s.avatarTxt}>Bot</Text>
          </View>
        )}
        <View style={[s.bubbleContainer, isUser ? s.bubbleContainerUser : s.bubbleContainerBot]}>
          <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleBot]}>
            <Text style={isUser ? s.bubbleUserTxt : s.bubbleBotTxt}>{item.content}</Text>
          </View>
          {timeStr ? (
            <Text style={[s.timestampTxt, isUser ? s.timestampUser : s.timestampBot]}>
              {timeStr}
            </Text>
          ) : null}
        </View>
      </Animated.View>
    );
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        style={s.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
      >
        {/* Top Loading indicator when fetching history */}
        {fetchingHistory && storeHistory.length === 0 ? (
          <View style={s.historyLoading}>
            <ActivityIndicator size="small" color={BLUE} />
            <Text style={s.historyLoadingTxt}>Loading conversation history…</Text>
          </View>
        ) : null}

        {/* Message list */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderBubble}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListHeaderComponent={
            storeHistory.length === 0 ? (
              <View style={s.emptyStateCard}>
                <Text style={s.emptyTitle}>Ask FINAURA about your finances</Text>
                <Text style={s.emptySub}>
                  Grounded in your verified operating balance, spending habits, FMI pillars, and FIRE milestones.
                </Text>
              </View>
            ) : undefined
          }
          ListFooterComponent={
            loading ? (
              <View style={s.bubbleRow}>
                <View style={s.avatar}><Text style={s.avatarTxt}>Bot</Text></View>
                <View style={[s.bubble, s.bubbleBot]}>
                  <View style={s.typingDots}>
                    {[0, 1, 2].map((i) => <TypingDot key={i} index={i} style={s.dot} />)}
                  </View>
                </View>
              </View>
            ) : undefined
          }
        />

        {/* Quick Prompt Pills */}
        <View style={s.promptSection}>
          <Text style={s.promptLabel}>Suggested Questions</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.promptScroll}
          >
            {QUICK_PROMPTS.map((p) => (
              <TouchableOpacity
                key={p}
                style={s.pill}
                onPress={() => sendMessage(p)}
                activeOpacity={0.8}
                disabled={loading}
              >
                <Text style={s.pillTxt} numberOfLines={1}>{p}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Input bar */}
        <View style={s.inputBar}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about spending, FMI, FIRE, liabilities…"
            placeholderTextColor={c.textSubtle}
            multiline
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnDisabled]}
            onPress={() => sendMessage(input)}
            activeOpacity={0.85}
            disabled={!input.trim() || loading}
          >
            <Text style={s.sendIcon}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

// ── Styles ─────────────────────────────────────────────────
const useSStyles = createStyles((c) => {
  const { BLUE, BLUE_LIGHT, TEXT_MAIN, TEXT_MUTED, BORDER_CLR } = tokens(c);
  return {
  screen: { flex: 1, backgroundColor: c.bg },

  historyLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    backgroundColor: BLUE_LIGHT,
  },
  historyLoadingTxt: {
    fontSize: 12,
    color: BLUE,
    fontWeight: '600',
  },

  emptyStateCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER_CLR,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_MAIN,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    color: TEXT_MUTED,
    lineHeight: 18,
  },

  // Messages
  list:          { padding: 16, paddingBottom: 8, gap: 12 },
  bubbleRow:     { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubbleRowUser: { flexDirection: 'row-reverse' },
  bubbleRowBot:  {},
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { fontSize: 10, fontWeight: '800', color: '#fff' },

  bubbleContainer:     { maxWidth: '76%' },
  bubbleContainerUser: { alignItems: 'flex-end' },
  bubbleContainerBot:  { alignItems: 'flex-start' },

  bubble: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  bubbleUser:    { backgroundColor: BLUE, borderBottomRightRadius: 4 },
  bubbleBot:     { backgroundColor: c.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: BORDER_CLR },
  bubbleUserTxt: { fontSize: 15, color: '#fff', lineHeight: 22 },
  bubbleBotTxt:  { fontSize: 15, color: TEXT_MAIN, lineHeight: 22 },

  timestampTxt:  { fontSize: 10, color: c.textSubtle, marginTop: 4, paddingHorizontal: 4 },
  timestampUser: { textAlign: 'right' },
  timestampBot:  { textAlign: 'left' },

  // Typing indicator
  typingDots: { flexDirection: 'row', gap: 5, paddingVertical: 4 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#9CA3AF' },

  // Quick prompts
  promptSection: {
    backgroundColor: c.surface,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: BORDER_CLR,
  },
  promptLabel:   {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_MUTED,
    paddingHorizontal: 16,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  promptScroll:  { paddingHorizontal: 16, gap: 8 },
  pill: {
    height: 34, paddingHorizontal: 14, borderRadius: 99,
    borderWidth: 1, borderColor: c.border, backgroundColor: c.bg,
    justifyContent: 'center',
  },
  pillTxt: { fontSize: 13, color: c.textMuted, fontWeight: '500' },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    backgroundColor: c.surface, paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: BORDER_CLR,
  },
  input: {
    flex: 1, minHeight: 42, maxHeight: 100,
    backgroundColor: c.surfaceAlt, borderRadius: 21,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10,
    fontSize: 15, color: TEXT_MAIN,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center',
    shadowColor: BLUE, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  sendBtnDisabled: { backgroundColor: c.border, shadowOpacity: 0 },
  sendIcon: { fontSize: 18, color: '#fff', fontWeight: '800' },
};
});
