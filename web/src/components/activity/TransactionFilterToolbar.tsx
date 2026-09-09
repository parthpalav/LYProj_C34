import React from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { CANONICAL_CATEGORIES, VALID_TRANSACTION_TYPES } from '../../types';
import type { DateFilterOption, SortOption } from '../../hooks/useTransactions';
import { Button } from '../ui/Button';

export interface TransactionFilterToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  categoryFilter: string;
  onCategoryChange: (cat: string) => void;
  typeFilter: string;
  onTypeChange: (type: string) => void;
  dateFilter: DateFilterOption;
  onDateFilterChange: (opt: DateFilterOption) => void;
  customStartDate: string;
  onCustomStartDateChange: (val: string) => void;
  customEndDate: string;
  onCustomEndDateChange: (val: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  onResetFilters: () => void;
  onAddClick?: () => void;
  isFiltered: boolean;
}

const DATE_LABELS: Record<DateFilterOption, string> = {
  all: 'All Time',
  this_month: 'This Month',
  last_month: 'Last Month',
  last_3_months: 'Last 3 Months',
  custom: 'Custom Range',
};

export const TransactionFilterToolbar: React.FC<TransactionFilterToolbarProps> = ({
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  typeFilter,
  onTypeChange,
  dateFilter,
  onDateFilterChange,
  customStartDate,
  onCustomStartDateChange,
  customEndDate,
  onCustomEndDateChange,
  sortBy,
  onSortChange,
  onResetFilters,
  onAddClick,
  isFiltered,
}) => {
  return (
    <div className="activity-toolbar-wrapper">
      <div className="activity-toolbar">
        {/* Search Input */}
        <div className="toolbar-search-wrap">
          <Search size={15} className="search-icon" aria-hidden="true" />
          <input
            type="text"
            className="toolbar-search-input"
            placeholder="Search descriptions, categories..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search transactions"
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => onSearchChange('')}
              aria-label="Clear search text"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Controls Row */}
        <div className="toolbar-controls-row">
          {/* Category Filter */}
          <div className="toolbar-select-wrap">
            <select
              className="toolbar-select"
              value={categoryFilter}
              onChange={(e) => onCategoryChange(e.target.value)}
              aria-label="Filter by category"
            >
              <option value="ALL">All Categories</option>
              {CANONICAL_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="toolbar-select-wrap">
            <select
              className="toolbar-select"
              value={typeFilter}
              onChange={(e) => onTypeChange(e.target.value)}
              aria-label="Filter by spend type"
            >
              <option value="ALL">All Types</option>
              {VALID_TRANSACTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div className="toolbar-select-wrap">
            <select
              className="toolbar-select"
              value={dateFilter}
              onChange={(e) => onDateFilterChange(e.target.value as DateFilterOption)}
              aria-label="Filter by date period"
            >
              <option value="all">All Time</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="last_3_months">Last 3 Months</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Custom Date Pickers */}
          {dateFilter === 'custom' && (
            <div className="custom-date-inputs">
              <input
                type="date"
                className="toolbar-date-input"
                value={customStartDate}
                onChange={(e) => onCustomStartDateChange(e.target.value)}
                aria-label="Start date"
              />
              <span className="date-separator">to</span>
              <input
                type="date"
                className="toolbar-date-input"
                value={customEndDate}
                onChange={(e) => onCustomEndDateChange(e.target.value)}
                aria-label="End date"
              />
            </div>
          )}

          {/* Sort */}
          <div className="toolbar-select-wrap">
            <select
              className="toolbar-select"
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              aria-label="Sort transactions"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="amount_desc">Highest amount</option>
              <option value="amount_asc">Lowest amount</option>
            </select>
          </div>

          {/* Mobile-only Add Transaction CTA if provided */}
          {onAddClick && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onAddClick}
              className="mobile-toolbar-add-btn"
            >
              <span>+ Add</span>
            </Button>
          )}
        </div>
      </div>

      {/* Active Filter Chips Strip */}
      {isFiltered && (
        <div className="toolbar-chips-strip" role="region" aria-label="Active filters">
          <span className="chips-label">
            <SlidersHorizontal size={12} aria-hidden="true" />
            <span>Active filters:</span>
          </span>

          <div className="chips-list">
            {searchQuery.trim() && (
              <span className="filter-chip">
                <span>"{searchQuery.trim()}"</span>
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label="Remove search filter"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {categoryFilter !== 'ALL' && (
              <span className="filter-chip">
                <span>Category: {categoryFilter}</span>
                <button
                  type="button"
                  onClick={() => onCategoryChange('ALL')}
                  aria-label="Remove category filter"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {typeFilter !== 'ALL' && (
              <span className="filter-chip">
                <span>Type: {typeFilter}</span>
                <button
                  type="button"
                  onClick={() => onTypeChange('ALL')}
                  aria-label="Remove type filter"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {dateFilter !== 'all' && (
              <span className="filter-chip">
                <span>Period: {DATE_LABELS[dateFilter] || dateFilter}</span>
                <button
                  type="button"
                  onClick={() => onDateFilterChange('all')}
                  aria-label="Remove date period filter"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            <button
              type="button"
              className="clear-all-chips-btn"
              onClick={onResetFilters}
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
