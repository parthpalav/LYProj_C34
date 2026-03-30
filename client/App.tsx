import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { OnboardingNavigator } from './src/navigation/OnboardingNavigator';
import { AuthScreen } from './src/screens/AuthScreen';
import { WelcomeOverlay } from './src/components/WelcomeOverlay';

export default function App(): React.ReactElement {
  const [authDone, setAuthDone] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [welcomeDone, setWelcomeDone] = useState(false);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        {!authDone ? (
          <AuthScreen onAuthSuccess={() => setAuthDone(true)} />
        ) : !onboardingDone ? (
          <OnboardingNavigator onFinish={() => setOnboardingDone(true)} />
        ) : (
          <>
            <AppNavigator />
            {!welcomeDone && <WelcomeOverlay onDismiss={() => setWelcomeDone(true)} />}
          </>
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
