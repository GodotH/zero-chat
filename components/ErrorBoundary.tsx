import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full items-center justify-center p-6 bg-zinc-950">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-2xl text-center">
            <div className="mx-auto w-12 h-12 bg-red-900/20 rounded-full flex items-center justify-center mb-4">
               <AlertTriangle className="text-red-500" size={24} />
            </div>
            <h2 className="text-lg font-bold text-zinc-200 mb-2">Interface Rendering Error</h2>
            <p className="text-sm text-zinc-500 font-mono mb-4 break-words">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button
              className="flex items-center justify-center gap-2 w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded font-mono text-sm transition-colors"
              onClick={() => window.location.reload()}
            >
              <RefreshCw size={14} /> Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;