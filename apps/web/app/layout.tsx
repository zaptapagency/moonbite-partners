import type { ReactNode } from "react";

export const metadata = {
  title: "MoonBite Partners",
  description: "Buy digital products with MBITE.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          margin: 0,
          background: "#0b0e14",
          color: "#e6e8ec",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #1c2230",
            fontWeight: 700,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <a href="/" style={{ color: "inherit", textDecoration: "none" }}>
            🌙 MoonBite Partners
          </a>
          <nav style={{ display: "flex", gap: 20, fontWeight: 500 }}>
            <a href="/library" style={{ color: "#9aa4b2", textDecoration: "none" }}>
              My Library
            </a>
            <a href="/dashboard" style={{ color: "#8ab4ff", textDecoration: "none" }}>
              Merchant dashboard →
            </a>
          </nav>
        </header>
        <main style={{ maxWidth: 960, margin: "0 auto", padding: 24, width: "100%", boxSizing: "border-box", flex: 1 }}>
          {children}
        </main>
        <footer
          style={{
            borderTop: "1px solid #1c2230",
            padding: "20px 24px",
            marginTop: 24,
          }}
        >
          <div
            style={{
              maxWidth: 960,
              margin: "0 auto",
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              alignItems: "center",
              justifyContent: "space-between",
              color: "#7c8699",
              fontSize: 13,
            }}
          >
            <span>© {new Date().getFullYear()} MoonBite Partners · Non-custodial MBITE payments.</span>
            <nav style={{ display: "flex", gap: 16 }}>
              <a href="/terms" style={{ color: "#9aa4b2", textDecoration: "none" }}>
                Terms of Service
              </a>
              <a href="/prohibited" style={{ color: "#9aa4b2", textDecoration: "none" }}>
                Prohibited Goods
              </a>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
