/**
 * Boot-time environment validation (wired into ConfigModule.forRoot).
 *
 * In production it FAILS FAST when a required secret is missing, too weak, or
 * left at a known dev/placeholder value — so a misconfigured instance refuses
 * to start rather than serving with an insecure default. Outside production it
 * only warns, keeping local dev and CI frictionless.
 */

/** Known insecure defaults that must never reach production. */
const DENY = new Set([
  "change-me",
  "dev-insecure-secret-change-me",
  "change-me-dev-secret",
  "dev-compose-secret-change-me",
  "change-me-dev-download-secret",
]);

type Env = Record<string, unknown>;

function str(env: Env, key: string): string | undefined {
  const v = env[key];
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

export function validateEnv(env: Env): Env {
  const prod = env.NODE_ENV === "production";
  const problems: string[] = [];
  const warnings: string[] = [];

  const requireSecret = (key: string, minLen: number) => {
    const v = str(env, key);
    if (!v) return problems.push(`${key} is required in production`);
    if (v.length < minLen) problems.push(`${key} must be at least ${minLen} chars`);
    if (DENY.has(v)) problems.push(`${key} is set to a known insecure default — change it`);
  };
  const requirePresent = (key: string) => {
    if (!str(env, key)) problems.push(`${key} is required in production`);
  };

  if (prod) {
    requirePresent("DATABASE_URL");
    requirePresent("REDIS_URL");
    requireSecret("JWT_SECRET", 32);
    requireSecret("DOWNLOAD_URL_SECRET", 16);
    // If SMTP is turned on, its companions must be present.
    if (str(env, "SMTP_HOST")) {
      for (const k of ["SMTP_USER", "SMTP_PASS", "MAIL_FROM"]) {
        if (!str(env, k)) problems.push(`${k} is required when SMTP_HOST is set`);
      }
    } else {
      warnings.push("SMTP_HOST not set — transactional email runs in dev-log mode");
    }
    if (str(env, "MBITE_BECH32_HRP") === undefined) {
      warnings.push(
        "MBITE network params appear to be placeholders — confirm against the real chain before accepting live funds",
      );
    }
  } else {
    for (const k of ["JWT_SECRET", "DOWNLOAD_URL_SECRET"]) {
      if (!str(env, k)) warnings.push(`${k} not set — using a dev default`);
    }
  }

  for (const w of warnings) console.warn(`[env] WARN: ${w}`);
  if (problems.length) {
    throw new Error(
      `Invalid environment configuration:\n  - ${problems.join("\n  - ")}`,
    );
  }
  return env;
}
