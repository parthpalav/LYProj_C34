import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, LogOut, SlidersHorizontal, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ThemeSegment } from '../components/ui/ThemeToggle';
import { useAuth } from '../hooks/useAuth';
import { updateUserProfile } from '../services/api';
import { formatCurrencyINR, getUserInitials } from '../utils/formatters';
import type { User } from '../types';
import { readAssumptions } from '../utils/assumptions';
import { PaymentMethodsSection } from '../components/profile/PaymentMethodsSection';
import { DEFAULT_TIMEZONE, TIMEZONE_OPTIONS, todayKey } from '../utils/timezone';

// Defaults matching system financial policy (same as mobile Profile).
const DEFAULT_RETURN_RATE = 0.08;
const DEFAULT_INFLATION_RATE = 0.06;
const DEFAULT_WITHDRAWAL_RATE = 0.04;
const DEFAULT_LIFESTYLE_RATIO = 0.8;
const DEFAULT_EMERGENCY_MONTHS = 6;
const MAX_AVATAR_CHARS = 3_800_000;

const pct = (value: number | null | undefined, fallback: number) => `${Math.round((value ?? fallback) * 100)}%`;

/** Downscales a picked image to a square-ish JPEG data URI so it fits the server's avatar limit. */
function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const size = Math.min(512, side);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('canvas')); return; }
      // Centre-crop to a square, like the mobile picker's 1:1 crop.
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
}

const FIELDS: Array<{ key: string; label: string; hint?: string; type?: string }> = [
  { key: 'name', label: 'Full name', type: 'text' },
  { key: 'income', label: 'Declared monthly income (₹)' },
  { key: 'retAge', label: 'Target retirement age', hint: '40 to 100' },
  { key: 'corpus', label: 'Retirement corpus goal (₹)', hint: 'Leave blank to let FINAURA estimate' },
  { key: 'ret', label: 'Expected return (%)' },
  { key: 'inf', label: 'Expected inflation (%)' },
  { key: 'swr', label: 'Safe withdrawal rate (%)' },
  { key: 'life', label: 'Retirement lifestyle (% of today)' },
  { key: 'ef', label: 'Emergency fund target (months)' },
];

const LINKS = [
  { to: '/app/net-worth?tab=assets', title: 'Assets', subtitle: 'Investments, deposits and savings' },
  { to: '/app/activity?tab=income', title: 'Income streams', subtitle: 'Salary and other receipts' },
  { to: '/app/plan?tab=goals', title: 'Savings goals', subtitle: 'What you are saving towards' },
  { to: '/app/net-worth?tab=liabilities', title: 'Liabilities', subtitle: 'Loans, EMIs, cards and recurring bills' },
  { to: '/app/roundups', title: 'Round-ups', subtitle: 'Save the loose change' },
  { to: '/app/family', title: 'Family & Household', subtitle: 'Combined finances and invitations' },
];

