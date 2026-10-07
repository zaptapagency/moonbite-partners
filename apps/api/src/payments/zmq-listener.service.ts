import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as zmq from "zeromq";
import * as bitcoin from "bitcoinjs-lib";
import { MBITE_NETWORK } from "../mbite/mbite.network";
import { PaymentsService } from "./payments.service";

/**
 * Primary payment trigger (PLAN.md §3): subscribes to the MoonBite node's ZMQ
 * publishers and reconciles affected orders the moment a tx/block appears,
 * instead of waiting for the next poll.
 *
 *   rawtx   → a transaction entered the mempool/was relayed. We decode its
 *             outputs, match them to open orders, and reconcile those (0-conf
 *             DETECTED).
 *   rawblock→ a new block was found. Confirmations advanced for everything in
 *             flight, so we reconcile all open orders (DETECTED → PAID).
 *
 * The node must be started with:
 *   -zmqpubrawtx=tcp://0.0.0.0:28332 -zmqpubrawblock=tcp://0.0.0.0:28333
 * (see docker-compose.yml). If the endpoints are unset or unreachable, this
 * service logs and stays idle — ConfirmationService's poll is the backstop.
 */
@Injectable()
export class ZmqListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ZmqListenerService.name);
  private readonly rawTxEndpoint?: string;
  private readonly rawBlockEndpoint?: string;
  private rawTxSock?: zmq.Subscriber;
  private rawBlockSock?: zmq.Subscriber;
  private running = false;

  constructor(
    private readonly payments: PaymentsService,
    config: ConfigService,
  ) {
    this.rawTxEndpoint = config.get<string>("MBITE_ZMQ_RAWTX") || undefined;
    this.rawBlockEndpoint = config.get<string>("MBITE_ZMQ_RAWBLOCK") || undefined;
  }

  onModuleInit() {
    this.running = true;
    if (this.rawTxEndpoint) {
      void this.consume("rawtx", this.rawTxEndpoint, (body) => this.handleRawTx(body));
    } else {
      this.log.warn("MBITE_ZMQ_RAWTX unset — fast tx detection off (polling backstop only)");
    }
    if (this.rawBlockEndpoint) {
      void this.consume("rawblock", this.rawBlockEndpoint, () => this.handleRawBlock());
    } else {
      this.log.warn("MBITE_ZMQ_RAWBLOCK unset — fast confirmations off (polling backstop only)");
    }
  }

  async onModuleDestroy() {
    this.running = false;
    this.rawTxSock?.close();
    this.rawBlockSock?.close();
  }

  /** Generic subscribe loop with auto-reconnect on error. */
  private async consume(
    topic: "rawtx" | "rawblock",
    endpoint: string,
    onBody: (body: Buffer) => Promise<void>,
  ): Promise<void> {
    while (this.running) {
      const sock = new zmq.Subscriber();
      if (topic === "rawtx") this.rawTxSock = sock;
      else this.rawBlockSock = sock;
      try {
        sock.connect(endpoint);
        sock.subscribe(topic);
        this.log.log(`ZMQ ${topic} subscriber connected: ${endpoint}`);
        for await (const frames of sock) {
          if (!this.running) break;
          // bitcoind ZMQ frames: [topic, body, sequence]. We want the body.
          const body = frames[1];
          if (body && body.length) await onBody(Buffer.from(body));
        }
      } catch (e) {
        if (!this.running) break;
        this.log.error(`ZMQ ${topic} error, reconnecting in 5s: ${String(e)}`);
        sock.close();
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  private async handleRawTx(raw: Buffer): Promise<void> {
    const addresses = this.decodeOutputAddresses(raw);
    if (addresses.length === 0) return;
    const ids = await this.payments.findOpenByAddresses(addresses);
    for (const id of ids) await this.reconcileSafe(id);
    if (ids.length) this.log.log(`rawtx matched ${ids.length} open order(s)`);
  }

  private async handleRawBlock(): Promise<void> {
    const open = await this.payments.openOrders();
    for (const { id } of open) await this.reconcileSafe(id);
  }

  /** Decode a raw tx and return the pay-to addresses of its outputs. */
  private decodeOutputAddresses(raw: Buffer): string[] {
    let tx: bitcoin.Transaction;
    try {
      tx = bitcoin.Transaction.fromBuffer(raw);
    } catch {
      return []; // non-standard / unparseable (e.g. some MWEB txs) — polling catches it
    }
    const addresses: string[] = [];
    for (const out of tx.outs) {
      try {
        addresses.push(bitcoin.address.fromOutputScript(out.script, MBITE_NETWORK));
      } catch {
        // OP_RETURN / non-address output — skip
      }
    }
    return addresses;
  }

  private async reconcileSafe(orderId: string): Promise<void> {
    try {
      await this.payments.reconcile(orderId);
    } catch (e) {
      this.log.warn(`Reconcile ${orderId} failed: ${String(e)}`);
    }
  }
}
