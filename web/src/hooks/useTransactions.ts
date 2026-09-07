import { useState, useEffect, useMemo, useCallback } from 'react';
import { getTransactions, createTransaction, updateTransaction, deleteTransaction } from '../services/api';
import type { Transaction, TransactionPayload } from '../types';
import { getTransactionDate } from '../utils/formatters';

export type DateFilterOption = 'all' | 'this_month' | 'last_month' | 'last_3_months' | 'custom';
export type SortOption = 'newest' | 'oldest' | 'amount_desc' | 'amount_asc';

export interface UseTransactionsReturn {
  transactions: Transaction[];
  filteredTransactions: Transaction[];
  paginatedTransactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  categoryFilter: string;
  setCategoryFilter: (cat: string) => void;
  typeFilter: string;
  setTypeFilter: (type: string) => void;
  dateFilter: DateFilterOption;
  setDateFilter: (opt: DateFilterOption) => void;
  customStartDate: string;
  setCustomStartDate: (date: string) => void;
  customEndDate: string;
  setCustomEndDate: (date: string) => void;
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  totalPages: number;
  summary: {
    count: number;
    totalSpend: number;
    needsTotal: number;
    wantsTotal: number;
    investmentsTotal: number;
  };
  refetch: () => Promise<void>;
  add: (payload: TransactionPayload) => Promise<Transaction>;
  edit: (id: string, payload: Partial<TransactionPayload>) => Promise<Transaction>;
  remove: (id: string) => Promise<void>;
  resetFilters: () => void;
}

export function useTransactions(): UseTransactionsReturn {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search & Sort states
  const [searchQuery, _setSearchQuery] = useState<string>('');
  const [categoryFilter, _setCategoryFilter] = useState<string>('ALL');
  const [typeFilter, _setTypeFilter] = useState<string>('ALL');
  const [dateFilter, _setDateFilter] = useState<DateFilterOption>('all');
  const [customStartDate, _setCustomStartDate] = useState<string>('');
  const [customEndDate, _setCustomEndDate] = useState<string>('');
  const [sortBy, _setSortBy] = useState<SortOption>('newest');
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;

  const setSearchQuery = useCallback((q: string) => {
    _setSearchQuery(q);
    setPage(1);
  }, []);

  const setCategoryFilter = useCallback((cat: string) => {
    _setCategoryFilter(cat);
    setPage(1);
  }, []);

  const setTypeFilter = useCallback((type: string) => {
    _setTypeFilter(type);
    setPage(1);
  }, []);

  const setDateFilter = useCallback((opt: DateFilterOption) => {
    _setDateFilter(opt);
    setPage(1);
  }, []);

  const setCustomStartDate = useCallback((date: string) => {
    _setCustomStartDate(date);
    setPage(1);
  }, []);

  const setCustomEndDate = useCallback((date: string) => {
    _setCustomEndDate(date);
    setPage(1);
  }, []);

  const setSortBy = useCallback((sort: SortOption) => {
    _setSortBy(sort);
    setPage(1);
  }, []);

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getTransactions();
      setTransactions(data);
    } catch (err: any) {
      console.error('Failed to load transactions:', err);
      setError(err?.response?.data?.error || err?.response?.data?.message || 'Failed to load transaction records.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (mounted) {
        await fetchTransactions();
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [fetchTransactions]);

  // Filtering & Sorting
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return transactions.filter((tx) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const descMatch = (tx.description || '').toLowerCase().includes(q);
        const catMatch = (tx.category || '').toLowerCase().includes(q);
        const typeMatch = (tx.type || '').toLowerCase().includes(q);
        if (!descMatch && !catMatch && !typeMatch) {
          return false;
        }
      }

      // Category filter
      if (categoryFilter !== 'ALL' && tx.category !== categoryFilter) {
        return false;
      }

      // Type filter
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) {
        return false;
      }

      // Date filter
      const txDate = getTransactionDate(tx);
      if (dateFilter === 'this_month') {
        if (txDate.getFullYear() !== currentYear || txDate.getMonth() !== currentMonth) {
          return false;
        }
      } else if (dateFilter === 'last_month') {
        const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
        const lastMonthYear = lastMonthDate.getFullYear();
        const lastMonthMonth = lastMonthDate.getMonth();
        if (txDate.getFullYear() !== lastMonthYear || txDate.getMonth() !== lastMonthMonth) {
          return false;
        }
      } else if (dateFilter === 'last_3_months') {
        const threeMonthsAgo = new Date(currentYear, currentMonth - 2, 1);
        if (txDate < threeMonthsAgo) {
          return false;
        }
      } else if (dateFilter === 'custom') {
        if (customStartDate) {
          const start = new Date(customStartDate);
          start.setHours(0, 0, 0, 0);
          if (txDate < start) return false;
        }
        if (customEndDate) {
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          if (txDate > end) return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'newest') {
        return getTransactionDate(b).getTime() - getTransactionDate(a).getTime();
      }
      if (sortBy === 'oldest') {
        return getTransactionDate(a).getTime() - getTransactionDate(b).getTime();
      }
      if (sortBy === 'amount_desc') {
        return b.amount - a.amount;
      }
      if (sortBy === 'amount_asc') {
        return a.amount - b.amount;
      }
      return 0;
    });
  }, [transactions, searchQuery, categoryFilter, typeFilter, dateFilter, customStartDate, customEndDate, sortBy]);

  // Summary of filtered dataset
  const summary = useMemo(() => {
    let totalSpend = 0;
    let needsTotal = 0;
    let wantsTotal = 0;
    let investmentsTotal = 0;

    for (const tx of filteredTransactions) {
      const amt = Number(tx.amount) || 0;
      totalSpend += amt;
      if (tx.type === 'Need') {
        needsTotal += amt;
      } else if (tx.type === 'Want') {
        wantsTotal += amt;
      } else if (tx.type === 'Investment') {
        investmentsTotal += amt;
      }
    }

    return {
      count: filteredTransactions.length,
      totalSpend,
      needsTotal,
      wantsTotal,
      investmentsTotal,
    };
  }, [filteredTransactions]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));

  const paginatedTransactions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, page, pageSize]);

  const add = useCallback(async (payload: TransactionPayload): Promise<Transaction> => {
    const created = await createTransaction(payload);
    setTransactions((prev) => [created, ...prev]);
    return created;
  }, []);

  const edit = useCallback(async (id: string, payload: Partial<TransactionPayload>): Promise<Transaction> => {
    const updated = await updateTransaction(id, payload);
    setTransactions((prev) => prev.map((t) => (t.id === id ? updated : t)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string): Promise<void> => {
    await deleteTransaction(id);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const resetFilters = useCallback(() => {
    _setSearchQuery('');
    _setCategoryFilter('ALL');
    _setTypeFilter('ALL');
    _setDateFilter('all');
    _setCustomStartDate('');
    _setCustomEndDate('');
    _setSortBy('newest');
    setPage(1);
  }, []);

  return {
    transactions,
    filteredTransactions,
    paginatedTransactions,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    typeFilter,
    setTypeFilter,
    dateFilter,
    setDateFilter,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    sortBy,
    setSortBy,
    page,
    setPage,
    pageSize,
    totalPages,
    summary,
    refetch: fetchTransactions,
    add,
    edit,
    remove,
    resetFilters,
  };
}
