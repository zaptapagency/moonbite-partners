import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/** The authenticated buyer identity attached by BuyerJwtGuard. */
export interface AuthBuyer {
  id: string;
  email: string;
}

/** Inject the current buyer into a handler: `@CurrentBuyer() me: AuthBuyer`. */
export const CurrentBuyer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthBuyer => {
    const req = ctx.switchToHttp().getRequest<{ buyer: AuthBuyer }>();
    return req.buyer;
  },
);
