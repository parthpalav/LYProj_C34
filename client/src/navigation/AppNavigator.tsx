import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { ChatScreen } from '../screens/ChatScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { TransactionsScreen } from '../screens/TransactionsScreen';
import { TransactionEntryScreen } from '../screens/TransactionEntryScreen';
import { LiabilitiesScreen } from '../screens/LiabilitiesScreen';
import { FinancialOutlookScreen } from '../screens/FinancialOutlookScreen';
import { FmiScreen } from '../screens/FmiScreen';
import { IncomeFlowScreen } from '../screens/IncomeFlowScreen';
import AssetsScreen from '../screens/AssetsScreen';
import FamilyScreen from '../screens/FamilyScreen';
import { GoalPlannerScreen } from '../screens/GoalPlannerScreen';
import { PlanScreen } from '../screens/PlanScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { TabBar } from '../components/navigation/TabBar';
import { withFocusFade } from '../components/navigation/FocusFade';
import { useAuthStore } from '../store/useAuthStore';
import { createStyles, useTheme } from '../theme';

export type RootTabParamList = {
  Dashboard: undefined;
  Transactions: undefined;
  Plan: undefined;
  Chat: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Onboarding: undefined;
  Welcome: undefined;
  MainTabs: undefined;
  QuickAdd: undefined;
  FinancialOutlook: undefined;
  FMI: undefined;
  IncomeFlow: undefined;
  Assets: undefined;
  Family: undefined;
  Goals: undefined;
  Liabilities: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

// Wrapped once at module level so each tab keeps a stable component identity.
const HomeTab = withFocusFade(DashboardScreen);
const ActivityTab = withFocusFade(TransactionsScreen);
const PlanTab = withFocusFade(PlanScreen);
const ChatTab = withFocusFade(ChatScreen);

function MainTabNavigator(): React.ReactElement {
  const styles = useStyles();
  const { c } = useTheme();
  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: c.bg },
        headerTitleStyle: styles.headerTitle,
        headerShadowVisible: false,
      }}
    >
      <Tab.Screen name="Dashboard" component={HomeTab} options={{ title: 'Home', headerShown: false }} />
      <Tab.Screen name="Transactions" component={ActivityTab} options={{ title: 'Activity', headerShown: false }} />
      <Tab.Screen name="Plan" component={PlanTab} options={{ headerShown: false }} />
      <Tab.Screen name="Chat" component={ChatTab} options={{ title: 'AI', headerShown: false }} />
    </Tab.Navigator>
  );
}

function QuickAddRoute(): React.ReactElement {
  const navigation = useNavigation();
  return <TransactionEntryScreen onClose={() => navigation.goBack()} />;
}

function WelcomeRoute(): React.ReactElement {
  const dismissWelcome = useAuthStore((s) => s.dismissWelcome);
  return <WelcomeScreen onContinue={dismissWelcome} />;
}

/**
 * One stack for the whole app. Auth, onboarding and welcome are conditional screens (the React
 * Navigation auth-flow pattern), so moving between them cross-fades instead of hard-swapping trees.
 */
export function AppNavigator(): React.ReactElement {
  const styles = useStyles();
  const { c } = useTheme();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const onboardingCompleted = useAuthStore((s) => s.onboardingCompleted);
  const showWelcome = useAuthStore((s) => s.showWelcome);
  const onboarded = Boolean(onboardingCompleted || user?.onboardingComplete || user?.onboardingCompleted);

  const nativeHeader: NativeStackNavigationOptions = {
    headerShown: true,
    headerStyle: { backgroundColor: c.bg },
    headerTitleStyle: styles.headerTitle,
    headerTintColor: c.text,
    headerShadowVisible: false,
    headerBackTitleVisible: false,
  };

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'default', animationTypeForReplace: 'push' }}>
      {!token ? (
        <Stack.Screen name="Auth" component={LoginScreen} options={{ animation: 'fade' }} />
      ) : !onboarded ? (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: 'fade' }} />
      ) : (
        <>
          {showWelcome && <Stack.Screen name="Welcome" component={WelcomeRoute} options={{ animation: 'fade' }} />}
          <Stack.Screen name="MainTabs" component={MainTabNavigator} options={{ animation: 'fade' }} />
          <Stack.Screen name="FinancialOutlook" component={FinancialOutlookScreen} />
          <Stack.Screen name="FMI" component={FmiScreen} />
          <Stack.Screen name="IncomeFlow" component={IncomeFlowScreen} />
          <Stack.Screen name="Assets" component={AssetsScreen} />
          <Stack.Screen name="Family" component={FamilyScreen} />
          <Stack.Screen name="Goals" component={GoalPlannerScreen} />
          <Stack.Screen name="Liabilities" component={LiabilitiesScreen} options={{ ...nativeHeader, title: 'Bills' }} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen
            name="QuickAdd"
            component={QuickAddRoute}
            options={{ presentation: 'formSheet', sheetAllowedDetents: 'large', sheetGrabberVisible: true, sheetCornerRadius: 28 }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

const useStyles = createStyles((c) => ({
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: c.text,
  },
}));
