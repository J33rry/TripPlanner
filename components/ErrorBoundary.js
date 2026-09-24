"use client";

import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-card p-6 text-center animate-fade-in">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-accent-rose/10 flex items-center justify-center">
            <span className="text-2xl">💥</span>
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            Something went wrong
          </h3>
          <p className="text-sm text-text-secondary mb-4">
            An unexpected error occurred while rendering the itinerary.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 rounded-lg text-sm font-medium
              bg-primary text-white hover:bg-primary-hover
              transition-colors"
          >
            Try Again
          </button>
          {this.state.error && (
            <details className="mt-4 text-xs text-text-muted text-left">
              <summary className="cursor-pointer">Error details</summary>
              <pre className="mt-2 p-2 bg-black/30 rounded-lg overflow-x-auto">
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
