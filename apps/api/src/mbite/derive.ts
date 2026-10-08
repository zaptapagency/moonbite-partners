import * as ecc from "tiny-secp256k1";
import { BIP32Factory } from "bip32";
import * as bitcoin from "bitcoinjs-lib";
import { MBITE_NETWORK } from "./mbite.network";

const bip32 = BIP32Factory(ecc);

/** Receive-address script type. MBITE with MWEB is segwit, so p2wpkh is the
 *  default; set MBITE_ADDRESS_TYPE=p2pkh if the chain is legacy-only, or
 *  p2sh-p2wpkh for wrapped-segwit. */
export type MbiteAddressType = "p2wpkh" | "p2pkh" | "p2sh-p2wpkh";

export const MBITE_ADDRESS_TYPE: MbiteAddressType =
  (process.env.MBITE_ADDRESS_TYPE as MbiteAddressType) || "p2wpkh";

/**
 * Single source of truth for deriving a receive address from a merchant xpub
 * at path `/0/<index>`. Used by HdAddressService (runtime) and the
 * derive-address CLI (for pre-launch param verification) so they can never
 * diverge. Pure — holds only the xpub, never a private key.
 */
export function deriveReceiveAddress(
  xpub: string,
  index: number,
  network: bitcoin.networks.Network = MBITE_NETWORK,
  type: MbiteAddressType = MBITE_ADDRESS_TYPE,
): string {
  const child = bip32.fromBase58(xpub, network).derive(0).derive(index);
  const pubkey = Buffer.from(child.publicKey);

  let address: string | undefined;
  if (type === "p2pkh") {
    address = bitcoin.payments.p2pkh({ pubkey, network }).address;
  } else if (type === "p2sh-p2wpkh") {
    address = bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wpkh({ pubkey, network }),
      network,
    }).address;
  } else {
    address = bitcoin.payments.p2wpkh({ pubkey, network }).address;
  }
  if (!address) throw new Error("Failed to derive MBITE address from xpub");
  return address;
}
