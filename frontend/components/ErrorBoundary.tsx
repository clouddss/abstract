'use client';

import React, { Component, ReactNode } from 'react';
import { Button } from './ui/Button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Enhanced error logging with more context
    const errorReport = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      errorInfo: {
        componentStack: errorInfo.componentStack,
      },
      context: {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        userId: localStorage.getItem('userId') || 'anonymous',
      },
    };

    // Log to error reporting service in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to Sentry or similar service
      // For now, send to console with structured data
      console.error('Production error report:', errorReport);
      
      // Could also send to an API endpoint for tracking
      try {
        fetch('/api/errors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(errorReport),
        }).catch(() => {
          // Ignore fetch errors to prevent infinite loops
        });
      } catch {
        // Ignore any errors in error reporting
      }
    } else {
      console.error('Development error report:', errorReport);
    }

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      // Default error UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-gray-800 rounded-lg p-6 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </div>

            <h2 className="text-xl font-semibold text-white mb-2">
              Something went wrong
            </h2>

            <p className="text-gray-400 mb-6">
              An unexpected error occurred. Please try refreshing the page or go back to the homepage.
            </p>

            {/* Show error details in development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 p-4 bg-gray-900 rounded text-left">
                <p className="text-sm font-mono text-red-400 mb-2">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <details className="text-xs text-gray-500">
                    <summary className="cursor-pointer hover:text-gray-400">
                      Component Stack
                    </summary>
                    <pre className="mt-2 overflow-auto">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Page
              </Button>

              <Link href="/">
                <Button variant="default" size="sm" className="gap-2">
                  <Home className="w-4 h-4" />
                  Go Home
                </Button>
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for using error boundary programmatically
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  // Enhanced error throwing with better error context
  const throwError = React.useCallback((error: Error | string) => {
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    
    // Add context to error
    if (errorObj.stack) {
      errorObj.stack += `\n    at useErrorBoundary (${window.location.href})`;
    }
    
    setError(errorObj);
  }, []);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  return {
    throwError,
    resetError,
    hasError: !!error,
  };
}

// Async error boundary hook for handling promise rejections
export function useAsyncErrorBoundary() {
  const { throwError } = useErrorBoundary();

  return React.useCallback(
    (error: Error) => {
      // Handle async errors by throwing them in the next tick
      setTimeout(() => throwError(error), 0);
    },
    [throwError]
  );
}

// Wrapper component for common error scenarios
interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
  message?: string;
}

export function ErrorFallback({ 
  error, 
  resetError, 
  message = 'An error occurred' 
}: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
      <h3 className="text-lg font-semibold text-white mb-2">{message}</h3>
      {error && (
        <p className="text-sm text-gray-400 mb-4">
          {error.message || 'Unknown error'}
        </p>
      )}
      {resetError && (
        <Button onClick={resetError} variant="outline" size="sm">
          Try Again
        </Button>
      )}
    </div>
  );
}

// Specialized error boundaries for different application areas
export function TradingErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary 
      fallback={
        <ErrorFallback 
          message="Trading interface error"
          error={undefined}
          resetError={() => window.location.reload()}
        />
      }
    >
      {children}
    </ErrorBoundary>
  );
}

export function ChartErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary 
      fallback={
        <div className="h-64 flex items-center justify-center border border-gray-700 rounded-lg">
          <div className="text-center">
            <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Chart failed to load</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-2 text-xs text-blue-400 hover:text-blue-300"
            >
              Refresh
            </button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

export function WalletErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary 
      fallback={
        <ErrorFallback 
          message="Wallet connection error"
          error={undefined}
          resetError={() => {
            // Clear wallet connection data
            localStorage.removeItem('walletconnect');
            localStorage.removeItem('wagmi.wallet');
            window.location.reload();
          }}
        />
      }
    >
      {children}
    </ErrorBoundary>
  );
}

// Higher-order component for wrapping components with error boundaries
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ReactNode
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}