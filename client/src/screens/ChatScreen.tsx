import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { sendMessageToAgent } from '../services/api';
import { useStore } from '../store/useStore';

export function ChatScreen(): JSX.Element {
  const { chatHistory, addChatMessage } = useStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  const handleSend = async () => {
    if (!canSend) {
      return;
    }

    const userMessage = {
      id: `u-${Date.now()}`,
      role: 'user' as const,
      content: input,
      timestamp: new Date().toISOString()
    };

    addChatMessage(userMessage);
    setInput('');
    setLoading(true);

    try {
      const aiMessage = await sendMessageToAgent(userMessage.content, {});
      addChatMessage(aiMessage);
    } catch (error) {
      addChatMessage({
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: 'Unable to fetch AI response right now.',
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={chatHistory}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
            <Text style={item.role === 'user' ? styles.userText : styles.aiText}>{item.content}</Text>
          </View>
        )}
      />

      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask about your money habits"
          style={styles.input}
        />
        <Pressable onPress={handleSend} disabled={!canSend} style={[styles.sendBtn, !canSend && styles.disabled]}>
          <Text style={styles.sendText}>{loading ? '...' : 'Send'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 12 },
  bubble: { borderRadius: 12, padding: 10, marginBottom: 8, maxWidth: '85%' },
  userBubble: { backgroundColor: '#0f766e', alignSelf: 'flex-end' },
  aiBubble: { backgroundColor: '#ffffff', alignSelf: 'flex-start' },
  userText: { color: '#ffffff' },
  aiText: { color: '#1e293b' },
  inputRow: { flexDirection: 'row', gap: 8, paddingTop: 8 },
  input: { flex: 1, backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 12 },
  sendBtn: {
    borderRadius: 12,
    backgroundColor: '#0284c7',
    justifyContent: 'center',
    paddingHorizontal: 16
  },
  disabled: { opacity: 0.5 },
  sendText: { color: '#ffffff', fontWeight: '700' }
});
