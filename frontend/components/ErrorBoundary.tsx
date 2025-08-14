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

    // Log to error reporting service in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to Sentry or similar service
      console.error('Production error:', {
        error: error.toString(),
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
      });
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

  return {
    throwError: (error: Error) => setError(error),
    resetError: () => setError(null),
  };
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