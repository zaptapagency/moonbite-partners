import { Injectable } from "@nestjs/common";
import * as ecc from "tiny-secp256k1";
import { BIP32Factory } from "bip32";
import * as bitcoin from "bitcoinjs-lib";

const bip32 = BIP32Factory(ecc);

/**
 * MoonBite network parameters for address encoding.
 *
 * ⚠️ PLACEHOLDER VALUES (currently Litecoin-like). Replace with MBITE's real
 * params from its chainparams (confirm in Phase 0 — PLAN.md §7). Getting these
 * wrong means deriving addresses on the wrong network → lost funds. Verify a
 * derived address against the MBITE block explorer before going live.
 */
const MBITE_NETWORK: bitcoin.networks.Network = {
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

@Injectable()
export class HdAddressService {
  /**
   * Derive a fresh receive address from a merchant's xpub at a given index.
   * Path relative to the xpub: `/0/<index>` (external chain). We only ever
   * hold the xpub — this function cannot and must not touch private keys.
   */
  deriveAddress(xpub: string, index: number): string {
    const node = bip32.fromBase58(xpub, MBITE_NETWORK);
    const child = node.derive(0).derive(index);
    const { address } = bitcoin.payments.p2wpkh({
      pubkey: Buffer.from(child.publicKey),
      network: MBITE_NETWORK,
    });
    if (!address) {
      throw new Error("Failed to derive MBITE address from xpub");
    }
    return address;
  }

  /** Validate that a string is a usable xpub on the MBITE network. */
  isValidXpub(xpub: string): boolean {
    try {
      bip32.fromBase58(xpub, MBITE_NETWORK);
      return true;
    } catch {
      return false;
    }
  }
}
