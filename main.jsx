import React from "react";
import { createRoot } from "react-dom/client";
import Root from "./Root.jsx";
import { LangProvider } from "./i18n.jsx";

class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error(error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ fontFamily: "system-ui, sans-serif", color: "#fff", background: "#0f1720", minHeight: "100vh", padding: 20, boxSizing: "border-box" }}>
          <h2 style={{ marginTop: 0 }}>Something went wrong</h2>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13, color: "#ffd0d0" }}>
            {String((this.state.error && this.state.error.stack) || this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <LangProvider>
      <Root />
    </LangProvider>
  </ErrorBoundary>
);
