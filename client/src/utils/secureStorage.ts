import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'finaura_access_token';
const REFRESH_TOKEN_KEY = 'finaura_refresh_token';

// In-memory web fallback
const memoryStorage: Record<string, string> = {};

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    memoryStorage[key] = value;
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    memoryStorage[key] = value;
  }
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return memoryStorage[key] || null;
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return memoryStorage[key] || null;
  }
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    delete memoryStorage[key];
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    delete memoryStorage[key];
  }
}

export const secureStorage = {
  saveTokens: async (accessToken: string, refreshToken: string) => {
    await setItem(ACCESS_TOKEN_KEY, accessToken);
    await setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  getAccessToken: async (): Promise<string | null> => {
    return getItem(ACCESS_TOKEN_KEY);
  },
  getRefreshToken: async (): Promise<string | null> => {
    return getItem(REFRESH_TOKEN_KEY);
  },
  clearTokens: async () => {
    await deleteItem(ACCESS_TOKEN_KEY);
    await deleteItem(REFRESH_TOKEN_KEY);
  }
};
