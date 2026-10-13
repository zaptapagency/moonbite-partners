import { PrismaClient, DeliveryMethod, Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/** Demo logins: <email> / password123 */
const DEMO_PASSWORD = "password123";

/**
 * Well-known BIP32 TEST-vector xpub — derives valid addresses but is NOT a real
 * wallet. Replace with real merchant xpubs before taking live payments.
 */
const DEMO_XPUB =
  "xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet";

const img = (slug: string) => `https://picsum.photos/seed/mb-${slug}/800/500`;
const avatar = (slug: string) => `https://picsum.photos/seed/mb-${slug}-av/240`;
const mbite = (n: number) => BigInt(Math.round(n * 1e8));

interface SeedProduct {
  slug: string;
  title: string;
  description: string;
  category: string;
  mbite: number;
  method: DeliveryMethod;
  pwyw?: boolean;
  minMbite?: number;
  reviews?: { rating: number; comment: string; by: string }[];
}

const CREATORS: {
  email: string;
  displayName: string;
  handle: string;
  bio: string;
  products: SeedProduct[];
}[] = [
  {
    email: "demo@moonbite.example",
    displayName: "Pixel Forge Studio",
    handle: "pixel-forge",
    bio: "Indie games, pixel art, and dev assets. Paid in MBITE, delivered instantly.",
    products: [
      {
        slug: "starbound",
        title: "Starbound Odyssey — Game Key",
        description: "A cozy space-exploration roguelite. One-time activation key, delivered the instant payment confirms.",
        category: "games",
        mbite: 5,
        method: "LICENSE_KEY",
        reviews: [
          { rating: 5, comment: "Lost 40 hours to this already. Worth every MBITE.", by: "astro_nerd" },
          { rating: 4, comment: "Great loop, a few rough edges. Devs are responsive.", by: "quasar" },
        ],
      },
      {
        slug: "sprites",
        title: "2,000 Pixel-Art Sprites Pack",
        description: "A huge pack of game-ready 32×32 sprites: characters, tiles, items, FX. PNG + Aseprite sources.",
        category: "assets",
        mbite: 2.5,
        method: "SIGNED_DOWNLOAD",
        reviews: [{ rating: 5, comment: "Saved me weeks of art. Clean and consistent.", by: "gamedev_jo" }],
      },
      {
        slug: "uikit",
        title: "Lo-Fi UI Kit (Figma)",
        description: "120+ components, dark & light, auto-layout everywhere. Ship your next app faster.",
        category: "design",
        mbite: 12,
        method: "SIGNED_DOWNLOAD",
        reviews: [
          { rating: 5, comment: "Best UI kit I've bought. Tokens are perfect.", by: "designbymaya" },
          { rating: 5, comment: "Chef's kiss.", by: "pixelpusher" },
        ],
      },
      {
        slug: "soundtrack",
        title: "Starbound OST — Name Your Price",
        description: "The full 24-track synthwave soundtrack. Pay what you want (min 1 MBITE) — support the composer.",
        category: "music",
        mbite: 3,
        method: "SIGNED_DOWNLOAD",
        pwyw: true,
        minMbite: 1,
        reviews: [{ rating: 5, comment: "Track 7 lives in my head rent-free.", by: "synthhead" }],
      },
    ],
  },
  {
    email: "lumen@moonbite.example",
    displayName: "Lumen Press",
    handle: "lumen-press",
    bio: "Books, courses, and templates for builders. Learn fast, ship faster.",
    products: [
      {
        slug: "handbook",
        title: "The Indie Hacker's Handbook (eBook)",
        description: "280 pages on going from idea to paying customers, solo. PDF + EPUB.",
        category: "ebooks",
        mbite: 3,
        method: "SIGNED_DOWNLOAD",
        reviews: [
          { rating: 5, comment: "Dense with actually-useful advice. No fluff.", by: "buildinpublic" },
          { rating: 4, comment: "Loved it. Wanted more on pricing.", by: "sarah_k" },
        ],
      },
      {
        slug: "course",
        title: "Mastering Crypto Payments — Video Course",
        description: "6 hours on accepting crypto the right way: non-custodial, confirmations, delivery, refunds.",
        category: "courses",
        mbite: 15,
        method: "COURSE_ACCESS",
        reviews: [{ rating: 5, comment: "Finally understand UTXOs and confirmations. Excellent.", by: "devops_dan" }],
      },
      {
        slug: "album",
        title: "Ambient Focus — Album",
        description: "Nine hours of deep-work ambient. Lossless FLAC + MP3.",
        category: "music",
        mbite: 4,
        method: "SIGNED_DOWNLOAD",
        reviews: [{ rating: 5, comment: "My default coding soundtrack now.", by: "focusmode" }],
      },
      {
        slug: "notion",
        title: "Creator OS — Notion Template",
        description: "Run your whole creator business from one Notion workspace. Content, finances, launches.",
        category: "templates",
        mbite: 7,
        method: "SIGNED_DOWNLOAD",
        reviews: [{ rating: 4, comment: "Comprehensive. Took an afternoon to set up but great after.", by: "notion_nerd" }],
      },
      {
        slug: "apicredits",
        title: "API Credits — 10,000 calls",
        description: "Top up your account with 10k API calls. Provisioned automatically on payment.",
        category: "saas",
        mbite: 9,
        method: "WEBHOOK",
      },
    ],
  },
];

function deliveryConfig(p: SeedProduct): Prisma.InputJsonObject | undefined {
  if (p.method === "SIGNED_DOWNLOAD") return { objectKey: `demo/${p.slug}.zip` };
  if (p.method === "WEBHOOK")
    return { webhookUrl: "https://httpbin.org/post", webhookSecret: "seed-webhook-secret-0123456789" };
  return undefined;
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const c of CREATORS) {
    const merchant = await prisma.merchant.upsert({
      where: { email: c.email },
      update: { passwordHash, displayName: c.displayName, handle: c.handle, bio: c.bio, avatarUrl: avatar(c.handle), settlementXpub: DEMO_XPUB },
      create: {
        email: c.email,
        displayName: c.displayName,
        handle: c.handle,
        bio: c.bio,
        avatarUrl: avatar(c.handle),
        tier: "VERIFIED",
        feeBps: 300,
        settlementXpub: DEMO_XPUB,
        passwordHash,
      },
    });

    // Idempotent: clear prior seeded products (and children) that have no orders.
    const prior = await prisma.product.findMany({ where: { merchantId: merchant.id }, select: { id: true } });
    const priorIds = prior.map((p) => p.id);
    if (priorIds.length) {
      await prisma.review.deleteMany({ where: { productId: { in: priorIds } } });
      await prisma.licenseKey.deleteMany({ where: { productId: { in: priorIds } } });
      await prisma.product.deleteMany({ where: { id: { in: priorIds }, orders: { none: {} } } });
    }

    for (const p of c.products) {
      const product = await prisma.product.create({
        data: {
          merchantId: merchant.id,
          title: p.title,
          description: p.description,
          category: p.category,
          imageUrl: img(p.slug),
          priceMbite: mbite(p.mbite),
          pwyw: p.pwyw ?? false,
          minPriceMbite: p.minMbite != null ? mbite(p.minMbite) : undefined,
          deliveryMethod: p.method,
          deliveryConfig: deliveryConfig(p),
        },
      });

      if (p.method === "LICENSE_KEY") {
        await prisma.licenseKey.createMany({
          data: Array.from({ length: 20 }, (_, i) => ({
            productId: product.id,
            key: `${p.slug.toUpperCase()}-${String(i + 1).padStart(4, "0")}-XXXX-YYYY`,
          })),
        });
      }

      for (const [i, r] of (p.reviews ?? []).entries()) {
        await prisma.review.create({
          data: {
            productId: product.id,
            orderId: `seed-${p.slug}-${i}`, // unique synthetic ref for the demo
            rating: r.rating,
            comment: r.comment,
            buyerRef: r.by,
          },
        });
      }
    }

    console.log(`Seeded ${c.displayName} (@${c.handle}) with ${c.products.length} products.`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
