import { createClient } from "@libsql/client";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { eq, and, like, desc, sql } from "drizzle-orm";
import * as schema from "./db/schema.js";
import { getInitialSeedData } from "./seed.js";

// ─── Koneksi Database ───────────────────────────────────────────────────────

const tursoUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN;

if (!tursoUrl) {
  console.error("❌ TURSO_DATABASE_URL tidak ditemukan! Set environment variable di Vercel.");
}

export const client = createClient({
  url: tursoUrl || "file:local.db",
  authToken: tursoToken
});

export const drizzleDb = drizzleLibsql(client, { schema });

// ─── Helper Waktu WITA (UTC+8) ──────────────────────────────────────────────

export function getWitaDate(dateObj = new Date()) {
  const witaTimeStr = dateObj.toLocaleString("en-US", { timeZone: "Asia/Makassar" });
  const witaDate = new Date(witaTimeStr);
  const yyyy = witaDate.getFullYear();
  const mm = String(witaDate.getMonth() + 1).padStart(2, "0");
  const dd = String(witaDate.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getWitaIsoString(dateObj = new Date()) {
  return new Date(dateObj).toISOString();
}

// ─── Inisialisasi Tabel ─────────────────────────────────────────────────────

const TABLES_DDL = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'courier',
    pin TEXT DEFAULT '1234',
    vehicle TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    standard_price INTEGER NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'Galon',
    description TEXT DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    address_notes TEXT DEFAULT '',
    current_gallon_balance INTEGER NOT NULL DEFAULT 0,
    current_debt_balance INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS customer_custom_prices (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    custom_price INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_address TEXT NOT NULL,
    address_notes TEXT DEFAULT '',
    courier_id TEXT,
    courier_name TEXT DEFAULT 'Belum Ditugaskan',
    delivery_date TEXT NOT NULL,
    delivery_time_slot TEXT DEFAULT 'Bebas',
    delivery_status TEXT NOT NULL DEFAULT 'PENDING',
    payment_status TEXT NOT NULL DEFAULT 'UNPAID',
    empty_gallons_expected INTEGER NOT NULL DEFAULT 0,
    empty_gallons_returned INTEGER NOT NULL DEFAULT 0,
    subtotal_ordered INTEGER NOT NULL DEFAULT 0,
    subtotal_actual INTEGER NOT NULL DEFAULT 0,
    total_paid INTEGER NOT NULL DEFAULT 0,
    payment_method TEXT DEFAULT 'CASH',
    driver_notes TEXT DEFAULT '',
    cancellation_reason TEXT DEFAULT '',
    cancelled_at TEXT,
    delivered_at TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    unit_price INTEGER NOT NULL DEFAULT 0,
    qty_ordered INTEGER NOT NULL DEFAULT 1,
    qty_delivered INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    order_id TEXT,
    customer_id TEXT,
    customer_name TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'CASH',
    collected_by TEXT NOT NULL,
    collected_by_name TEXT NOT NULL,
    payment_date TEXT NOT NULL,
    notes TEXT DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS gallon_logs (
    id TEXT PRIMARY KEY,
    order_id TEXT,
    customer_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    gallons_out INTEGER NOT NULL DEFAULT 0,
    gallons_in INTEGER NOT NULL DEFAULT 0,
    balance_after INTEGER NOT NULL DEFAULT 0,
    notes TEXT DEFAULT '',
    logged_at TEXT NOT NULL
  )`
];

async function initTables() {
  try {
    for (const ddl of TABLES_DDL) {
      await client.execute(ddl);
    }
    console.log("✅ Turso DB schema verified/created.");
    await autoSeedIfEmpty();
  } catch (err) {
    console.error("❌ initTables error:", err.message);
  }
}

async function autoSeedIfEmpty() {
  try {
    const res = await client.execute("SELECT COUNT(*) as cnt FROM users");
    const count = Number(res.rows[0]?.cnt || 0);
    if (count === 0) {
      console.log("🌱 Database kosong, melakukan auto-seed data awal...");
      await seedDatabase(false);
    }
  } catch (e) {
    console.warn("Auto-seed check skipped:", e.message);
  }
}

// ─── Seed Database ──────────────────────────────────────────────────────────

export async function seedDatabase(isZero = false) {
  const seed = getInitialSeedData(isZero);

  // Hapus semua data lama (urutan penting karena foreign key)
  await client.execute("DELETE FROM gallon_logs");
  await client.execute("DELETE FROM payments");
  await client.execute("DELETE FROM order_items");
  await client.execute("DELETE FROM orders");
  await client.execute("DELETE FROM customer_custom_prices");
  await client.execute("DELETE FROM customers");
  await client.execute("DELETE FROM products");
  await client.execute("DELETE FROM users");

  for (const u of seed.users) {
    await client.execute({
      sql: "INSERT OR REPLACE INTO users (id, name, phone, role, pin, vehicle, is_active, created_at) VALUES (?,?,?,?,?,?,?,?)",
      args: [u.id, u.name, u.phone, u.role, u.pin || "1234", u.vehicle || null, u.isActive !== false ? 1 : 0, getWitaIsoString()]
    });
  }

  for (const p of seed.products) {
    await client.execute({
      sql: "INSERT OR REPLACE INTO products (id, name, code, standard_price, unit, description, is_active) VALUES (?,?,?,?,?,?,?)",
      args: [p.id, p.name, p.code, p.standardPrice, p.unit || "Galon", p.description || "", p.isActive !== false ? 1 : 0]
    });
  }

  for (const c of seed.customers) {
    await client.execute({
      sql: "INSERT OR REPLACE INTO customers (id, name, phone, address, address_notes, current_gallon_balance, current_debt_balance, created_at) VALUES (?,?,?,?,?,?,?,?)",
      args: [c.id, c.name, c.phone, c.address, c.addressNotes || "", c.currentGallonBalance || 0, c.currentDebtBalance || 0, c.createdAt || getWitaDate()]
    });
    if (c.customPrices) {
      for (const [prodId, price] of Object.entries(c.customPrices)) {
        await client.execute({
          sql: "INSERT OR REPLACE INTO customer_custom_prices (id, customer_id, product_id, custom_price) VALUES (?,?,?,?)",
          args: [`cp-${c.id}-${prodId}`, c.id, prodId, Number(price)]
        });
      }
    }
  }

  for (const o of seed.orders) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO orders (id, customer_id, customer_name, customer_phone, customer_address, address_notes,
            courier_id, courier_name, delivery_date, delivery_time_slot, delivery_status, payment_status,
            empty_gallons_expected, empty_gallons_returned, subtotal_ordered, subtotal_actual, total_paid,
            payment_method, driver_notes, cancellation_reason, cancelled_at, delivered_at, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [o.id, o.customerId, o.customerName, o.customerPhone, o.customerAddress, o.addressNotes || "",
        o.courierId || null, o.courierName || "Belum Ditugaskan", o.deliveryDate, o.deliveryTimeSlot || "Bebas",
        o.deliveryStatus || "PENDING", o.paymentStatus || "UNPAID",
        o.emptyGallonsExpected || 0, o.emptyGallonsReturned || 0, o.subtotalOrdered || 0, o.subtotalActual || 0,
        o.totalPaid || 0, o.paymentMethod || "CASH", o.driverNotes || "", o.cancellationReason || "",
        o.cancelledAt || null, o.deliveredAt || null, o.createdAt || getWitaIsoString()]
    });
    if (o.items && o.items.length > 0) {
      for (let idx = 0; idx < o.items.length; idx++) {
        const it = o.items[idx];
        await client.execute({
          sql: "INSERT OR REPLACE INTO order_items (id, order_id, product_id, product_name, unit_price, qty_ordered, qty_delivered) VALUES (?,?,?,?,?,?,?)",
          args: [`item-${o.id}-${idx + 1}`, o.id, it.productId, it.productName, it.unitPrice, it.qtyOrdered, it.qtyDelivered]
        });
      }
    }
  }

  for (const p of seed.payments || []) {
    await client.execute({
      sql: "INSERT OR REPLACE INTO payments (id, order_id, customer_id, customer_name, amount, payment_method, collected_by, collected_by_name, payment_date, notes) VALUES (?,?,?,?,?,?,?,?,?,?)",
      args: [p.id, p.orderId || null, p.customerId || null, p.customerName, p.amount, p.paymentMethod || "CASH", p.collectedBy, p.collectedByName, p.paymentDate || getWitaIsoString(), p.notes || ""]
    });
  }

  for (const g of seed.gallonLogs || []) {
    await client.execute({
      sql: "INSERT OR REPLACE INTO gallon_logs (id, order_id, customer_id, customer_name, gallons_out, gallons_in, balance_after, notes, logged_at) VALUES (?,?,?,?,?,?,?,?,?)",
      args: [g.id, g.orderId || null, g.customerId, g.customerName, g.gallonsOut || 0, g.gallonsIn || 0, g.balanceAfter || 0, g.notes || "", g.loggedAt || getWitaIsoString()]
    });
  }

  console.log("✅ Seed database selesai.");
}

// ─── Database Helper Class (Async) ──────────────────────────────────────────

class TursoDatabaseHelper {

  // ── Helper: konversi row ke objek ──
  _rowToUser(r) {
    if (!r) return null;
    return { id: r.id, name: r.name, phone: r.phone, role: r.role, pin: r.pin, vehicle: r.vehicle || null, isActive: r.is_active === 1 || r.is_active === true };
  }
  _rowToProduct(r) {
    if (!r) return null;
    return { id: r.id, name: r.name, code: r.code, standardPrice: Number(r.standard_price), unit: r.unit, description: r.description || "", isActive: r.is_active === 1 || r.is_active === true };
  }
  _rowToCustomer(r, customPrices = {}) {
    if (!r) return null;
    return { id: r.id, name: r.name, phone: r.phone, address: r.address, addressNotes: r.address_notes || "", currentGallonBalance: Number(r.current_gallon_balance || 0), currentDebtBalance: Number(r.current_debt_balance || 0), createdAt: r.created_at, customPrices };
  }
  _rowToOrder(r, items = []) {
    if (!r) return null;
    return {
      id: r.id, customerId: r.customer_id, customerName: r.customer_name, customerPhone: r.customer_phone,
      customerAddress: r.customer_address, addressNotes: r.address_notes || "",
      courierId: r.courier_id || null, courierName: r.courier_name || "Belum Ditugaskan",
      deliveryDate: r.delivery_date, deliveryTimeSlot: r.delivery_time_slot || "Bebas",
      deliveryStatus: r.delivery_status, paymentStatus: r.payment_status,
      emptyGallonsExpected: Number(r.empty_gallons_expected || 0), emptyGallonsReturned: Number(r.empty_gallons_returned || 0),
      subtotalOrdered: Number(r.subtotal_ordered || 0), subtotalActual: Number(r.subtotal_actual || 0),
      totalPaid: Number(r.total_paid || 0), paymentMethod: r.payment_method || "CASH",
      driverNotes: r.driver_notes || "", cancellationReason: r.cancellation_reason || "",
      cancelledAt: r.cancelled_at || null, deliveredAt: r.delivered_at || null,
      createdAt: r.created_at, items
    };
  }
  _rowToItem(r) {
    if (!r) return null;
    return { productId: r.product_id, productName: r.product_name, unitPrice: Number(r.unit_price || 0), qtyOrdered: Number(r.qty_ordered || 1), qtyDelivered: Number(r.qty_delivered || 1) };
  }
  _rowToPayment(r) {
    if (!r) return null;
    return { id: r.id, orderId: r.order_id || null, customerId: r.customer_id || null, customerName: r.customer_name, amount: Number(r.amount || 0), paymentMethod: r.payment_method || "CASH", collectedBy: r.collected_by, collectedByName: r.collected_by_name, paymentDate: r.payment_date, notes: r.notes || "" };
  }
  _rowToGallonLog(r) {
    if (!r) return null;
    return { id: r.id, orderId: r.order_id || null, customerId: r.customer_id, customerName: r.customer_name, gallonsOut: Number(r.gallons_out || 0), gallonsIn: Number(r.gallons_in || 0), balanceAfter: Number(r.balance_after || 0), notes: r.notes || "", loggedAt: r.logged_at };
  }

  // ── Getter .data (untuk /api/system/export) ──
  async getData() {
    const [users, products, customers, orders, payments, gallonLogs] = await Promise.all([
      this.getUsers(), this.getProducts(), this.getCustomers(), this.getOrders(), this.getPayments(), this.getGallonLogs()
    ]);
    return { users, products, customers, orders, payments, gallonLogs, lastUpdated: new Date().toISOString() };
  }

  // ── Reset ──
  async reset() {
    await seedDatabase(false);
    return this.getData();
  }
  async resetToZero() {
    await seedDatabase(true);
    return this.getData();
  }

  // ══ USERS ══════════════════════════════════════════════════════════════════

  async getUsers(filters = {}) {
    let q = "SELECT * FROM users WHERE 1=1";
    const args = [];
    if (filters.role) { q += " AND role = ?"; args.push(filters.role); }
    if (filters.active !== undefined) {
      const activeVal = (filters.active === "true" || filters.active === true) ? 1 : 0;
      q += " AND is_active = ?"; args.push(activeVal);
    }
    const res = await client.execute({ sql: q, args });
    return res.rows.map(r => this._rowToUser(r));
  }

  async getUserById(id) {
    const res = await client.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [id] });
    return this._rowToUser(res.rows[0]);
  }

  async getUserByPhone(phone) {
    const res = await client.execute({ sql: "SELECT * FROM users WHERE phone = ?", args: [phone.trim()] });
    return this._rowToUser(res.rows[0]);
  }

  async createUser(data) {
    await client.execute({
      sql: "INSERT OR REPLACE INTO users (id, name, phone, role, pin, vehicle, is_active, created_at) VALUES (?,?,?,?,?,?,?,?)",
      args: [data.id, data.name, data.phone, data.role || "courier", data.pin || "1234", data.vehicle || null, data.isActive !== false ? 1 : 0, getWitaIsoString()]
    });
    return this.getUserById(data.id);
  }

  async updateUser(id, data) {
    const parts = [], args = [];
    if (data.name !== undefined) { parts.push("name = ?"); args.push(data.name.trim()); }
    if (data.phone !== undefined) { parts.push("phone = ?"); args.push(data.phone.trim()); }
    if (data.role !== undefined) { parts.push("role = ?"); args.push(data.role); }
    if (data.pin !== undefined) { parts.push("pin = ?"); args.push(String(data.pin)); }
    if (data.vehicle !== undefined) { parts.push("vehicle = ?"); args.push(data.vehicle ? data.vehicle.trim() : null); }
    if (data.isActive !== undefined) { parts.push("is_active = ?"); args.push(data.isActive ? 1 : 0); }
    if (parts.length === 0) return this.getUserById(id);
    args.push(id);
    await client.execute({ sql: `UPDATE users SET ${parts.join(", ")} WHERE id = ?`, args });
    return this.getUserById(id);
  }

  async deleteUser(id) {
    await client.execute({ sql: "UPDATE users SET is_active = 0 WHERE id = ?", args: [id] });
  }

  // ══ PRODUCTS ═══════════════════════════════════════════════════════════════

  async getProducts(filters = {}) {
    let q = "SELECT * FROM products WHERE 1=1";
    const args = [];
    if (filters.active !== undefined) {
      const activeVal = (filters.active === "true" || filters.active === true) ? 1 : 0;
      q += " AND is_active = ?"; args.push(activeVal);
    }
    const res = await client.execute({ sql: q, args });
    return res.rows.map(r => this._rowToProduct(r));
  }

  async getProductById(id) {
    const res = await client.execute({ sql: "SELECT * FROM products WHERE id = ?", args: [id] });
    return this._rowToProduct(res.rows[0]);
  }

  async createProduct(data) {
    await client.execute({
      sql: "INSERT OR REPLACE INTO products (id, name, code, standard_price, unit, description, is_active) VALUES (?,?,?,?,?,?,?)",
      args: [data.id, data.name, data.code, Number(data.standardPrice), data.unit || "Galon", data.description || "", data.isActive !== false ? 1 : 0]
    });
    return this.getProductById(data.id);
  }

  async updateProduct(id, data) {
    const parts = [], args = [];
    if (data.name !== undefined) { parts.push("name = ?"); args.push(data.name.trim()); }
    if (data.code !== undefined) { parts.push("code = ?"); args.push(data.code.trim()); }
    if (data.standardPrice !== undefined) { parts.push("standard_price = ?"); args.push(Number(data.standardPrice)); }
    if (data.unit !== undefined) { parts.push("unit = ?"); args.push(data.unit.trim()); }
    if (data.description !== undefined) { parts.push("description = ?"); args.push(data.description.trim()); }
    if (data.isActive !== undefined) { parts.push("is_active = ?"); args.push(data.isActive ? 1 : 0); }
    if (parts.length === 0) return this.getProductById(id);
    args.push(id);
    await client.execute({ sql: `UPDATE products SET ${parts.join(", ")} WHERE id = ?`, args });
    return this.getProductById(id);
  }

  // ══ CUSTOMERS ══════════════════════════════════════════════════════════════

  async getCustomers(filters = {}) {
    let q = "SELECT * FROM customers WHERE 1=1";
    const args = [];
    if (filters.q && filters.q.trim()) {
      const term = `%${filters.q.trim()}%`;
      q += " AND (name LIKE ? OR phone LIKE ? OR address LIKE ?)";
      args.push(term, term, term);
    }
    const res = await client.execute({ sql: q, args });
    const pricesRes = await client.execute("SELECT * FROM customer_custom_prices");
    return res.rows.map(r => {
      const customPrices = {};
      pricesRes.rows.filter(p => p.customer_id === r.id).forEach(p => { customPrices[p.product_id] = Number(p.custom_price); });
      return this._rowToCustomer(r, customPrices);
    });
  }

  async getCustomerById(id) {
    const res = await client.execute({ sql: "SELECT * FROM customers WHERE id = ?", args: [id] });
    if (!res.rows[0]) return null;
    const pricesRes = await client.execute({ sql: "SELECT * FROM customer_custom_prices WHERE customer_id = ?", args: [id] });
    const customPrices = {};
    pricesRes.rows.forEach(p => { customPrices[p.product_id] = Number(p.custom_price); });
    return this._rowToCustomer(res.rows[0], customPrices);
  }

  async createCustomer(data) {
    await client.execute({
      sql: "INSERT OR REPLACE INTO customers (id, name, phone, address, address_notes, current_gallon_balance, current_debt_balance, created_at) VALUES (?,?,?,?,?,?,?,?)",
      args: [data.id, data.name, data.phone, data.address, data.addressNotes || "", data.currentGallonBalance || 0, data.currentDebtBalance || 0, data.createdAt || getWitaDate()]
    });
    return this.getCustomerById(data.id);
  }

  async updateCustomer(id, data) {
    const parts = [], args = [];
    if (data.name !== undefined) { parts.push("name = ?"); args.push(data.name.trim()); }
    if (data.phone !== undefined) { parts.push("phone = ?"); args.push(data.phone.trim()); }
    if (data.address !== undefined) { parts.push("address = ?"); args.push(data.address.trim()); }
    if (data.addressNotes !== undefined) { parts.push("address_notes = ?"); args.push(data.addressNotes.trim()); }
    if (data.currentGallonBalance !== undefined) { parts.push("current_gallon_balance = ?"); args.push(Number(data.currentGallonBalance)); }
    if (data.currentDebtBalance !== undefined) { parts.push("current_debt_balance = ?"); args.push(Number(data.currentDebtBalance)); }
    if (parts.length === 0) return this.getCustomerById(id);
    args.push(id);
    await client.execute({ sql: `UPDATE customers SET ${parts.join(", ")} WHERE id = ?`, args });
    return this.getCustomerById(id);
  }

  async deleteCustomer(id) {
    await client.execute({ sql: "DELETE FROM customer_custom_prices WHERE customer_id = ?", args: [id] });
    await client.execute({ sql: "DELETE FROM customers WHERE id = ?", args: [id] });
  }

  async setCustomPrice(customerId, productId, customPrice) {
    const price = Number(customPrice);
    if (isNaN(price) || price <= 0) {
      await client.execute({ sql: "DELETE FROM customer_custom_prices WHERE customer_id = ? AND product_id = ?", args: [customerId, productId] });
    } else {
      await client.execute({
        sql: "INSERT OR REPLACE INTO customer_custom_prices (id, customer_id, product_id, custom_price) VALUES (?,?,?,?)",
        args: [`cp-${customerId}-${productId}`, customerId, productId, price]
      });
    }
  }

  async deleteCustomPrice(customerId, productId) {
    await client.execute({ sql: "DELETE FROM customer_custom_prices WHERE customer_id = ? AND product_id = ?", args: [customerId, productId] });
  }

  async getEffectivePrice(customerId, productId) {
    const priceRes = await client.execute({ sql: "SELECT custom_price FROM customer_custom_prices WHERE customer_id = ? AND product_id = ?", args: [customerId, productId] });
    if (priceRes.rows[0]) return Number(priceRes.rows[0].custom_price);
    const prod = await this.getProductById(productId);
    return prod ? prod.standardPrice : 0;
  }

  // ══ ORDERS ═════════════════════════════════════════════════════════════════

  async getOrders(filters = {}) {
    let q = "SELECT * FROM orders WHERE 1=1";
    const args = [];
    if (filters.date) { q += " AND delivery_date = ?"; args.push(filters.date); }
    if (filters.courierId) { q += " AND courier_id = ?"; args.push(filters.courierId); }
    if (filters.status) { q += " AND delivery_status = ?"; args.push(filters.status); }
    if (filters.paymentStatus) { q += " AND payment_status = ?"; args.push(filters.paymentStatus); }
    if (filters.customerId) { q += " AND customer_id = ?"; args.push(filters.customerId); }
    q += " ORDER BY created_at DESC";
    const res = await client.execute({ sql: q, args });
    const orderIds = res.rows.map(r => r.id);
    if (orderIds.length === 0) return [];
    const itemsRes = await client.execute({ sql: `SELECT * FROM order_items WHERE order_id IN (${orderIds.map(() => "?").join(",")})`, args: orderIds });
    return res.rows.map(r => {
      const items = itemsRes.rows.filter(i => i.order_id === r.id).map(i => this._rowToItem(i));
      return this._rowToOrder(r, items);
    });
  }

  async getOrderById(id) {
    const res = await client.execute({ sql: "SELECT * FROM orders WHERE id = ?", args: [id] });
    if (!res.rows[0]) return null;
    const itemsRes = await client.execute({ sql: "SELECT * FROM order_items WHERE order_id = ?", args: [id] });
    const items = itemsRes.rows.map(i => this._rowToItem(i));
    return this._rowToOrder(res.rows[0], items);
  }

  async createOrder(data) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO orders (id, customer_id, customer_name, customer_phone, customer_address, address_notes,
            courier_id, courier_name, delivery_date, delivery_time_slot, delivery_status, payment_status,
            empty_gallons_expected, empty_gallons_returned, subtotal_ordered, subtotal_actual, total_paid,
            payment_method, driver_notes, cancellation_reason, cancelled_at, delivered_at, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [data.id, data.customerId, data.customerName, data.customerPhone, data.customerAddress, data.addressNotes || "",
        data.courierId || null, data.courierName || "Belum Ditugaskan", data.deliveryDate, data.deliveryTimeSlot || "Bebas",
        data.deliveryStatus || "PENDING", data.paymentStatus || "UNPAID",
        data.emptyGallonsExpected || 0, data.emptyGallonsReturned || 0, data.subtotalOrdered || 0, data.subtotalActual || 0,
        data.totalPaid || 0, data.paymentMethod || "CASH", data.driverNotes || "", data.cancellationReason || "",
        data.cancelledAt || null, data.deliveredAt || null, data.createdAt || getWitaIsoString()]
    });
    if (data.items && data.items.length > 0) {
      await client.execute({ sql: "DELETE FROM order_items WHERE order_id = ?", args: [data.id] });
      for (let idx = 0; idx < data.items.length; idx++) {
        const it = data.items[idx];
        await client.execute({
          sql: "INSERT INTO order_items (id, order_id, product_id, product_name, unit_price, qty_ordered, qty_delivered) VALUES (?,?,?,?,?,?,?)",
          args: [`item-${data.id}-${idx + 1}`, data.id, it.productId, it.productName, it.unitPrice, it.qtyOrdered, it.qtyDelivered]
        });
      }
    }
    return this.getOrderById(data.id);
  }

  async updateOrder(id, data) {
    const parts = [], args = [];
    const fields = {
      deliveryDate: "delivery_date", deliveryTimeSlot: "delivery_time_slot", courierId: "courier_id",
      courierName: "courier_name", deliveryStatus: "delivery_status", paymentStatus: "payment_status",
      emptyGallonsExpected: "empty_gallons_expected", emptyGallonsReturned: "empty_gallons_returned",
      subtotalOrdered: "subtotal_ordered", subtotalActual: "subtotal_actual", totalPaid: "total_paid",
      paymentMethod: "payment_method", driverNotes: "driver_notes", addressNotes: "address_notes",
      cancellationReason: "cancellation_reason", cancelledAt: "cancelled_at", deliveredAt: "delivered_at"
    };
    for (const [jsKey, sqlCol] of Object.entries(fields)) {
      if (data[jsKey] !== undefined) { parts.push(`${sqlCol} = ?`); args.push(data[jsKey]); }
    }
    if (parts.length > 0) {
      args.push(id);
      await client.execute({ sql: `UPDATE orders SET ${parts.join(", ")} WHERE id = ?`, args });
    }
    if (Array.isArray(data.items) && data.items.length > 0) {
      await client.execute({ sql: "DELETE FROM order_items WHERE order_id = ?", args: [id] });
      for (let idx = 0; idx < data.items.length; idx++) {
        const it = data.items[idx];
        await client.execute({
          sql: "INSERT INTO order_items (id, order_id, product_id, product_name, unit_price, qty_ordered, qty_delivered) VALUES (?,?,?,?,?,?,?)",
          args: [`item-${id}-${idx + 1}`, id, it.productId, it.productName, it.unitPrice, it.qtyOrdered, it.qtyDelivered]
        });
      }
    }
    return this.getOrderById(id);
  }

  async deleteOrder(id) {
    await client.execute({ sql: "DELETE FROM order_items WHERE order_id = ?", args: [id] });
    await client.execute({ sql: "DELETE FROM orders WHERE id = ?", args: [id] });
  }

  // ══ PAYMENTS ═══════════════════════════════════════════════════════════════

  async getPayments(filters = {}) {
    let q = "SELECT * FROM payments WHERE 1=1";
    const args = [];
    if (filters.customerId) { q += " AND customer_id = ?"; args.push(filters.customerId); }
    if (filters.orderId) { q += " AND order_id = ?"; args.push(filters.orderId); }
    q += " ORDER BY payment_date DESC";
    const res = await client.execute({ sql: q, args });
    return res.rows.map(r => this._rowToPayment(r));
  }

  async getPaymentById(id) {
    const res = await client.execute({ sql: "SELECT * FROM payments WHERE id = ?", args: [id] });
    return this._rowToPayment(res.rows[0]);
  }

  async createPayment(data) {
    await client.execute({
      sql: "INSERT OR REPLACE INTO payments (id, order_id, customer_id, customer_name, amount, payment_method, collected_by, collected_by_name, payment_date, notes) VALUES (?,?,?,?,?,?,?,?,?,?)",
      args: [data.id, data.orderId || null, data.customerId || null, data.customerName, Number(data.amount), data.paymentMethod || "CASH", data.collectedBy, data.collectedByName, data.paymentDate || getWitaIsoString(), data.notes || ""]
    });
    return this.getPaymentById(data.id);
  }

  async deletePayment(id) {
    await client.execute({ sql: "DELETE FROM payments WHERE id = ?", args: [id] });
  }

  // ══ GALLON LOGS ════════════════════════════════════════════════════════════

  async getGallonLogs(filters = {}) {
    let q = "SELECT * FROM gallon_logs WHERE 1=1";
    const args = [];
    if (filters.customerId) { q += " AND customer_id = ?"; args.push(filters.customerId); }
    if (filters.orderId) { q += " AND order_id = ?"; args.push(filters.orderId); }
    q += " ORDER BY logged_at DESC";
    const res = await client.execute({ sql: q, args });
    return res.rows.map(r => this._rowToGallonLog(r));
  }

  async getGallonLogById(id) {
    const res = await client.execute({ sql: "SELECT * FROM gallon_logs WHERE id = ?", args: [id] });
    return this._rowToGallonLog(res.rows[0]);
  }

  async createGallonLog(data) {
    await client.execute({
      sql: "INSERT OR REPLACE INTO gallon_logs (id, order_id, customer_id, customer_name, gallons_out, gallons_in, balance_after, notes, logged_at) VALUES (?,?,?,?,?,?,?,?,?)",
      args: [data.id, data.orderId || null, data.customerId, data.customerName, data.gallonsOut || 0, data.gallonsIn || 0, data.balanceAfter || 0, data.notes || "", data.loggedAt || getWitaIsoString()]
    });
    return this.getGallonLogById(data.id);
  }

  async deleteGallonLog(id) {
    await client.execute({ sql: "DELETE FROM gallon_logs WHERE id = ?", args: [id] });
  }
}

export const db = new TursoDatabaseHelper();

// Inisialisasi tabel saat modul pertama kali dimuat
initTables().catch(console.error);
