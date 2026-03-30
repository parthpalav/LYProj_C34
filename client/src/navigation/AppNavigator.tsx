import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { AlertsScreen } from '../screens/AlertsScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { EnvelopesScreen } from '../screens/EnvelopesScreen';
import { FmiScreen } from '../screens/FmiScreen';
import { GoalPlannerScreen } from '../screens/GoalPlannerScreen';
import { TransactionsScreen } from '../screens/TransactionsScreen';
import { IncomeFlowScreen } from '../screens/IncomeFlowScreen';
import { ReportsScreen } from '../screens/ReportsScreen';

export type RootTabParamList = {
  Dashboard: undefined;
  Transactions: undefined;
  FMI: undefined;
  Envelopes: undefined;
  Goals: undefined;
  Chat: undefined;
  Alerts: undefined;
  Income: undefined;
  Reports: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export function AppNavigator(): React.ReactElement {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#f8f9fb' },
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: '#3B3BDE',
      }}
    >
      <Tab.Screen name="Dashboard"    component={DashboardScreen} />
      <Tab.Screen name="Chat"         component={ChatScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="Income"       component={IncomeFlowScreen} />
      <Tab.Screen name="Envelopes"    component={EnvelopesScreen} />
      <Tab.Screen name="Goals"        component={GoalPlannerScreen} />
      <Tab.Screen name="FMI"          component={FmiScreen} />
      <Tab.Screen name="Reports"      component={ReportsScreen} />
      <Tab.Screen name="Alerts"       component={AlertsScreen} />
    </Tab.Navigator>
  );
}
