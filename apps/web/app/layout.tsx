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
        }}
      >
        <header
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #1c2230",
            fontWeight: 700,
          }}
        >
          🌙 MoonBite Partners
        </header>
        <main style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
          {children}
        </main>
      </body>
    </html>
  );
}
