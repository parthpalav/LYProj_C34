import React, { useCallback, useState } from 'react';
import { ScrollView, Share, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createSmsCaptureToken, getSmsCaptureStatus, revokeSmsCaptureToken, SMS_INGEST_URL } from '../services/api';
import { toast } from '../store/useCelebrationStore';
import { createStyles, radius, typeScale, useTheme } from '../theme';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Bits';
import { ScreenHeader, useHeaderHeight } from '../components/ui/ScreenHeader';

const STEPS = [
  'Open the Shortcuts app, go to Automation and tap +.',
  'Choose Message. Set "Message Contains" to debited (add a second automation for credited or spent if you like). Pick Run Immediately.',
  'Tap New Blank Automation and add the action "Get Contents of URL".',
  'Paste the URL below. Tap the arrow: Method POST, add a header Authorization with the value Bearer followed by a space and your token.',
  'Request Body: JSON. Add a Text field named text and set it to Shortcut Input (the message). Tap Done.',
];

/**
 * iOS does not let apps read SMS, so a Shortcuts personal automation forwards bank SMS to FINAURA.
 * They land as "captured" items on Home; nothing is recorded until the user confirms each one.
 */
export function SmsCaptureScreen(): React.ReactElement {
  const s = useStyles();
  const { c } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(useCallback(() => {
    getSmsCaptureStatus().then((st) => setEnabled(st.enabled)).catch(() => setEnabled(false));
  }, []));

  const generate = async () => {
    setBusy(true);
    try {
      const { token: t } = await createSmsCaptureToken();
      setToken(t);
      setEnabled(true);
    } catch {
      toast("Couldn't create a token", { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    setBusy(true);
    try {
      await revokeSmsCaptureToken();
      setToken(null);
      setEnabled(false);
      toast('SMS capture turned off', { subtitle: 'The old Shortcut will stop working.' });
    } catch {
      toast("Couldn't turn it off", { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ paddingTop: headerHeight + 8, paddingBottom: insets.bottom + 32, paddingHorizontal: 16 }}>
        <Card style={s.card}>
          <View style={s.rowBetween}>
            <Text style={s.title}>Auto-capture bank SMS</Text>
            {enabled !== null && <Badge label={enabled ? 'On' : 'Off'} tone={enabled ? 'success' : 'neutral'} />}
          </View>
          <Text style={s.muted}>
            iPhones don't let apps read your messages. An iOS Shortcut can forward each bank SMS to FINAURA instead.
            Captured payments show up on Home. FINAURA keeps the parsed details. Unrecognized message formats may be sent to Google Gemini.
          </Text>
        </Card>

        <Card style={s.card}>
          <Text style={s.label}>Your capture token</Text>
          {token ? (
            <>
              <Text style={s.code} selectable>{token}</Text>
              <Text style={s.warn}>Copy it now: it is shown only once. Anyone with it can add captured items to your account, so don't share it.</Text>
              <Button label="Copy or share token" icon="share-outline" variant="secondary" onPress={() => Share.share({ message: token })} style={s.cta} />
            </>
          ) : (
            <Text style={s.muted}>{enabled ? 'A token is active. Make a new one if you lost it; the old one stops working.' : 'Make a token to connect the Shortcut.'}</Text>
          )}
          <Button label={enabled ? 'Make a new token' : 'Make a token'} icon="key-outline" onPress={generate} loading={busy && !token} style={s.cta} />
          {enabled && <Button label="Turn off SMS capture" variant="ghost" onPress={revoke} disabled={busy} />}
        </Card>

        <Card style={s.card}>
          <Text style={s.label}>Capture URL</Text>
          <Text style={s.code} selectable>{SMS_INGEST_URL}</Text>
          <Text style={s.mutedSmall}>Your iPhone must be able to reach this address (same Wi-Fi as the FINAURA server, or a public URL).</Text>
          <Button label="Share URL" icon="link-outline" variant="secondary" onPress={() => Share.share({ message: SMS_INGEST_URL })} style={s.cta} />
        </Card>

        <Card style={s.card}>
          <Text style={s.label}>Set up the Shortcut</Text>
          {STEPS.map((step, i) => (
            <View key={i} style={s.step}>
              <View style={[s.stepNum, { backgroundColor: c.primarySoft }]}><Text style={[s.stepNumText, { color: c.primary }]}>{i + 1}</Text></View>
              <Text style={[s.muted, s.flex]}>{step}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
      <ScreenHeader title="SMS capture" onBack={() => navigation.goBack()} />
    </View>
  );
}

const useStyles = createStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  card: { marginBottom: 14 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { ...typeScale.headline, color: c.text },
  label: { ...typeScale.overline, color: c.textSubtle, marginBottom: 8 },
  muted: { ...typeScale.body, fontSize: 14, color: c.textMuted, marginTop: 4 },
  mutedSmall: { ...typeScale.caption, color: c.textSubtle, marginTop: 8 },
  warn: { ...typeScale.caption, color: c.warningStrong, marginTop: 8 },
  code: { fontFamily: 'Menlo', fontSize: 13, color: c.text, padding: 12, borderRadius: radius.md, backgroundColor: c.surfaceAlt },
  cta: { marginTop: 14 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: 10 },
  stepNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  stepNumText: { fontSize: 12, fontWeight: '800' },
}));
