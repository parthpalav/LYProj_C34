import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { OnboardingNavigator } from './src/navigation/OnboardingNavigator';
import { AuthScreen } from './src/screens/AuthScreen';
import { WelcomeOverlay } from './src/components/WelcomeOverlay';
import { useStore } from './src/store/useStore';

export default function App(): React.ReactElement {
  const [welcomeDone, setWelcomeDone] = React.useState(false);
  const user = useStore((state) => state.user);

  // Check if user is authenticated
  const isAuthenticated = user !== null;

  // Check if onboarding is complete
  const isOnboardingComplete = user?.onboardingComplete ?? false;

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        {!isAuthenticated ? (
          <AuthScreen onAuthSuccess={() => {}} />
        ) : !isOnboardingComplete ? (
          <OnboardingNavigator onFinish={() => {}} />
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
