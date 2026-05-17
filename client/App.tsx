import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { WelcomeOverlay } from './src/components/WelcomeOverlay';
import { useStore } from './src/store/useStore';

const DEMO_USER = {
  id: 'u1',
  name: 'Parth Palav',
  email: 'parth@example.com',
  onboardingComplete: true,
  incomeType: 'salaried',
  goals: [],
  currentBalance: 0,
};

export default function App(): React.ReactElement {
  const [welcomeDone, setWelcomeDone] = React.useState(false);
  const user = useStore((state) => state.user);
  const setUser = useStore((state) => state.setUser);

  React.useEffect(() => {
    if (!user) {
      setUser(DEMO_USER);
    }
  }, [user, setUser]);

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
