import { BottomTabBarButtonProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatScreen } from '../screens/ChatScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { TransactionsScreen } from '../screens/TransactionsScreen';
import { LiabilitiesScreen } from '../screens/LiabilitiesScreen';
import { FinancialOutlookScreen } from '../screens/FinancialOutlookScreen';
import { FmiScreen } from '../screens/FmiScreen';
import { IncomeFlowScreen } from '../screens/IncomeFlowScreen';
import AssetsScreen from '../screens/AssetsScreen';

export type RootTabParamList = {
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
  if (routeName === 'Transactions') return focused ? 'swap-horizontal' : 'swap-horizontal-outline';
  if (routeName === 'Dashboard') return focused ? 'home' : 'home-outline';
  if (routeName === 'Liabilities') return focused ? 'calendar' : 'calendar-outline';
  if (routeName === 'Chat') return focused ? 'sparkles' : 'sparkles-outline';
  return focused ? 'person-circle' : 'person-circle-outline';
}

function HomeTabButton({ onPress, accessibilityState }: BottomTabBarButtonProps): React.ReactElement {
  const isFocused = Boolean(accessibilityState?.selected);
  const tintColor = isFocused ? '#1e293b' : '#94a3b8';

  return (
    <Pressable
      onPress={onPress}
      style={styles.homeButtonWrap}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel="Home"
    >
      <View style={[styles.homeButton, isFocused ? styles.homeButtonActive : undefined]}>
        <Ionicons
          name={isFocused ? 'home' : 'home-outline'}
          size={22}
          color={tintColor}
        />
        <Text style={[styles.homeLabel, { color: tintColor }]}>Home</Text>
      </View>
    </Pressable>
  );
}

function MainTabNavigator(): React.ReactElement {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: '#f8f9fb' },
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: '#1e293b',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: styles.tabLabel,
        tabBarAllowFontScaling: false,
        tabBarItemStyle: styles.tabItem,
        tabBarStyle: [styles.tabBar, { height: 60 + insets.bottom, paddingBottom: Math.max(6, insets.bottom) }],
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ focused, color, size }) => (
          <View style={styles.tabIconWrap}>
            <Ionicons
              name={tabIconName(route.name as keyof RootTabParamList, focused)}
              size={route.name === 'Dashboard' ? size + 2 : 22}
              color={color}
            />
            {focused && route.name !== 'Dashboard' && <View style={styles.activeIndicator} />}
          </View>
        ),
      })}
    >
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="Liabilities" component={LiabilitiesScreen} />
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Home',
          tabBarButton: (props) => <HomeTabButton {...props} />,
          tabBarItemStyle: styles.homeItem,
        }}
      />
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
    paddingTop: 6,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 4,
  },
  tabItem: {
    paddingHorizontal: 4,
    minWidth: 0,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.1,
  },
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2563EB',
  },
  homeItem: {
    marginTop: -14,
  },
  homeButtonWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  homeButton: {
    minWidth: 64,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#eef2ff',
    borderWidth: 2,
    borderColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: '#1e293b',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeButtonActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#ffffff',
    shadowOpacity: 0.16,
    elevation: 6,
  },
  homeLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.1,
  },
});
