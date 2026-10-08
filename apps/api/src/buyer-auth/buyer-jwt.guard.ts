import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import type { AuthBuyer } from "./current-buyer.decorator";
import { isBuyerToken } from "./buyer-scope";

/**
 * Verifies a Bearer JWT and attaches `req.buyer`. Rejects any token that is
 * not buyer-scoped (e.g. a merchant token), so merchant and buyer tokens stay
 * strictly distinct even though they are signed with the same secret.
 */
@Injectable()
export class BuyerJwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request & { buyer?: AuthBuyer }>();
    const header = req.headers.authorization ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedException("Missing Bearer token");
    }
    let payload: unknown;
    try {
      payload = this.jwt.verify(token);
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
    if (!isBuyerToken(payload)) {
      throw new UnauthorizedException("Not a buyer token");
    }
    req.buyer = { id: payload.sub, email: payload.email };
    return true;
  }
}
