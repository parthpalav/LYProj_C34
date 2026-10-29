import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useStore } from './src/store/useStore';
import { useAuthStore } from './src/store/useAuthStore';
import { CelebrationHost } from './src/components/motion/CelebrationHost';
import { useFonts, Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, Inter_900Black } from '@expo-google-fonts/inter';
import { navigationTheme, useTheme } from './src/theme';
import { useThemeStore } from './src/store/useThemeStore';

// Keep the native splash up until auth, theme and fonts are ready, then fade it out.
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 400, fade: true });

export default function App(): React.ReactElement | null {
  const token = useAuthStore((state) => state.token);
  const authUser = useAuthStore((state) => state.user);
  const initializing = useAuthStore((state) => state.initializing);
  const initAuth = useAuthStore((state) => state.initAuth);
  const setUser = useStore((state) => state.setUser);
  const themeHydrated = useThemeStore((state) => state.hydrated);
  const hydrateTheme = useThemeStore((state) => state.hydrate);
  const { c, isDark } = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, Inter_900Black,
  });
  // A font load failure falls back to the system font rather than blocking the app.
  const ready = !initializing && themeHydrated && (fontsLoaded || !!fontError);

  // Initialize auth state from SecureStore on startup
  useEffect(() => {
    initAuth();
    hydrateTheme();
  }, [initAuth, hydrateTheme]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Sync auth user to the main app store so all screens can access it
  useEffect(() => {
    if (authUser) {
      setUser({
        id: authUser.id,
        name: authUser.name,
        email: authUser.email,
        dateOfBirth: authUser.dateOfBirth,
        retirementAge: authUser.retirementAge,
        monthlyIncome: authUser.monthlyIncome,
        onboardingComplete: Boolean(authUser.onboardingComplete || authUser.onboardingCompleted),
        incomeType: authUser.incomeType,
        goals: authUser.goals,
        currentBalance: authUser.currentBalance,
      });
    } else {
      setUser(null);
    }
  }, [authUser, setUser]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor: c.bg }]}>
      <SafeAreaProvider>
        <NavigationContainer theme={navigationTheme(c, isDark)}>
          {/* The signed-out screens sit on the dark aurora, so they always want light status text. */}
          <StatusBar style={!token || isDark ? 'light' : 'dark'} />
          <AppNavigator />
        </NavigationContainer>
        <CelebrationHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
