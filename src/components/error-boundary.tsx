"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportError } from "@/lib/observability/report-error";
import { ErrorState } from "@/components/ui/error-state";

interface Props {
  children: ReactNode;
  /** Identifies the boundary in error reports — "review-form", "ledger-table". */
  source: string;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time crashes so one broken panel doesn't blank the page.
 * Still a class component — React has no hook equivalent for this.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError(error, this.props.source, { componentStack: info.componentStack });
  }

  private reset = () => this.setState({ error: null });

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      this.props.fallback ?? (
        <ErrorState error={this.state.error} onRetry={this.reset} />
      )
    );
  }
}
