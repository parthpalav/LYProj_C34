import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  className = '',
  ...props
}) => {
  const isDisabled = disabled || isLoading;

  const classes = [
    'btn-base',
    `btn-${variant}`,
    `btn-${size}`,
    isDisabled ? 'btn-disabled' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button disabled={isDisabled} className={classes} {...props}>
      {isLoading ? (
        <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin" />
      ) : leftIcon ? (
        <span className="btn-icon">{leftIcon}</span>
      ) : null}
      <span>{children}</span>
      {!isLoading && rightIcon && (
        <span className="btn-icon">{rightIcon}</span>
      )}
    </button>
  );
};
