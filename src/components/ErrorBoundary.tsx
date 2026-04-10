import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = this.state.error?.message || 'An unknown error occurred';
      try {
        // Try to parse if it's our custom Firestore error JSON
        const parsed = JSON.parse(errorMessage);
        if (parsed.error) {
          errorMessage = parsed.error;
        }
      } catch (e) {
        // Not JSON, use as is
      }

      return (
        <div className="p-8 max-w-2xl mx-auto mt-10 bg-blood/10 border-2 border-blood text-center">
          <h2 className="text-2xl font-serif font-black italic text-blood mb-4 uppercase tracking-widest">System Error</h2>
          <p className="text-blood font-mono text-sm mb-8">{errorMessage}</p>
          <button
            className="px-6 py-2 bg-blood text-paper font-mono text-xs uppercase tracking-widest hover:bg-blood-hover transition-colors"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Retry Operation
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
