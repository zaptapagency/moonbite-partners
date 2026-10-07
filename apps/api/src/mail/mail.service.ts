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

  /** Public: is real SMTP configured (vs dev log mode)? Used by /ready. */
  isConfigured(): boolean {
    return this.smtpConfigured;
  }

  /** Verify the SMTP connection (for the readiness probe / boot check). */
  async verifyConnection(): Promise<{ ok: boolean; mode: "smtp" | "dev-log"; error?: string }> {
    const t = await this.getTransporter();
    if (!t) return { ok: true, mode: "dev-log" };
    try {
      await t.verify();
      return { ok: true, mode: "smtp" };
    } catch (e) {
      return { ok: false, mode: "smtp", error: String(e) };
    }
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

  /** Send (or, in dev, log) one email. Never throws (best-effort). */
  private async deliver(to: string, subject: string, text: string): Promise<void> {
    try {
      const transporter = await this.getTransporter();
      if (!transporter) {
        this.log.log(`[dev mail] to=${to} subject="${subject}"\n${text}`);
        return;
      }
      await transporter.sendMail({ from: this.from, to, subject, text });
      this.log.log(`Mail sent to ${to}: "${subject}"`);
    } catch (e) {
      this.log.error(`Failed to send "${subject}" to ${to}: ${String(e)}`);
    }
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
    await this.deliver(input.to, subject, text);
  }

  /** Email a merchant a verification link. Never throws. */
  async sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
    const text = [
      `Confirm your MoonBite Partners email address:`,
      ``,
      verifyUrl,
      ``,
      `This link expires in 24 hours. If you didn't create an account, ignore this email.`,
      ``,
      `— MoonBite Partners`,
    ].join("\n");
    await this.deliver(to, "Verify your MoonBite Partners email", text);
  }

  /** Email a merchant a password-reset link. Never throws. */
  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    const text = [
      `Reset your MoonBite Partners password:`,
      ``,
      resetUrl,
      ``,
      `This link expires in 1 hour. If you didn't request this, ignore this email — your password is unchanged.`,
      ``,
      `— MoonBite Partners`,
    ].join("\n");
    await this.deliver(to, "Reset your MoonBite Partners password", text);
  }

  async onModuleDestroy() {
    this.transporter?.close();
  }
}
