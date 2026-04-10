import React, { useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { sendMessageToAgent } from '../services/api';
import { useStore } from '../store/useStore';

// ── Palette ────────────────────────────────────────────────
const BLUE  = '#3B3BDE';
const GREEN = '#22C880';
const RED   = '#EF4444';

// ── Quick prompt suggestions ───────────────────────────────
const QUICK_PROMPTS = [
  'How much should I save?',
  'Am I overspending on food?',
  'Family event budget tips',
  'Should I invest more?',
];

// ── Tiny sparkline (pure View) ─────────────────────────────
const SPARK = [20, 35, 28, 45, 40, 55, 50, 68, 62, 75];
function MiniSparkline() {
  const W = 220; const H = 52;
  const max = Math.max(...SPARK);
  const stepX = W / (SPARK.length - 1);
  return (
    <View style={{ width: W, height: H, position: 'relative', backgroundColor: '#EEF2FF', borderRadius: 10 }}>
      {SPARK.map((v, i) => {
        if (i === 0) return null;
        const x1 = (i - 1) * stepX; const y1 = H - (SPARK[i - 1] / max) * (H - 8) - 4;
        const x2 = i * stepX;       const y2 = H - (v / max) * (H - 8) - 4;
        const dx = x2 - x1; const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        return (
          <View key={i} style={{
            position: 'absolute', width: len, height: 2.5,
            backgroundColor: BLUE, borderRadius: 2,
            left: x1, top: y1,
            transform: [{ rotate: `${angle}deg` }],
          }} />
        );
      })}
      {/* dashed forecast */}
      {[0, 1, 2].map((i) => (
        <View key={`d${i}`} style={{
          position: 'absolute', width: 16, height: 1.5,
          backgroundColor: BLUE, opacity: 0.4, borderRadius: 1,
          left: W - 58 + i * 20, top: 10,
        }} />
      ))}
    </View>
  );
}

// ── Mini bar chart for Goal Cap ────────────────────────────
const GOAL_BARS   = [30, 45, 35, 55, 80, 65, 40];
const GOAL_ACTIVE = [false, false, false, false, true, true, false];
function GoalCapChart() {
  const MAX = 90; const H = 60;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: H }}>
      {GOAL_BARS.map((v, i) => (
        <View key={i} style={{
          flex: 1, height: (v / MAX) * H,
          backgroundColor: GOAL_ACTIVE[i] ? (i === 4 ? GREEN : BLUE) : '#D1D5DB',
          borderRadius: 4,
        }} />
      ))}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════
