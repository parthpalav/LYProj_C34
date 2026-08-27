import { BottomTabBarButtonProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatScreen } from '../screens/ChatScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { EnvelopesScreen } from '../screens/EnvelopesScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { TransactionsScreen } from '../screens/TransactionsScreen';
import { LiabilitiesScreen } from '../screens/LiabilitiesScreen';
import { FinancialOutlookScreen } from '../screens/FinancialOutlookScreen';
import { FmiScreen } from '../screens/FmiScreen';
import { IncomeFlowScreen } from '../screens/IncomeFlowScreen';
import AssetsScreen from '../screens/AssetsScreen';

export type RootTabParamList = {
  Envelopes: undefined;
  Transactions: undefined;
  Dashboard: undefined;
  Chat: undefined;
  Profile: undefined;
  Liabilities: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  FinancialOutlook: undefined;
  FMI: undefined;
  IncomeFlow: undefined;
  Assets: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function tabIconName(routeName: keyof RootTabParamList, focused: boolean): React.ComponentProps<typeof Ionicons>['name'] {
  if (routeName === 'Envelopes') return focused ? 'wallet' : 'wallet-outline';
  if (routeName === 'Transactions') return focused ? 'swap-horizontal' : 'swap-horizontal-outline';
  if (routeName === 'Dashboard') return focused ? 'home' : 'home-outline';
  if (routeName === 'Liabilities') return focused ? 'calendar' : 'calendar-outline';
  if (routeName === 'Chat') return focused ? 'sparkles' : 'sparkles-outline';
  return focused ? 'person-circle' : 'person-circle-outline';
}

function HomeTabButton({ children, onPress, accessibilityState }: BottomTabBarButtonProps): React.ReactElement {
  const isFocused = accessibilityState?.selected;
  return (
    <Pressable onPress={onPress} style={styles.homeButtonWrap}>
      <View style={[styles.homeButton, isFocused ? styles.homeButtonActive : undefined]}>{children}</View>
    </Pressable>
  );
}

function MainTabNavigator(): React.ReactElement {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: '#f8f9fb' },
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: '#1f2937',
        tabBarInactiveTintColor: '#7c8594',
        tabBarLabelStyle: styles.tabLabel,
        tabBarAllowFontScaling: false,
        tabBarItemStyle: styles.tabItem,
        tabBarStyle: [styles.tabBar, { height: 62 + insets.bottom, paddingBottom: Math.max(8, insets.bottom) }],
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons
            name={tabIconName(route.name as keyof RootTabParamList, focused)}
            size={route.name === 'Dashboard' ? size + 2 : size}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen name="Envelopes" component={EnvelopesScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Home',
          tabBarButton: (props) => <HomeTabButton {...props} />,
          tabBarItemStyle: styles.homeItem,
        }}
      />
      <Tab.Screen name="Liabilities" component={LiabilitiesScreen} />
      <Tab.Screen name="Chat" component={ChatScreen} options={{ title: 'AI' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function AppNavigator(): React.ReactElement {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen
        name="FinancialOutlook"
        component={FinancialOutlookScreen}
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="FMI"
        component={FmiScreen}
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="IncomeFlow"
        component={IncomeFlowScreen}
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="Assets"
        component={AssetsScreen}
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
    </Stack.Navigator>
  );
}


const styles = StyleSheet.create({
  tabBar: {
    paddingTop: 8,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e6e9f0',
  },
  tabItem: {
    paddingHorizontal: 2,
    minWidth: 0,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  homeItem: {
    marginTop: -18,
  },
  homeButtonWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  homeButton: {
    minWidth: 72,
    minHeight: 72,
    borderRadius: 36,
    backgroundColor: '#e8eeff',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeButtonActive: {
    backgroundColor: '#d7e3ff',
  },
});
