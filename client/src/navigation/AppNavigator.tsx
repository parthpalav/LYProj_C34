import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { AlertsScreen } from '../screens/AlertsScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { EnvelopesScreen } from '../screens/EnvelopesScreen';
import { FmiScreen } from '../screens/FmiScreen';
import { TransactionsScreen } from '../screens/TransactionsScreen';

export type RootTabParamList = {
  Dashboard: undefined;
  Transactions: undefined;
  FMI: undefined;
  Envelopes: undefined;
  Chat: undefined;
  Alerts: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export function AppNavigator(): JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#f8f9fb' },
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: '#0f766e'
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="FMI" component={FmiScreen} />
      <Tab.Screen name="Envelopes" component={EnvelopesScreen} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Alerts" component={AlertsScreen} />
    </Tab.Navigator>
  );
}
