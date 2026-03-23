import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { OnboardingIncomeScreen } from '../screens/OnboardingIncomeScreen';

export type OnboardingParamList = {
  OnboardingIncome: undefined;
};

const Stack = createNativeStackNavigator<OnboardingParamList>();

interface Props {
  onFinish: () => void;
}

export function OnboardingNavigator({ onFinish }: Props): React.ReactElement {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OnboardingIncome">
        {() => (
          <OnboardingIncomeScreen
            onNext={onFinish}
            onPrev={() => {}}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
