import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Thin JSON-RPC client for a MoonBite full node (bitcoind-style RPC).
 * This is the platform's source of truth for payments (PLAN.md §3).
 *
 * Assumes MBITE exposes a Bitcoin/Litecoin-compatible RPC surface. If the
 * codebase lineage differs (confirm in Phase 0), adjust method names here —
 * this is the ONLY file that should know the node's wire protocol.
 */
@Injectable()
export class MbiteRpcClient {
  private readonly log = new Logger(MbiteRpcClient.name);
  private readonly url: string;
  private readonly auth: string;

  constructor(config: ConfigService) {
    this.url = config.get<string>("MBITE_RPC_URL") ?? "http://127.0.0.1:9332";
    const user = config.get<string>("MBITE_RPC_USER") ?? "";
    const pass = config.get<string>("MBITE_RPC_PASSWORD") ?? "";
    this.auth = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  }

  /** Raw JSON-RPC call. Throws on node-level errors. */
  async call<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: this.auth },
      body: JSON.stringify({ jsonrpc: "1.0", id: "moonbite", method, params }),
    });
    if (!res.ok) {
      throw new Error(`MBITE RPC HTTP ${res.status} for ${method}`);
    }
    const body = (await res.json()) as { result: T; error: unknown };
    if (body.error) {
      throw new Error(`MBITE RPC error for ${method}: ${JSON.stringify(body.error)}`);
    }
    return body.result;
  }

  getBlockCount(): Promise<number> {
    return this.call<number>("getblockcount");
  }

  /**
   * Total amount received by an address across all txs, as a decimal number
   * of MBITE (node returns whole-coin decimals). `minconf=0` counts 0-conf.
   * Requires the address to be watched by the node wallet, OR use
   * `scantxoutset` for a wallet-less node (see scanAddress).
   */
  getReceivedByAddress(address: string, minconf = 0): Promise<number> {
    return this.call<number>("getreceivedbyaddress", [address, minconf]);
  }

  /**
   * Wallet-less UTXO scan for an address descriptor. Preferred for our
   * watch-only model so we don't import thousands of addresses into a wallet.
   */
  async scanAddress(
    address: string,
  ): Promise<{ total: number; utxos: Array<{ txid: string; height: number }> }> {
    const result = await this.call<{
      total_amount: number;
      unspents: Array<{ txid: string; height: number }>;
    }>("scantxoutset", ["start", [{ desc: `addr(${address})` }]]);
    return {
      total: result?.total_amount ?? 0,
      utxos: (result?.unspents ?? []).map((u) => ({
        txid: u.txid,
        height: u.height,
      })),
    };
  }

  /** Health probe that never throws — used by /health. */
  async pingSafe(): Promise<{ reachable: boolean; blocks?: number; error?: string }> {
    try {
      const blocks = await this.getBlockCount();
      return { reachable: true, blocks };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      this.log.warn(`Node unreachable: ${error}`);
      return { reachable: false, error };
    }
  }
}
