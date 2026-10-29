import React, { useState, useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { popIn } from '../motion';
import { addTransaction, classifyExpense, ClassifyResult, getLiabilities, getPacing } from '../services/api';
import { celebrate, toast } from '../store/useCelebrationStore';
import { formatCurrency } from '../utils/format';
import { useStore } from '../store/useStore';
import { Liability } from '../types';
import { createStyles, radius, tabular, typeScale, useTheme } from '../theme';
import { Button } from '../components/ui/Button';
import { Chip, IconTile } from '../components/ui/Bits';
import { Sheet } from '../components/ui/Sheet';

const CATEGORIES = [
  { label: 'Food & Dining', emoji: '🍽️', ml: 'Food & Dining' },
  { label: 'Groceries', emoji: '🛒', ml: 'Groceries' },
  { label: 'Transport & Travel', emoji: '🚕', ml: 'Transport & Travel' },
  { label: 'Housing', emoji: '🏠', ml: 'Housing' },
  { label: 'Utilities & Bills', emoji: '💡', ml: 'Utilities & Bills' },
  { label: 'Debt & Loan Payments', emoji: '💳', ml: 'Debt & Loan Payments' },
  { label: 'Shopping', emoji: '🛍️', ml: 'Shopping' },
  { label: 'Entertainment', emoji: '🎬', ml: 'Entertainment' },
  { label: 'Health', emoji: '🏥', ml: 'Health' },
  { label: 'Education', emoji: '🎓', ml: 'Education' },
  { label: 'Personal Care', emoji: '✂️', ml: 'Personal Care' },
  { label: 'Insurance', emoji: '🛡️', ml: 'Insurance' },
  { label: 'Investments', emoji: '📈', ml: 'Investments' },
  { label: 'Misc', emoji: '📦', ml: 'Misc' },
];

const SPEND_TYPES = ['Need', 'Want', 'Investment'] as const;
type SpendType = (typeof SPEND_TYPES)[number];

const emojiFor = (ml: string) => CATEGORIES.find((c) => c.ml === ml)?.emoji ?? '📦';

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

interface Props {
  onClose?: () => void;
}

export function TransactionEntryScreen({ onClose }: Props): React.ReactElement {
  const { c, isDark } = useTheme();
  const styles = useStyles();
  const [amount, setAmount] = useState('');
  const [isAmountFocused, setIsAmountFocused] = useState(false);
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [selectedType, setSelectedType] = useState<SpendType>('Want');
  const [date, setDate] = useState(new Date());
  // One picker sheet at a time: iOS can't stack modal presentations.
  const [picker, setPicker] = useState<'category' | 'liability' | 'date' | null>(null);
  const [formError, setFormError] = useState('');
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [selectedLiability, setSelectedLiability] = useState<Liability | null>(null);
  const [markAsPaid, setMarkAsPaid] = useState(true);
  const amountInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const transactions = useStore((s) => s.transactions);
  const addToStore = useStore((s) => s.addTransaction);

  useEffect(() => {
    let mounted = true;
    getLiabilities()
      .then(data => {
        if (mounted) setLiabilities(data.filter(l => l.status === 'active' || !l.status));
      })
      .catch(() => {
        if (mounted) setLiabilities([]);
      });
    // Open with the keypad up: amount is always the first thing to type.
    const focus = setTimeout(() => amountInputRef.current?.focus(), 450);
    return () => { mounted = false; clearTimeout(focus); };
  }, []);

  // ── AI Classifier state ─────────────────────────────────────
  const [aiResult, setAiResult] = useState<ClassifyResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [typeConfirmed, setTypeConfirmed] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const userOverrodeCategoryRef = useRef(false);
  const userOverrodeTypeRef = useRef(false);

  useEffect(() => {
    const text = description.trim();
    if (!text || text.length < 3) {
      setAiResult(null);
      setTypeConfirmed(true);
      return;
    }
    // Clear old AI results and reset type confirmation while waiting for debounced query
    setAiResult(null);
    setTypeConfirmed(true);
    // Debounce: wait 600 ms after user stops typing
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const currentReqId = ++requestIdRef.current;
      setAiLoading(true);
      try {
        const result = await classifyExpense(amount ? `${amount} ${text}` : text);
        // Guard against stale out-of-order responses
        if (currentReqId !== requestIdRef.current) return;

        setAiResult(result);

        // ML suggests: only pre-select if user has not manually chosen category
        if (!userOverrodeCategoryRef.current) {
          const rawCat = (result.category || '').trim();
          const match = CATEGORIES.find(c =>
            c.ml.toLowerCase() === rawCat.toLowerCase() ||
            (rawCat.toLowerCase() === 'food' && c.ml === 'Food & Dining') ||
            (rawCat.toLowerCase() === 'travel' && c.ml === 'Transport & Travel') ||
            (rawCat.toLowerCase() === 'bills' && c.ml === 'Utilities & Bills') ||
            (rawCat.toLowerCase() === 'party' && c.ml === 'Entertainment')
          );
          if (match) setSelectedCategory(match);
        }

        // ML suggests: only pre-select if user has not manually chosen type
        if (!userOverrodeTypeRef.current) {
          if (result.type && (SPEND_TYPES as readonly string[]).includes(result.type)) {
            setSelectedType(result.type as SpendType);
          } else if (result.sentiment) {
            if (result.sentiment === 'positive') setSelectedType('Investment');
            else if (result.sentiment === 'negative') setSelectedType('Want');
            else setSelectedType('Need');
          }

          if (result.needsReview) {
            setTypeConfirmed(false);
          } else {
            setTypeConfirmed(true);
          }
        } else {
          setTypeConfirmed(true);
        }
      } catch {
        if (currentReqId === requestIdRef.current) {
          setAiResult(null);
        }
      } finally {
        if (currentReqId === requestIdRef.current) {
          setAiLoading(false);
        }
      }
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [description, amount]);

  const parsedAmount = parseFloat(amount.replace(/[^0-9.]/g, '')) || 0;
  const aiUnsure = !!aiResult?.needsReview && !userOverrodeCategoryRef.current;

  // Real-time stats (the amount being typed is previewed in)
  const today = new Date();
  const todaySpend = transactions
    .filter(t => sameDay(new Date(t.timestamp), today) && t.type !== 'Investment')
    .reduce((s, t) => s + Math.abs(t.amount), 0) + (selectedType !== 'Investment' && sameDay(date, today) ? parsedAmount : 0);

  const startOfWeek = new Date(); startOfWeek.setDate(startOfWeek.getDate() - 7);
  const weekSpend = transactions
    .filter(t => new Date(t.timestamp) > startOfWeek && t.type !== 'Investment')
    .reduce((s, t) => s + Math.abs(t.amount), 0) + (selectedType !== 'Investment' ? parsedAmount : 0);

  // Share of the last 7 days' spending that went to Wants.
  const weekWants = transactions
    .filter(t => new Date(t.timestamp) > startOfWeek && t.type === 'Want')
    .reduce((s, t) => s + Math.abs(t.amount), 0) + (selectedType === 'Want' ? parsedAmount : 0);
  const wantsRatio = weekSpend > 0 ? Math.round((weekWants / weekSpend) * 100) : 0;

  const handleSelectCategoryManually = (cat: typeof CATEGORIES[number]) => {
    userOverrodeCategoryRef.current = true;
    setSelectedCategory(cat);
    setPicker(null);
  };

  const handleSelectTypeManually = (type: SpendType) => {
    userOverrodeTypeRef.current = true;
    setSelectedType(type);
    setTypeConfirmed(true);
    setFormError('');
  };

  const handleLog = async () => {
    if (aiLoading) {
      setFormError('Hang on, FINAURA is still reading the description.');
      return;
    }
    if (parsedAmount <= 0) {
      setFormError('Enter an amount greater than zero.');
      amountInputRef.current?.focus();
      return;
    }
    if (!typeConfirmed) {
      setFormError('Confirm the suggested type, or pick the right one.');
      return;
    }
    setFormError('');
    // Keep the time of day; only the calendar day comes from the date chip.
    const now = new Date();
    const when = new Date(date.getFullYear(), date.getMonth(), date.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
    try {
      // Map UI category + type → server fields
      const categoryKey = selectedCategory.ml;
      const sentimentMap: Record<string, 'positive' | 'neutral' | 'negative'> = {
        Need: 'neutral', Want: 'negative', Investment: 'positive',
      };
      const finalSentiment: 'positive' | 'neutral' | 'negative' =
        aiResult?.sentiment === 'positive' || aiResult?.sentiment === 'neutral' || aiResult?.sentiment === 'negative'
          ? aiResult.sentiment
          : sentimentMap[selectedType] ?? 'neutral';

      // The user's selectedType is the single source of truth from the form
      const newTx = await addTransaction({
        amount: parsedAmount,
        category: categoryKey,
        sentiment: finalSentiment,
        description: description.trim() || selectedCategory.label,
        type: selectedType,
        confidenceScore: aiResult?.confidenceScore ?? aiResult?.confidence ?? 0,
        // 'default' = untouched form value with no AI result; the server never learns from it
        categorySource: userOverrodeCategoryRef.current ? 'manual' : aiResult?.categorySource ?? 'default',
        typeSource: userOverrodeTypeRef.current ? 'manual' : aiResult?.typeSource ?? 'default',
        categoryConfidence: userOverrodeCategoryRef.current ? 1.0 : aiResult?.categoryConfidence,
        typeConfidence: userOverrodeTypeRef.current ? 1.0 : aiResult?.typeConfidence,
        needsReview: aiResult?.needsReview,
        liabilityId: selectedLiability ? selectedLiability.id : undefined,
        expectedScheduledFor: selectedLiability && selectedLiability.autoDeduct && markAsPaid && selectedLiability.nextDueDate ? selectedLiability.nextDueDate.toString() : undefined,
        timestamp: when.toISOString(),
      });
      addToStore(newTx);
      onClose?.();
      const loggedType = newTx.type || selectedType;
      if (loggedType === 'Investment') {
        celebrate({ kind: 'fireworks', title: `${formatCurrency(parsedAmount)} invested`, subtitle: 'Your future self says thanks. Investments this month just went up.' });
        return;
      }
      toast('Transaction logged', { subtitle: `${formatCurrency(parsedAmount)} · ${loggedType} in ${newTx.category || categoryKey}` });
      // Budget nudge: warn (after the success toast) when this pushes Needs/Wants past the monthly limit.
      const bucket = loggedType === 'Need' ? 'Needs' : loggedType === 'Want' ? 'Wants' : null;
      if (bucket) {
        getPacing()
          .then((p) => {
            const b = p?.[bucket];
            if (b && b.limit > 0 && b.actual > b.limit) {
              setTimeout(() => toast(`${bucket} over budget`, {
                tone: 'warning',
                subtitle: `${formatCurrency(b.actual)} spent of ${formatCurrency(b.limit)} this month.`,
              }), 2200);
            }
          })
          .catch(() => {});
      }
    } catch {
      setFormError("Couldn't save. Check your connection and try again.");
    }
  };

  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const dateLabel = sameDay(date, today) ? 'Today' : sameDay(date, yesterday) ? 'Yesterday' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const alternatives = Object.entries(aiResult?.all_probs ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .filter(([cat]) => cat !== selectedCategory.ml);

  return (
    <View style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>New expense</Text>
        <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={20} color={c.textMuted} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.sheet}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {/* Amount */}
        <Text style={styles.fieldLabel}>Amount</Text>
        <Pressable
          style={[styles.amountContainer, isAmountFocused && styles.amountContainerFocused]}
          onPress={() => amountInputRef.current?.focus()}
          accessibilityRole="button"
          accessibilityLabel="Transaction amount"
        >
          <View pointerEvents="none" style={styles.currencyPrefixWrap}>
            <Text style={[styles.currencyPrefix, isAmountFocused && styles.currencyPrefixFocused]}>₹</Text>
          </View>
          <TextInput
            ref={amountInputRef}
            style={styles.amountInput}
            value={amount}
            onChangeText={(t) => {
              setFormError('');
              const cleaned = t.replace(/[^0-9.]/g, '');
              const parts = cleaned.split('.');
              if (parts.length > 2) {
                setAmount(`${parts[0]}.${parts.slice(1).join('')}`);
              } else {
                setAmount(cleaned);
              }
            }}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={c.textSubtle}
            keyboardAppearance={isDark ? 'dark' : 'light'}
            onFocus={() => setIsAmountFocused(true)}
            onBlur={() => setIsAmountFocused(false)}
            accessibilityLabel="Amount value"
          />
        </Pressable>

        {/* Description */}
        <View style={styles.descRow}>
          <Ionicons name="create-outline" size={18} color={c.textSubtle} />
          <TextInput
            style={styles.textInput}
            value={description}
            onChangeText={setDescription}
            placeholder="What was it? e.g. Pizza, Uber ride"
            placeholderTextColor={c.textSubtle}
            keyboardAppearance={isDark ? 'dark' : 'light'}
            returnKeyType="done"
            accessibilityLabel="Description"
          />
          {aiLoading && <ActivityIndicator size="small" color={c.primary} />}
        </View>

        {/* AI suggestion: the chosen category plus tappable alternatives */}
        {!aiLoading && aiResult && aiResult.confidence > 0 && (
          <Animated.View key={aiResult.category} entering={popIn()} exiting={FadeOut} style={[styles.aiCard, aiUnsure && styles.aiCardUnsure]}>
            <View style={styles.aiHeader}>
              <Ionicons name="sparkles" size={14} color={aiUnsure ? c.warningStrong : c.primary} />
              <Text style={[styles.aiLabel, aiUnsure && { color: c.warningStrong }]}>
                {userOverrodeCategoryRef.current ? 'Your pick' : aiUnsure ? 'Not sure. Tap the right one' : 'Suggested by FINAURA'}
              </Text>
            </View>
            <View style={styles.aiChips}>
              <Chip label={`${emojiFor(selectedCategory.ml)} ${selectedCategory.label}`} selected onPress={() => setPicker('category')} />
              {alternatives.map(([cat]) => (
                <Chip
                  key={cat}
                  label={`${emojiFor(cat)} ${cat}`}
                  onPress={() => {
                    const pick = CATEGORIES.find(c => c.ml === cat);
                    if (pick) handleSelectCategoryManually(pick);
                  }}
                />
              ))}
            </View>
            {!!aiResult.verdict && <Text style={styles.aiVerdict}>{aiResult.sentiment_emoji} {aiResult.verdict}</Text>}
          </Animated.View>
        )}

        {/* Category + date */}
        <View style={styles.pickRow}>
          <Pressable style={[styles.pick, styles.flex]} onPress={() => setPicker('category')} accessibilityRole="button" accessibilityLabel={`Category: ${selectedCategory.label}`}>
            <Text style={styles.pickEmoji}>{selectedCategory.emoji}</Text>
            <Text style={styles.pickText} numberOfLines={1}>{selectedCategory.label}</Text>
            <Ionicons name="chevron-down" size={16} color={c.textSubtle} />
          </Pressable>
          <Pressable style={styles.pick} onPress={() => setPicker('date')} accessibilityRole="button" accessibilityLabel={`Date: ${dateLabel}`}>
            <Ionicons name="calendar-outline" size={16} color={c.textMuted} />
            <Text style={styles.pickText}>{dateLabel}</Text>
          </Pressable>
        </View>

        {/* Spend type */}
        <Text style={styles.fieldLabel}>Type</Text>
        <View style={styles.typeRow}>
          {SPEND_TYPES.map((type) => (
            <Chip key={type} label={type} selected={selectedType === type} onPress={() => handleSelectTypeManually(type)} style={styles.flex} />
          ))}
        </View>

        {/* AI type confirmation (low confidence) */}
        {!typeConfirmed && aiResult && (
          <Animated.View entering={FadeIn} style={styles.aiConfirmationBanner}>
            <Text style={styles.aiConfirmationText}>
              FINAURA thinks this is a <Text style={styles.bold}>{selectedType}</Text>, but it's not sure.
            </Text>
            <Button label="Looks right" size="sm" variant="secondary" onPress={() => { setTypeConfirmed(true); setFormError(''); }} />
          </Animated.View>
        )}

        {/* Optional liability link */}
        {liabilities.length > 0 && (
          <Pressable style={styles.linkRow} onPress={() => setPicker('liability')} accessibilityRole="button" accessibilityLabel="Link to a bill">
            <IconTile icon={selectedLiability ? 'calendar' : 'link-outline'} tint={c.primary} size={36} />
            <View style={styles.flex}>
              <Text style={styles.linkTitle} numberOfLines={1}>{selectedLiability ? selectedLiability.name : 'Link to a bill (optional)'}</Text>
              <Text style={styles.linkSub} numberOfLines={1}>
                {selectedLiability
                  ? `${formatCurrency(selectedLiability.amount)} · ${selectedLiability.frequency}${selectedLiability.autoDeduct ? ' · Auto deduct' : ''}`
                  : 'Record this as a payment for a tracked Liability'}
              </Text>
            </View>
            {selectedLiability ? (
              <Pressable onPress={() => setSelectedLiability(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Unlink bill">
                <Ionicons name="close-circle" size={20} color={c.textSubtle} />
              </Pressable>
            ) : (
              <Ionicons name="chevron-forward" size={18} color={c.textSubtle} />
            )}
          </Pressable>
        )}

        {selectedLiability?.autoDeduct && selectedLiability.nextDueDate && (
          <View style={styles.markPaid}>
            <View style={styles.flex}>
              <Text style={styles.linkTitle}>Mark next scheduled payment as paid</Text>
              <Text style={styles.linkSub}>
                {markAsPaid
                  ? `Covers the payment due ${new Date(selectedLiability.nextDueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, so it won't auto-deduct twice.`
                  : 'Adds to payment history; the next auto-deduct date stays the same.'}
              </Text>
            </View>
            <Switch value={markAsPaid} onValueChange={setMarkAsPaid} trackColor={{ true: c.primary }} />
          </View>
        )}

        {!!formError && <Animated.Text entering={FadeIn} style={styles.formError} accessibilityRole="alert">{formError}</Animated.Text>}

        <Button label={parsedAmount > 0 ? `Log ${formatCurrency(parsedAmount)}` : 'Log expense'} onPress={handleLog} style={styles.logButton} />

        {/* Running totals, including what's being typed */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Today</Text>
            <Text style={styles.summaryValue}>{formatCurrency(todaySpend)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Last 7 days</Text>
            <Text style={styles.summaryValue}>{formatCurrency(weekSpend)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Wants share</Text>
            <Text style={styles.summaryValue}>{wantsRatio}%</Text>
          </View>
        </View>
      </ScrollView>

      {/* Category picker */}
      <Sheet visible={picker === 'category'} onClose={() => setPicker(null)} title="Category">
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((item) => (
            <Chip key={item.label} label={`${item.emoji} ${item.label}`} selected={selectedCategory.label === item.label} onPress={() => handleSelectCategoryManually(item)} />
          ))}
        </View>
      </Sheet>

      {/* Date picker */}
      <Sheet visible={picker === 'date'} onClose={() => setPicker(null)} title="When was it?">
        <View style={styles.typeRow}>
          <Chip label="Today" selected={sameDay(date, today)} onPress={() => { setDate(today); setPicker(null); }} style={styles.flex} />
          <Chip label="Yesterday" selected={sameDay(date, yesterday)} onPress={() => { setDate(yesterday); setPicker(null); }} style={styles.flex} />
        </View>
        <DateTimePicker
          value={date}
          mode="date"
          display="inline"
          maximumDate={today}
          themeVariant={isDark ? 'dark' : 'light'}
          accentColor={c.primary}
          onChange={(_, d) => d && setDate(d)}
        />
        <Button label="Done" onPress={() => setPicker(null)} />
      </Sheet>

      {/* Liability picker */}
      <Sheet visible={picker === 'liability'} onClose={() => setPicker(null)} title="Link to a bill">
        <ScrollView style={styles.liabilityList}>
          {[null, ...liabilities].map((item) => {
            const isSelected = (selectedLiability?.id ?? null) === (item?.id ?? null);
            return (
              <Pressable
                key={item?.id ?? 'none'}
                style={[styles.liabilityItem, isSelected && styles.liabilityItemActive]}
                onPress={() => { setSelectedLiability(item); setPicker(null); }}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                <IconTile icon={item ? 'calendar-outline' : 'remove-circle-outline'} tint={item ? c.primary : c.textMuted} size={36} />
                <View style={styles.flex}>
                  <Text style={styles.linkTitle}>{item ? item.name : "Don't link"}</Text>
                  <Text style={styles.linkSub}>
                    {item ? `${formatCurrency(item.amount)} · ${item.category} · ${item.frequency}${item.autoDeduct ? ' · Auto' : ''}` : 'A standalone expense'}
                  </Text>
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={20} color={c.primary} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>
    </View>
  );
}

const useStyles = createStyles((c) => ({
  safe: {
    flex: 1,
    backgroundColor: c.surface,
  },
  flex: {
    flex: 1,
  },
  bold: {
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 6,
  },
  headerTitle: {
    ...typeScale.title,
    color: c.text,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceAlt,
  },
  sheet: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  fieldLabel: {
    ...typeScale.overline,
    color: c.textSubtle,
    marginTop: 18,
    marginBottom: 8,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 64,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.bg,
  },
  amountContainerFocused: {
    borderColor: c.primary,
    backgroundColor: c.primarySoft,
  },
  currencyPrefixWrap: {
    marginRight: 4,
  },
  currencyPrefix: {
    fontSize: 32,
    fontWeight: '700',
    color: c.textSubtle,
  },
  currencyPrefixFocused: {
    fontSize: 32,
    fontWeight: '700',
    color: c.primary,
  },
  amountInput: {
    minWidth: 60,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
    color: c.text,
    ...tabular,
  },
  descRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    marginTop: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: c.surfaceAlt,
  },
  textInput: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: c.text,
  },
  aiCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: c.primarySoft,
    gap: 10,
  },
  aiCardUnsure: {
    backgroundColor: c.warningSoft,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiLabel: {
    ...typeScale.label,
    color: c.primary,
  },
  aiChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  aiVerdict: {
    ...typeScale.caption,
    color: c.textMuted,
  },
  pickRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  pickEmoji: {
    fontSize: 18,
  },
  pickText: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
    color: c.text,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  aiConfirmationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: c.warningSoft,
  },
  aiConfirmationText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: c.text,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  linkTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: c.text,
  },
  linkSub: {
    fontSize: 12,
    color: c.textMuted,
    marginTop: 2,
  },
  markPaid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: c.surfaceAlt,
  },
  formError: {
    fontSize: 13,
    color: c.danger,
    marginTop: 14,
    textAlign: 'center',
  },
  logButton: {
    marginTop: 18,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: c.bg,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 26,
    backgroundColor: c.border,
  },
  summaryLabel: {
    fontSize: 11,
    color: c.textSubtle,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '700',
    color: c.text,
    marginTop: 2,
    ...tabular,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  liabilityList: {
    maxHeight: 420,
  },
  liabilityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    marginBottom: 6,
  },
  liabilityItemActive: {
    backgroundColor: c.primarySoft,
  },
}));
