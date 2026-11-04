import type { User } from '../types';

/** Validates the assumptions form; returns the payload or the first problem in plain words. */
export function readAssumptions(f: Record<string, string>): { error: string } | { payload: Partial<User> } {
  if (!f.name.trim()) return { error: 'Name cannot be blank.' };
  const retAge = f.retAge.trim() ? Number(f.retAge) : null;
  if (retAge !== null && (!Number.isInteger(retAge) || retAge < 40 || retAge > 100)) return { error: 'Retirement age must be a whole number between 40 and 100.' };
  const income = f.income.trim() ? Number(f.income) : null;
  if (income !== null && (Number.isNaN(income) || income < 0)) return { error: 'Declared monthly income must be zero or more.' };
  const corpus = f.corpus.trim() ? Number(f.corpus) : null;
  if (corpus !== null && (Number.isNaN(corpus) || corpus < 0)) return { error: 'Retirement corpus goal must be zero or more.' };
  const ret = f.ret.trim() ? Number(f.ret) : 8;
  if (Number.isNaN(ret) || ret < 0 || ret > 100) return { error: 'Expected return must be between 0% and 100%.' };
  const inf = f.inf.trim() ? Number(f.inf) : 6;
  if (Number.isNaN(inf) || inf < 0 || inf > 100) return { error: 'Inflation must be between 0% and 100%.' };
  const swr = f.swr.trim() ? Number(f.swr) : 4;
  if (Number.isNaN(swr) || swr <= 0 || swr > 100) return { error: 'Safe withdrawal rate must be between 1% and 100%.' };
  const life = f.life.trim() ? Number(f.life) : 80;
  if (Number.isNaN(life) || life <= 0 || life > 200) return { error: 'Retirement lifestyle must be between 1% and 200% of today.' };
  const ef = f.ef.trim() ? Number(f.ef) : 6;
  if (!Number.isInteger(ef) || ef < 0 || ef > 36) return { error: 'Emergency fund target must be between 0 and 36 months.' };
  return {
    payload: {
      name: f.name.trim(),
      retirementAge: retAge ?? undefined,
      monthlyIncome: income ?? undefined,
      retirementCorpusGoal: corpus ?? 0,
      expectedReturnRate: ret / 100,
      expectedInflationRate: inf / 100,
      expectedWithdrawalRate: swr / 100,
      lifestyleAdjustmentRatio: life / 100,
      emergencyFundTargetMonths: ef,
    },
  };
}
