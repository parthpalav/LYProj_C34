import React from 'react';
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
  onAddClick: () => void;
  isFiltered: boolean;
}

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
    <div className="activity-toolbar">
      <div className="toolbar-search-wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          className="toolbar-search-input"
          placeholder="Search descriptions, categories..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchQuery && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      <div className="toolbar-controls-row">
        {/* Category Filter */}
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

        {/* Type Filter */}
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

        {/* Date Filter */}
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

        {/* Reset Filter Button */}
        {isFiltered && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="reset-filters-btn"
          >
            Reset Filters
          </Button>
        )}

        <div className="toolbar-spacer" />

        {/* Add Transaction CTA */}
        <Button
          type="button"
          variant="primary"
          onClick={onAddClick}
          className="add-activity-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Add Transaction</span>
        </Button>
      </div>
    </div>
  );
};
