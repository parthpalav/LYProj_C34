import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, Key, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AuthLayout } from '../layouts/AuthLayout';
import { Input } from '../components/ui/Input';
import { PasswordInput } from '../components/ui/PasswordInput';
import { Button } from '../components/ui/Button';
import { resetPasswordUser } from '../services/api';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';
  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token.trim()) {
      setError('Please provide the reset token.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      await resetPasswordUser({ token: token.trim(), password });
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2500);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Invalid or expired password reset token.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Set New Password"
      subtitle="Enter your verification token and your new password"
    >
      {success ? (
        <div className="auth-success-card">
          <div className="auth-success-icon-wrap">
            <CheckCircle2 size={24} />
          </div>
          <h2 className="auth-success-title">
            Password Reset Successfully
          </h2>
          <p className="auth-success-msg">
            Your credentials have been securely updated. Redirecting to sign in...
          </p>
          <Link to="/login" className="auth-block-link">
            <Button variant="primary" size="md" className="auth-submit-btn">
              Proceed to Sign In
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="auth-form-root">
          {error && (
            <div role="alert" className="auth-error-alert">
              <AlertCircle size={16} className="auth-error-icon" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <Input
            label="Reset Token"
            type="text"
            required
            placeholder="Paste your reset token here"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            leftIcon={<Key size={16} />}
          />

          <PasswordInput
            label="New Password"
            required
            placeholder="Minimum 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock size={16} />}
          />

          <PasswordInput
            label="Confirm New Password"
            required
            placeholder="Re-type new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            leftIcon={<Lock size={16} />}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            className="auth-submit-btn"
          >
            Reset Password
          </Button>

          <div className="auth-switch-prompt">
            <Link to="/login" className="auth-switch-link">
              Cancel and Return to Sign In
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
};
