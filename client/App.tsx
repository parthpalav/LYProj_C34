import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { OnboardingNavigator } from './src/navigation/OnboardingNavigator';
import { AuthScreen } from './src/screens/AuthScreen';

export default function App(): React.ReactElement {
  const [authDone, setAuthDone] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        {!authDone ? (
          <AuthScreen onAuthSuccess={() => setAuthDone(true)} />
        ) : onboardingDone ? (
          <AppNavigator />
        ) : (
          <OnboardingNavigator onFinish={() => setOnboardingDone(true)} />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
