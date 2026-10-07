import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MbiteRpcClient } from "../mbite/mbite-rpc.client";
import { MailService } from "../mail/mail.service";
import { isUsingPlaceholderParams } from "../mbite/mbite.network";

/**
 * Launch readiness probe (go/no-go). Unlike /health (liveness, always 200 if
 * the process is up), /ready reports whether this instance is actually fit to
 * accept real traffic + funds: node reachable, MBITE params confirmed (not
 * placeholders), and SMTP verified. It never throws — it reports.
 */
@Controller("ready")
export class ReadinessController {
  constructor(
    private readonly rpc: MbiteRpcClient,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async check() {
    const [node, smtp] = await Promise.all([
      this.rpc.pingSafe(),
      this.mail.verifyConnection(),
    ]);
    const paramsConfirmed = !isUsingPlaceholderParams();

    const checks = {
      mbiteNodeReachable: node.reachable,
      mbiteParamsConfirmed: paramsConfirmed,
      smtpOk: smtp.ok,
      smtpMode: smtp.mode,
    };

    // Launch-ready requires a reachable node AND confirmed (non-placeholder)
    // params. SMTP in dev-log mode is allowed but flagged.
    const ready = checks.mbiteNodeReachable && checks.mbiteParamsConfirmed && checks.smtpOk;

    return {
      ready,
      checks,
      notes: [
        paramsConfirmed
          ? undefined
          : "MBITE network params are PLACEHOLDERS — set MBITE_* env vars to the real chain params before accepting live funds.",
        node.reachable ? undefined : `MBITE node unreachable: ${node.error ?? "unknown"}`,
        smtp.mode === "dev-log" ? "SMTP not configured — emails are logged, not sent." : undefined,
      ].filter(Boolean),
    };
  }
}
