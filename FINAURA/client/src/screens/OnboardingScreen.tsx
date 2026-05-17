import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';

export function OnboardingScreen(): React.ReactElement {
  const { completeOnboarding } = useAuthStore();
  const [age, setAge] = useState('');
  const [income, setIncome] = useState('');
  const [retirementAge, setRetirementAge] = useState('');
  const [retirementCorpusGoal, setRetirementCorpusGoal] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [incomeType, setIncomeType] = useState('salaried');
  const [rent, setRent] = useState('');
  const [emi, setEmi] = useState('');
  const [bills, setBills] = useState('');
  const [family, setFamily] = useState('');

  const submit = async () => {
    const fixedObligations = [
      { label: 'Rent', amount: Number(rent || 0) },
      { label: 'EMI', amount: Number(emi || 0) },
      { label: 'Bills', amount: Number(bills || 0) },
      { label: 'Family', amount: Number(family || 0) },
    ].filter((o) => o.amount > 0);

    await completeOnboarding({
      age: Number(age),
      income: Number(income),
      incomeType,
      retirementAge: Number(retirementAge),
      retirementCorpusGoal: Number(retirementCorpusGoal),
      currentBalance: Number(currentBalance),
      fixedObligations
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Set up your profile</Text>

      <TextInput style={styles.input} placeholder="Current age" keyboardType="number-pad" value={age} onChangeText={setAge} />
      <TextInput style={styles.input} placeholder="Monthly income" keyboardType="number-pad" value={income} onChangeText={setIncome} />
      <TextInput style={styles.input} placeholder="Retirement age" keyboardType="number-pad" value={retirementAge} onChangeText={setRetirementAge} />
      <TextInput style={styles.input} placeholder="Desired retirement corpus" keyboardType="number-pad" value={retirementCorpusGoal} onChangeText={setRetirementCorpusGoal} />
      <TextInput style={styles.input} placeholder="Current balance" keyboardType="number-pad" value={currentBalance} onChangeText={setCurrentBalance} />

      <TextInput style={styles.input} placeholder="Income type (salaried/gig/freelancer/student/business)" value={incomeType} onChangeText={setIncomeType} />

      <Text style={styles.section}>Fixed obligations</Text>
      <TextInput style={styles.input} placeholder="Rent" keyboardType="number-pad" value={rent} onChangeText={setRent} />
      <TextInput style={styles.input} placeholder="EMI" keyboardType="number-pad" value={emi} onChangeText={setEmi} />
      <TextInput style={styles.input} placeholder="Bills" keyboardType="number-pad" value={bills} onChangeText={setBills} />
      <TextInput style={styles.input} placeholder="Family support" keyboardType="number-pad" value={family} onChangeText={setFamily} />

      <TouchableOpacity style={styles.btn} onPress={submit}>
        <Text style={styles.btnText}>Finish Onboarding</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: '#F4F6FA', gap: 10 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 8 },
  section: { fontSize: 13, fontWeight: '700', color: '#374151', marginTop: 10 },
  input: { height: 48, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  btn: { height: 48, backgroundColor: '#3B3BDE', borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  btnText: { color: '#fff', fontWeight: '700' }
});
