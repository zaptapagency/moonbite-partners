import Link from "next/link";
import { listProducts } from "../lib/api";

// MBITE units (1e8) → display string.
function fmtMbite(units: string): string {
  try {
    const u = BigInt(units);
    const whole = u / 100_000_000n;
    const frac = (u % 100_000_000n).toString().padStart(8, "0").replace(/0+$/, "");
    return frac ? `${whole}.${frac}` : `${whole}`;
  } catch {
    return units;
  }
}

export default async function CatalogPage() {
  let products: Awaited<ReturnType<typeof listProducts>> = [];
  let error: string | null = null;
  try {
    products = await listProducts();
  } catch {
    error = "Could not reach the API. Is it running on :4000?";
  }

  return (
    <div>
      <h1>Digital products, paid in MBITE</h1>
      <p style={{ color: "#9aa4b2" }}>
        No chargebacks. Instant on-chain settlement. (See PLAN.md §1.)
      </p>

      {error && <p style={{ color: "#ff6b6b" }}>{error}</p>}
      {!error && products.length === 0 && (
        <p style={{ color: "#9aa4b2" }}>
          No products yet — seed some via <code>npm run db:seed -w @moonbite/api</code>.
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 16,
          marginTop: 24,
        }}
      >
        {products.map((p) => (
          <div
            key={p.id}
            style={{
              border: "1px solid #1c2230",
              borderRadius: 12,
              padding: 16,
              background: "#111622",
            }}
          >
            <div style={{ fontSize: 12, color: "#7c8699" }}>{p.merchant.displayName}</div>
            <h3 style={{ margin: "4px 0" }}>{p.title}</h3>
            <p style={{ color: "#9aa4b2", minHeight: 40 }}>{p.description}</p>
            <strong>{fmtMbite(p.priceMbite)} MBITE</strong>
            <div style={{ marginTop: 12 }}>
              <Link
                href={`/product/${p.id}`}
                style={{ color: "#8ab4ff", textDecoration: "none" }}
              >
                Buy →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
