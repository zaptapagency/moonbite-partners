import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { MerchantTier, OrderStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "./audit.service";

const SETTLED: OrderStatus[] = ["FULFILLED", "PAID", "OVERPAID"];
const str = (v: bigint | null | undefined) => (v ?? 0n).toString();

/**
 * Platform operator (ADMIN) operations: dashboards, moderation, oversight.
 * Every mutating method writes an audit entry.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Dashboard metrics ───────────────────────────────────────────────────
  async metrics() {
    const [merchants, suspendedMerchants, buyers, products, activeProducts, orders] =
      await Promise.all([
        this.prisma.merchant.count(),
        this.prisma.merchant.count({ where: { suspended: true } }),
        this.prisma.buyer.count(),
        this.prisma.product.count(),
        this.prisma.product.count({ where: { active: true } }),
        this.prisma.order.count(),
      ]);

    const byStatusRaw = await this.prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const ordersByStatus: Record<string, number> = {};
    for (const r of byStatusRaw) ordersByStatus[r.status] = r._count._all;

    const settled = await this.prisma.order.aggregate({
      where: { status: { in: SETTLED } },
      _sum: { amountMbite: true, feeMbite: true },
      _count: { _all: true },
    });

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const settled7d = await this.prisma.order.aggregate({
      where: { status: { in: SETTLED }, createdAt: { gte: since } },
      _sum: { amountMbite: true, feeMbite: true },
      _count: { _all: true },
    });

    // Top merchants by settled GMV.
    const topRaw = await this.prisma.order.groupBy({
      by: ["merchantId"],
      where: { status: { in: SETTLED } },
      _sum: { amountMbite: true, feeMbite: true },
      _count: { _all: true },
      orderBy: { _sum: { amountMbite: "desc" } },
      take: 5,
    });
    const topMerchantRows = await this.prisma.merchant.findMany({
      where: { id: { in: topRaw.map((t) => t.merchantId) } },
      select: { id: true, displayName: true, handle: true, suspended: true },
    });
    const topMerchants = topRaw.map((t) => {
      const m = topMerchantRows.find((x) => x.id === t.merchantId);
      return {
        id: t.merchantId,
        displayName: m?.displayName ?? "—",
        handle: m?.handle ?? null,
        suspended: m?.suspended ?? false,
        gmvMbite: str(t._sum.amountMbite),
        feeMbite: str(t._sum.feeMbite),
        orders: t._count._all,
      };
    });

    const recentOrders = await this.prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        amountMbite: true,
        createdAt: true,
        product: { select: { title: true } },
        merchant: { select: { displayName: true } },
      },
    });

    // 14-day daily timeseries (orders + settled GMV) for the dashboard chart.
    const DAYS = 14;
    const t0 = new Date();
    t0.setHours(0, 0, 0, 0);
    const start = new Date(t0.getTime() - (DAYS - 1) * 86_400_000);
    const window = await this.prisma.order.findMany({
      where: { createdAt: { gte: start } },
      select: { createdAt: true, amountMbite: true, status: true },
    });
    const timeseries = Array.from({ length: DAYS }, (_, i) => {
      const d = new Date(start.getTime() + i * 86_400_000);
      return { date: d.toISOString().slice(0, 10), orders: 0, gmv: 0n };
    });
    const dayIndex = new Map(timeseries.map((d, i) => [d.date, i]));
    for (const o of window) {
      const i = dayIndex.get(o.createdAt.toISOString().slice(0, 10));
      if (i == null) continue;
      timeseries[i].orders += 1;
      if (SETTLED.includes(o.status)) timeseries[i].gmv += o.amountMbite;
    }
    // 7d-over-7d order trend within the 14-day window.
    const mid = new Date(t0.getTime() - 6 * 86_400_000);
    const last7 = window.filter((o) => o.createdAt >= mid).length;
    const prev7 = window.length - last7;
    const ordersTrend = prev7 === 0 ? null : Math.round(((last7 - prev7) / prev7) * 100);

    return {
      timeseries: timeseries.map((d) => ({ date: d.date, orders: d.orders, gmv: d.gmv.toString() })),
      trends: { orders7d: ordersTrend, ordersLast7: last7, ordersPrev7: prev7 },
      counts: {
        merchants,
        suspendedMerchants,
        buyers,
        products,
        activeProducts,
        orders,
      },
      ordersByStatus,
      gmv: {
        allTime: { mbite: str(settled._sum.amountMbite), fees: str(settled._sum.feeMbite), orders: settled._count._all },
        last7d: { mbite: str(settled7d._sum.amountMbite), fees: str(settled7d._sum.feeMbite), orders: settled7d._count._all },
      },
      topMerchants,
      recentOrders: recentOrders.map((o) => ({
        ...o,
        amountMbite: str(o.amountMbite),
      })),
    };
  }

  // ── Merchants ───────────────────────────────────────────────────────────
  async listMerchants(q?: string) {
    const where: Prisma.MerchantWhereInput = q?.trim()
      ? {
          OR: [
            { email: { contains: q.trim(), mode: "insensitive" } },
            { displayName: { contains: q.trim(), mode: "insensitive" } },
            { handle: { contains: q.trim(), mode: "insensitive" } },
          ],
        }
      : {};
    const rows = await this.prisma.merchant.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        email: true,
        displayName: true,
        handle: true,
        tier: true,
        feeBps: true,
        suspended: true,
        emailVerified: true,
        createdAt: true,
        _count: { select: { products: true, orders: true } },
      },
    });
    return rows;
  }

  async getMerchant(id: string) {
    const m = await this.prisma.merchant.findUnique({
      where: { id },
      select: {
        id: true, email: true, displayName: true, handle: true, bio: true,
        tier: true, feeBps: true, suspended: true, suspendedAt: true,
        suspendReason: true, emailVerified: true,
        settlementXpub: true, createdAt: true,
        _count: { select: { products: true, orders: true, discounts: true } },
      },
    });
    if (!m) throw new NotFoundException("Merchant not found");
    const settled = await this.prisma.order.aggregate({
      where: { merchantId: id, status: { in: SETTLED } },
      _sum: { amountMbite: true, feeMbite: true },
      _count: { _all: true },
    });
    return {
      ...m,
      xpubConfigured: Boolean(m.settlementXpub),
      settlementXpub: undefined,
      gmv: { mbite: str(settled._sum.amountMbite), fees: str(settled._sum.feeMbite), orders: settled._count._all },
    };
  }

  async suspendMerchant(adminId: string, id: string, reason?: string) {
    await this.ensureMerchant(id);
    const m = await this.prisma.merchant.update({
      where: { id },
      data: { suspended: true, suspendedAt: new Date(), suspendReason: reason ?? null },
      select: { id: true, suspended: true },
    });
    await this.audit.record(adminId, "merchant.suspend", { type: "Merchant", id }, { reason });
    return m;
  }

  async unsuspendMerchant(adminId: string, id: string) {
    await this.ensureMerchant(id);
    const m = await this.prisma.merchant.update({
      where: { id },
      data: { suspended: false, suspendedAt: null, suspendReason: null },
      select: { id: true, suspended: true },
    });
    await this.audit.record(adminId, "merchant.unsuspend", { type: "Merchant", id });
    return m;
  }

  async setMerchantFee(adminId: string, id: string, feeBps: number) {
    if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10_000) {
      throw new BadRequestException("feeBps must be an integer 0..10000");
    }
    await this.ensureMerchant(id);
    const m = await this.prisma.merchant.update({
      where: { id },
      data: { feeBps },
      select: { id: true, feeBps: true },
    });
    await this.audit.record(adminId, "merchant.setFee", { type: "Merchant", id }, { feeBps });
    return m;
  }

  async setMerchantTier(adminId: string, id: string, tier: MerchantTier) {
    await this.ensureMerchant(id);
    const m = await this.prisma.merchant.update({
      where: { id },
      data: { tier },
      select: { id: true, tier: true },
    });
    await this.audit.record(adminId, "merchant.setTier", { type: "Merchant", id }, { tier });
    return m;
  }

  private async ensureMerchant(id: string) {
    const m = await this.prisma.merchant.findUnique({ where: { id }, select: { id: true } });
    if (!m) throw new NotFoundException("Merchant not found");
  }

  // ── Buyers ──────────────────────────────────────────────────────────────
  async listBuyers(q?: string) {
    const where: Prisma.BuyerWhereInput = q?.trim()
      ? { email: { contains: q.trim(), mode: "insensitive" } }
      : {};
    return this.prisma.buyer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true, email: true, suspended: true, createdAt: true,
        passwordHash: false,
        _count: { select: { orders: true } },
      },
    });
  }

  async setBuyerSuspended(adminId: string, id: string, suspended: boolean) {
    const b = await this.prisma.buyer.findUnique({ where: { id }, select: { id: true } });
    if (!b) throw new NotFoundException("Buyer not found");
    const updated = await this.prisma.buyer.update({
      where: { id },
      data: { suspended },
      select: { id: true, suspended: true },
    });
    await this.audit.record(adminId, suspended ? "buyer.suspend" : "buyer.unsuspend", { type: "Buyer", id });
    return updated;
  }

  // ── Products (moderation) ────────────────────────────────────────────────
  async listProducts(opts: { q?: string; status?: "active" | "down" }) {
    const where: Prisma.ProductWhereInput = {};
    if (opts.q?.trim()) {
      where.OR = [
        { title: { contains: opts.q.trim(), mode: "insensitive" } },
        { category: { contains: opts.q.trim(), mode: "insensitive" } },
      ];
    }
    if (opts.status === "active") where.active = true;
    if (opts.status === "down") where.active = false;
    return this.prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true, title: true, category: true, priceMbite: true, active: true,
        takedownReason: true, imageUrl: true, createdAt: true,
        merchant: { select: { id: true, displayName: true, suspended: true } },
        _count: { select: { orders: true, reviews: true } },
      },
    }).then((rows) => rows.map((p) => ({ ...p, priceMbite: str(p.priceMbite) })));
  }

  async takedownProduct(adminId: string, id: string, reason?: string) {
    await this.ensureProduct(id);
    const p = await this.prisma.product.update({
      where: { id },
      data: { active: false, takedownReason: reason ?? "Policy violation" },
      select: { id: true, active: true, takedownReason: true },
    });
    await this.audit.record(adminId, "product.takedown", { type: "Product", id }, { reason });
    return p;
  }

  async restoreProduct(adminId: string, id: string) {
    await this.ensureProduct(id);
    const p = await this.prisma.product.update({
      where: { id },
      data: { active: true, takedownReason: null },
      select: { id: true, active: true },
    });
    await this.audit.record(adminId, "product.restore", { type: "Product", id });
    return p;
  }

  private async ensureProduct(id: string) {
    const p = await this.prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!p) throw new NotFoundException("Product not found");
  }

  // ── Orders (oversight) ───────────────────────────────────────────────────
  async listOrders(opts: { status?: OrderStatus; q?: string }) {
    const where: Prisma.OrderWhereInput = {};
    if (opts.status) where.status = opts.status;
    if (opts.q?.trim()) {
      where.OR = [
        { id: { contains: opts.q.trim() } },
        { payToAddress: { contains: opts.q.trim() } },
        { buyerRef: { contains: opts.q.trim(), mode: "insensitive" } },
      ];
    }
    const rows = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true, status: true, amountMbite: true, receivedMbite: true,
        feeMbite: true, confirmations: true, requiredConfirmations: true,
        createdAt: true,
        product: { select: { title: true } },
        merchant: { select: { id: true, displayName: true } },
        refund: { select: { id: true, status: true } },
      },
    });
    return rows.map((o) => ({
      ...o,
      amountMbite: str(o.amountMbite),
      receivedMbite: str(o.receivedMbite),
      feeMbite: str(o.feeMbite),
    }));
  }

  // ── Reviews (moderation) ─────────────────────────────────────────────────
  async listReviews(q?: string) {
    const where: Prisma.ReviewWhereInput = q?.trim()
      ? { comment: { contains: q.trim(), mode: "insensitive" } }
      : {};
    return this.prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true, rating: true, comment: true, buyerRef: true, createdAt: true,
        product: { select: { id: true, title: true } },
      },
    });
  }

  async deleteReview(adminId: string, id: string) {
    const r = await this.prisma.review.findUnique({ where: { id }, select: { id: true, productId: true } });
    if (!r) throw new NotFoundException("Review not found");
    await this.prisma.review.delete({ where: { id } });
    await this.audit.record(adminId, "review.delete", { type: "Review", id }, { productId: r.productId });
    return { id, deleted: true };
  }
}
