import type { ReactNode } from "react";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";

// Gumroad-ish chunky geometric display + clean body sans.
const display = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-display" });
const sans = Inter({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-sans" });

export const metadata = {
  title: "MoonBite Partners",
  description: "Sell digital products. Get paid in MBITE.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <header
          style={{
            borderBottom: "var(--border)",
            background: "var(--pink)",
            position: "sticky",
            top: 0,
            zIndex: 50,
          }}
        >
          <div
            className="container"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 66, gap: 16 }}
          >
            <a href="/" className="logo-mark" style={{ fontSize: 23, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span aria-hidden>🌙</span> MoonBite
            </a>
            <nav style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <a href="/#catalog" className="btn btn-sm btn-ghost" style={{ display: "inline-flex" }}>
                Browse
              </a>
              <a href="/library" className="btn btn-sm">My Library</a>
              <a href="/dashboard" className="btn btn-sm btn-ink">Start selling</a>
            </nav>
          </div>
        </header>

        <main className="container" style={{ flex: 1, width: "100%", padding: "clamp(28px, 4vw, 48px) 20px" }}>
          {children}
        </main>

        <footer style={{ borderTop: "var(--border)", background: "var(--cream)", marginTop: "var(--space-section)" }}>
          <div className="container" style={{ padding: "40px 20px" }}>
            <div className="spread" style={{ alignItems: "flex-start", gap: 24 }}>
              <div style={{ maxWidth: 360 }}>
                <div className="logo-mark" style={{ fontSize: 22 }}>🌙 MoonBite Partners</div>
                <p className="muted" style={{ fontSize: 14, margin: "8px 0 0" }}>
                  Sell digital products and get paid in MBITE. Non-custodial, no
                  chargebacks, instant on-chain settlement.
                </p>
              </div>
              <nav style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
                  <span className="eyebrow">Marketplace</span>
                  <a href="/#catalog" className="muted">Browse products</a>
                  <a href="/library" className="muted">My Library</a>
                </div>
                <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
                  <span className="eyebrow">Sell</span>
                  <a href="/dashboard" className="muted">Start selling</a>
                  <a href="/dashboard/profile" className="muted">Your storefront</a>
                </div>
                <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
                  <span className="eyebrow">Legal</span>
                  <a href="/terms" className="muted">Terms</a>
                  <a href="/prohibited" className="muted">Prohibited goods</a>
                </div>
              </nav>
            </div>
            <hr className="divider" style={{ margin: "28px 0 16px" }} />
            <span className="muted" style={{ fontSize: 13 }}>
              © {new Date().getFullYear()} MoonBite Partners · Non-custodial MBITE payments.
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
