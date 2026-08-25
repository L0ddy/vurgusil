import React from "react";

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("VurguSil hata yakaladı:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#edeee7",
            fontFamily: "'Instrument Sans', sans-serif",
            padding: 24,
          }}
        >
          <div
            style={{
              maxWidth: 560,
              background: "#f9faf5",
              border: "2px solid #161920",
              borderRadius: 16,
              boxShadow: "6px 7px 0 rgba(22,25,32,0.9)",
              padding: "32px 32px 28px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "#161920",
                  color: "#d8f651",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'Syne', sans-serif",
                  fontWeight: 800,
                  fontSize: 18,
                }}
              >
                !
              </span>
              <p
                style={{
                  fontFamily: "'Syne', sans-serif",
                  fontWeight: 800,
                  fontSize: 22,
                  margin: 0,
                  color: "#161920",
                }}
              >
                Arayüz yüklenirken bir sorun oluştu
              </p>
            </div>
            <p style={{ margin: "0 0 12px", color: "rgba(22,25,32,0.72)", lineHeight: 1.6, fontSize: 14 }}>
              Uygulama beklenmedik bir hatayla karşılaştı. Sayfayı yenilemek genellikle çözer;
              sorun devam ederse tarayıcınızı güncelleyip tekrar deneyin.
            </p>
            <code
              style={{
                display: "block",
                background: "#161920",
                color: "#d8f651",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 12,
                fontFamily: "'Spline Sans Mono', monospace",
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {this.state.error.message || String(this.state.error)}
            </code>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: 18,
                background: "#d8f651",
                color: "#161920",
                border: "2px solid #161920",
                borderRadius: 12,
                padding: "12px 22px",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                boxShadow: "4px 4px 0 rgba(22,25,32,0.9)",
              }}
            >
              Sayfayı Yenile
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
