import type { ChatMessage } from '../types';

export const SESSION_LOAD_FAILED = "I couldn't load this conversation. Check your connection and open it again from History.";

/**
 * Messages to show after the user picks a saved chat: its history, [] when it has
 * none (the screen shows its welcome), or one assistant note when loading failed,
 * so a failed load is not mistaken for an empty chat.
 */
export async function loadSessionMessages(
  id: string,
  fetchHistory: (sessionId: string) => Promise<ChatMessage[]>,
): Promise<ChatMessage[]> {
  try {
    return (await fetchHistory(id)) ?? [];
  } catch (err) {
    console.warn('Failed to load chat session:', err);
    return [{ id: `e-load-${id}`, role: 'assistant', content: SESSION_LOAD_FAILED, timestamp: new Date().toISOString() }];
  }
}
