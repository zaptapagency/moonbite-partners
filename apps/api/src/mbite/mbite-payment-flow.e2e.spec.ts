import { OrderStatus } from "@moonbite/shared";
import { MbiteRpcClient } from "./mbite-rpc.client";
import { startMockMbiteNode, MockMbiteNode } from "./testing/mock-node";
import { coinsToUnits } from "../common/money";
import { decideNextStatus, ReconcileInput } from "../payments/order-state-machine";
import type { ConfigService } from "@nestjs/config";

function fakeConfig(values: Record<string, string>): ConfigService {
  return {
    get: <T = string>(key: string): T | undefined => values[key] as T | undefined,
  } as unknown as ConfigService;
}

const ADDR = "mbite1qorderaddressorderaddressorderaddressxyz";
const PRICE_COINS = 1.0;
const REQUIRED_CONFIRMATIONS = 2;

/**
 * Glue the real RPC client's scan output into the pure state machine exactly
 * as PaymentsService.reconcile would — but with no DB and no real node. Proves
 * the parsed chain facts drive the AWAITING → DETECTED → PAID progression.
 */
async function reconcile(
  client: MbiteRpcClient,
  current: OrderStatus,
): Promise<OrderStatus> {
  const tip = await client.getBlockCount();
  const { total, utxos } = await client.scanAddress(ADDR);

  // Deepest-funded output drives confirmations; mempool/pending → 0-conf.
  const confirmations = utxos.reduce(
    (max, u) => Math.max(max, tip >= u.height ? tip - u.height + 1 : 0),
    0,
  );

  const next: ReconcileInput = {
    current,
    quoteExpired: false,
    amountUnits: coinsToUnits(PRICE_COINS),
    receivedUnits: coinsToUnits(total),
    confirmations,
    requiredConfirmations: REQUIRED_CONFIRMATIONS,
    tolerance: 0.02,
  };
  return decideNextStatus(next);
}

describe("MBITE payment flow (mock node → client → state machine)", () => {
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

  it("walks AWAITING_PAYMENT → DETECTED → PAID as confirmations accrue", async () => {
    const fundingHeight = 1000;
    node.setTipHeight(fundingHeight - 1); // tip just below the funding block

    // 1) Nothing on-chain yet.
    let status: OrderStatus = OrderStatus.AWAITING_PAYMENT;
    status = await reconcile(client, status);
    expect(status).toBe(OrderStatus.AWAITING_PAYMENT);

    // 2) Exact payment lands but is still unconfirmed (height > tip → 0-conf).
    node.creditAddress(ADDR, PRICE_COINS, fundingHeight);
    status = await reconcile(client, status);
    expect(status).toBe(OrderStatus.DETECTED);

    // 3) Funding block is mined (1 confirmation) — still short of the gate.
    node.setTipHeight(fundingHeight);
    status = await reconcile(client, status);
    expect(status).toBe(OrderStatus.DETECTED);

    // 4) One more block → 2 confirmations → PAID.
    node.setTipHeight(fundingHeight + 1);
    status = await reconcile(client, status);
    expect(status).toBe(OrderStatus.PAID);
  });

  it("flags an underpayment as UNDERPAID even once confirmed", async () => {
    const fundingHeight = 2000;
    node.setTipHeight(fundingHeight + 5); // well confirmed
    node.creditAddress(ADDR, 0.5, fundingHeight); // half the price

    const status = await reconcile(client, OrderStatus.AWAITING_PAYMENT);
    expect(status).toBe(OrderStatus.UNDERPAID);
  });

  it("treats an on-time overpayment as payable once confirmed", async () => {
    const fundingHeight = 3000;
    node.setTipHeight(fundingHeight + 1); // 2 confs
    node.creditAddress(ADDR, 1.5, fundingHeight); // 150% of price

    const status = await reconcile(client, OrderStatus.AWAITING_PAYMENT);
    expect(status).toBe(OrderStatus.PAID);
  });

  it("confirms getTxPayments agrees with the scanned funding output", async () => {
    const fundingHeight = 4000;
    node.setTipHeight(fundingHeight + 1);
    const txid = node.creditWithRawTx(ADDR, PRICE_COINS, fundingHeight, 2);

    const { outputs, confirmations } = await client.getTxPayments(txid);
    expect(confirmations).toBe(2);
    expect(outputs).toContainEqual({ address: ADDR, value: PRICE_COINS });
  });
});
