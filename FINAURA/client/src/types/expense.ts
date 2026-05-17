export type ExpenseClassification = 'NEED' | 'WANT' | 'INVESTMENT';

export interface Expense {
  _id?: string;
  amount: number;
  category: string;
  description?: string;
  timestamp: string;
  classification: ExpenseClassification;
  confidence: number;
  reasons: string[];
}
