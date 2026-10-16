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

/** 17px line icons (stroke=currentColor) for the sidebar. */
function Icon({ name }: { name: string }) {
  const p: Record<string, ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    merchants: <><path d="M3 9l1-5h16l1 5" /><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" /><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /></>,
    buyers: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 16 0v1" /></>,
    products: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" /><path d="M4 7.5L12 12l8-4.5" /><path d="M12 12v9" /></>,
    orders: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 7h6M9 11h6M9 15h4" /></>,
    reviews: <><path d="M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9 6.7 19l1-5.8L3.5 9.2l5.9-.9L12 3z" /></>,
    admins: <><path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-3z" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 6.6 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 15H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 5.6V5a2 2 0 1 1 4 0v.1A1.6 1.6 0 0 0 17.4 6.6l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 20.4 11H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></>,
    audit: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  };
  return (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {p[name]}
    </svg>
  );
}

const NAV: { href: string; label: string; icon: string; group?: string; super?: boolean }[] = [
  { href: "/admin", label: "Overview", icon: "overview" },
  { href: "/admin/merchants", label: "Merchants", icon: "merchants", group: "Operations" },
  { href: "/admin/buyers", label: "Buyers", icon: "buyers" },
  { href: "/admin/products", label: "Products", icon: "products" },
  { href: "/admin/orders", label: "Orders", icon: "orders" },
  { href: "/admin/reviews", label: "Reviews", icon: "reviews" },
  { href: "/admin/admins", label: "Admins", icon: "admins", group: "Platform", super: true },
  { href: "/admin/settings", label: "Settings", icon: "settings", super: true },
  { href: "/admin/audit", label: "Audit log", icon: "audit", super: true },
];

const TITLES: Record<string, string> = {
  "/admin": "Overview", "/admin/merchants": "Merchants", "/admin/buyers": "Buyers",
  "/admin/products": "Products", "/admin/orders": "Orders", "/admin/reviews": "Reviews",
  "/admin/admins": "Admins", "/admin/settings": "Settings", "/admin/audit": "Audit log",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<AdminMe | null>(null);
  const [checked, setChecked] = useState(false);
  const isLogin = pathname === "/admin/login";

  useEffect(() => {
    if (isLogin) { setChecked(true); return; }
    if (!getAdminToken()) { router.replace("/admin/login"); return; }
    adminMe().then(setMe).catch(() => router.replace("/admin/login")).finally(() => setChecked(true));
  }, [isLogin, pathname, router]);

  if (isLogin) return <div className="admin-shell">{children}</div>;
  if (!checked || !me) return <div className="admin-shell"><p className="muted" style={{ padding: 24 }}>Loading admin…</p></div>;

  const items = NAV.filter((n) => !n.super || me.role === "SUPER_ADMIN");

  return (
    <div className="admin-shell">
      <div className="admin-grid">
        <aside className="admin-side">
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px 10px" }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, background: "var(--a-accent-soft)", display: "grid", placeItems: "center", fontSize: 15 }}>🌙</span>
            <strong style={{ fontSize: 14 }}>Admin console</strong>
          </div>
          {items.map((n) => (
            <div key={n.href}>
              {n.group && <div className="grp">{n.group}</div>}
              <Link href={n.href} className={`adm-nav${pathname === n.href ? " active" : ""}`}>
                <Icon name={n.icon} /> {n.label}
              </Link>
            </div>
          ))}
          <hr className="divider" style={{ margin: "12px 4px" }} />
          <div style={{ padding: "0 8px 4px" }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{me.displayName}</div>
            <div className="muted" style={{ fontSize: 12 }}>{me.email}</div>
            <span className={`badge ${me.role === "SUPER_ADMIN" ? "badge-blue" : "badge-gray"}`} style={{ marginTop: 8 }}>
              {me.role === "SUPER_ADMIN" ? "Super admin" : "Admin"}
            </span>
          </div>
          <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => { clearAdminToken(); router.replace("/admin/login"); }}>
            Sign out
          </button>
        </aside>

        <main style={{ minWidth: 0 }}>
          <div className="adm-topbar">
            <div className="crumb">Admin <span style={{ opacity: .5 }}>/</span> <b>{TITLES[pathname] ?? "Console"}</b></div>
            <div className="muted" style={{ fontSize: 12 }}>MoonBite Partners · MBITE</div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
