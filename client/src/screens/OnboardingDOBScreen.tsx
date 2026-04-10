import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOnboardingStore } from '../store/onboardingContext';

const TOTAL_STEPS = 5;
const CURRENT_STEP = 2;
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type DropdownOption = {
  label: string;
  value: string;
};

function DropdownField({
  label,
  placeholder,
  value,
  options,
  onSelect,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: DropdownOption[];
  onSelect: (value: string) => void;
}): React.ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.dropdownGroup}>
      <Text style={styles.dropdownLabel}>{label}</Text>
      <TouchableOpacity style={styles.dropdownButton} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={[styles.dropdownButtonText, !value && styles.dropdownPlaceholder]}>
          {value || placeholder}
        </Text>
        <Text style={styles.dropdownChevron}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{label}</Text>
            <ScrollView style={styles.modalList}>
              {options.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.modalItem}
                  onPress={() => {
                    onSelect(option.value);
                    setOpen(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalItemText}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

interface Props {
  onNext?: () => void;
}

export function OnboardingDOBScreen({ onNext }: Props): React.ReactElement {
  const setDateOfBirth = useOnboardingStore((state) => state.setDateOfBirth);
  const currentYear = new Date().getFullYear();
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [error, setError] = useState('');

  const daysInSelectedMonth = (() => {
    if (!selectedMonth || !selectedYear) return 31;
    const monthIndex = MONTHS.indexOf(selectedMonth);
    const year = parseInt(selectedYear, 10);
    return new Date(year, monthIndex + 1, 0).getDate();
  })();

  const dayOptions = Array.from({ length: daysInSelectedMonth }, (_, i) => ({
    label: String(i + 1),
    value: String(i + 1),
  }));

  const monthOptions = MONTHS.map((month) => ({ label: month, value: month }));
  const yearOptions = Array.from({ length: 101 }, (_, i) => String(currentYear - i)).map((year) => ({
    label: year,
    value: year,
  }));

  const handleContinue = () => {
    if (!selectedDay || !selectedMonth || !selectedYear) {
      setError('Please select day, month, and year');
      return;
    }

    const monthIndex = MONTHS.indexOf(selectedMonth);
    const day = parseInt(selectedDay, 10);
    const year = parseInt(selectedYear, 10);
    const selectedDate = new Date(year, monthIndex, day);

    if (Number.isNaN(selectedDate.getTime())) {
      setError('Please select a valid date');
      return;
    }

    setError('');
    setDateOfBirth(selectedDate);
    onNext?.();
  };

  const selectedDateStr =
    selectedDay && selectedMonth && selectedYear
      ? `${selectedDay} ${selectedMonth} ${selectedYear}`
      : 'Select your date of birth';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
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
          <Text style={styles.heading}>What's your{'\n'}date of birth?</Text>
          <Text style={styles.subtitle}>Choose day, month, and year directly</Text>

          {/* Selected Date Display */}
          <View style={styles.dateDisplayBox}>
            <Text style={styles.dateDisplayLabel}>Selected Date</Text>
            <Text style={styles.dateDisplayValue}>{selectedDateStr}</Text>
          </View>

          {/* Dropdowns */}
          <View style={styles.dropdownRow}>
            <DropdownField
              label="Day"
              placeholder="Day"
              value={selectedDay}
              options={dayOptions}
              onSelect={(value) => {
                setSelectedDay(value);
                setError('');
              }}
            />
            <DropdownField
              label="Month"
              placeholder="Month"
              value={selectedMonth}
              options={monthOptions}
              onSelect={(value) => {
                setSelectedMonth(value);
                setError('');
                if (selectedDay && parseInt(selectedDay, 10) > new Date(parseInt(selectedYear || String(currentYear), 10), MONTHS.indexOf(value) + 1, 0).getDate()) {
                  setSelectedDay('');
                }
              }}
            />
            <DropdownField
              label="Year"
              placeholder="Year"
              value={selectedYear}
              options={yearOptions}
              onSelect={(value) => {
                setSelectedYear(value);
                setError('');
                if (selectedMonth && selectedDay) {
                  const maxDays = new Date(parseInt(value, 10), MONTHS.indexOf(selectedMonth) + 1, 0).getDate();
                  if (parseInt(selectedDay, 10) > maxDays) {
                    setSelectedDay('');
                  }
                }
              }}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Continue Button */}
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
            activeOpacity={0.8}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const BRAND_BLUE = '#3B3BDE';

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  container: {
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
    marginBottom: 20,
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A2E',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: '500',
  },

  // Date Display
  dateDisplayBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  dateDisplayLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
    marginBottom: 4,
  },
  dateDisplayValue: {
    fontSize: 20,
    fontWeight: '800',
    color: BRAND_BLUE,
  },

  dropdownRow: {
    gap: 12,
    marginBottom: 8,
  },
  dropdownGroup: {
    marginBottom: 12,
  },
  dropdownLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  dropdownButton: {
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  dropdownPlaceholder: {
    color: '#9CA3AF',
    fontWeight: '600',
  },
  dropdownChevron: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6B7280',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    padding: 20,
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 12,
  },
  modalList: {
    maxHeight: 320,
  },
  modalItem: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  modalItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
  },

  errorText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },

  // Button
  continueButton: {
    height: 50,
    borderRadius: 25,
    backgroundColor: BRAND_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND_BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
