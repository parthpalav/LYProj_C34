import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ExpenseScreen } from '../screens/ExpenseScreen';
import { FMIScreen } from '../screens/FMIScreen';
import { ChatbotScreen } from '../screens/ChatbotScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

export function AppNavigator(): React.ReactElement {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Expenses" component={ExpenseScreen} />
      <Tab.Screen name="FMI" component={FMIScreen} />
      <Tab.Screen name="Chatbot" component={ChatbotScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
