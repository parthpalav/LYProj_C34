import React, { useId } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
  fullWidth?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightElement,
  fullWidth = true,
  id,
  style,
  ...props
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div style={{ width: fullWidth ? '100%' : 'auto', marginBottom: '1rem' }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            display: 'block',
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: 'var(--text-secondary)',
            marginBottom: '0.375rem',
          }}
        >
          {label}
        </label>
      )}

      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          width: '100%',
        }}
      >
        {leftIcon && (
          <div
            style={{
              position: 'absolute',
              left: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none',
              color: 'var(--text-tertiary)',
            }}
          >
            {leftIcon}
          </div>
        )}

        <input
          id={inputId}
          style={{
            width: '100%',
            padding: '0.5625rem 0.875rem',
            paddingLeft: leftIcon ? '2.375rem' : '0.875rem',
            paddingRight: rightElement ? '2.5rem' : '0.875rem',
            fontSize: '0.875rem',
            color: 'var(--text-primary)',
            backgroundColor: 'var(--bg-surface)',
            border: error ? '1px solid var(--danger)' : '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-sm)',
            transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
            outline: 'none',
            ...style,
          }}
          {...props}
        />

        {rightElement && (
          <div
            style={{
              position: 'absolute',
              right: '0.5rem',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {rightElement}
          </div>
        )}
      </div>

      {error ? (
        <p
          style={{
            margin: '0.375rem 0 0',
            fontSize: '0.75rem',
            color: 'var(--danger-text)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          {error}
        </p>
      ) : helperText ? (
        <p
          style={{
            margin: '0.375rem 0 0',
            fontSize: '0.75rem',
            color: 'var(--text-tertiary)',
          }}
        >
          {helperText}
        </p>
      ) : null}
    </div>
  );
};
