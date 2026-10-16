import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { MerchantTier, OrderStatus } from "@prisma/client";
import { AdminJwtGuard } from "../admin-auth/admin-jwt.guard";
import { CurrentAdmin, AuthAdmin } from "../admin-auth/current-admin.decorator";
import { AdminService } from "./admin.service";

class ReasonDto {
  @IsOptional() @IsString() reason?: string;
}
class FeeDto {
  @IsInt() @Min(0) @Max(10_000) feeBps!: number;
}
class TierDto {
  @IsEnum(MerchantTier) tier!: MerchantTier;
}

/** ADMIN-and-up endpoints: dashboards, moderation, oversight. */
@UseGuards(AdminJwtGuard)
@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("metrics")
  metrics() {
    return this.admin.metrics();
  }

  // Merchants
  @Get("merchants")
  merchants(@Query("q") q?: string) {
    return this.admin.listMerchants(q);
  }
  @Get("merchants/:id")
  merchant(@Param("id") id: string) {
    return this.admin.getMerchant(id);
  }
  @Post("merchants/:id/suspend")
  suspendMerchant(@CurrentAdmin() me: AuthAdmin, @Param("id") id: string, @Body() dto: ReasonDto) {
    return this.admin.suspendMerchant(me.id, id, dto.reason);
  }
  @Post("merchants/:id/unsuspend")
  unsuspendMerchant(@CurrentAdmin() me: AuthAdmin, @Param("id") id: string) {
    return this.admin.unsuspendMerchant(me.id, id);
  }
  @Put("merchants/:id/fee")
  setFee(@CurrentAdmin() me: AuthAdmin, @Param("id") id: string, @Body() dto: FeeDto) {
    return this.admin.setMerchantFee(me.id, id, dto.feeBps);
  }
  @Put("merchants/:id/tier")
  setTier(@CurrentAdmin() me: AuthAdmin, @Param("id") id: string, @Body() dto: TierDto) {
    return this.admin.setMerchantTier(me.id, id, dto.tier);
  }

  // Buyers
  @Get("buyers")
  buyers(@Query("q") q?: string) {
    return this.admin.listBuyers(q);
  }
  @Post("buyers/:id/suspend")
  suspendBuyer(@CurrentAdmin() me: AuthAdmin, @Param("id") id: string) {
    return this.admin.setBuyerSuspended(me.id, id, true);
  }
  @Post("buyers/:id/unsuspend")
  unsuspendBuyer(@CurrentAdmin() me: AuthAdmin, @Param("id") id: string) {
    return this.admin.setBuyerSuspended(me.id, id, false);
  }

  // Products (moderation)
  @Get("products")
  products(@Query("q") q?: string, @Query("status") status?: "active" | "down") {
    return this.admin.listProducts({ q, status });
  }
  @Post("products/:id/takedown")
  takedown(@CurrentAdmin() me: AuthAdmin, @Param("id") id: string, @Body() dto: ReasonDto) {
    return this.admin.takedownProduct(me.id, id, dto.reason);
  }
  @Post("products/:id/restore")
  restore(@CurrentAdmin() me: AuthAdmin, @Param("id") id: string) {
    return this.admin.restoreProduct(me.id, id);
  }

  // Orders (oversight)
  @Get("orders")
  orders(@Query("status") status?: OrderStatus, @Query("q") q?: string) {
    return this.admin.listOrders({ status, q });
  }

  // Reviews (moderation)
  @Get("reviews")
  reviews(@Query("q") q?: string) {
    return this.admin.listReviews(q);
  }
  @Post("reviews/:id/delete")
  deleteReview(@CurrentAdmin() me: AuthAdmin, @Param("id") id: string) {
    return this.admin.deleteReview(me.id, id);
  }
}
