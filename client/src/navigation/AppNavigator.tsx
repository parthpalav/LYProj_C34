import { BottomTabBarButtonProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
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
import FamilyScreen from '../screens/FamilyScreen';
import { GoalPlannerScreen } from '../screens/GoalPlannerScreen';
import { PressableScale } from '../components/motion/PressableScale';
import { createStyles, useTheme } from '../theme';
import { duration, fadeIn, exitFade, timing } from '../motion';

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
  Family: undefined;
  Goals: undefined;
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

/** Tab icon: the active one settles to full opacity; the indicator dot fades in under it. */
function TabIcon({ name, focused, color, size, showDot }: {
  name: React.ComponentProps<typeof Ionicons>['name']; focused: boolean; color: string; size: number; showDot: boolean;
}): React.ReactElement {
  const styles = useStyles();
  const opacity = useSharedValue(focused ? 1 : 0.85);
  useEffect(() => {
    opacity.value = withTiming(focused ? 1 : 0.85, timing(duration.fast));
  }, [focused, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <View style={styles.tabIconWrap}>
      <Animated.View style={style}>
        <Ionicons name={name} size={size} color={color} />
      </Animated.View>
      {focused && showDot && <Animated.View entering={fadeIn()} exiting={exitFade} style={styles.activeIndicator} />}
    </View>
  );
}

function HomeTabButton({ onPress, accessibilityState }: BottomTabBarButtonProps): React.ReactElement {
  const styles = useStyles();
  const { c } = useTheme();
  const isFocused = Boolean(accessibilityState?.selected);
  const tintColor = isFocused ? c.primary : c.textSubtle;

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.96}
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
    </PressableScale>
  );
}

function MainTabNavigator(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { c } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: c.bg },
        headerTitleStyle: styles.headerTitle,
        headerShadowVisible: false,
        tabBarActiveTintColor: c.text,
        tabBarInactiveTintColor: c.textSubtle,
        tabBarLabelStyle: styles.tabLabel,
        tabBarAllowFontScaling: false,
        tabBarItemStyle: styles.tabItem,
        tabBarStyle: [styles.tabBar, { height: 60 + insets.bottom, paddingBottom: Math.max(6, insets.bottom) }],
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ focused, color, size }) => (
          <TabIcon
            name={tabIconName(route.name as keyof RootTabParamList, focused)}
            size={route.name === 'Dashboard' ? size + 2 : 22}
            color={color}
            focused={focused}
            showDot={route.name !== 'Dashboard'}
          />
        ),
      })}
    >
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="Liabilities" component={LiabilitiesScreen} options={{ headerShown: false }} />
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Home',
          headerShown: false,
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
      <Stack.Screen
        name="Family"
        component={FamilyScreen}
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="Goals"
        component={GoalPlannerScreen}
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
    </Stack.Navigator>
  );
}


const useStyles = createStyles((c) => ({
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: c.text,
  },
  tabBar: {
    paddingTop: 6,
    backgroundColor: c.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    shadowColor: c.shadow,
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
    backgroundColor: c.primary,
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
    backgroundColor: c.surfaceAlt,
    borderWidth: 2,
    borderColor: c.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeButtonActive: {
    backgroundColor: c.primarySoft,
    borderColor: c.surface,
    shadowOpacity: 0.16,
    elevation: 6,
  },
  homeLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.1,
  },
}));
