/**
 * Pre-launch MBITE param verification.
 *
 * Derives a receive address from an xpub using the CURRENTLY CONFIGURED network
 * params + MBITE_ADDRESS_TYPE (read from the environment). Compare the output
 * against the MBITE node's own derivation to prove the params are correct
 * BEFORE any funds move:
 *
 *   # our derivation (this script)
 *   MBITE_BECH32_HRP=mbite MBITE_PUBKEYHASH=0x30 ... \
 *     npx tsx apps/api/scripts/derive-address.ts <xpub> 0
 *
 *   # the node's derivation (must match exactly)
 *   mbite-cli deriveaddresses "wpkh(<xpub>/0/*)" "[0,0]"
 *
 * If they match, the base58/bech32 params + address type are correct. Then
 * paste the address into the MBITE block explorer to confirm it's recognized.
 */
import {
  buildMbiteNetwork,
  logEffectiveMbiteNetwork,
} from "../src/mbite/mbite.network";
import { deriveReceiveAddress, MBITE_ADDRESS_TYPE } from "../src/mbite/derive";

const [xpub, indexArg] = process.argv.slice(2);
if (!xpub) {
  console.error("Usage: tsx apps/api/scripts/derive-address.ts <xpub> [index=0]");
  process.exit(1);
}
const index = Number(indexArg ?? 0);
const network = buildMbiteNetwork(process.env);

logEffectiveMbiteNetwork(network, console);
console.log(`\nAddress type: ${MBITE_ADDRESS_TYPE}`);
console.log(`Derivation:   <xpub>/0/${index}`);
try {
  console.log(`Address:      ${deriveReceiveAddress(xpub, index, network)}`);
  console.log(
    `\nCompare with the node:\n  mbite-cli deriveaddresses "wpkh(${xpub}/0/*)" "[${index},${index}]"`,
  );
} catch (e) {
  console.error(`\nDerivation failed: ${String(e)}`);
  process.exit(1);
}
