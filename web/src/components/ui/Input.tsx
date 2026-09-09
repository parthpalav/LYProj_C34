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
  className = '',
  ...props
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div className={`input-group ${fullWidth ? 'input-full-width' : ''}`}>
      {label && (
        <label htmlFor={inputId} className="input-label">
          {label}
        </label>
      )}

      <div className="input-wrapper">
        {leftIcon && (
          <div className="input-left-icon">
            {leftIcon}
          </div>
        )}

        <input
          id={inputId}
          className={[
            'input-field',
            leftIcon ? 'input-has-left-icon' : '',
            rightElement ? 'input-has-right-element' : '',
            error ? 'input-error' : '',
            className,
          ].filter(Boolean).join(' ')}
          {...props}
        />

        {rightElement && (
          <div className="input-right-element">
            {rightElement}
          </div>
        )}
      </div>

      {error ? (
        <p className="input-error-text">{error}</p>
      ) : helperText ? (
        <p className="input-helper-text">{helperText}</p>
      ) : null}
    </div>
  );
};
