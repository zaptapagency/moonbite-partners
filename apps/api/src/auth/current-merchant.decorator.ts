import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/** The authenticated merchant identity attached by JwtAuthGuard. */
export interface AuthMerchant {
  id: string;
  email: string;
}

/** Inject the current merchant into a handler: `@CurrentMerchant() me: AuthMerchant`. */
export const CurrentMerchant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthMerchant => {
    const req = ctx.switchToHttp().getRequest<{ merchant: AuthMerchant }>();
    return req.merchant;
  },
);
