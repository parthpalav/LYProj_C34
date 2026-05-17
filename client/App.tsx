import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { WelcomeOverlay } from './src/components/WelcomeOverlay';
import { useStore } from './src/store/useStore';
import { useAuthStore } from './src/store/useAuthStore';
import { LoginScreen } from './src/screens/LoginScreen';

export default function App(): React.ReactElement {
  const [welcomeDone, setWelcomeDone] = React.useState(false);
  const token = useAuthStore((state) => state.token);
  const authUser = useAuthStore((state) => state.user);
  const setUser = useStore((state) => state.setUser);

  // Sync auth user to the main app store so all screens can access it
  React.useEffect(() => {
    if (authUser) {
      setUser({
        id: authUser.id,
        name: authUser.name,
        email: authUser.email,
        dateOfBirth: authUser.dateOfBirth,
        retirementAge: authUser.retirementAge,
        monthlyIncome: authUser.monthlyIncome,
        onboardingComplete: authUser.onboardingComplete,
        incomeType: authUser.incomeType,
        goals: authUser.goals,
        currentBalance: authUser.currentBalance,
      });
    } else {
      setUser(null);
    }
  }, [authUser, setUser]);

  // Not authenticated — show login
  if (!token) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <LoginScreen />
      </SafeAreaProvider>
    );
  }

  // Authenticated — show the app
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <AppNavigator />
        {!welcomeDone && <WelcomeOverlay onDismiss={() => setWelcomeDone(true)} />}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
