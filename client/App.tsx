import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { useStore } from './src/store/useStore';
import { useAuthStore } from './src/store/useAuthStore';
import { LoginScreen } from './src/screens/LoginScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { CelebrationHost } from './src/components/motion/CelebrationHost';
import { useFonts, Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, Inter_900Black } from '@expo-google-fonts/inter';
import { navigationTheme, useTheme } from './src/theme';
import { useThemeStore } from './src/store/useThemeStore';

export default function App(): React.ReactElement {
  const token = useAuthStore((state) => state.token);
  const authUser = useAuthStore((state) => state.user);
  const onboardingCompleted = useAuthStore((state) => state.onboardingCompleted);
  const showWelcome = useAuthStore((state) => state.showWelcome);
  const dismissWelcome = useAuthStore((state) => state.dismissWelcome);
  const initializing = useAuthStore((state) => state.initializing);
  const initAuth = useAuthStore((state) => state.initAuth);
  const setUser = useStore((state) => state.setUser);
  const themeHydrated = useThemeStore((state) => state.hydrated);
  const hydrateTheme = useThemeStore((state) => state.hydrate);
  const { c, isDark } = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, Inter_900Black,
  });
  const statusBarStyle = isDark ? 'light' : 'dark';

  // Initialize auth state from SecureStore on startup
  useEffect(() => {
    initAuth();
    hydrateTheme();
  }, [initAuth, hydrateTheme]);

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

  // A font load failure falls back to the system font rather than blocking the app.
  if (initializing || !themeHydrated || (!fontsLoaded && !fontError)) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  // Not authenticated — show login flow
  if (!token) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <LoginScreen />
      </SafeAreaProvider>
    );
  }

  // Authenticated but onboarding incomplete — show onboarding flow
  const isComplete = Boolean(onboardingCompleted || authUser?.onboardingComplete || authUser?.onboardingCompleted);
  if (!isComplete) {
    return (
      <SafeAreaProvider>
        <StatusBar style={statusBarStyle} />
        <OnboardingScreen />
      </SafeAreaProvider>
    );
  }

  // Explicit successful login transition for onboarded users
  if (showWelcome) {
    return (
      <SafeAreaProvider>
        <StatusBar style={statusBarStyle} />
        <WelcomeScreen onContinue={dismissWelcome} />
        <CelebrationHost />
      </SafeAreaProvider>
    );
  }

  // Authenticated & onboarded — show the full app
  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navigationTheme(c, isDark)}>
        <StatusBar style={statusBarStyle} />
        <AppNavigator />
      </NavigationContainer>
      <CelebrationHost />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
