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
    <div className={`auth-rule-item ${valid ? 'rule-valid' : 'rule-invalid'}`}>
      {valid ? (
        <Check size={12} className="rule-icon-check" />
      ) : (
        <X size={12} className="rule-icon-cross" />
      )}
      <span>{label}</span>
    </div>
  );

  return (
    <AuthLayout
      title="Create account"
      subtitle="Start your journey to structured financial intelligence"
    >
      {error && (
        <div role="alert" className="auth-error-alert">
          <AlertCircle size={16} className="auth-error-icon" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="auth-form-root">
        <Input
          label="Full Name"
          type="text"
          name="name"
          autoComplete="name"
          required
          placeholder="Parth Palav"
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
          placeholder="Create a secure password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leftIcon={<Lock size={16} />}
        />

        {/* Password requirements indicators */}
        <div className="auth-rules-box">
          <div className="auth-rules-grid">
            {renderRule('8+ characters', hasMinLength)}
            {renderRule('Uppercase letter', hasUpper)}
            {renderRule('Lowercase letter', hasLower)}
            {renderRule('Number (0-9)', hasNumber)}
            {renderRule('Special symbol (@$!%*?&)', hasSpecial)}
          </div>
        </div>

        <PasswordInput
          label="Confirm Password"
          name="confirmPassword"
          autoComplete="new-password"
          required
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          leftIcon={<Lock size={16} />}
          error={
            confirmPassword.length > 0 && !passwordsMatch
              ? 'Passwords do not match'
              : undefined
          }
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isSubmitting}
          className="auth-submit-btn"
        >
          Create Account
        </Button>
      </form>

      <div className="auth-switch-prompt">
        Already have an account?{' '}
        <Link to="/login" className="auth-switch-link">
          Sign in
        </Link>
      </div>
    </AuthLayout>
  );
};
