import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  getCurrentFamily,
  getReceivedFamilyInvitations,
  getSentFamilyInvitations,
  getFamilyDashboard,
  sendFamilyInvitation,
  acceptFamilyInvitation,
  declineFamilyInvitation,
  cancelFamilyInvitation,
  leaveFamily,
  removeFamilyMember,
} from '../services/api';
import {
  FamilySummary,
  FamilyInvitation,
  FamilyDashboard,
  FamilyMember,
} from '../types';

// ── Design Tokens ─────────────────────────────────────────────
const BLUE = '#2563EB';
const BLUE_LIGHT = '#EFF6FF';
const GREEN = '#10B981';
const GREEN_LIGHT = '#ECFDF5';
const AMBER = '#F59E0B';
const AMBER_LIGHT = '#FFFBEB';
const RED = '#EF4444';
const RED_LIGHT = '#FEF2F2';
const PURPLE = '#7C3AED';
const PURPLE_LIGHT = '#F5F3FF';
const BG = '#F8FAFC';
const CARD_BG = '#FFFFFF';
const TEXT_PRIMARY = '#0F172A';
const TEXT_SECONDARY = '#475569';
const TEXT_MUTED = '#94A3B8';
const BORDER = '#E2E8F0';

// ── Helpers ───────────────────────────────────────────────────

export function formatINR(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '₹0';
  return '₹' + Math.round(val).toLocaleString('en-IN');
}

export function getInitials(name?: string | null): string {
  if (!name || typeof name !== 'string') return 'FM';
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}

export function getFmiColor(score: number): string {
  if (score >= 80) return '#059669'; // Excellent
  if (score >= 65) return '#10B981'; // Good
  if (score >= 50) return '#D97706'; // Fair
  if (score >= 35) return '#F59E0B'; // Needs Attention
  return '#DC2626'; // Critical
}

export function getHumanReadableError(err: any, fallback: string = 'Operation failed. Please try again.'): string {
  const status = err?.response?.status;
  const serverMsg = err?.response?.data?.message || err?.response?.data?.error || '';
  const msgLower = typeof serverMsg === 'string' ? serverMsg.toLowerCase() : '';

  if (status === 404 || msgLower.includes('user not found') || msgLower.includes('account was found')) {
    return 'No FINAURA account was found with that email.';
  }
  if (msgLower.includes('cannot invite yourself') || msgLower.includes("can't invite your own") || msgLower.includes('self-invitation')) {
    return "You can't invite your own account.";
  }
  if (msgLower.includes('already belongs to a family') || (status === 409 && msgLower.includes('already belongs'))) {
    return 'This user already belongs to a Family.';
  }
  if (msgLower.includes('already exists') || msgLower.includes('already pending') || msgLower.includes('active invitation already exists')) {
    return 'A Family invitation is already pending for this user.';
  }
  if (status === 403 || msgLower.includes('only the family owner') || msgLower.includes('only owner')) {
    return 'Only the Family owner can invite new members.';
  }
  if (msgLower.includes('maximum 6') || msgLower.includes('family is full') || msgLower.includes('limit reached')) {
    return 'This Family has reached the 6-member limit.';
  }
  if (err?.message === 'Network Error' || !err?.response) {
    return 'Unable to reach FINAURA. Please try again.';
  }
  return serverMsg || fallback;
}

export function formatExpiry(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'expired';
    if (diffDays === 1) return 'in 1 day';
    return `in ${diffDays} days`;
  } catch {
    return '';
  }
}

