import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../../ds';
import { Skull } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Catches render/lifecycle errors anywhere below it so a bug shows a recovery
 *  screen instead of a blank white page (the app has a history of exactly this —
 *  see DAILY_STOIC.md's "Bugfix - Blank Page on Load" entries). */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Daily Stoic crashed:', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background-primary p-6 text-center">
        <div className="w-full max-w-md rounded-2xl border border-tertiary bg-background-secondary p-8 shadow-sm">
          <Skull size={40} className="mx-auto mb-4 text-text-secondary" aria-hidden />
          <h1 className="mb-2 font-display text-2xl font-bold text-text-primary">
            Something Interrupted the Reflection
          </h1>
          <p className="mb-6 leading-relaxed text-text-secondary">
            The app hit an unexpected error and couldn't continue. Nothing you've already
            saved was lost — reloading should bring it back.
          </p>
          <Button className="w-full" onClick={this.handleReload}>
            Reload the App
          </Button>
          <details className="mt-5 text-left">
            <summary className="cursor-pointer text-xs font-medium text-text-secondary hover:text-text-primary">
              Technical details
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-background-tertiary p-3 text-left font-mono text-[11px] text-text-secondary">
              {error.message}
              {error.stack ? `\n\n${error.stack}` : ''}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
