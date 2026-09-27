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
        <div className="error-banner" role="alert">
          <div className="error-body">
            <strong>Something went wrong showing this itinerary.</strong>
            {this.state.error && (
              <details>
                <summary>Error details</summary>
                <pre>{this.state.error.toString()}</pre>
              </details>
            )}
          </div>
          <div className="error-actions">
            <button type="button" className="dark-pill small" onClick={() => this.setState({ hasError: false, error: null })}>
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
