import { Injectable } from "@nestjs/common";
import * as ecc from "tiny-secp256k1";
import { BIP32Factory } from "bip32";
import * as bitcoin from "bitcoinjs-lib";
import { MBITE_NETWORK } from "./mbite.network";
import { deriveReceiveAddress } from "./derive";

const bip32 = BIP32Factory(ecc);

@Injectable()
export class HdAddressService {
  /**
   * Derive a fresh receive address from a merchant's xpub at a given index.
   * Path relative to the xpub: `/0/<index>` (external chain). We only ever
   * hold the xpub — this function cannot and must not touch private keys.
   * Script type is governed by MBITE_ADDRESS_TYPE (default p2wpkh).
   */
  deriveAddress(xpub: string, index: number): string {
    return deriveReceiveAddress(xpub, index);
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

  /** Validate that a string is a well-formed MBITE address (any standard type). */
  isValidAddress(address: string): boolean {
    try {
      bitcoin.address.toOutputScript(address, MBITE_NETWORK);
      return true;
    } catch {
      return false;
    }
  }
}
