"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  adminMe,
  clearAdminToken,
  getAdminToken,
  type AdminMe,
} from "../../lib/admin";

const NAV: { href: string; label: string; icon: string; super?: boolean }[] = [
  { href: "/admin", label: "Overview", icon: "📊" },
  { href: "/admin/merchants", label: "Merchants", icon: "🏪" },
  { href: "/admin/buyers", label: "Buyers", icon: "👤" },
  { href: "/admin/products", label: "Products", icon: "📦" },
  { href: "/admin/orders", label: "Orders", icon: "🧾" },
  { href: "/admin/reviews", label: "Reviews", icon: "⭐" },
  { href: "/admin/admins", label: "Admins", icon: "🛡️", super: true },
  { href: "/admin/settings", label: "Settings", icon: "⚙️", super: true },
  { href: "/admin/audit", label: "Audit log", icon: "🕵️", super: true },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<AdminMe | null>(null);
  const [checked, setChecked] = useState(false);

  const isLogin = pathname === "/admin/login";

  useEffect(() => {
    if (isLogin) {
      setChecked(true);
      return;
    }
    if (!getAdminToken()) {
      router.replace("/admin/login");
      return;
    }
    adminMe()
      .then(setMe)
      .catch(() => router.replace("/admin/login"))
      .finally(() => setChecked(true));
  }, [isLogin, pathname, router]);

  if (isLogin) return <>{children}</>;
  if (!checked || !me) {
    return <p className="muted" style={{ padding: 24 }}>Loading admin…</p>;
  }

  const items = NAV.filter((n) => !n.super || me.role === "SUPER_ADMIN");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "230px minmax(0,1fr)", gap: 24, alignItems: "start" }}>
      <aside
        className="card"
        style={{ padding: 14, position: "sticky", top: 90, display: "flex", flexDirection: "column", gap: 4 }}
      >
        <div className="eyebrow" style={{ padding: "4px 8px 8px" }}>Admin console</div>
        {items.map((n) => {
          const active = pathname === n.href;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={active ? "btn btn-sm btn-ink" : "btn btn-sm btn-ghost"}
              style={{ justifyContent: "flex-start", width: "100%" }}
            >
              <span aria-hidden>{n.icon}</span> {n.label}
            </Link>
          );
        })}
        <hr className="divider" style={{ margin: "10px 0" }} />
        <div style={{ padding: "0 8px" }}>
          <div style={{ fontWeight: 800, fontSize: 13 }}>{me.displayName}</div>
          <div className="muted" style={{ fontSize: 12 }}>{me.email}</div>
          <span className={`pill ${me.role === "SUPER_ADMIN" ? "pill-pink" : "pill-sky"}`} style={{ marginTop: 8, fontSize: 11 }}>
            {me.role === "SUPER_ADMIN" ? "Super admin" : "Admin"}
          </span>
        </div>
        <button
          className="btn btn-sm"
          style={{ marginTop: 10 }}
          onClick={() => {
            clearAdminToken();
            router.replace("/admin/login");
          }}
        >
          Sign out
        </button>
      </aside>

      <main style={{ minWidth: 0 }}>{children}</main>
    </div>
  );
}
