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
            borderBottom: "2px solid #000",
            background: "#ff90e8",
          }}
        >
          <div
            className="container"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}
          >
            <a href="/" className="font-display" style={{ textDecoration: "none", fontWeight: 700, fontSize: 22, letterSpacing: "-0.02em" }}>
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
