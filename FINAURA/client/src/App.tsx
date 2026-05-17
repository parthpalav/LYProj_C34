import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './navigation/AppNavigator';
import { useAuthStore } from './store/useAuthStore';
import { LoginScreen } from './screens/LoginScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';

export default function App(): React.ReactElement {
  const { user, token, onboardingCompleted } = useAuthStore();

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        {!token ? (
          <LoginScreen />
        ) : !onboardingCompleted ? (
          <OnboardingScreen />
        ) : (
          <AppNavigator />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
