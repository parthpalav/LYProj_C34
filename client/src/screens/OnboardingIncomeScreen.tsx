import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';

const TOTAL_STEPS = 5;
const CURRENT_STEP = 2;

interface Props {
  onNext?: () => void;
  onPrev?: () => void;
}

export function OnboardingIncomeScreen({ onNext, onPrev }: Props): React.ReactElement {
  const [income, setIncome] = useState(5000);
  const [age, setAge] = useState(28);
  const [retirementAge, setRetirementAge] = useState(65);

  // Simple custom slider using touch-based approach via percentage
  const AGE_MIN = 18;
  const AGE_MAX = 80;
  const RET_MIN = 40;
  const RET_MAX = 85;

  const agePercent = ((age - AGE_MIN) / (AGE_MAX - AGE_MIN)) * 100;
  const retPercent = ((retirementAge - RET_MIN) / (RET_MAX - RET_MIN)) * 100;

  const [sliderWidth, setSliderWidth] = useState(0);

  const handleAgeSlider = (locationX: number) => {
    if (sliderWidth === 0) return;
    const clampedX = Math.max(0, Math.min(locationX, sliderWidth));
    const pct = clampedX / sliderWidth;
    const val = Math.round(AGE_MIN + pct * (AGE_MAX - AGE_MIN));
    setAge(val);
  };

  const handleRetSlider = (locationX: number) => {
    if (sliderWidth === 0) return;
    const clampedX = Math.max(0, Math.min(locationX, sliderWidth));
    const pct = clampedX / sliderWidth;
    const val = Math.round(RET_MIN + pct * (RET_MAX - RET_MIN));
    setRetirementAge(val);
  };

  const formatIncome = (val: number) =>
    `$${val.toLocaleString('en-US')}`;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Logo / Brand */}
        <View style={styles.logoRow}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoIconText}>⟡</Text>
          </View>
          <Text style={styles.logoText}>Finaura</Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <Text style={styles.stepLabel}>Step {CURRENT_STEP} of {TOTAL_STEPS}</Text>
          <View style={styles.progressBarRow}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressSegment,
                  i < CURRENT_STEP ? styles.progressSegmentActive : styles.progressSegmentInactive,
                  { marginRight: i < TOTAL_STEPS - 1 ? 4 : 0 },
                ]}
              />
            ))}
          </View>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {/* Heading */}
          <Text style={styles.heading}>What's your{'\n'}Monthly Income?</Text>

          {/* Income Display */}
          <Text style={styles.incomeValue}>{formatIncome(income)}</Text>

          {/* Age Slider */}
          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>Age</Text>
            <Text style={styles.sliderValue}>({age})</Text>
          </View>
          <View
            style={styles.sliderTrack}
            onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(e) => handleAgeSlider(e.nativeEvent.locationX)}
            onResponderMove={(e) => handleAgeSlider(e.nativeEvent.locationX)}
          >
            <View style={[styles.sliderFill, { width: `${agePercent}%` }]} />
            <View style={[styles.sliderThumb, { left: `${agePercent}%` as any }]} />
          </View>

          {/* Retirement Age Slider */}
          <View style={[styles.sliderRow, { marginTop: 20 }]}>
            <Text style={styles.sliderLabel}>Retirement Age</Text>
            <Text style={styles.sliderValue}>({retirementAge})</Text>
          </View>
          <View
            style={styles.sliderTrack}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(e) => handleRetSlider(e.nativeEvent.locationX)}
            onResponderMove={(e) => handleRetSlider(e.nativeEvent.locationX)}
          >
            <View style={[styles.sliderFill, { width: `${retPercent}%` }]} />
            <View style={[styles.sliderThumb, { left: `${retPercent}%` as any }]} />
          </View>

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.prevButton} onPress={onPrev} activeOpacity={0.8}>
              <Text style={styles.prevButtonText}>Prev</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.continueButton} onPress={onNext} activeOpacity={0.8}>
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const BRAND_BLUE = '#3B3BDE';
const TRACK_COLOR = '#E0E0E0';

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  // Logo
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: BRAND_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  logoIconText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  logoText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A2E',
    letterSpacing: 0.3,
  },

  // Progress
  progressContainer: {
    marginBottom: 20,
  },
  stepLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
    fontWeight: '500',
  },
  progressBarRow: {
    flexDirection: 'row',
  },
  progressSegment: {
    flex: 1,
    height: 5,
    borderRadius: 10,
  },
  progressSegmentActive: {
    backgroundColor: BRAND_BLUE,
  },
  progressSegmentInactive: {
    backgroundColor: '#D1D5DB',
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A2E',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 12,
  },
  incomeValue: {
    fontSize: 48,
    fontWeight: '800',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: 28,
    letterSpacing: -1,
  },

  // Sliders
  sliderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  sliderValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  sliderTrack: {
    height: 6,
    backgroundColor: TRACK_COLOR,
    borderRadius: 999,
    justifyContent: 'center',
    marginBottom: 4,
    position: 'relative',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: BRAND_BLUE,
    borderRadius: 999,
  },
  sliderThumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: BRAND_BLUE,
    top: -8,
    marginLeft: -11,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },

  // Buttons
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 32,
    gap: 12,
  },
  prevButton: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  prevButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  continueButton: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    backgroundColor: BRAND_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND_BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  continueButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
