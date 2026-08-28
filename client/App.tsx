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

export default function App(): React.ReactElement {
  const token = useAuthStore((state) => state.token);
  const authUser = useAuthStore((state) => state.user);
  const onboardingCompleted = useAuthStore((state) => state.onboardingCompleted);
  const showWelcome = useAuthStore((state) => state.showWelcome);
  const dismissWelcome = useAuthStore((state) => state.dismissWelcome);
  const initializing = useAuthStore((state) => state.initializing);
  const initAuth = useAuthStore((state) => state.initAuth);
  const setUser = useStore((state) => state.setUser);

  // Initialize auth state from SecureStore on startup
  useEffect(() => {
    initAuth();
  }, [initAuth]);

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

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B3BDE" />
      </View>
    );
  }

  // Not authenticated — show login flow
  if (!token) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <LoginScreen />
      </SafeAreaProvider>
    );
  }

  // Authenticated but onboarding incomplete — show onboarding flow
  const isComplete = Boolean(onboardingCompleted || authUser?.onboardingComplete || authUser?.onboardingCompleted);
  if (!isComplete) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <OnboardingScreen />
      </SafeAreaProvider>
    );
  }

  // Explicit successful login transition for onboarded users
  if (showWelcome) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <WelcomeScreen onContinue={dismissWelcome} />
      </SafeAreaProvider>
    );
  }

  // Authenticated & onboarded — show the full app
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F4F6FA',
    justifyContent: 'center',
    alignItems: 'center',
  }
});
