import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function ChatBubble({ message, isUser }: { message: string; isUser: boolean }): React.ReactElement {
  return (
    <View style={[styles.bubble, isUser ? styles.user : styles.bot]}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { padding: 10, borderRadius: 12, marginBottom: 8, maxWidth: '80%' },
  user: { backgroundColor: '#DBEAFE', alignSelf: 'flex-end' },
  bot: { backgroundColor: '#F3F4F6', alignSelf: 'flex-start' },
  text: { color: '#111827', fontSize: 13 }
});
