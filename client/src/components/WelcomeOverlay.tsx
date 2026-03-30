import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Easing, TouchableOpacity } from 'react-native';

const { width, height } = Dimensions.get('window');
const BLUE  = '#3B3BDE';

interface Props {
  onDismiss: () => void;
  fmiBaseline?: number;
}

export function WelcomeOverlay({ onDismiss, fmiBaseline = 65 }: Props) {
  const [visible, setVisible] = useState(true);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();
  }, [fadeAnim, slideAnim, scaleAnim]);

  const handleStart = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      onDismiss();
    });
  };

  if (!visible) return null;

  return (
    <View style={s.overlay}>
      <Animated.View 
        style={[
          s.container, 
          { 
            opacity: fadeAnim, 
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }] 
          }
        ]}
      >
        <View style={s.iconWrap}>
          <Text style={s.icon}>✨</Text>
        </View>
        <Text style={s.title}>Welcome to FINAURA</Text>
        <Text style={s.subtitle}>Your Autonomous Financial Digital Twin</Text>
        
        <View style={s.baselineCard}>
          <Text style={s.baselineLabel}>Initial FMI Baseline Configured</Text>
          <Text style={s.baselineScore}>{fmiBaseline}/100</Text>
          <Text style={s.baselineDesc}>
            Finaura will continuously scan for patterns, micro-actions, and goals to elevate this score dynamically.
          </Text>
        </View>

        <TouchableOpacity style={s.btn} activeOpacity={0.85} onPress={handleStart}>
          <Text style={s.btnText}>Enter Finaura Dashboard</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 9999,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 32,
    width: width - 48,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 24,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  icon: { fontSize: 40 },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  baselineCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 32,
  },
  baselineLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  baselineScore: {
    fontSize: 48,
    fontWeight: '900',
    color: BLUE,
    marginBottom: 12,
  },
  baselineDesc: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
  },
  btn: {
    backgroundColor: BLUE,
    width: '100%',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
