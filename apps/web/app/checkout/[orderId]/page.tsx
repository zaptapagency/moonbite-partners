"use client";

import { use } from "react";
import OrderStatusView from "../../../components/OrderStatusView";

export default function CheckoutPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  return <OrderStatusView orderId={orderId} />;
}
