import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowUpRight, CheckCircle2, Lock, RefreshCw, ShieldCheck, Activity, XCircle } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { PasswordInput } from '../components/ui/PasswordInput';
import { Button } from '../components/ui/Button';
import { Toast } from '../components/ui/Toast';
import { useAuth } from '../hooks/useAuth';
import { changePassword, getSystemStatus, resendVerification, type SystemStatus } from '../services/api';

// Same rule the server enforces, so the form can explain a rejection before sending.
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d\s])\S{8,128}$/;
const apiError = (err: any, fallback: string) => err?.response?.data?.message || err?.response?.data?.error || fallback;

const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [statusFailed, setStatusFailed] = useState(false);
  const [checking, setChecking] = useState(false);

  const checkStatus = useCallback(async () => {
    setChecking(true);
    try {
      setStatus(await getSystemStatus());
      setStatusFailed(false);
    } catch {
      setStatusFailed(true);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return setFormError('Enter your current password.');
    if (!PASSWORD_RULE.test(next)) return setFormError('New password needs 8 or more characters with an uppercase letter, a lowercase letter, a number and a symbol, and no spaces.');
    if (next !== confirm) return setFormError('The new passwords do not match.');
    setFormError(null);
    setSaving(true);
    try {
      const { message } = await changePassword(current, next);
      setCurrent(''); setNext(''); setConfirm('');
      setToast({ message, type: 'success' });
    } catch (err) {
      setFormError(apiError(err, 'Could not change your password. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  const sendVerification = async () => {
    if (!user?.email) return;
    try {
      await resendVerification(user.email);
      setToast({ message: `Verification email sent to ${user.email}.`, type: 'success' });
    } catch (err) {
      setToast({ message: apiError(err, 'Could not send the verification email.'), type: 'error' });
    }
  };

  const signOut = async () => {
    await logout();
    navigate('/login');
  };

  const services: Array<{ name: string; detail: string; ok: boolean | undefined }> = [
    { name: 'API server', detail: status ? `Running for ${formatUptime(status.api.uptimeSeconds)}` : 'Not reachable', ok: statusFailed ? false : status?.api.ok },
    { name: 'Database', detail: status?.database.ok ? 'Connected' : 'Not connected', ok: status?.database.ok },
    { name: 'Classifier (ML service)', detail: status?.ml.ok ? (status.ml.classifierReady ? `Model loaded, answered in ${status.ml.latencyMs} ms` : 'Running, model still loading') : 'Offline: new expenses use keyword rules until it is back', ok: status?.ml.ok },
    { name: 'AI assistant', detail: status?.assistant.ok ? 'Connected' : 'No API key set: the assistant answers direct questions only', ok: status?.assistant.ok },
  ];

  return (
    <div className="account-page">
      <PageHeader title="Settings" category="YOUR ACCOUNT" description="Security, service status and your data." />

      <section className="account-summary" aria-labelledby="settings-security">
        <div className="account-summary-heading">
          <ShieldCheck size={22} aria-hidden="true" />
          <h2 id="settings-security">Sign-in and security</h2>
          <span><CheckCircle2 size={14} aria-hidden="true" /> Signed in</span>
        </div>
        <dl>
          <div><dt>Account email</dt><dd>{user?.email ?? 'Not available'}</dd></div>
          <div>
            <dt>Email verification</dt>
            <dd>
              {user?.isEmailVerified ? 'Verified' : (
                <>Not verified <button type="button" className="settings-inline-btn" onClick={sendVerification}>Send verification email</button></>
              )}
            </dd>
          </div>
        </dl>

        <form onSubmit={submitPassword} noValidate className="settings-password-form">
          <h3>Change password</h3>
          <p className="account-view-note">Changing it signs you out on every other device. You stay signed in here.</p>
          {formError && (
            <div role="alert" className="auth-error-alert">
              <AlertCircle size={16} className="auth-error-icon" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}
          <PasswordInput label="Current password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} leftIcon={<Lock size={16} />} />
          <PasswordInput label="New password" autoComplete="new-password" placeholder="8+ characters, mixed case, a number and a symbol" value={next} onChange={(e) => setNext(e.target.value)} leftIcon={<Lock size={16} />} />
          <PasswordInput label="Confirm new password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} leftIcon={<Lock size={16} />} />
          <Button type="submit" variant="primary" size="md" isLoading={saving}>Change password</Button>
        </form>
      </section>

      <section className="account-summary" aria-labelledby="settings-status">
        <div className="account-summary-heading">
          <Activity size={22} aria-hidden="true" />
          <h2 id="settings-status">Service status</h2>
          <Button type="button" variant="secondary" size="sm" onClick={checkStatus} isLoading={checking} className="settings-status-refresh">
            <RefreshCw size={14} aria-hidden="true" /> Check again
          </Button>
        </div>
        <ul className="settings-status-list">
          {services.map((service) => (
            <li key={service.name}>
              {service.ok ? <CheckCircle2 size={18} className="settings-ok" aria-label="Working" /> : service.ok === false || statusFailed ? <XCircle size={18} className="settings-down" aria-label="Not working" /> : <RefreshCw size={18} className="settings-pending" aria-label="Checking" />}
              <div><strong>{service.name}</strong><p>{status || statusFailed ? service.detail : 'Checking…'}</p></div>
            </li>
          ))}
        </ul>
      </section>

      <div className="account-available">
        <div>
          <span className="next-step-eyebrow">YOUR DATA</span>
          <h2>Keep a copy of your records</h2>
          <p>Download transactions, income, liabilities and monthly summaries as CSV from Reports.</p>
        </div>
        <Link className="next-step-action" to="/app/reports?tab=export">Open exports<ArrowUpRight size={16} aria-hidden="true" /></Link>
      </div>

      <section className="account-summary settings-row">
        <div>
          <h2>Preferences and sign out</h2>
          <p className="account-view-note">Theme, timezone, payment methods and planning assumptions live in your profile.</p>
        </div>
        <div className="settings-row-actions">
          <Link to="/app/profile"><Button type="button" variant="secondary" size="md">Open profile</Button></Link>
          <Button type="button" variant="secondary" size="md" onClick={signOut}>Sign out</Button>
        </div>
      </section>

      <Toast message={toast?.message ?? null} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  );
};

function formatUptime(seconds: number): string {
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86400)} d`;
}

export default SettingsPage;
