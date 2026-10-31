import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { submitOnboarding } from '../services/api';
import { celebrate } from '../utils/celebrate';

const INCOME_TYPES = [
  { id: 'salaried', label: 'Salaried' },
  { id: 'freelancer', label: 'Freelance' },
  { id: 'business', label: 'Business' },
  { id: 'gig', label: 'Gig Economy' },
  { id: 'student', label: 'Student' },
];

const STEPS = [
  { title: 'About you', subtitle: 'So FINAURA can plan around your stage of life.' },
  { title: 'Your income', subtitle: 'A monthly baseline. You can log actual receipts later.' },
  { title: 'Where you are', subtitle: 'The money you can reach today, across bank accounts.' },
  { title: "Where you're headed", subtitle: 'Your retirement target shapes forecasts and your FMI score.' },
];

const num = (v: string) => (v.trim() === '' ? NaN : Number(v));
const digits = (v: string) => v.replace(/[^0-9]/g, '');
const decimal = (v: string) => v.replace(/[^0-9.]/g, '');

/** Four-step setup, same questions and rules as the mobile onboarding. */
export const OnboardingPage: React.FC = () => {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [age, setAge] = useState(user?.age ? String(user.age) : '');
  const [incomeType, setIncomeType] = useState(user?.incomeType || 'salaried');
  const [income, setIncome] = useState(user?.income || user?.monthlyIncome ? String(user?.income || user?.monthlyIncome) : '');
  const [balance, setBalance] = useState(user?.currentBalance ? String(user.currentBalance) : '');
  const [retirementAge, setRetirementAge] = useState(user?.retirementAge ? String(user.retirementAge) : '60');
  const [corpus, setCorpus] = useState(user?.retirementCorpusGoal ? String(user.retirementCorpusGoal) : '');

  /** The first problem on the current step, in plain words; empty when the step is complete. */
  const problem = (): string => {
    if (step === 0) {
      const a = num(age);
      if (!Number.isInteger(a) || a < 16 || a > 100) return 'Enter your age in years (16 to 100).';
    }
    if (step === 1 && !(num(income) >= 0)) return 'Enter your usual monthly income. Use 0 if you have none right now.';
    if (step === 2 && !(num(balance) >= 0)) return 'Enter the money you can reach today. Use 0 if none.';
    if (step === 3) {
      const r = num(retirementAge);
      if (!Number.isInteger(r) || r <= num(age) || r > 100) return `Retirement age must be after your current age (${age}) and at most 100.`;
      if (corpus.trim() && !(num(corpus) >= 0)) return 'Corpus goal must be zero or more, or left blank.';
    }
    return '';
  };

  const next = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = problem();
    if (p) return setError(p);
    setError('');
    if (step < STEPS.length - 1) return setStep(step + 1);
    setSaving(true);
    try {
      const res = await submitOnboarding({
        age: num(age),
        income: num(income),
        monthlyIncome: num(income),
        incomeType,
        retirementAge: num(retirementAge),
        retirementCorpusGoal: num(corpus) || 0,
        currentBalance: num(balance),
      });
      setUser(res.user ?? { ...user!, onboardingComplete: true, onboardingCompleted: true });
      navigate('/app', { replace: true });
      celebrate({ kind: 'confetti', title: "You're all set!", subtitle: 'Your financial pulse is ready. Explore your dashboard.' });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to complete onboarding. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const field = (id: string, label: string, value: string, set: (v: string) => void, opts: { hint?: string; placeholder?: string; mode?: 'numeric' | 'decimal' } = {}) => (
    <div className="form-group">
      <label htmlFor={id} className="form-label">{label}</label>
      <input
        id={id}
        className="form-input"
        inputMode={opts.mode ?? 'decimal'}
        placeholder={opts.placeholder}
        value={value}
        autoFocus
        onChange={(e) => { set(opts.mode === 'numeric' ? digits(e.target.value) : decimal(e.target.value)); setError(''); }}
      />
      {opts.hint && <span className="parity-hint">{opts.hint}</span>}
    </div>
  );

  const steps = [
    <>
      {field('ob-age', 'Age', age, setAge, { placeholder: 'e.g. 27', mode: 'numeric' })}
      <div>
        <span className="form-label">How do you earn?</span>
        <div className="parity-actions" style={{ marginTop: 8 }}>
          {INCOME_TYPES.map((t) => (
            <button key={t.id} type="button" className="parity-chip" aria-pressed={incomeType === t.id} onClick={() => setIncomeType(t.id)}>{t.label}</button>
          ))}
        </div>
      </div>
    </>,
    field('ob-income', 'Monthly income (₹)', income, setIncome, { placeholder: 'e.g. 85000', hint: 'Take-home, after tax.' }),
    field('ob-balance', 'Current liquid balance (₹)', balance, setBalance, { placeholder: 'e.g. 120000', hint: 'Savings and current accounts. Investments come later, under Assets.' }),
    <>
      {field('ob-retire', 'Target retirement age', retirementAge, setRetirementAge, { mode: 'numeric' })}
      {field('ob-corpus', 'Retirement corpus goal (₹)', corpus, setCorpus, { placeholder: 'Optional', hint: 'Leave blank and FINAURA will estimate one from your spending.' })}
    </>,
  ];

  return (
    <div className="onboarding-root">
      <form className="onboarding-card" onSubmit={next}>
        <div className="onboarding-dots" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((_, i) => <i key={i} className={i === step ? 'active' : i < step ? 'done' : ''} />)}
        </div>
        <h1>{STEPS[step].title}</h1>
        <p className="parity-muted">{STEPS[step].subtitle}</p>
        <div className="onboarding-fields" key={step}>{steps[step]}</div>
        {error && <p className="parity-error" role="alert">{error}</p>}
        <div className="parity-row" style={{ justifyContent: 'space-between' }}>
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={() => { setError(''); setStep(step - 1); }} disabled={saving}>Back</Button>
          ) : (
            <Button type="button" variant="ghost" onClick={async () => { await logout(); navigate('/login'); }}>Sign out</Button>
          )}
          <Button type="submit" isLoading={saving}>{step < STEPS.length - 1 ? 'Continue' : 'Finish setup'}</Button>
        </div>
      </form>
    </div>
  );
};

export default OnboardingPage;
