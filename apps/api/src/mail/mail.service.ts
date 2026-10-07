import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Transporter } from "nodemailer";

/** A delivery receipt to send to a buyer. */
export interface ReceiptInput {
  to: string;
  productTitle: string;
  orderId: string;
  /** Human-readable "how to access what you bought" note. */
  accessNote: string;
}

/**
 * Transactional email (Workstream B §3). Uses nodemailer SMTP when the SMTP_*
 * env vars are configured; otherwise logs the message (dev mode). Sending is
 * best-effort: a failure is logged and swallowed so it never breaks delivery.
 */
@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly log = new Logger(MailService.name);
  private readonly from: string;
  private transporter: Transporter | null = null;
  private transportReady: Promise<void> | null = null;

  constructor(private readonly config: ConfigService) {
    this.from = this.config.get<string>("MAIL_FROM") ?? "MoonBite <no-reply@moonbite.example>";
  }

  private get smtpConfigured(): boolean {
    return Boolean(this.config.get<string>("SMTP_HOST"));
  }

  /** Lazily build the SMTP transport the first time we actually need to send. */
  private async getTransporter(): Promise<Transporter | null> {
    if (!this.smtpConfigured) return null;
    if (this.transporter) return this.transporter;
    if (!this.transportReady) {
      this.transportReady = (async () => {
        const nodemailer = await import("nodemailer");
        const port = Number(this.config.get("SMTP_PORT") ?? 587);
        this.transporter = nodemailer.createTransport({
          host: this.config.get<string>("SMTP_HOST"),
          port,
          secure: port === 465,
          auth: {
            user: this.config.get<string>("SMTP_USER"),
            pass: this.config.get<string>("SMTP_PASS"),
          },
        });
      })();
    }
    await this.transportReady;
    return this.transporter;
  }

  /** Send (or, in dev, log) a purchase receipt. Never throws. */
  async sendReceipt(input: ReceiptInput): Promise<void> {
    const subject = `Your MoonBite purchase: ${input.productTitle}`;
    const text = [
      `Thanks for your purchase!`,
      ``,
      `Product: ${input.productTitle}`,
      `Order: ${input.orderId}`,
      ``,
      `How to access your purchase:`,
      input.accessNote,
      ``,
      `— MoonBite Partners`,
    ].join("\n");

    try {
      const transporter = await this.getTransporter();
      if (!transporter) {
        this.log.log(
          `[dev mail] to=${input.to} subject="${subject}"\n${text}`,
        );
        return;
      }
      await transporter.sendMail({ from: this.from, to: input.to, subject, text });
      this.log.log(`Receipt sent to ${input.to} for order ${input.orderId}`);
    } catch (e) {
      // Must never break delivery — log and continue.
      this.log.error(`Failed to send receipt for order ${input.orderId}: ${String(e)}`);
    }
  }

  async onModuleDestroy() {
    this.transporter?.close();
  }
}
