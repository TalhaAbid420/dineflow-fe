// Shared order types used by both the customer chat page and the chef dashboard.

export type OrderItem = {
  menu_item_id: number | null;
  name: string;
  price: number;
  quantity: number;
};

export type OrderStatus = "pending" | "baking" | "baked" | "in-delivery" | "cancelled";

export type OrderType = "dine_in" | "delivery";

export type Order = {
  id: number;
  session_id: string;
  user_id: number | null;
  customer_name: string;
  user_email?: string | null;
  user_name?: string | null;
  order_type: OrderType;
  delivery_address: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  items: OrderItem[];
};

export const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  dine_in: "Dine-in",
  delivery: "Delivery",
};

export const STATUS_FLOW: OrderStatus[] = ["pending", "baking", "baked", "in-delivery"];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  baking: "Baking",
  baked: "Baked",
  "in-delivery": "In delivery",
  cancelled: "Cancelled",
};

export const STATUS_DOT: Record<OrderStatus, string> = {
  pending: "bg-zinc-400",
  baking: "bg-orange-500",
  baked: "bg-emerald-500",
  "in-delivery": "bg-sky-500",
  cancelled: "bg-red-500",
};

export const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  baking: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  baked: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "in-delivery": "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};
