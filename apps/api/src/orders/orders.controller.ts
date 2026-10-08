import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { IsInt, IsOptional, IsString, Min } from "class-validator";
import { ConfigService } from "@nestjs/config";
import type { CreateOrderResult, InvoiceView } from "@moonbite/shared";
import { PaymentsService } from "../payments/payments.service";

class CreateOrderDto {
  @IsString() productId!: string;
  /** Address to refund to if underpaid/cancelled (PLAN.md §4). */
  @IsOptional() @IsString() buyerReturnAddress?: string;
  /** Email or account id for delivery. */
  @IsOptional() @IsString() buyerRef?: string;
  /** "Pay what you want" chosen amount, smallest MBITE unit. */
  @IsOptional() @IsInt() @Min(1) chosenAmountUnits?: number;
  /** Discount / coupon code. */
  @IsOptional() @IsString() discountCode?: string;
}

@Controller("orders")
export class OrdersController {
  private readonly webBase: string;

  constructor(
    private readonly payments: PaymentsService,
    config: ConfigService,
  ) {
    this.webBase = config.get<string>("NEXT_PUBLIC_API_BASE_URL") ?? "";
  }

  @Post()
  async create(@Body() dto: CreateOrderDto): Promise<CreateOrderResult> {
    const order = await this.payments.createInvoice({
      productId: dto.productId,
      buyerReturnAddress: dto.buyerReturnAddress,
      buyerRef: dto.buyerRef,
      chosenAmountMbite: dto.chosenAmountUnits != null ? BigInt(dto.chosenAmountUnits) : undefined,
      discountCode: dto.discountCode,
    });
    return { orderId: order.id, checkoutUrl: `/checkout/${order.id}` };
  }

  /** Buyer polls this (or we push via SSE later) to watch the invoice fill. */
  @Get(":id")
  getInvoice(@Param("id") id: string): Promise<InvoiceView> {
    return this.payments.getInvoiceView(id);
  }

  /**
   * Fetch what the buyer received once the order is FULFILLED (license key,
   * fresh download link, access note). The orderId acts as the bearer
   * capability; 404 until fulfilled.
   */
  @Get(":id/entitlement")
  getEntitlement(@Param("id") id: string): Promise<Record<string, unknown>> {
    return this.payments.getEntitlement(id);
  }
}
