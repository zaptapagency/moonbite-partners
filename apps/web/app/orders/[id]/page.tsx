"use client";

import { use } from "react";
import OrderStatusView from "../../../components/OrderStatusView";

/**
 * Shareable, bookmarkable order-status link. Reuses the same live-polling
 * view as checkout so a buyer can revisit their order at any time.
 */
export default function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <div>
      <p style={{ color: "#9aa4b2", fontSize: 13, marginBottom: 8 }}>
        Order status
      </p>
      <OrderStatusView orderId={id} />
    </div>
  );
}
