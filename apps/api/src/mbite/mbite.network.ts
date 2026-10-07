import * as bitcoin from "bitcoinjs-lib";

/**
 * MoonBite network parameters for address encoding/decoding. Shared by
 * HD address derivation (receiving) and the ZMQ tx decoder (matching
 * incoming payments to orders).
 *
 * ⚠️ PLACEHOLDER VALUES (currently Litecoin-like). Replace with MBITE's real
 * params from its chainparams (confirm in Phase 0 — PLAN.md §7). Getting these
 * wrong means deriving/decoding addresses on the wrong network → lost or
 * undetected funds. Verify a derived address against the MBITE block explorer
 * before going live.
 *
 * The values below can each be overridden via environment variables (see
 * `buildMbiteNetwork`) so an operator can point the service at the real chain
 * params the moment they are confirmed, WITHOUT a code change. Absent an env
 * override, the loud placeholders below are used — they are still guesses.
 */

/** Default (PLACEHOLDER) params — Litecoin-like. Confirm every one on the explorer. */
export const MBITE_NETWORK_DEFAULTS = {
  messagePrefix: "\x19MoonBite Signed Message:\n",
  bech32: "mbite", // TODO: confirm real bech32 HRP
  bip32Public: 0x0488b21e, // xpub
  bip32Private: 0x0488ade4, // xprv
  pubKeyHash: 0x30, // TODO: confirm
  scriptHash: 0x32, // TODO: confirm
  wif: 0xb0, // TODO: confirm
} as const;

/**
 * Parse an unsigned integer from an env string. Accepts hex ("0x30", "30",
 * "0488b21e") or decimal. Returns `fallback` for undefined/empty/invalid input.
 * Hex is assumed when the string has a "0x" prefix OR contains a–f digits OR is
 * longer than the decimal form could plausibly need; to stay unambiguous we
 * treat a leading "0x" as explicit hex and otherwise require an explicit base
 * via the `radix` argument.
 */
function parseIntEnv(raw: string | undefined, fallback: number, radix: 16 | 10): number {
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (trimmed === "") return fallback;
  const hex = trimmed.toLowerCase().startsWith("0x");
  const value = parseInt(hex ? trimmed.slice(2) : trimmed, hex ? 16 : radix);
  if (!Number.isFinite(value) || Number.isNaN(value) || value < 0) return fallback;
  return value;
}

type EnvLike = Record<string, string | undefined>;

/**
 * Build the effective MBITE network params, reading each field from the
 * environment and falling back to the PLACEHOLDER defaults above.
 *
 * Env vars (all optional):
 *  - MBITE_MESSAGE_PREFIX  signed-message prefix string (raw, no escaping)
 *  - MBITE_BECH32_HRP      bech32 human-readable part (e.g. "mbite")
 *  - MBITE_PUBKEYHASH      P2PKH version byte, hex ("0x30") or decimal
 *  - MBITE_SCRIPTHASH      P2SH version byte, hex ("0x32") or decimal
 *  - MBITE_WIF             WIF version byte, hex ("0xb0") or decimal
 *  - MBITE_BIP32_PUBLIC    BIP32 xpub version, hex ("0x0488b21e") or decimal
 *  - MBITE_BIP32_PRIVATE   BIP32 xprv version, hex ("0x0488ade4") or decimal
 */
export function buildMbiteNetwork(env: EnvLike = process.env): bitcoin.networks.Network {
  const d = MBITE_NETWORK_DEFAULTS;
  return {
    messagePrefix: env.MBITE_MESSAGE_PREFIX ?? d.messagePrefix,
    bech32: env.MBITE_BECH32_HRP?.trim() || d.bech32,
    bip32: {
      public: parseIntEnv(env.MBITE_BIP32_PUBLIC, d.bip32Public, 16),
      private: parseIntEnv(env.MBITE_BIP32_PRIVATE, d.bip32Private, 16),
    },
    pubKeyHash: parseIntEnv(env.MBITE_PUBKEYHASH, d.pubKeyHash, 16),
    scriptHash: parseIntEnv(env.MBITE_SCRIPTHASH, d.scriptHash, 16),
    wif: parseIntEnv(env.MBITE_WIF, d.wif, 16),
  };
}

/**
 * The effective network parameters for this process. Resolved once at module
 * load from the environment (or placeholders). Consumed by HD derivation and
 * the tx decoder.
 */
export const MBITE_NETWORK: bitcoin.networks.Network = buildMbiteNetwork();

/** True when a given field still matches the baked-in placeholder default. */
function usingDefaults(net: bitcoin.networks.Network): boolean {
  const d = MBITE_NETWORK_DEFAULTS;
  return (
    net.bech32 === d.bech32 &&
    net.pubKeyHash === d.pubKeyHash &&
    net.scriptHash === d.scriptHash &&
    net.wif === d.wif &&
    net.bip32.public === d.bip32Public &&
    net.bip32.private === d.bip32Private
  );
}

const hex = (n: number, bytes: number): string => "0x" + n.toString(16).padStart(bytes * 2, "0");

let logged = false;

/**
 * Log the effective MBITE network params once, with a loud PLACEHOLDER warning
 * when they have not been overridden from the environment. NOT wired into
 * bootstrap — call it from wherever you want the one-time boot banner.
 */
export function logEffectiveMbiteNetwork(
  net: bitcoin.networks.Network = MBITE_NETWORK,
  logger: Pick<Console, "warn" | "info"> = console,
): void {
  if (logged) return;
  logged = true;

  const lines = [
    `MBITE network params in effect:`,
    `  messagePrefix = ${JSON.stringify(net.messagePrefix)}`,
    `  bech32 (HRP)  = ${net.bech32}`,
    `  pubKeyHash    = ${hex(net.pubKeyHash, 1)}`,
    `  scriptHash    = ${hex(net.scriptHash, 1)}`,
    `  wif           = ${hex(net.wif, 1)}`,
    `  bip32.public  = ${hex(net.bip32.public, 4)}`,
    `  bip32.private = ${hex(net.bip32.private, 4)}`,
  ].join("\n");

  if (usingDefaults(net)) {
    logger.warn(
      "\n⚠️  ========================================================\n" +
        "⚠️  MBITE NETWORK PARAMS ARE PLACEHOLDERS (Litecoin-like).\n" +
        "⚠️  CONFIRM every value against the real MBITE chainparams and\n" +
        "⚠️  a block explorer before accepting live funds. Set env vars\n" +
        "⚠️  (MBITE_BECH32_HRP, MBITE_PUBKEYHASH, MBITE_SCRIPTHASH, MBITE_WIF,\n" +
        "⚠️  MBITE_BIP32_PUBLIC, MBITE_BIP32_PRIVATE, MBITE_MESSAGE_PREFIX)\n" +
        "⚠️  once the real params are known.\n" +
        "⚠️  ========================================================\n" +
        lines,
    );
  } else {
    logger.info(
      lines +
        "\n(MBITE params overridden from the environment — still verify against the explorer.)",
    );
  }
}

/** Reset the once-only guard — test-only helper. */
export function __resetMbiteNetworkLogOnce(): void {
  logged = false;
}
