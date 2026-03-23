import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { OnboardingNavigator } from './src/navigation/OnboardingNavigator';

export default function App(): React.ReactElement {
  const [onboardingDone, setOnboardingDone] = useState(false);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        {onboardingDone ? (
          <AppNavigator />
        ) : (
          <OnboardingNavigator onFinish={() => setOnboardingDone(true)} />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
