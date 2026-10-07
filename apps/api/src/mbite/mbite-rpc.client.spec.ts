import type { ConfigService } from "@nestjs/config";
import { MbiteRpcClient } from "./mbite-rpc.client";
import { startMockMbiteNode, MockMbiteNode } from "./testing/mock-node";

/** Minimal ConfigService stand-in: only `get` is used by the client ctor. */
function fakeConfig(values: Record<string, string>): ConfigService {
  return {
    get: <T = string>(key: string): T | undefined => values[key] as T | undefined,
  } as unknown as ConfigService;
}

const ADDR = "mbite1qexampleaddressexampleaddressexampleaddr";

describe("MbiteRpcClient ↔ mock MBITE node (integration)", () => {
  let node: MockMbiteNode;
  let client: MbiteRpcClient;

  beforeAll(async () => {
    node = await startMockMbiteNode();
  });

  afterAll(async () => {
    await node.stop();
  });

  beforeEach(() => {
    node.reset();
    client = new MbiteRpcClient(fakeConfig({ MBITE_RPC_URL: node.url }));
  });

  describe("getBlockCount", () => {
    it("returns the node tip height", async () => {
      node.setTipHeight(812345);
      await expect(client.getBlockCount()).resolves.toBe(812345);
    });
  });

  describe("scanAddress", () => {
    it("returns total 0 and no utxos for an unfunded address", async () => {
      const { total, utxos } = await client.scanAddress(ADDR);
      expect(total).toBe(0);
      expect(utxos).toEqual([]);
    });

    it("sums the total and returns each utxo's txid + height", async () => {
      const t1 = node.creditAddress(ADDR, 1.5, 1000);
      const t2 = node.creditAddress(ADDR, 0.25, 1002);
      const { total, utxos } = await client.scanAddress(ADDR);

      expect(total).toBeCloseTo(1.75, 8);
      expect(utxos).toEqual([
        { txid: t1, height: 1000 },
        { txid: t2, height: 1002 },
      ]);
    });

    it("supports confirmation-height math against the tip", async () => {
      node.setTipHeight(1005);
      node.creditAddress(ADDR, 2.0, 1001);
      const tip = await client.getBlockCount();
      const { utxos } = await client.scanAddress(ADDR);

      // confirmations = tip - height + 1
      const confs = tip - utxos[0].height + 1;
      expect(confs).toBe(5);
    });

    it("reports a pending (height > tip) credit as 0-conf", async () => {
      node.setTipHeight(1000);
      node.creditAddress(ADDR, 1.0, 1001); // not yet mined relative to tip
      const tip = await client.getBlockCount();
      const { total, utxos } = await client.scanAddress(ADDR);

      expect(total).toBeCloseTo(1.0, 8);
      const confs = Math.max(0, tip - utxos[0].height + 1);
      expect(confs).toBe(0);
    });
  });

  describe("getTxPayments", () => {
    it("extracts address + value from the modern scriptPubKey.address shape", async () => {
      node.registerRawTx("aa", {
        confirmations: 3,
        vout: [
          { value: 0.5, scriptPubKey: { address: ADDR } },
          { value: 1.25, scriptPubKey: { address: "mbite1qchangeaddr" } },
        ],
      });

      const { confirmations, outputs } = await client.getTxPayments("aa");
      expect(confirmations).toBe(3);
      expect(outputs).toEqual([
        { address: ADDR, value: 0.5 },
        { address: "mbite1qchangeaddr", value: 1.25 },
      ]);
    });

    it("extracts address from the legacy scriptPubKey.addresses[] shape", async () => {
      node.registerRawTx("bb", {
        confirmations: 0,
        vout: [{ value: 2.0, scriptPubKey: { addresses: [ADDR, "mbite1qother"] } }],
      });

      const { confirmations, outputs } = await client.getTxPayments("bb");
      expect(confirmations).toBe(0);
      expect(outputs).toEqual([{ address: ADDR, value: 2.0 }]);
    });

    it("surfaces a node error for an unknown txid", async () => {
      await expect(client.getTxPayments("deadbeef")).rejects.toThrow(/getrawtransaction/);
    });
  });

  describe("pingSafe", () => {
    it("reports reachable + block height when the node is up", async () => {
      node.setTipHeight(42);
      await expect(client.pingSafe()).resolves.toEqual({ reachable: true, blocks: 42 });
    });

    it("reports unreachable when pointed at a dead port", async () => {
      const dead = new MbiteRpcClient(fakeConfig({ MBITE_RPC_URL: "http://127.0.0.1:1" }));
      const result = await dead.pingSafe();
      expect(result.reachable).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });
});
