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
 */
export const MBITE_NETWORK: bitcoin.networks.Network = {
  messagePrefix: "\x19MoonBite Signed Message:\n",
  bech32: "mbite", // TODO: confirm real bech32 HRP
  bip32: {
    public: 0x0488b21e, // xpub
    private: 0x0488ade4, // xprv
  },
  pubKeyHash: 0x30, // TODO: confirm
  scriptHash: 0x32, // TODO: confirm
  wif: 0xb0, // TODO: confirm
};
