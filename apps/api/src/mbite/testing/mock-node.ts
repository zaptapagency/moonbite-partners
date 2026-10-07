import * as http from "node:http";
import type { AddressInfo } from "node:net";

/**
 * A lightweight in-memory mock of a bitcoind-style MBITE full node, speaking
 * just enough JSON-RPC-over-HTTP for `MbiteRpcClient` to talk to in tests:
 * `getblockcount`, `scantxoutset`, and `getrawtransaction`.
 *
 * It is NOT a chain simulator. It is a scriptable ledger: tests credit
 * addresses, set the tip height, and register raw transactions, then point the
 * real client at `url` and assert on how the client parses the responses.
 *
 * Uses only `node:http` — no runtime dependencies.
 */

/** A spendable output credited to an address, as `scantxoutset` would report it. */
export interface MockUtxo {
  txid: string;
  /** Block height the funding tx was included in (may exceed the tip = pending/0-conf). */
  height: number;
  /** Amount in whole MBITE (decimal), matching the node's coin-denominated RPC. */
  amount: number;
}

/** One output of a registered raw transaction, in node `vout` shape. */
export interface MockVout {
  value: number;
  scriptPubKey: { address?: string; addresses?: string[] };
}

/** A registered raw transaction, as `getrawtransaction <txid> true` would return it. */
export interface MockRawTx {
  confirmations: number;
  vout: MockVout[];
}

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: unknown;
  method?: string;
  params?: unknown[];
}

/** A running mock node. Mutate the ledger via the helpers, then stop() when done. */
export interface MockMbiteNode {
  /** Base URL to hand to MbiteRpcClient (e.g. http://127.0.0.1:54123). */
  readonly url: string;
  /** The ephemeral port the server bound to. */
  readonly port: number;

  // --- ledger scripting -------------------------------------------------
  /** Set the current chain tip height (what `getblockcount` returns). */
  setTipHeight(height: number): void;
  /** Current tip height. */
  getTipHeight(): number;
  /**
   * Credit `amount` (whole MBITE) to `address` as a UTXO mined at `height`.
   * A `height` greater than the current tip models a still-unconfirmed credit,
   * so `scantxoutset` reports it while confirmation math yields 0-conf.
   * Returns the synthetic txid used (auto-generated unless `txid` is given).
   */
  creditAddress(address: string, amount: number, height: number, txid?: string): string;
  /** Register (or overwrite) a raw tx so `getrawtransaction` can return it. */
  registerRawTx(txid: string, tx: MockRawTx): void;
  /** Convenience: credit an address AND register a matching single-output raw tx. */
  creditWithRawTx(
    address: string,
    amount: number,
    height: number,
    confirmations: number,
    txid?: string,
  ): string;
  /** Wipe all credits, raw txs, and reset the tip to 0. */
  reset(): void;

  /** Stop the HTTP server. */
  stop(): Promise<void>;
}

let txidCounter = 0;
function nextTxid(): string {
  txidCounter += 1;
  return txidCounter.toString(16).padStart(64, "0");
}

/**
 * Start a mock MBITE node on an ephemeral port. Resolves once it is listening.
 */
export async function startMockMbiteNode(): Promise<MockMbiteNode> {
  let tipHeight = 0;
  // address -> list of utxos
  const utxos = new Map<string, MockUtxo[]>();
  // txid -> raw tx
  const rawTxs = new Map<string, MockRawTx>();

  function scan(address: string): { total_amount: number; unspents: MockUtxo[] } {
    const list = utxos.get(address) ?? [];
    const total_amount = list.reduce((sum, u) => sum + u.amount, 0);
    return {
      total_amount,
      unspents: list.map((u) => ({ txid: u.txid, height: u.height, amount: u.amount })),
    };
  }

  function dispatch(method: string | undefined, params: unknown[]): unknown {
    switch (method) {
      case "getblockcount":
        return tipHeight;

      case "scantxoutset": {
        // params: ["start", [{ desc: "addr(<address>)" }]]
        const descriptors = (params?.[1] as Array<{ desc?: string }> | undefined) ?? [];
        const desc = descriptors[0]?.desc ?? "";
        const match = /^addr\((.+)\)$/.exec(desc);
        const address = match ? match[1] : "";
        const { total_amount, unspents } = scan(address);
        return {
          success: true,
          height: tipHeight,
          bestblock: "00".repeat(32),
          total_amount,
          unspents: unspents.map((u) => ({
            txid: u.txid,
            vout: 0,
            height: u.height,
            amount: u.amount,
            scriptPubKey: "",
            desc,
          })),
        };
      }

      case "getrawtransaction": {
        // params: [txid, true]
        const txid = String(params?.[0] ?? "");
        const tx = rawTxs.get(txid);
        if (!tx) {
          const err = new Error(
            "No such mempool or blockchain transaction. Use gettransaction for wallet transactions.",
          ) as Error & { rpcCode: number };
          err.rpcCode = -5;
          throw err;
        }
        return {
          txid,
          confirmations: tx.confirmations,
          vout: tx.vout.map((o, i) => ({
            value: o.value,
            n: i,
            scriptPubKey: o.scriptPubKey,
          })),
        };
      }

      default: {
        const err = new Error(`Method not found: ${method}`) as Error & { rpcCode: number };
        err.rpcCode = -32601;
        throw err;
      }
    }
  }

  const server = http.createServer((req, res) => {
    if (req.method !== "POST") {
      res.writeHead(405).end();
      return;
    }
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      let payload: JsonRpcRequest;
      try {
        payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as JsonRpcRequest;
      } catch {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ result: null, error: { code: -32700, message: "parse error" }, id: null }));
        return;
      }
      const id = payload.id ?? null;
      try {
        const result = dispatch(payload.method, payload.params ?? []);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ result, error: null, id }));
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        const code = (e as { rpcCode?: number })?.rpcCode ?? -1;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ result: null, error: { code, message }, id }));
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;

  return {
    url,
    port,
    getTipHeight: () => tipHeight,
    setTipHeight(height: number) {
      tipHeight = height;
    },
    creditAddress(address: string, amount: number, height: number, txid = nextTxid()): string {
      const list = utxos.get(address) ?? [];
      list.push({ txid, height, amount });
      utxos.set(address, list);
      return txid;
    },
    registerRawTx(txid: string, tx: MockRawTx) {
      rawTxs.set(txid, tx);
    },
    creditWithRawTx(address, amount, height, confirmations, txid = nextTxid()) {
      const list = utxos.get(address) ?? [];
      list.push({ txid, height, amount });
      utxos.set(address, list);
      rawTxs.set(txid, {
        confirmations,
        vout: [{ value: amount, scriptPubKey: { address } }],
      });
      return txid;
    },
    reset() {
      tipHeight = 0;
      utxos.clear();
      rawTxs.clear();
    },
    stop() {
      return new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}
