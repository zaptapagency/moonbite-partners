import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { ReviewsService } from "./reviews.service";

class CreateReviewDto {
  /** The fulfilled order that proves purchase (gates the review). */
  @IsString() orderId!: string;
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() comment?: string;
}

@Controller("products/:id/reviews")
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  /** List a product's reviews, newest first. */
  @Get()
  list(@Param("id") id: string) {
    return this.reviews.list(id);
  }

  /** Leave a review for a product (gated on a fulfilled order for it). */
  @Post()
  create(@Param("id") id: string, @Body() dto: CreateReviewDto) {
    return this.reviews.create(id, {
      orderId: dto.orderId,
      rating: dto.rating,
      comment: dto.comment,
    });
  }
}
