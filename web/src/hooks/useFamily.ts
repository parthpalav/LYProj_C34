import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import {
  getCurrentFamily,
  getFamilyDashboard,
  getReceivedFamilyInvitations,
  getSentFamilyInvitations,
  sendFamilyInvitation,
  acceptFamilyInvitation,
  declineFamilyInvitation,
  cancelFamilyInvitation,
  leaveFamily as apiLeaveFamily,
  removeFamilyMember as apiRemoveFamilyMember,
} from '../services/api';
import type {
  FamilySummary,
  FamilyDashboard,
  FamilyInvitation,
  FamilyMember,
} from '../types';
import { getHumanReadableFamilyError } from '../utils/familyFormatters';

export function useFamily() {
  const { user } = useAuth();

  const [family, setFamily] = useState<FamilySummary | null>(null);
  const [dashboard, setDashboard] = useState<FamilyDashboard | null>(null);
  const [receivedInvitations, setReceivedInvitations] = useState<FamilyInvitation[]>([]);
  const [sentInvitations, setSentInvitations] = useState<FamilyInvitation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchFamilyData = useCallback(async (isRefresh = false) => {
    if (!user) {
      setFamily(null);
      setDashboard(null);
      setReceivedInvitations([]);
      setSentInvitations([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      // 1. Fetch current family and invitations in parallel
      const [currentFamily, receivedInvites, sentInvites] = await Promise.all([
        getCurrentFamily().catch(() => null),
        getReceivedFamilyInvitations().catch(() => []),
        getSentFamilyInvitations().catch(() => []),
      ]);

      setFamily(currentFamily);
      setReceivedInvitations(receivedInvites || []);
      setSentInvitations(sentInvites || []);

      // 2. Fetch dashboard only if active family exists
      if (currentFamily && currentFamily.id) {
        const dash = await getFamilyDashboard().catch(() => null);
        setDashboard(dash);
      } else {
        setDashboard(null);
      }
    } catch (err: unknown) {
      setError(getHumanReadableFamilyError(err, 'Unable to load household information right now.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    async function loadData() {
      await fetchFamilyData();
    }
    void loadData();
  }, [fetchFamilyData]);

  const refresh = useCallback(() => {
    return fetchFamilyData(true);
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

  const hasActiveHousehold = memberCount > 1;
  const isFamilyFull = memberCount >= 6;
  const members: FamilyMember[] = useMemo(() => {
    return dashboard?.family?.members || family?.members || [];
  }, [dashboard, family]);

  // Actions
  const sendInvite = useCallback(async (rawEmail: string) => {
    const trimmed = rawEmail.trim().toLowerCase();
    setActionLoadingId('send-invite');
    try {
      const newInvite = await sendFamilyInvitation(trimmed);
      setSentInvitations((prev) => [newInvite, ...prev]);
      await fetchFamilyData(true);
      return { success: true };
    } catch (err: unknown) {
      const msg = getHumanReadableFamilyError(err, 'Failed to send invitation.');
      throw new Error(msg);
    } finally {
      setActionLoadingId(null);
    }
  }, [fetchFamilyData]);

  const acceptInvite = useCallback(async (invitationId: string) => {
    setActionLoadingId(`accept-${invitationId}`);
    try {
      await acceptFamilyInvitation(invitationId);
      await fetchFamilyData(true);
      return { success: true };
    } catch (err: unknown) {
      const msg = getHumanReadableFamilyError(err, 'Failed to accept invitation.');
      throw new Error(msg);
    } finally {
      setActionLoadingId(null);
    }
  }, [fetchFamilyData]);

  const declineInvite = useCallback(async (invitationId: string) => {
    setActionLoadingId(`decline-${invitationId}`);
    try {
      await declineFamilyInvitation(invitationId);
      setReceivedInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      return { success: true };
    } catch (err: unknown) {
      const msg = getHumanReadableFamilyError(err, 'Failed to decline invitation.');
      throw new Error(msg);
    } finally {
      setActionLoadingId(null);
    }
  }, []);

  const cancelInvite = useCallback(async (invitationId: string) => {
    setActionLoadingId(`cancel-${invitationId}`);
    try {
      await cancelFamilyInvitation(invitationId);
      setSentInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      return { success: true };
    } catch (err: unknown) {
      const msg = getHumanReadableFamilyError(err, 'Failed to cancel invitation.');
      throw new Error(msg);
    } finally {
      setActionLoadingId(null);
    }
  }, []);

  const removeMember = useCallback(async (memberUserId: string) => {
    setActionLoadingId(`remove-${memberUserId}`);
    try {
      await apiRemoveFamilyMember(memberUserId);
      await fetchFamilyData(true);
      return { success: true };
    } catch (err: unknown) {
      const msg = getHumanReadableFamilyError(err, 'Failed to remove member.');
      throw new Error(msg);
    } finally {
      setActionLoadingId(null);
    }
  }, [fetchFamilyData]);

  const leaveFamily = useCallback(async () => {
    setActionLoadingId('leave-family');
    try {
      await apiLeaveFamily();
      await fetchFamilyData(true);
      return { success: true };
    } catch (err: unknown) {
      const msg = getHumanReadableFamilyError(err, 'Failed to leave family.');
      throw new Error(msg);
    } finally {
      setActionLoadingId(null);
    }
  }, [fetchFamilyData]);

  return {
    family,
    dashboard,
    receivedInvitations,
    sentInvitations,
    members,
    isLoading,
    isRefreshing,
    error,
    actionLoadingId,
    isOwner,
    memberCount,
    hasActiveHousehold,
    isFamilyFull,
    refresh,
    sendInvite,
    acceptInvite,
    declineInvite,
    cancelInvite,
    removeMember,
    leaveFamily,
  };
}
