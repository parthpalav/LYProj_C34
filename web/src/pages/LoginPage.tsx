import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { AuthLayout } from '../layouts/AuthLayout';
import { Input } from '../components/ui/Input';
import { PasswordInput } from '../components/ui/PasswordInput';
import { Button } from '../components/ui/Button';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please enter both your email and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      await login({ email: trimmedEmail, password });
      navigate('/app');
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('Invalid email or password. Please check your credentials.');
      } else if (err.response?.status === 423) {
        setError(err.response?.data?.message || 'Account is temporarily locked. Please try again in 15 minutes.');
      } else if (err.code === 'ERR_NETWORK' || !err.response) {
        setError('Unable to connect to FINAURA. Please check your connection and try again.');
      } else {
        setError(err.response?.data?.message || err.response?.data?.error || 'Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your financial intelligence workspace"
    >
      {error && (
        <div role="alert" className="auth-error-alert">
          <AlertCircle size={16} className="auth-error-icon" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="auth-form-root">
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
          autoComplete="current-password"
          required
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leftIcon={<Lock size={16} />}
        />

        <div className="auth-forgot-row">
          <Link to="/forgot-password" className="auth-forgot-link">
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isSubmitting}
          className="auth-submit-btn"
        >
          Sign In
        </Button>
      </form>

      <div className="auth-switch-prompt">
        Don’t have an account yet?{' '}
        <Link to="/register" className="auth-switch-link">
          Create account
        </Link>
      </div>
    </AuthLayout>
  );
};
