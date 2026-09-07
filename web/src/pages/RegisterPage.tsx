import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User as UserIcon, Mail, Lock, AlertCircle, Check, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { AuthLayout } from '../layouts/AuthLayout';
import { Input } from '../components/ui/Input';
import { PasswordInput } from '../components/ui/PasswordInput';
import { Button } from '../components/ui/Button';

export const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  // Password rules validation (matching backend Zod schema regex)
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[@$!%*?&]/.test(password);
  const isPasswordValid = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial;
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setError('Please enter your full name (at least 2 characters).');
      return;
    }

    if (!trimmedEmail) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!isPasswordValid) {
      setError('Please satisfy all password complexity requirements.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your password.');
      return;
    }

    setIsSubmitting(true);

    try {
      await register({
        name: trimmedName,
        email: trimmedEmail,
        password,
      });
      navigate('/app');
    } catch (err: any) {
      if (err.response?.status === 409) {
        setError('An account with this email address already exists. Please sign in instead.');
      } else if (err.response?.data?.errors) {
        const firstKey = Object.keys(err.response.data.errors)[0];
        setError(err.response.data.errors[firstKey]);
      } else if (err.response?.data?.message || err.response?.data?.error) {
        setError(err.response.data.message || err.response.data.error);
      } else if (err.code === 'ERR_NETWORK' || !err.response) {
        setError('Unable to connect to FINAURA. Please check your connection and try again.');
      } else {
        setError('Failed to create account. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderRule = (label: string, valid: boolean) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.375rem',
        fontSize: '0.6875rem',
        color: valid ? 'var(--success-text)' : 'var(--text-tertiary)',
      }}
    >
      {valid ? (
        <Check size={12} style={{ color: 'var(--success)' }} />
      ) : (
        <X size={12} style={{ color: 'var(--text-tertiary)' }} />
      )}
      <span>{label}</span>
    </div>
  );

  return (
    <AuthLayout
      title="Create your FINAURA account"
      subtitle="Start understanding and modeling your finances"
    >
      {error && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.625rem',
            padding: '0.75rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--danger-subtle)',
            color: 'var(--danger-text)',
            fontSize: '0.8125rem',
            lineHeight: 1.4,
            marginBottom: '1.25rem',
            border: '1px solid #fecaca',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <Input
          label="Full Name"
          type="text"
          name="name"
          autoComplete="name"
          required
          placeholder="e.g. Parth Palav"
          value={name}
          onChange={(e) => setName(e.target.value)}
          leftIcon={<UserIcon size={16} />}
        />

        <Input
          label="Email Address"
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<Mail size={16} />}
        />

        <PasswordInput
          label="Password"
          name="password"
          autoComplete="new-password"
          required
          placeholder="Min 8 chars with upper, number, symbol"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leftIcon={<Lock size={16} />}
        />

        {/* Password Strength Checklist */}
        {password.length > 0 && (
          <div
            style={{
              padding: '0.625rem 0.75rem',
              backgroundColor: 'var(--bg-app)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              marginBottom: '1rem',
              marginTop: '-0.5rem',
            }}
          >
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
              Password Requirements:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem' }}>
              {renderRule('8+ Characters', hasMinLength)}
              {renderRule('Uppercase letter', hasUpper)}
              {renderRule('Lowercase letter', hasLower)}
              {renderRule('Number (0-9)', hasNumber)}
              {renderRule('Special char (@$!%*?&)', hasSpecial)}
            </div>
          </div>
        )}

        <PasswordInput
          label="Confirm Password"
          name="confirmPassword"
          autoComplete="new-password"
          required
          placeholder="Re-type your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          leftIcon={<Lock size={16} />}
          error={confirmPassword.length > 0 && !passwordsMatch ? 'Passwords do not match' : undefined}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isSubmitting}
          style={{ width: '100%', marginTop: '0.5rem' }}
        >
          Create Account
        </Button>
      </form>

      <div
        style={{
          marginTop: '1.5rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid var(--border-default)',
          textAlign: 'center',
          fontSize: '0.8125rem',
          color: 'var(--text-secondary)',
        }}
      >
        Already have an account?{' '}
        <Link
          to="/login"
          style={{
            color: 'var(--accent-primary)',
            fontWeight: 600,
          }}
        >
          Sign in
        </Link>
      </div>
    </AuthLayout>
  );
};
