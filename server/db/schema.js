import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// 1. Users Table (Pengguna)
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  role: text("role").notNull().default("courier"),
  pin: text("pin").default("1234"),
  vehicle: text("vehicle"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
});

// 2. Products Table (Katalog Produk)
export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  standardPrice: integer("standard_price").notNull().default(0),
  unit: text("unit").notNull().default("Galon"),
  description: text("description").default(""),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true)
});

// 3. Customers Table (Pelanggan)
export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  addressNotes: text("address_notes").default(""),
  currentGallonBalance: integer("current_gallon_balance").notNull().default(0),
  currentDebtBalance: integer("current_debt_balance").notNull().default(0),
  createdAt: text("created_at").notNull()
});

// 4. Customer Custom Prices Table (Harga Khusus Pelanggan)
export const customerCustomPrices = sqliteTable("customer_custom_prices", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  customPrice: integer("custom_price").notNull()
});

// 5. Orders Table (Pesanan)
export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull().references(() => customers.id),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerAddress: text("customer_address").notNull(),
  addressNotes: text("address_notes").default(""),
  courierId: text("courier_id"),
  courierName: text("courier_name").default("Belum Ditugaskan"),
  deliveryDate: text("delivery_date").notNull(),
  deliveryTimeSlot: text("delivery_time_slot").default("Bebas"),
  deliveryStatus: text("delivery_status").notNull().default("PENDING"),
  paymentStatus: text("payment_status").notNull().default("UNPAID"),
  emptyGallonsExpected: integer("empty_gallons_expected").notNull().default(0),
  emptyGallonsReturned: integer("empty_gallons_returned").notNull().default(0),
  subtotalOrdered: integer("subtotal_ordered").notNull().default(0),
  subtotalActual: integer("subtotal_actual").notNull().default(0),
  totalPaid: integer("total_paid").notNull().default(0),
  paymentMethod: text("payment_method").default("CASH"),
  driverNotes: text("driver_notes").default(""),
  cancellationReason: text("cancellation_reason").default(""),
  cancelledAt: text("cancelled_at"),
  deliveredAt: text("delivered_at"),
  createdAt: text("created_at").notNull()
});

// 6. Order Items Table (Item Detail Pesanan)
export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull(),
  productName: text("product_name").notNull(),
  unitPrice: integer("unit_price").notNull().default(0),
  qtyOrdered: integer("qty_ordered").notNull().default(1),
  qtyDelivered: integer("qty_delivered").notNull().default(1)
});

// 7. Payments Table (Riwayat Pembayaran)
export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  orderId: text("order_id"),
  customerId: text("customer_id"),
  customerName: text("customer_name").notNull(),
  amount: integer("amount").notNull().default(0),
  paymentMethod: text("payment_method").notNull().default("CASH"),
  collectedBy: text("collected_by").notNull(),
  collectedByName: text("collected_by_name").notNull(),
  paymentDate: text("payment_date").notNull(),
  notes: text("notes").default("")
});

// 8. Gallon Logs Table (Mutasi Galon Kosong)
export const gallonLogs = sqliteTable("gallon_logs", {
  id: text("id").primaryKey(),
  orderId: text("order_id"),
  customerId: text("customer_id").notNull(),
  customerName: text("customer_name").notNull(),
  gallonsOut: integer("gallons_out").notNull().default(0),
  gallonsIn: integer("gallons_in").notNull().default(0),
  balanceAfter: integer("balance_after").notNull().default(0),
  notes: text("notes").default(""),
  loggedAt: text("logged_at").notNull()
});