// AI REASONING DATA PANEL
// ═══════════════════════════════════════════════════════════
function AiReasoningPanel({ onClose }: { onClose: () => void }) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={ar.overlay}>
        <TouchableOpacity style={ar.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={ar.sheet}>
          {/* Handle */}
          <View style={ar.handle} />
          {/* Header */}
          <View style={ar.header}>
            <Text style={ar.title}>AI Reasoning Data</Text>
            <TouchableOpacity style={ar.closeBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={ar.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Forecast */}
            <View style={ar.section}>
              <View style={ar.sectionRow}>
                <Text style={ar.sectionTitle}>Forecast</Text>
                <Text style={ar.sectionLink}>Mini Sparkline</Text>
              </View>
              <MiniSparkline />
            </View>

            <View style={ar.divider} />

            {/* Goal Cap */}
            <View style={ar.section}>
              <View style={ar.sectionRow}>
                <Text style={ar.sectionTitle}>Goal Cap</Text>
                <Text style={ar.sectionLink}>Chart</Text>
              </View>
              <GoalCapChart />
            </View>

            <View style={ar.divider} />

            {/* Suggested Saving Change */}
            <View style={ar.section}>
              <Text style={ar.sectionTitle}>Suggested Saving Change</Text>
              <Text style={ar.bigGreen}>+$50/mo</Text>
              <Text style={ar.subNote}>Increasing your monthly saving by $50 keeps you on track.</Text>
            </View>

            <View style={ar.divider} />

            {/* Category Causing Overspend */}
            <View style={ar.section}>
              <Text style={ar.sectionTitle}>Category Causing Overspend</Text>
              <View style={ar.anomalyBox}>
                <Text style={ar.anomalyTitle}>⚠️  Anomaly Flag</Text>
                <TouchableOpacity style={ar.anomalyRow} activeOpacity={0.8}>
                  <Text style={ar.anomalyIcon}>🔺</Text>
                  <Text style={ar.anomalyText}>Subscriptions</Text>
                  <Text style={ar.anomalyBadge}>12% {'>'} Avg</Text>
                  <Text style={ar.anomalyChevron}>›</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const ar = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  handle:   { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 99, alignSelf: 'center', marginBottom: 16 },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 44, maxHeight: '82%',
  },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title:       { fontSize: 18, fontWeight: '800', color: '#111827' },
  closeBtn:    { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  closeTxt:    { fontSize: 13, color: '#6B7280', fontWeight: '700' },
  section:     { paddingVertical: 16 },
  sectionRow:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  sectionLink:  { fontSize: 13, color: BLUE, fontWeight: '600' },
  divider:      { height: 1, backgroundColor: '#F0F1F5' },
  bigGreen:     { fontSize: 34, fontWeight: '800', color: GREEN, marginTop: 4 },
  subNote:      { fontSize: 12, color: '#6B7280', marginTop: 4, lineHeight: 18 },
  anomalyBox:   { backgroundColor: '#FEF2F2', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#FECACA' },
  anomalyTitle: { fontSize: 13, fontWeight: '700', color: RED, marginBottom: 10 },
  anomalyRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  anomalyIcon:  { fontSize: 14 },
  anomalyText:  { fontSize: 14, fontWeight: '600', color: '#374151', flex: 1 },
  anomalyBadge: { fontSize: 13, fontWeight: '700', color: RED },
  anomalyChevron: { fontSize: 20, color: '#9CA3AF' },
});

// ═══════════════════════════════════════════════════════════
// CHAT MESSAGE TYPE
// ═══════════════════════════════════════════════════════════
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// ═══════════════════════════════════════════════════════════
// CHAT SCREEN
// ═══════════════════════════════════════════════════════════
export function ChatScreen(): React.ReactElement {
  const { user, chatHistory: storeHistory, addChatMessage } = useStore();
  const [input,         setInput]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const listRef = useRef<FlatList>(null);

  const userName = user?.name ?? 'Friend';
  const INITIAL_MESSAGES: ChatMessage[] = [
    {
      id: 'bot-0',
      role: 'assistant',
      content: `Hi ${userName}! 👋 How can I help with your finances today?`,
      timestamp: new Date().toISOString(),
    },
  ];

  const messages: ChatMessage[] =
    (storeHistory as ChatMessage[]).length > 0
      ? [...INITIAL_MESSAGES, ...(storeHistory as ChatMessage[])]
      : INITIAL_MESSAGES;

  const sendMessage = async (text: string) => {
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

    // Show AI reasoning panel after brief delay
    setTimeout(() => setShowReasoning(true), 600);

    try {
      const aiMsg = await sendMessageToAgent(trimmed, {});
      addChatMessage(aiMsg);
    } catch {
      addChatMessage({
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: "Sorry, I couldn't reach the server right now. Please try again.",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const renderBubble = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[s.bubbleRow, isUser ? s.bubbleRowUser : s.bubbleRowBot]}>
        {!isUser && (
          <View style={s.avatar}>
            <Text style={s.avatarTxt}>Bot</Text>
          </View>
        )}
        <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleBot]}>
          <Text style={isUser ? s.bubbleUserTxt : s.bubbleBotTxt}>{item.content}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Message list */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderBubble}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={
          loading ? (
            <View style={s.bubbleRow}>
              <View style={s.avatar}><Text style={s.avatarTxt}>Bot</Text></View>
              <View style={[s.bubble, s.bubbleBot]}>
                <View style={s.typingDots}>
                  {[0, 1, 2].map((i) => <View key={i} style={s.dot} />)}
                </View>
              </View>
            </View>
          ) : null
        }
      />

      {/* Quick Prompt Pills */}
      <View style={s.promptSection}>
        <Text style={s.promptLabel}>Quick Prompt Pills</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.promptScroll}>
          {QUICK_PROMPTS.map((p) => (
            <TouchableOpacity key={p} style={s.pill} onPress={() => sendMessage(p)} activeOpacity={0.8}>
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
          placeholder="Type a prompt here…"
          placeholderTextColor="#9CA3AF"
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

      {/* AI Reasoning Panel */}
      {showReasoning && <AiReasoningPanel onClose={() => setShowReasoning(false)} />}
    </KeyboardAvoidingView>
  );
}

// ── Styles ─────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },

  // Messages
  list:          { padding: 16, paddingBottom: 8, gap: 10 },
  bubbleRow:     { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubbleRowUser: { flexDirection: 'row-reverse' },
  bubbleRowBot:  {},
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { fontSize: 10, fontWeight: '800', color: '#fff' },
  bubble: {
    maxWidth: '72%', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  bubbleUser:    { backgroundColor: BLUE, borderBottomRightRadius: 4 },
  bubbleBot:     { backgroundColor: '#fff', borderBottomLeftRadius: 4 },
  bubbleUserTxt: { fontSize: 15, color: '#fff', lineHeight: 22 },
  bubbleBotTxt:  { fontSize: 15, color: '#111827', lineHeight: 22 },

  // Typing indicator
  typingDots: { flexDirection: 'row', gap: 5, paddingVertical: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D1D5DB' },

  // Quick prompts
  promptSection: { backgroundColor: '#fff', paddingTop: 12, paddingBottom: 8, borderTopWidth: 1, borderTopColor: '#E8ECF2' },
  promptLabel:   { fontSize: 13, fontWeight: '700', color: '#374151', paddingHorizontal: 16, marginBottom: 8 },
  promptScroll:  { paddingHorizontal: 16, gap: 8 },
  pill: {
    height: 36, paddingHorizontal: 14, borderRadius: 99,
    borderWidth: 1.5, borderColor: '#D1D5DB', backgroundColor: '#F9FAFB',
    justifyContent: 'center', maxWidth: 210,
  },
  pillTxt: { fontSize: 13, color: '#374151', fontWeight: '500' },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    backgroundColor: '#fff', padding: 12,
    borderTopWidth: 1, borderTopColor: '#E8ECF2',
  },
  input: {
    flex: 1, minHeight: 44, maxHeight: 100,
    backgroundColor: '#F3F4F6', borderRadius: 22,
    paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11,
    fontSize: 15, color: '#111827',
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center',
    shadowColor: BLUE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  sendBtnDisabled: { backgroundColor: '#D1D5DB', shadowOpacity: 0 },
  sendIcon: { fontSize: 18, color: '#fff', fontWeight: '800' },
});
