import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { OnboardingDOBScreen } from '../screens/OnboardingDOBScreen';
import { OnboardingRetirementScreen } from '../screens/OnboardingRetirementScreen';
import { OnboardingIncomeScreen } from '../screens/OnboardingIncomeScreen';
import { OnboardingCompleteScreen } from '../screens/OnboardingCompleteScreen';

export type OnboardingParamList = {
  OnboardingDOB: undefined;
  OnboardingRetirement: undefined;
  OnboardingIncome: undefined;
  OnboardingComplete: undefined;
};

const Stack = createNativeStackNavigator<OnboardingParamList>();

interface Props {
  onFinish: () => void;
}

export function OnboardingNavigator({ onFinish }: Props): React.ReactElement {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OnboardingDOB">
        {({ navigation }) => (
          <OnboardingDOBScreen
            onNext={() => {
              navigation.navigate('OnboardingRetirement');
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="OnboardingRetirement">
        {({ navigation }) => (
          <OnboardingRetirementScreen
            onNext={() => {
              navigation.navigate('OnboardingIncome');
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="OnboardingIncome">
        {({ navigation }) => (
          <OnboardingIncomeScreen
            onNext={() => {
              navigation.navigate('OnboardingComplete');
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="OnboardingComplete">
        {() => (
          <OnboardingCompleteScreen
            onComplete={onFinish}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