export default function FamilyScreen(): React.ReactElement {
  const navigation = useNavigation<any>();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [family, setFamily] = useState<FamilySummary | null>(null);
  const [receivedInvitations, setReceivedInvitations] = useState<FamilyInvitation[]>([]);
  const [sentInvitations, setSentInvitations] = useState<FamilyInvitation[]>([]);
  const [dashboard, setDashboard] = useState<FamilyDashboard | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Invite Modal State
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // ── Data Fetching ───────────────────────────────────────────
  const fetchFamilyData = useCallback(async () => {
    try {
      // 1. Fetch current family and invitations in parallel
      const [currentFamily, receivedInvites, sentInvites] = await Promise.all([
        getCurrentFamily(),
        getReceivedFamilyInvitations(),
        getSentFamilyInvitations(),
      ]);

      setFamily(currentFamily);
      setReceivedInvitations(receivedInvites || []);
      setSentInvitations(sentInvites || []);

      // 2. Fetch dashboard only if active family exists
      if (currentFamily && currentFamily.id) {
        const dash = await getFamilyDashboard();
        setDashboard(dash);
      } else {
        setDashboard(null);
      }
    } catch (err: any) {
      console.error('[FamilyScreen] fetchFamilyData error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFamilyData();
  }, [fetchFamilyData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFamilyData();
  }, [fetchFamilyData]);

  // Derived Values
  const isOwner = useMemo(() => {
    return family?.role === 'owner';
  }, [family]);

  const memberCount = useMemo(() => {
    if (dashboard?.family?.memberCount) return dashboard.family.memberCount;
    if (family?.members?.length) return family.members.length;
    return 0;
  }, [dashboard, family]);

  const isFamilyFull = memberCount >= 6;

  // ── Handlers ────────────────────────────────────────────────

  const handleSendInvite = async () => {
    const trimmed = inviteEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setInviteError('Please enter a valid email address.');
      return;
    }

    setInviteLoading(true);
    setInviteError(null);

    try {
      await sendFamilyInvitation(trimmed);
      setInviteModalVisible(false);
      setInviteEmail('');
      Alert.alert('Invitation Sent', `A Family invitation was sent to ${trimmed}.`);
      fetchFamilyData();
    } catch (err: any) {
      const msg = getHumanReadableError(err, 'Failed to send invitation.');
      setInviteError(msg);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleAcceptInvite = async (invitationId: string) => {
    setActionLoadingId(`accept-${invitationId}`);
    try {
      await acceptFamilyInvitation(invitationId);
      Alert.alert('Welcome to the Family!', 'You have successfully joined the Family.');
      await fetchFamilyData();
    } catch (err: any) {
      const msg = getHumanReadableError(err, 'Failed to accept invitation.');
      Alert.alert('Error', msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeclineInvite = async (invitationId: string) => {
    setActionLoadingId(`decline-${invitationId}`);
    try {
      await declineFamilyInvitation(invitationId);
      setReceivedInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    } catch (err: any) {
      const msg = getHumanReadableError(err, 'Failed to decline invitation.');
      Alert.alert('Error', msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelInvite = async (invitationId: string) => {
    setActionLoadingId(`cancel-${invitationId}`);
    try {
      await cancelFamilyInvitation(invitationId);
      setSentInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    } catch (err: any) {
      const msg = getHumanReadableError(err, 'Failed to cancel invitation.');
      Alert.alert('Error', msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemoveMember = (member: FamilyMember) => {
    Alert.alert(
      'Remove from Family?',
      `Are you sure you want to remove ${member.name} from this Family? Their individual financial data will remain unchanged.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setActionLoadingId(`remove-${member.userId}`);
            try {
              await removeFamilyMember(member.userId);
              Alert.alert('Member Removed', `${member.name} was removed from the Family.`);
              await fetchFamilyData();
            } catch (err: any) {
              const msg = getHumanReadableError(err, 'Failed to remove member.');
              Alert.alert('Error', msg);
            } finally {
              setActionLoadingId(null);
            }
          },
        },
      ]
    );
  };

  const handleLeaveFamily = () => {
    const isSoleOwner = isOwner && memberCount === 1;

    const title = isSoleOwner ? 'Disband Family?' : 'Leave Family?';
    const message = isSoleOwner
      ? 'As the sole member, leaving will disband this Family. Your individual financial data will remain unchanged.'
      : 'You will lose access to household insights. Your personal financial data will remain unchanged.';

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: isSoleOwner ? 'Disband' : 'Leave',
        style: 'destructive',
        onPress: async () => {
          setActionLoadingId('leave-family');
          try {
            await leaveFamily();
            Alert.alert(
              isSoleOwner ? 'Family Disbanded' : 'Family Left',
              isSoleOwner ? 'Your Family has been closed.' : 'You have left the Family.'
            );
            await fetchFamilyData();
          } catch (err: any) {
            const msg = getHumanReadableError(err, 'Failed to leave family.');
            Alert.alert('Error', msg);
          } finally {
            setActionLoadingId(null);
          }
        },
      },
    ]);
  };

  // ── Render ──────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={BG} />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={TEXT_PRIMARY} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Family & Household</Text>
          </View>
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={BLUE} />
          <Text style={styles.loadingText}>Loading family finances...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const activeMembers: FamilyMember[] = dashboard?.family?.members || family?.members || [];
  const fmi = dashboard?.fmi;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      {/* ── App Header ────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Family & Household</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {family ? `${family.name} • ${memberCount} member${memberCount === 1 ? '' : 's'}` : 'Combined financial overview'}
          </Text>
        </View>
        {isOwner && !isFamilyFull && (
          <TouchableOpacity
            style={styles.headerAddBtn}
            onPress={() => {
              setInviteError(null);
              setInviteEmail('');
              setInviteModalVisible(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Add Family Member"
          >
            <Ionicons name="person-add-outline" size={20} color={BLUE} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BLUE} />}
      >
        {/* ── Privacy Notice Banner ────────────────────────────── */}
        <View style={styles.privacyBanner} accessibilityLabel="Privacy Note">
          <Ionicons name="shield-checkmark" size={18} color={BLUE} />
          <Text style={styles.privacyText}>
            Family insights use combined household totals. Your individual transaction details remain private.
          </Text>
        </View>

        {/* ── Received Invitations ─────────────────────────────── */}
        {receivedInvitations.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionIconWrap, { backgroundColor: PURPLE_LIGHT }]}>
                <Ionicons name="mail-unread" size={18} color={PURPLE} />
              </View>
              <Text style={styles.sectionHeading}>Family Invitations</Text>
            </View>

            {receivedInvitations.map((inv) => {
              const isAccepting = actionLoadingId === `accept-${inv.id}`;
              const isDeclining = actionLoadingId === `decline-${inv.id}`;
              const inFlight = isAccepting || isDeclining;

              return (
                <View key={inv.id} style={styles.inviteItemCard}>
                  <View style={styles.inviteInfoRow}>
                    <Ionicons name="people-circle-outline" size={28} color={PURPLE} />
                    <View style={styles.inviteTextWrap}>
                      <Text style={styles.inviteTitle}>
                        <Text style={styles.boldText}>{inv.inviterName || 'A FINAURA user'}</Text> invited you to join their Family.
                      </Text>
                      {inv.expiresAt ? (
                        <Text style={styles.inviteExpiryText}>Expires {formatExpiry(inv.expiresAt)}</Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.inviteBtnRow}>
                    <TouchableOpacity
                      style={[styles.declineBtn, inFlight && styles.btnDisabled]}
                      onPress={() => handleDeclineInvite(inv.id)}
                      disabled={inFlight}
                      accessibilityRole="button"
                      accessibilityLabel={`Decline invitation from ${inv.inviterName || 'user'}`}
                    >
                      {isDeclining ? (
                        <ActivityIndicator size="small" color={RED} />
                      ) : (
                        <Text style={styles.declineBtnText}>Decline</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.acceptBtn, inFlight && styles.btnDisabled]}
                      onPress={() => handleAcceptInvite(inv.id)}
                      disabled={inFlight}
                      accessibilityRole="button"
                      accessibilityLabel={`Accept invitation from ${inv.inviterName || 'user'}`}
                    >
                      {isAccepting ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.acceptBtnText}>Accept</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Pending Sent Invitations ─────────────────────────── */}
        {sentInvitations.filter((i) => i.status === 'pending').length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionIconWrap, { backgroundColor: AMBER_LIGHT }]}>
                <Ionicons name="paper-plane-outline" size={18} color={AMBER} />
              </View>
              <Text style={styles.sectionHeading}>Pending Invitations</Text>
            </View>

            {sentInvitations
              .filter((i) => i.status === 'pending')
              .map((inv) => {
                const isCancelling = actionLoadingId === `cancel-${inv.id}`;
                return (
                  <View key={inv.id} style={styles.sentInviteRow}>
                    <View style={styles.sentInviteTextCol}>
                      <Text style={styles.sentInviteEmail} numberOfLines={1}>
                        {inv.inviteeEmail || 'Invited User'}
                      </Text>
                      <Text style={styles.sentInviteStatus}>
                        Waiting for response • Expires {formatExpiry(inv.expiresAt)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.cancelInviteBtn, isCancelling && styles.btnDisabled]}
                      onPress={() => handleCancelInvite(inv.id)}
                      disabled={isCancelling}
                      accessibilityRole="button"
                      accessibilityLabel={`Cancel invitation for ${inv.inviteeEmail || 'user'}`}
                    >
                      {isCancelling ? (
                        <ActivityIndicator size="small" color={TEXT_MUTED} />
                      ) : (
                        <Text style={styles.cancelInviteBtnText}>Cancel</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
          </View>
        )}

        {/* ── No-Family Empty State ────────────────────────────── */}
        {!family ? (
          <View style={styles.emptyStateCard}>
            <View style={styles.emptyHeroIconWrap}>
              <Ionicons name="people" size={44} color={BLUE} />
            </View>
            <Text style={styles.emptyHeroTitle}>
              Plan together without losing your individual financial view.
            </Text>
            <Text style={styles.emptyHeroSubtitle}>
              Invite another FINAURA user to create a shared household view of income, spending and financial health. Your personal transactions and individual FMI remain private.
            </Text>

            <TouchableOpacity
              style={styles.primaryAddBtn}
              onPress={() => {
                setInviteError(null);
                setInviteEmail('');
                setInviteModalVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Add Family Member"
            >
              <Ionicons name="person-add" size={18} color="#FFFFFF" />
              <Text style={styles.primaryAddBtnText}>Add Family Member</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ── Active Family Dashboard Content ─────────────────── */
          <>
            {/* Family Header Card */}
            <View style={styles.familyHeaderCard}>
              <View style={styles.familyHeaderLeft}>
                <View style={styles.familyIconBadge}>
                  <Ionicons name="home-outline" size={24} color={PURPLE} />
                </View>
                <View style={styles.familyHeaderTextCol}>
                  <Text style={styles.familyName}>{family.name || 'My Family'}</Text>
                  <Text style={styles.familyMemberSub}>
                    {memberCount} active member{memberCount === 1 ? '' : 's'} (limit 6)
                  </Text>
                </View>
              </View>
              <View style={[styles.roleBadge, isOwner ? styles.roleBadgeOwner : styles.roleBadgeMember]}>
                <Text style={[styles.roleBadgeText, isOwner ? styles.roleBadgeTextOwner : styles.roleBadgeTextMember]}>
                  {isOwner ? 'Owner' : 'Member'}
                </Text>
              </View>
            </View>

            {/* ── Household Members Roster ─────────────────────── */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderBetween}>
                <View style={styles.sectionHeaderRow}>
                  <View style={[styles.sectionIconWrap, { backgroundColor: BLUE_LIGHT }]}>
                    <Ionicons name="people-outline" size={18} color={BLUE} />
                  </View>
                  <Text style={styles.sectionHeading}>Household Members</Text>
                </View>
                {isOwner && !isFamilyFull ? (
                  <TouchableOpacity
                    onPress={() => {
                      setInviteError(null);
                      setInviteEmail('');
                      setInviteModalVisible(true);
                    }}
                    style={styles.inlineAddBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Invite Family Member"
                  >
                    <Ionicons name="add-circle" size={16} color={BLUE} />
                    <Text style={styles.inlineAddText}>Invite</Text>
                  </TouchableOpacity>
                ) : isOwner && isFamilyFull ? (
                  <Text style={styles.limitReachedText}>Limit reached (6)</Text>
                ) : null}
              </View>

              <View style={styles.membersList}>
                {activeMembers.map((m, idx) => {
                  const isSelfOwner = isOwner && m.role === 'owner';
                  const canRemove = isOwner && m.role !== 'owner';
                  const isRemoving = actionLoadingId === `remove-${m.userId}`;

                  return (
                    <View key={m.userId || idx} style={[styles.memberRow, idx > 0 && styles.memberRowBorder]}>
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>{getInitials(m.name)}</Text>
                      </View>
                      <View style={styles.memberTextCol}>
                        <Text style={styles.memberName} numberOfLines={1}>
                          {m.name || 'Family Member'}
                        </Text>
                        <Text style={styles.memberRoleSub}>
                          {m.role === 'owner' ? 'Family Owner' : 'Member'}
                        </Text>
                      </View>

                      {canRemove && (
                        <TouchableOpacity
                          style={styles.removeMemberBtn}
                          onPress={() => handleRemoveMember(m)}
                          disabled={isRemoving}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${m.name} from Family`}
                        >
                          {isRemoving ? (
                            <ActivityIndicator size="small" color={RED} />
                          ) : (
                            <Text style={styles.removeMemberBtnText}>Remove</Text>
                          )}
                        </TouchableOpacity>
                      )}

                      {isSelfOwner && (
                        <View style={styles.youBadge}>
                          <Text style={styles.youBadgeText}>You (Owner)</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>

            {/* ── Family FMI Hero Card ─────────────────────────── */}
            {fmi ? (
              <View style={styles.fmiCard}>
                <View style={styles.fmiHeaderRow}>
                  <View style={styles.fmiTitleWrap}>
                    <Text style={styles.fmiCardLabel}>Family Financial Maturity Index</Text>
                    <Text style={styles.fmiCardSub}>
                      Based on your household's combined saving, spending and behavioral patterns.
                    </Text>
                  </View>
                </View>

                {/* Score & Label display */}
                <View style={styles.fmiScoreHero}>
                  <View style={[styles.scoreCircle, { borderColor: getFmiColor(fmi.score) }]}>
                    <Text style={[styles.fmiScoreNumber, { color: getFmiColor(fmi.score) }]}>
                      {Math.round(fmi.score)}
                    </Text>
                    <Text style={styles.fmiScoreOutOf}>/ 100</Text>
                  </View>
                  <View style={styles.fmiRatingBadgeWrap}>
                    <View style={[styles.fmiRatingBadge, { backgroundColor: `${getFmiColor(fmi.score)}18` }]}>
                      <Text style={[styles.fmiRatingText, { color: getFmiColor(fmi.score) }]}>
                        {fmi.fmiLabel || 'Evaluating'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* ── Three Pillars ─────────────────────────────── */}
                <View style={styles.pillarsContainer}>
                  {/* Pillar 1: Saving Discipline */}
                  <View style={styles.pillarRow}>
                    <View style={styles.pillarTop}>
                      <View style={styles.pillarTitleCol}>
                        <Text style={styles.pillarName}>Saving Discipline</Text>
                        <Text style={styles.pillarWeight}>40% Weight</Text>
                      </View>
                      <Text style={[styles.pillarScore, { color: getFmiColor(fmi.pillars.D1_savingDiscipline.score) }]}>
                        {Math.round(fmi.pillars.D1_savingDiscipline.score)}/100
                      </Text>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(100, Math.max(0, fmi.pillars.D1_savingDiscipline.score))}%`,
                            backgroundColor: getFmiColor(fmi.pillars.D1_savingDiscipline.score),
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.pillarDetail}>{fmi.pillars.D1_savingDiscipline.detail}</Text>
                  </View>

                  {/* Pillar 2: Spending Control */}
                  <View style={styles.pillarRow}>
                    <View style={styles.pillarTop}>
                      <View style={styles.pillarTitleCol}>
                        <Text style={styles.pillarName}>Spending Control</Text>
                        <Text style={styles.pillarWeight}>30% Weight</Text>
                      </View>
                      <Text style={[styles.pillarScore, { color: getFmiColor(fmi.pillars.D2_spendingControl.score) }]}>
                        {Math.round(fmi.pillars.D2_spendingControl.score)}/100
                      </Text>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(100, Math.max(0, fmi.pillars.D2_spendingControl.score))}%`,
                            backgroundColor: getFmiColor(fmi.pillars.D2_spendingControl.score),
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.pillarDetail}>{fmi.pillars.D2_spendingControl.detail}</Text>
                  </View>

                  {/* Pillar 3: Behavioral Stability */}
                  <View style={styles.pillarRow}>
                    <View style={styles.pillarTop}>
                      <View style={styles.pillarTitleCol}>
                        <Text style={styles.pillarName}>Behavioral Stability</Text>
                        <Text style={styles.pillarWeight}>30% Weight</Text>
                      </View>
                      <Text style={[styles.pillarScore, { color: getFmiColor(fmi.pillars.D3_behavioralRisk.score) }]}>
                        {Math.round(fmi.pillars.D3_behavioralRisk.score)}/100
                      </Text>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(100, Math.max(0, fmi.pillars.D3_behavioralRisk.score))}%`,
                            backgroundColor: getFmiColor(fmi.pillars.D3_behavioralRisk.score),
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.pillarDetail}>{fmi.pillars.D3_behavioralRisk.detail}</Text>
                  </View>
                </View>
              </View>
            ) : null}

            {/* ── Household Financial Summary ──────────────────── */}
            {dashboard ? (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <View style={[styles.sectionIconWrap, { backgroundColor: GREEN_LIGHT }]}>
                    <Ionicons name="bar-chart-outline" size={18} color={GREEN} />
                  </View>
                  <Text style={styles.sectionHeading}>Household Financial Summary</Text>
                </View>

                {/* 2x3 Metric Grid */}
                <View style={styles.metricGrid}>
                  {/* Income */}
                  <View style={styles.metricTile}>
                    <Text style={styles.metricTileLabel}>Combined Monthly Income</Text>
                    <Text style={styles.metricTileValue}>
                      {formatINR(dashboard.income.effectiveMonthlyIncome)}
                    </Text>
                    <Text style={styles.metricTileSub}>Declared & actual pool</Text>
                  </View>

                  {/* Need Spending */}
                  <View style={styles.metricTile}>
                    <Text style={styles.metricTileLabel}>Need Spending</Text>
                    <Text style={styles.metricTileValue}>
                      {formatINR(dashboard.spending.need)}
                    </Text>
                    <Text style={styles.metricTileSub}>Essential living costs</Text>
                  </View>

                  {/* Want Spending */}
                  <View style={styles.metricTile}>
                    <Text style={styles.metricTileLabel}>Want Spending</Text>
                    <Text style={styles.metricTileValue}>
                      {formatINR(dashboard.spending.want)}
                    </Text>
                    <Text style={styles.metricTileSub}>Discretionary lifestyle</Text>
                  </View>

                  {/* Invested This Month */}
                  <View style={styles.metricTile}>
                    <Text style={styles.metricTileLabel}>Invested This Month</Text>
                    <Text style={[styles.metricTileValue, { color: GREEN }]}>
                      {formatINR(dashboard.investments.monthlyFlow)}
                    </Text>
                    <Text style={styles.metricTileSub}>Wealth & savings flow</Text>
                  </View>

                  {/* Investment Rate */}
                  <View style={styles.metricTile}>
                    <Text style={styles.metricTileLabel}>Investment Rate</Text>
                    <Text style={[styles.metricTileValue, { color: BLUE }]}>
                      {dashboard.investments.investmentRatePercent || 0}%
                    </Text>
                    <Text style={styles.metricTileSub}>Of effective income</Text>
                  </View>

                  {/* Net Cash Position */}
                  <View style={styles.metricTile}>
                    <Text style={styles.metricTileLabel}>Net Cash Position</Text>
                    <Text
                      style={[
                        styles.metricTileValue,
                        { color: dashboard.cashFlow.netCashPosition >= 0 ? '#059669' : RED },
                      ]}
                    >
                      {formatINR(dashboard.cashFlow.netCashPosition)}
                    </Text>
                    <Text style={styles.metricTileSub}>Income minus outflow</Text>
                  </View>
                </View>

                {/* Clear Totals Sub-banner */}
                <View style={styles.outflowNotice}>
                  <Text style={styles.outflowNoticeText}>
                    Total Outflow: <Text style={styles.boldText}>{formatINR(dashboard.cashFlow.totalOutflow)}</Text>
                    {'  '}•{'  '}
                    Household Spending (Need + Want): <Text style={styles.boldText}>{formatINR(dashboard.spending.totalNonInvestment)}</Text>
                  </Text>
                </View>
              </View>
            ) : null}

            {/* ── Type Breakdown ───────────────────────────────── */}
            {dashboard?.typeBreakdown && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <View style={[styles.sectionIconWrap, { backgroundColor: BLUE_LIGHT }]}>
                    <Ionicons name="pie-chart-outline" size={18} color={BLUE} />
                  </View>
                  <Text style={styles.sectionHeading}>Outflow by Type</Text>
                </View>

                {/* Progress-like Segment Bar */}
                <View style={styles.typeBarTrack}>
                  <View
                    style={[
                      styles.typeBarSegment,
                      {
                        flex: Math.max(1, dashboard.typeBreakdown.need.percentageOfOutflow || 1),
                        backgroundColor: '#3B82F6',
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.typeBarSegment,
                      {
                        flex: Math.max(1, dashboard.typeBreakdown.want.percentageOfOutflow || 1),
                        backgroundColor: '#F59E0B',
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.typeBarSegment,
                      {
                        flex: Math.max(1, dashboard.typeBreakdown.investment.percentageOfOutflow || 1),
                        backgroundColor: '#10B981',
                      },
                    ]}
                  />
                </View>

                {/* Breakdown Legend Rows */}
                <View style={styles.typeLegendCol}>
                  <View style={styles.typeLegendRow}>
                    <View style={[styles.typeLegendDot, { backgroundColor: '#3B82F6' }]} />
                    <Text style={styles.typeLegendLabel}>Needs (Essential)</Text>
                    <Text style={styles.typeLegendAmount}>{formatINR(dashboard.typeBreakdown.need.amount)}</Text>
                    <Text style={styles.typeLegendPct}>{dashboard.typeBreakdown.need.percentageOfOutflow}%</Text>
                  </View>

                  <View style={styles.typeLegendRow}>
                    <View style={[styles.typeLegendDot, { backgroundColor: '#F59E0B' }]} />
                    <Text style={styles.typeLegendLabel}>Wants (Discretionary)</Text>
                    <Text style={styles.typeLegendAmount}>{formatINR(dashboard.typeBreakdown.want.amount)}</Text>
                    <Text style={styles.typeLegendPct}>{dashboard.typeBreakdown.want.percentageOfOutflow}%</Text>
                  </View>

                  <View style={styles.typeLegendRow}>
                    <View style={[styles.typeLegendDot, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.typeLegendLabel}>Investments (Flow)</Text>
                    <Text style={styles.typeLegendAmount}>{formatINR(dashboard.typeBreakdown.investment.amount)}</Text>
                    <Text style={styles.typeLegendPct}>{dashboard.typeBreakdown.investment.percentageOfOutflow}%</Text>
                  </View>
                </View>
              </View>
            )}

            {/* ── Category Breakdown ───────────────────────────── */}
            {dashboard && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <View style={[styles.sectionIconWrap, { backgroundColor: PURPLE_LIGHT }]}>
                    <Ionicons name="list-outline" size={18} color={PURPLE} />
                  </View>
                  <Text style={styles.sectionHeading}>Top Household Categories</Text>
                </View>

                {dashboard.categoryBreakdown && dashboard.categoryBreakdown.length > 0 ? (
                  <View style={styles.categoriesList}>
                    {dashboard.categoryBreakdown.slice(0, 5).map((cat, idx) => (
                      <View key={cat.category || idx} style={[styles.categoryRow, idx > 0 && styles.categoryRowBorder]}>
                        <View style={styles.catRankBadge}>
                          <Text style={styles.catRankText}>{idx + 1}</Text>
                        </View>
                        <Text style={styles.catName} numberOfLines={1}>
                          {cat.category}
                        </Text>
                        <Text style={styles.catAmount}>{formatINR(cat.amount)}</Text>
                        <View style={styles.catPctPill}>
                          <Text style={styles.catPctText}>{cat.percentageOfOutflow}%</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyCatWrap}>
                    <Text style={styles.emptyCatText}>No category spending recorded this month.</Text>
                  </View>
                )}
              </View>
            )}

            {/* ── Deterministic Household Insights ─────────────── */}
            {fmi?.insights && fmi.insights.length > 0 && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <View style={[styles.sectionIconWrap, { backgroundColor: AMBER_LIGHT }]}>
                    <Ionicons name="bulb-outline" size={18} color={AMBER} />
                  </View>
                  <Text style={styles.sectionHeading}>Household Insights</Text>
                </View>

                <View style={styles.insightsList}>
                  {fmi.insights.map((insight, idx) => (
                    <View key={idx} style={styles.insightItem}>
                      <Ionicons name="sparkles" size={16} color={AMBER} style={styles.insightIcon} />
                      <Text style={styles.insightText}>{insight}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── Member Actions: Leave / Disband ─────────────── */}
            <View style={styles.actionsCard}>
              {!isOwner ? (
                <TouchableOpacity
                  style={styles.leaveBtn}
                  onPress={handleLeaveFamily}
                  disabled={actionLoadingId === 'leave-family'}
                  accessibilityRole="button"
                  accessibilityLabel="Leave Family"
                >
                  {actionLoadingId === 'leave-family' ? (
                    <ActivityIndicator size="small" color={RED} />
                  ) : (
                    <>
                      <Ionicons name="exit-outline" size={18} color={RED} />
                      <Text style={styles.leaveBtnText}>Leave Family</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : memberCount === 1 ? (
                <TouchableOpacity
                  style={styles.leaveBtn}
                  onPress={handleLeaveFamily}
                  disabled={actionLoadingId === 'leave-family'}
                  accessibilityRole="button"
                  accessibilityLabel="Disband Family"
                >
                  {actionLoadingId === 'leave-family' ? (
                    <ActivityIndicator size="small" color={RED} />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={18} color={RED} />
                      <Text style={styles.leaveBtnText}>Disband Family</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={styles.ownerLeaveNotice}>
                  <Ionicons name="information-circle-outline" size={18} color={TEXT_MUTED} />
                  <Text style={styles.ownerLeaveNoticeText}>
                    Remove other members before disbanding this Family.
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* ── Add Family Member Modal ────────────────────────────── */}
      <Modal
        visible={inviteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleCol}>
                <Text style={styles.modalTitle}>Add Family Member</Text>
                <Text style={styles.modalSubtitle}>Invite a registered FINAURA user by exact email</Text>
              </View>
              <TouchableOpacity
                onPress={() => setInviteModalVisible(false)}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Close modal"
              >
                <Ionicons name="close" size={20} color={TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>

            {inviteError ? (
              <View style={styles.modalErrorBanner}>
                <Ionicons name="alert-circle" size={16} color={RED} />
                <Text style={styles.modalErrorText}>{inviteError}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                style={styles.textInput}
                value={inviteEmail}
                onChangeText={(text) => {
                  setInviteEmail(text);
                  if (inviteError) setInviteError(null);
                }}
                placeholder="rhea@example.com"
                placeholderTextColor={TEXT_MUTED}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Family member email address"
              />
              <Text style={styles.inputHelpText}>
                The user must have an active FINAURA account.
              </Text>
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setInviteModalVisible(false)}
                disabled={inviteLoading}
                accessibilityRole="button"
                accessibilityLabel="Cancel invitation"
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, inviteLoading && styles.btnDisabled]}
                onPress={handleSendInvite}
                disabled={inviteLoading}
                accessibilityRole="button"
                accessibilityLabel="Send invitation"
              >
                {inviteLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Send Invitation</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Stylesheet ────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: CARD_BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  headerSubtitle: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 1,
  },
  headerAddBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: BLUE_LIGHT,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: TEXT_SECONDARY,
    fontWeight: '500',
  },

  // Privacy Banner
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BLUE_LIGHT,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 10,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 17,
    fontWeight: '500',
  },

  // Sections
  sectionCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeaderBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  inlineAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: BLUE_LIGHT,
  },
  inlineAddText: {
    fontSize: 12,
    fontWeight: '600',
    color: BLUE,
  },
  limitReachedText: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_MUTED,
  },

  // Invitations Received
  inviteItemCard: {
    backgroundColor: BG,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  inviteInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inviteTextWrap: {
    flex: 1,
  },
  inviteTitle: {
    fontSize: 13,
    color: TEXT_PRIMARY,
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '700',
  },
  inviteExpiryText: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  inviteBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  declineBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  declineBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: RED,
  },
  acceptBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: BLUE,
  },
  acceptBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Sent Invitations
  sentInviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginTop: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  sentInviteTextCol: {
    flex: 1,
    marginRight: 10,
  },
  sentInviteEmail: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  sentInviteStatus: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  cancelInviteBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cancelInviteBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },

  // Empty State
  emptyStateCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: 8,
  },
  emptyHeroIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: BLUE_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyHeroTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  emptyHeroSubtitle: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  primaryAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: BLUE,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryAddBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Family Header Card
  familyHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  familyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  familyIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: PURPLE_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  familyHeaderTextCol: {
    flex: 1,
  },
  familyName: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  familyMemberSub: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeOwner: {
    backgroundColor: PURPLE_LIGHT,
  },
  roleBadgeMember: {
    backgroundColor: BLUE_LIGHT,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  roleBadgeTextOwner: {
    color: PURPLE,
  },
  roleBadgeTextMember: {
    color: BLUE,
  },

  // Members Roster
  membersList: {
    marginTop: 6,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  memberRowBorder: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  memberTextCol: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  memberRoleSub: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginTop: 1,
  },
  removeMemberBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  removeMemberBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: RED,
  },
  youBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  youBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_MUTED,
  },

  // Family FMI Hero Card
  fmiCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  fmiHeaderRow: {
    marginBottom: 14,
  },
  fmiTitleWrap: {
    flex: 1,
  },
  fmiCardLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  fmiCardSub: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 3,
    lineHeight: 16,
  },
  fmiScoreHero: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  scoreCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG,
  },
  fmiScoreNumber: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
  },
  fmiScoreOutOf: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_MUTED,
    marginTop: -4,
  },
  fmiRatingBadgeWrap: {
    marginTop: 10,
  },
  fmiRatingBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
  },
  fmiRatingText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Pillars
  pillarsContainer: {
    marginTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 14,
  },
  pillarRow: {
    backgroundColor: BG,
    borderRadius: 10,
    padding: 10,
  },
  pillarTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  pillarTitleCol: {
    flex: 1,
  },
  pillarName: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  pillarWeight: {
    fontSize: 10,
    color: TEXT_MUTED,
  },
  pillarScore: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: 4,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  pillarDetail: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    marginTop: 3,
    lineHeight: 15,
  },

  // Financial Summary Grid
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginTop: 10,
  },
  metricTile: {
    width: '50%',
    padding: 6,
  },
  metricTileLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_MUTED,
    marginBottom: 4,
  },
  metricTileValue: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.3,
  },
  metricTileSub: {
    fontSize: 10,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  outflowNotice: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  outflowNoticeText: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    lineHeight: 16,
  },

  // Type Breakdown
  typeBarTrack: {
    height: 14,
    borderRadius: 7,
    flexDirection: 'row',
    overflow: 'hidden',
    marginVertical: 12,
    backgroundColor: '#E2E8F0',
  },
  typeBarSegment: {
    height: '100%',
  },
  typeLegendCol: {
    gap: 8,
  },
  typeLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  typeLegendLabel: {
    flex: 1,
    fontSize: 12,
    color: TEXT_PRIMARY,
    fontWeight: '500',
  },
  typeLegendAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginRight: 10,
  },
  typeLegendPct: {
    fontSize: 11,
    color: TEXT_MUTED,
    width: 36,
    textAlign: 'right',
  },

  // Category Breakdown
  categoriesList: {
    marginTop: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
  },
  categoryRowBorder: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  catRankBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  catRankText: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT_MUTED,
  },
  catName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  catAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginRight: 10,
  },
  catPctPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
  },
  catPctText: {
    fontSize: 10,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  emptyCatWrap: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  emptyCatText: {
    fontSize: 12,
    color: TEXT_MUTED,
  },

  // Insights
  insightsList: {
    marginTop: 8,
    gap: 8,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: BG,
    padding: 10,
    borderRadius: 10,
    gap: 8,
  },
  insightIcon: {
    marginTop: 2,
  },
  insightText: {
    flex: 1,
    fontSize: 12,
    color: TEXT_PRIMARY,
    lineHeight: 17,
  },

  // Actions Card (Leave / Disband)
  actionsCard: {
    marginTop: 8,
    alignItems: 'center',
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  leaveBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: RED,
  },
  ownerLeaveNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 12,
  },
  ownerLeaveNoticeText: {
    fontSize: 12,
    color: TEXT_MUTED,
  },
  btnDisabled: {
    opacity: 0.6,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalHeaderTitleCol: {
    flex: 1,
    marginRight: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  modalSubtitle: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  modalErrorText: {
    flex: 1,
    fontSize: 12,
    color: RED,
    lineHeight: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  inputHelpText: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginTop: 4,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  modalSubmitBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: BLUE,
  },
  modalSubmitBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
