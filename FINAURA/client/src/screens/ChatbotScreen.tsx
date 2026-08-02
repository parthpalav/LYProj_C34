import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sendChatMessage } from '../services/api';
import { ChatBubble } from '../components/ChatBubble';

export function ChatbotScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Array<{ text: string; isUser: boolean }>>([]);
  const [input, setInput] = useState('');

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [...m, { text, isUser: true }]);
    setInput('');
    const res = await sendChatMessage(text);
    setMessages((m) => [...m, { text: res.response, isUser: false }]);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.chat} contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
          {messages.map((m, i) => (
            <ChatBubble key={i} message={m.text} isUser={m.isUser} />
          ))}
        </ScrollView>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ask about your finances or profile..."
            placeholderTextColor="#9CA3AF"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={send}
          />
          <TouchableOpacity style={styles.btn} onPress={send} activeOpacity={0.8}>
            <Text style={styles.btnText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },
  container: { flex: 1, padding: 16 },
  chat: { flex: 1 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 },
  input: { flex: 1, height: 48, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#D1D5DB', paddingHorizontal: 14, fontSize: 15, color: '#111827' },
  btn: { backgroundColor: '#2563EB', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 }
});
