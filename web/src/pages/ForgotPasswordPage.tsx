import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AuthLayout } from '../layouts/AuthLayout';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { forgotPasswordUser } from '../services/api';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError('Please enter your email address.');
      return;
    }

    setIsSubmitting(true);

    try {
      await forgotPasswordUser({ email: trimmed });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Unable to process your request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Enter your account email to receive reset instructions"
    >
      {submitted ? (
        <div className="auth-success-card">
          <div className="auth-success-icon-wrap">
            <CheckCircle2 size={24} />
          </div>
          <h2 className="auth-success-title">
            Instructions Dispatched
          </h2>
          <p className="auth-success-msg">
            If an account exists for <strong>{email}</strong>, we have dispatched secure password reset instructions.
          </p>
          <Link to="/login" className="auth-block-link">
            <Button variant="outline" size="md" className="auth-submit-btn">
              Return to Sign In
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
            label="Account Email Address"
            type="email"
            name="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail size={16} />}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            className="auth-submit-btn"
          >
            Send Reset Instructions
          </Button>

          <div className="auth-switch-prompt">
            <Link to="/login" className="auth-switch-link">
              Back to Sign In
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
};
