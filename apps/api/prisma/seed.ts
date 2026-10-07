import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/** Demo dashboard login: demo@moonbite.example / password123 */
const DEMO_PASSWORD = "password123";

/**
 * Minimal demo data. The xpub below is a well-known BIP32 TEST vector — it
 * derives valid addresses but is NOT a real wallet. Replace with a real
 * merchant xpub before taking live payments.
 */
const DEMO_XPUB =
  "xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet";

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const merchant = await prisma.merchant.upsert({
    where: { email: "demo@moonbite.example" },
    update: { passwordHash },
    create: {
      email: "demo@moonbite.example",
      displayName: "Demo Studio",
      tier: "VERIFIED",
      feeBps: 300,
      settlementXpub: DEMO_XPUB,
      passwordHash,
    },
  });

  const product = await prisma.product.create({
    data: {
      merchantId: merchant.id,
      title: "Indie Game License Key",
      description: "A one-time activation key, delivered the instant payment confirms.",
      priceMbite: 500_000_000n, // 5 MBITE
      deliveryMethod: "LICENSE_KEY",
    },
  });

  await prisma.licenseKey.createMany({
    data: Array.from({ length: 20 }, (_, i) => ({
      productId: product.id,
      key: `DEMO-${String(i + 1).padStart(4, "0")}-XXXX-YYYY`,
    })),
  });

  console.log(`Seeded merchant ${merchant.id} + product ${product.id} (+20 keys).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
