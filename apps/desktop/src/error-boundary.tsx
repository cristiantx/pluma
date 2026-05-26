import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Pluma renderer crashed", error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <main
          style={{
            minHeight: "100vh",
            padding: "24px",
            background: "#1b1511",
            color: "#f4e7d5",
            fontFamily:
              '"IBM Plex Sans", "Segoe UI", "Inter", "Helvetica Neue", Arial, sans-serif'
          }}
        >
          <h1 style={{ marginTop: 0 }}>Renderer error</h1>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              padding: "16px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.08)"
            }}
          >
            {this.state.error.stack ?? this.state.error.message}
          </pre>
        </main>
      );
    }

    return this.props.children;
  }
}
