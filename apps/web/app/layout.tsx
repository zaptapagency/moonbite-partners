import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "MoonBite Partners",
  description: "Sell digital products. Get paid in MBITE.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <header
          style={{
            borderBottom: "2px solid #000",
            background: "#ff90e8",
          }}
        >
          <div
            className="container"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}
          >
            <a href="/" style={{ textDecoration: "none", fontWeight: 800, fontSize: 20, letterSpacing: "-0.02em" }}>
              🌙 MoonBite
            </a>
            <nav style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <a href="/library" className="btn btn-sm">My Library</a>
              <a href="/dashboard" className="btn btn-sm btn-ink">Start selling</a>
            </nav>
          </div>
        </header>

        <main className="container section" style={{ flex: 1, width: "100%" }}>
          {children}
        </main>

        <footer style={{ borderTop: "2px solid #000", background: "var(--cream)" }}>
          <div
            className="container"
            style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", padding: "20px" }}
          >
            <span className="muted" style={{ fontSize: 13 }}>
              © {new Date().getFullYear()} MoonBite Partners · Non-custodial MBITE payments.
            </span>
            <nav style={{ display: "flex", gap: 16, fontSize: 13, fontWeight: 700 }}>
              <a href="/terms" style={{ textDecoration: "none" }}>Terms</a>
              <a href="/prohibited" style={{ textDecoration: "none" }}>Prohibited goods</a>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
