import { Controller, Get, Param } from "@nestjs/common";
import { StorefrontService } from "./storefront.service";

/** Public creator storefront: `GET /storefront/:handle`. No auth. */
@Controller("storefront")
export class StorefrontController {
  constructor(private readonly storefront: StorefrontService) {}

  @Get(":handle")
  get(@Param("handle") handle: string) {
    return this.storefront.getStorefront(handle);
  }
}
