import { Module } from "@nestjs/common";
import { MailService } from "./mail.service";

/** Email transport (Workstream B §3): SMTP via nodemailer, or dev logging. */
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
