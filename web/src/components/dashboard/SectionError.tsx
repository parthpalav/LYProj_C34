import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';

interface SectionErrorProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const SectionError: React.FC<SectionErrorProps> = ({
  message = 'This financial data is temporarily unavailable.',
  onRetry,
  className = '',
}) => {
  return (
    <div className={`section-error-box ${className}`} role="alert">
      <div className="section-error-content">
        <AlertCircle size={18} className="section-error-icon" aria-hidden="true" />
        <span className="section-error-text">{message}</span>
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          leftIcon={<RotateCcw size={14} />}
        >
          Retry
        </Button>
      )}
    </div>
  );
};