export const ProfilePage: React.FC = () => {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [dob, setDob] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [tzBusy, setTzBusy] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [toast, setToast] = useState<{ message: string | null; type: 'success' | 'error' | 'warning' }>({ message: null, type: 'success' });

  useEffect(() => {
    if (!toast.message) return;
    const t = setTimeout(() => setToast({ message: null, type: 'success' }), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const openEdit = () => {
    setForm({
      name: user?.name || '',
      income: user?.monthlyIncome != null ? String(user.monthlyIncome) : '',
      retAge: user?.retirementAge != null ? String(user.retirementAge) : '',
      corpus: user?.retirementCorpusGoal ? String(user.retirementCorpusGoal) : '',
      ret: String(Math.round((user?.expectedReturnRate ?? DEFAULT_RETURN_RATE) * 100)),
      inf: String(Math.round((user?.expectedInflationRate ?? DEFAULT_INFLATION_RATE) * 100)),
      swr: String(Math.round((user?.expectedWithdrawalRate ?? DEFAULT_WITHDRAWAL_RATE) * 100)),
      life: String(Math.round((user?.lifestyleAdjustmentRatio ?? DEFAULT_LIFESTYLE_RATIO) * 100)),
      ef: String(user?.emergencyFundTargetMonths ?? DEFAULT_EMERGENCY_MONTHS),
    });
    const d = user?.dateOfBirth ? new Date(user.dateOfBirth) : null;
    setDob(d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : '');
    setError('');
    setEditing(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const read = readAssumptions(form);
    if ('error' in read) return setError(read.error);
    const payload: Partial<User> = { ...read.payload, ...(dob ? { dateOfBirth: new Date(dob).toISOString() } : {}) };
    setSaving(true);
    try {
      const res = await updateUserProfile(payload);
      setUser(res?.user ?? ({ ...user, ...payload } as User));
      setEditing(false);
      setToast({ message: 'Assumptions saved. Your forecasts will use the new values.', type: 'success' });
    } catch (err: any) {
      setError(err?.response?.data?.error || "Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const persistAvatar = async (avatar: string | null) => {
    if (!user) return;
    setAvatarBusy(true);
    try {
      const res = await updateUserProfile({ avatar });
      setUser(res?.user ? { ...res.user, avatar: res.user.avatar ?? avatar } : { ...user, avatar });
      setToast({ message: avatar ? 'Photo updated.' : 'Photo removed.', type: 'success' });
    } catch (err: any) {
      const tooLarge = err?.response?.status === 413;
      setToast({ message: tooLarge ? 'That photo is too large. Try a smaller one.' : 'Photo not saved. Check your connection and try again.', type: 'error' });
    } finally {
      setAvatarBusy(false);
    }
  };

  const saveTimezone = async (timezone: string) => {
    if (!user || timezone === (user.timezone ?? DEFAULT_TIMEZONE)) return;
    setTzBusy(true);
    try {
      const res = await updateUserProfile({ timezone });
      setUser(res?.user ?? { ...user, timezone });
      setToast({ message: 'Timezone saved. Dates, bills and reports now follow it.', type: 'success' });
    } catch (err: any) {
      setToast({ message: err?.response?.data?.error || "Couldn't save the timezone. Try again.", type: 'error' });
    } finally {
      setTzBusy(false);
    }
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return setToast({ message: 'Choose an image file.', type: 'warning' });
    try {
      const dataUri = await fileToAvatar(file);
      if (dataUri.length > MAX_AVATAR_CHARS) return setToast({ message: 'That photo is too large. Pick a smaller one.', type: 'warning' });
      await persistAvatar(dataUri);
    } catch {
      setToast({ message: "Couldn't read that photo. Please try another one.", type: 'error' });
    }
  };

  const assumptions = [
    user?.retirementAge ? `retire at ${user.retirementAge}` : null,
    `${pct(user?.expectedReturnRate, DEFAULT_RETURN_RATE)} return`,
    `${pct(user?.expectedInflationRate, DEFAULT_INFLATION_RATE)} inflation`,
    `${pct(user?.expectedWithdrawalRate, DEFAULT_WITHDRAWAL_RATE)} withdrawal`,
    `${user?.emergencyFundTargetMonths ?? DEFAULT_EMERGENCY_MONTHS} months emergency fund`,
  ].filter(Boolean).join(' · ');

  return (
    <div className="parity-page">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: null, type: 'success' })} />
      <PageHeader title="Your profile" category="YOUR ACCOUNT" description="Your details, photo and the assumptions behind every forecast." />

      <section className="parity-card">
        <div className="parity-row">
          <div className="profile-avatar" aria-label="Profile picture">
            {user?.avatar ? <img src={user.avatar} alt="" /> : getUserInitials(user)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>{user?.name || 'Your name'}</h2>
            <p className="parity-muted">{user?.email}</p>
            <div className="parity-actions" style={{ marginTop: 10 }}>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFile} />
              <Button size="sm" variant="outline" leftIcon={<Camera size={14} />} isLoading={avatarBusy} onClick={() => fileRef.current?.click()}>
                {user?.avatar ? 'Change photo' : 'Add photo'}
              </Button>
              {user?.avatar && (
                <Button size="sm" variant="ghost" leftIcon={<Trash2 size={14} />} disabled={avatarBusy} onClick={() => persistAvatar(null)}>Remove photo</Button>
              )}
            </div>
          </div>
        </div>
        <dl className="profile-facts">
          <div className="profile-fact"><dt>Declared income / mo</dt><dd>{user?.monthlyIncome ? formatCurrencyINR(user.monthlyIncome) : '—'}</dd></div>
          <div className="profile-fact"><dt>Retirement age</dt><dd>{user?.retirementAge ?? '—'}</dd></div>
          <div className="profile-fact"><dt>Date of birth</dt><dd>{user?.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</dd></div>
          <div className="profile-fact"><dt>Retirement corpus goal</dt><dd>{user?.retirementCorpusGoal ? formatCurrencyINR(user.retirementCorpusGoal) : 'Estimated'}</dd></div>
        </dl>
      </section>

      <section className="parity-card">
        <div className="parity-row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h2>Planning assumptions</h2>
            <p className="parity-muted">{assumptions}</p>
          </div>
          <Button variant="outline" leftIcon={<SlidersHorizontal size={15} />} onClick={openEdit}>Edit assumptions</Button>
        </div>
      </section>

      <PaymentMethodsSection notify={(message, type) => setToast({ message, type })} />

      <section className="parity-card">
        <div className="parity-row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h2>Appearance</h2>
            <p className="parity-muted">System follows your computer's light or dark setting.</p>
          </div>
          <ThemeSegment />
        </div>
      </section>

      <section className="parity-card">
        <div className="parity-row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h2>Timezone</h2>
            <p className="parity-muted">Sets when days and months start for your reports, bill due dates and card statements.</p>
          </div>
          <select
            aria-label="Timezone"
            className="form-select"
            style={{ maxWidth: 280 }}
            value={user?.timezone ?? DEFAULT_TIMEZONE}
            disabled={tzBusy}
            onChange={(e) => saveTimezone(e.target.value)}
          >
            {TIMEZONE_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      </section>

      <section className="parity-card">
        <h2>Your money</h2>
        <nav className="profile-links" aria-label="Your money">
          {LINKS.map((l) => <Link key={l.to} to={l.to}>{l.title}<span>{l.subtitle}</span></Link>)}
        </nav>
      </section>

      <section className="parity-card">
        <div className="parity-row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h2>Sign out</h2>
            <p className="parity-muted">You can sign back in any time with your email and password.</p>
          </div>
          <Button variant="danger" leftIcon={<LogOut size={15} />} onClick={() => setConfirmSignOut(true)}>Sign out</Button>
        </div>
      </section>

      <Modal isOpen={editing} onClose={() => setEditing(false)} title="Planning assumptions" subtitle="These drive your FIRE plan, forecasts and FMI." maxWidth="620px">
        <form onSubmit={save} className="activity-form">
          {error && <p className="parity-error" role="alert">{error}</p>}
          <div className="parity-grid-2">
            {FIELDS.map((f) => (
              <div key={f.key} className="form-group">
                <label htmlFor={`pf-${f.key}`} className="form-label">{f.label}</label>
                <input
                  id={`pf-${f.key}`}
                  className="form-input"
                  type="text"
                  inputMode={f.type === 'text' ? 'text' : 'decimal'}
                  value={form[f.key] ?? ''}
                  onChange={(e) => { setForm((p) => ({ ...p, [f.key]: e.target.value })); setError(''); }}
                />
                {f.hint && <span className="parity-hint">{f.hint}</span>}
              </div>
            ))}
            <div className="form-group">
              <label htmlFor="pf-dob" className="form-label">Date of birth</label>
              <input id="pf-dob" className="form-input" type="date" max={todayKey()} value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
          </div>
          <div className="modal-footer">
            <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" isLoading={saving}>Save assumptions</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmSignOut}
        onClose={() => setConfirmSignOut(false)}
        onConfirm={async () => { await logout(); navigate('/login'); }}
        title="Sign out of FINAURA?"
        message="You can sign back in any time with your email and password."
        confirmLabel="Sign out"
        variant="danger"
      />
    </div>
  );
};

export default ProfilePage;
