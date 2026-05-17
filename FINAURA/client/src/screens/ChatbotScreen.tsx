import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ScrollView } from 'react-native';
import { sendChatMessage } from '../services/api';
import { ChatBubble } from '../components/ChatBubble';

export function ChatbotScreen(): React.ReactElement {
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
    <View style={styles.container}>
      <ScrollView style={styles.chat} contentContainerStyle={{ paddingBottom: 12 }}>
        {messages.map((m, i) => (
          <ChatBubble key={i} message={m.text} isUser={m.isUser} />
        ))}
      </ScrollView>
      <View style={styles.inputRow}>
        <TextInput style={styles.input} placeholder="Ask about your finances..." value={input} onChangeText={setInput} />
        <TouchableOpacity style={styles.btn} onPress={send}>
          <Text style={styles.btnText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FA', padding: 16 },
  chat: { flex: 1 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, height: 44, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12 },
  btn: { backgroundColor: '#3B3BDE', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700' }
});
