import { createClient } from "@libsql/client";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import Database from "better-sqlite3";
import { drizzle as drizzleBetter } from "drizzle-orm/better-sqlite3";
import { eq, and, or, like, desc, sql } from "drizzle-orm";
import * as schema from "./db/schema.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "asalynn.db");

let drizzleDb = null;
let sqlite = null;
let client = null;

const tursoUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN;

if (tursoUrl) {
  try {
    client = createClient({ url: tursoUrl, authToken: tursoToken });
    drizzleDb = drizzleLibsql(client, { schema });
    console.log("⚡ Connected to Turso Cloud Database");
  } catch (err) {
    console.error("Failed to connect to Turso Cloud DB:", err);
  }
}

if (!drizzleDb) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    sqlite = new Database(DB_FILE);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    drizzleDb = drizzleBetter(sqlite, { schema });
    console.log("📁 Connected to local SQLite file:", DB_FILE);
  } catch (err) {
    console.warn("Local SQLite file fallback (ephemeral environment / Vercel):", err.message);
  }
}

export { drizzleDb, client };

const TABLES_DDL = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'courier',
      pin TEXT DEFAULT '1234',
      vehicle TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      standard_price INTEGER NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'Galon',
      description TEXT DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      address_notes TEXT DEFAULT '',
      current_gallon_balance INTEGER NOT NULL DEFAULT 0,
      current_debt_balance INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customer_custom_prices (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      custom_price INTEGER NOT NULL,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
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
      created_at TEXT NOT NULL,
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      unit_price INTEGER NOT NULL DEFAULT 0,
      qty_ordered INTEGER NOT NULL DEFAULT 1,
      qty_delivered INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
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
    );

    CREATE TABLE IF NOT EXISTS gallon_logs (
      id TEXT PRIMARY KEY,
      order_id TEXT,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      gallons_out INTEGER NOT NULL DEFAULT 0,
      gallons_in INTEGER NOT NULL DEFAULT 0,
      balance_after INTEGER NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      logged_at TEXT NOT NULL
    );
`;

// Inisialisasi tabel otomatis
async function initTables() {
  if (client) {
    try {
      await client.executeMultiple(TABLES_DDL);
      console.log("⚡ Turso Cloud DB schema verified/created successfully.");
    } catch (err) {
      console.warn("Turso Cloud schema init notice:", err.message);
    }
  }

  if (sqlite) {
    try {
      sqlite.exec(TABLES_DDL);
    } catch (err) {
      console.warn("Table init skipped:", err.message);
    }
  }
}

initTables();

// Helper Waktu Zona Asia/Makassar (WITA, UTC+8)
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

export function getInitialSeedData() {
  const today = getWitaDate();
  return {
    users: [
      {
        id: "usr-admin-1",
        name: "Hj. Asmawati (Owner)",
        phone: "081234567890",
        role: "admin",
        pin: "1234",
        isActive: true,
        vehicle: null
      },
      {
        id: "usr-courier-1",
        name: "Daeng Rahmat",
        phone: "082198765432",
        role: "courier",
        pin: "1111",
        isActive: true,
        vehicle: "Motor Roda Tiga (Tossa)"
      },
      {
        id: "usr-courier-2",
        name: "Andi Pratama",
        phone: "085345678901",
        role: "courier",
        pin: "2222",
        isActive: true,
        vehicle: "Sepeda Motor Obrok"
      }
    ],
    products: [
      {
        id: "prod-refill-19l",
        name: "Refill Air Galon 19L Asalynn",
        code: "RFL-19",
        standardPrice: 7000,
        description: "Air minum isi ulang higienis proses filter 8 tahap & ozonisasi",
        unit: "Galon",
        isActive: true
      },
      {
        id: "prod-new-gallon-19l",
        name: "Galon Baru + Air 19L",
        code: "GLN-NEW",
        standardPrice: 45000,
        description: "Galon PET food grade baru tebal lengkap dengan isi air Asalynn",
        unit: "Galon",
        isActive: true
      },
      {
        id: "prod-cup-dus",
        name: "Air Mineral Gelas Asalynn (Dus 48x220ml)",
        code: "CUP-48",
        standardPrice: 19000,
        description: "Dus air kemasan gelas cocok untuk acara & warung",
        unit: "Dus",
        isActive: true
      },
      {
        id: "prod-bottle-600",
        name: "Air Mineral Botol 600ml (Dus 24 botol)",
        code: "BTL-600",
        standardPrice: 35000,
        description: "Air kemasan botol praktis untuk kantor & hajatan",
        unit: "Dus",
        isActive: true
      },
      {
        id: "prod-cap-seal",
        name: "Tutup Galon & Tisu Higienis (Paket Ekstra)",
        code: "SEAL-PK",
        standardPrice: 2000,
        description: "Tutup ekstra anti-bocor dan tisu pembersih mulut galon",
        unit: "Set",
        isActive: true
      }
    ],
    customers: [
      {
        id: "cust-1",
        name: "Warung Coto Daeng Tata",
        phone: "081299887766",
        address: "Jl. Daeng Tata Raya No. 45, Parang Tambung, Makassar",
        addressNotes: "Samping Masjid Nurul Huda, masuk lorong kedua gerbang cat hijau",
        currentGallonBalance: 6,
        currentDebtBalance: 0,
        customPrices: { "prod-refill-19l": 6000 },
        createdAt: "2026-09-15"
      },
      {
        id: "cust-2",
        name: "Ibu Hj. Rosdiana (BTP)",
        phone: "085244332211",
        address: "Perumahan Bumi Tamalanrea Permai (BTP) Blok M No. 12, Makassar",
        addressNotes: "Rumah pagar hitam tingkat dua, ada pohon mangga",
        currentGallonBalance: 3,
        currentDebtBalance: 14000,
        customPrices: {},
        createdAt: "2026-09-20"
      },
      {
        id: "cust-3",
        name: "Kos Putri Lavender (Ibu Melati)",
        phone: "087811223344",
        address: "Jl. Sahabat No. 18, Dekat Kampus Unhas Tamalanrea, Makassar",
        addressNotes: "Pagar putih tinggi, bel pintu ada di sebelah kanan gerbang",
        currentGallonBalance: 8,
        currentDebtBalance: 0,
        customPrices: { "prod-refill-19l": 6500 },
        createdAt: "2026-09-25"
      },
      {
        id: "cust-4",
        name: "Resto Seafood Paotere (Pak Basri)",
        phone: "081377665544",
        address: "Kawasan Wisata Bahari Paotere No. 7, Ujung Pandang, Makassar",
        addressNotes: "Dapur belakang resto, masuk lewat jalan samping parkiran",
        currentGallonBalance: 12,
        currentDebtBalance: 0,
        customPrices: { "prod-refill-19l": 6000, "prod-cup-dus": 18000 },
        createdAt: "2026-09-28"
      },
      {
        id: "cust-5",
        name: "Keluarga Bpk. Irwan",
        phone: "082155667788",
        address: "Jl. AP Pettarani Komp. IDI Blok GA/8, Panakkukang, Makassar",
        addressNotes: "Rumah cat krem dekat pos security",
        currentGallonBalance: 2,
        currentDebtBalance: 0,
        customPrices: {},
        createdAt: "2026-10-01"
      }
    ],
    orders: [
      {
        id: "ORD-20261004-001",
        customerId: "cust-1",
        customerName: "Warung Coto Daeng Tata",
        customerPhone: "081299887766",
        customerAddress: "Jl. Daeng Tata Raya No. 45, Parang Tambung, Makassar",
        addressNotes: "Samping Masjid Nurul Huda, masuk lorong kedua gerbang cat hijau",
        courierId: "usr-courier-1",
        courierName: "Daeng Rahmat",
        deliveryDate: today,
        deliveryTimeSlot: "Pagi (08:30 - 10:00)",
        deliveryStatus: "DELIVERED",
        paymentStatus: "PAID",
        items: [
          { productId: "prod-refill-19l", productName: "Refill Air Galon 19L Asalynn", unitPrice: 6000, qtyOrdered: 4, qtyDelivered: 4 }
        ],
        emptyGallonsExpected: 4,
        emptyGallonsReturned: 4,
        subtotalOrdered: 24000,
        subtotalActual: 24000,
        totalPaid: 24000,
        paymentMethod: "CASH",
        driverNotes: "Sudah diantar ke meja kasir, galon kosong diambil pas 4 buah.",
        deliveredAt: `${today}T09:15:00+08:00`,
        createdAt: `${today}T08:00:00+08:00`
      },
      {
        id: "ORD-20261004-002",
        customerId: "cust-3",
        customerName: "Kos Putri Lavender (Ibu Melati)",
        customerPhone: "087811223344",
        customerAddress: "Jl. Sahabat No. 18, Dekat Kampus Unhas Tamalanrea, Makassar",
        addressNotes: "Pagar putih tinggi, bel pintu ada di sebelah kanan gerbang",
        courierId: "usr-courier-1",
        courierName: "Daeng Rahmat",
        deliveryDate: today,
        deliveryTimeSlot: "Pagi (10:00 - 11:30)",
        deliveryStatus: "ON_DELIVERY",
        paymentStatus: "UNPAID",
        items: [
          { productId: "prod-refill-19l", productName: "Refill Air Galon 19L Asalynn", unitPrice: 6500, qtyOrdered: 3, qtyDelivered: 3 }
        ],
        emptyGallonsExpected: 3,
        emptyGallonsReturned: 0,
        subtotalOrdered: 19500,
        subtotalActual: 19500,
        totalPaid: 0,
        paymentMethod: "CASH",
        driverNotes: "Sedang dalam perjalanan ke kos Unhas",
        createdAt: `${today}T09:00:00+08:00`
      },
      {
        id: "ORD-20261004-003",
        customerId: "cust-2",
        customerName: "Ibu Hj. Rosdiana (BTP)",
        customerPhone: "085244332211",
        customerAddress: "Perumahan Bumi Tamalanrea Permai (BTP) Blok M No. 12, Makassar",
        addressNotes: "Rumah pagar hitam tingkat dua, ada pohon mangga",
        courierId: "usr-courier-2",
        courierName: "Andi Pratama",
        deliveryDate: today,
        deliveryTimeSlot: "Siang (13:00 - 14:30)",
        deliveryStatus: "ASSIGNED",
        paymentStatus: "UNPAID",
        items: [
          { productId: "prod-refill-19l", productName: "Refill Air Galon 19L Asalynn", unitPrice: 7000, qtyOrdered: 2, qtyDelivered: 2 }
        ],
        emptyGallonsExpected: 2,
        emptyGallonsReturned: 0,
        subtotalOrdered: 14000,
        subtotalActual: 14000,
        totalPaid: 0,
        paymentMethod: "CASH",
        driverNotes: "Jangan lupa sekalian tagih sisa nota lama Rp 14.000 jika memungkinkan",
        createdAt: `${today}T09:30:00+08:00`
      },
      {
        id: "ORD-20261004-004",
        customerId: "cust-4",
        customerName: "Resto Seafood Paotere (Pak Basri)",
        customerPhone: "081377665544",
        customerAddress: "Kawasan Wisata Bahari Paotere No. 7, Ujung Pandang, Makassar",
        addressNotes: "Dapur belakang resto, masuk lewat jalan samping parkiran",
        courierId: "usr-courier-2",
        courierName: "Andi Pratama",
        deliveryDate: today,
        deliveryTimeSlot: "Siang (14:30 - 16:00)",
        deliveryStatus: "ASSIGNED",
        paymentStatus: "UNPAID",
        items: [
          { productId: "prod-refill-19l", productName: "Refill Air Galon 19L Asalynn", unitPrice: 6000, qtyOrdered: 5, qtyDelivered: 5 },
          { productId: "prod-cup-dus", productName: "Air Mineral Gelas Asalynn (Dus 48x220ml)", unitPrice: 18000, qtyOrdered: 2, qtyDelivered: 2 }
        ],
        emptyGallonsExpected: 5,
        emptyGallonsReturned: 0,
        subtotalOrdered: 66000,
        subtotalActual: 66000,
        totalPaid: 0,
        paymentMethod: "TRANSFER",
        driverNotes: "Nota diserahkan ke bagian kasir dapur",
        createdAt: `${today}T10:15:00+08:00`
      },
      {
        id: "ORD-20261004-005",
        customerId: "cust-5",
        customerName: "Keluarga Bpk. Irwan",
        customerPhone: "082155667788",
        customerAddress: "Jl. AP Pettarani Komp. IDI Blok GA/8, Panakkukang, Makassar",
        addressNotes: "Rumah cat krem dekat pos security",
        courierId: null,
        courierName: "Belum Ditugaskan",
        deliveryDate: today,
        deliveryTimeSlot: "Sore (16:00 - 17:30)",
        deliveryStatus: "PENDING",
        paymentStatus: "UNPAID",
        items: [
          { productId: "prod-refill-19l", productName: "Refill Air Galon 19L Asalynn", unitPrice: 7000, qtyOrdered: 2, qtyDelivered: 2 },
          { productId: "prod-new-gallon-19l", productName: "Galon Baru + Air 19L", unitPrice: 45000, qtyOrdered: 1, qtyDelivered: 1 }
        ],
        emptyGallonsExpected: 2,
        emptyGallonsReturned: 0,
        subtotalOrdered: 59000,
        subtotalActual: 59000,
        totalPaid: 0,
        paymentMethod: "CASH",
        driverNotes: "",
        createdAt: `${today}T10:45:00+08:00`
      }
    ],
    payments: [
      {
        id: "pay-init-01",
        orderId: "ORD-20261004-001",
        customerId: "cust-1",
        customerName: "Warung Coto Daeng Tata",
        amount: 24000,
        paymentMethod: "CASH",
        collectedBy: "usr-courier-1",
        collectedByName: "Daeng Rahmat",
        paymentDate: `${today}T09:15:00+08:00`,
        notes: "Pembayaran lunas tunai di tempat"
      }
    ],
    gallonLogs: [
      {
        id: "gln-init-01",
        orderId: "ORD-20261004-001",
        customerId: "cust-1",
        customerName: "Warung Coto Daeng Tata",
        gallonsOut: 4,
        gallonsIn: 4,
        balanceAfter: 6,
        loggedAt: `${today}T09:15:00+08:00`
      }
    ]
  };
}

// Fungsi Seed Database SQLite
export function seedDatabase(isZero = false) {
  const seed = isZero
    ? {
        users: getInitialSeedData().users,
        products: getInitialSeedData().products,
        customers: [],
        orders: [],
        payments: [],
        gallonLogs: []
      }
    : getInitialSeedData();

  // Clear existing records
  drizzleDb.delete(schema.orderItems).run();
  drizzleDb.delete(schema.orders).run();
  drizzleDb.delete(schema.customerCustomPrices).run();
  drizzleDb.delete(schema.customers).run();
  drizzleDb.delete(schema.products).run();
  drizzleDb.delete(schema.users).run();
  drizzleDb.delete(schema.payments).run();
  drizzleDb.delete(schema.gallonLogs).run();

  // Seed Users
  for (const u of seed.users) {
    drizzleDb.insert(schema.users).values({
      id: u.id,
      name: u.name,
      phone: u.phone,
      role: u.role,
      pin: u.pin || "1234",
      vehicle: u.vehicle || null,
      isActive: u.isActive !== false,
      createdAt: getWitaIsoString()
    }).run();
  }

  // Seed Products
  for (const p of seed.products) {
    drizzleDb.insert(schema.products).values({
      id: p.id,
      name: p.name,
      code: p.code,
      standardPrice: p.standardPrice,
      unit: p.unit || "Galon",
      description: p.description || "",
      isActive: p.isActive !== false
    }).run();
  }

  // Seed Customers & Custom Prices
  for (const c of seed.customers) {
    drizzleDb.insert(schema.customers).values({
      id: c.id,
      name: c.name,
      phone: c.phone,
      address: c.address,
      addressNotes: c.addressNotes || "",
      currentGallonBalance: c.currentGallonBalance || 0,
      currentDebtBalance: c.currentDebtBalance || 0,
      createdAt: c.createdAt || getWitaDate()
    }).run();

    if (c.customPrices) {
      for (const [prodId, price] of Object.entries(c.customPrices)) {
        drizzleDb.insert(schema.customerCustomPrices).values({
          id: `cp-${c.id}-${prodId}`,
          customerId: c.id,
          productId: prodId,
          customPrice: Number(price)
        }).run();
      }
    }
  }

  // Seed Orders & Items
  for (const o of seed.orders) {
    drizzleDb.insert(schema.orders).values({
      id: o.id,
      customerId: o.customerId,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      customerAddress: o.customerAddress,
      addressNotes: o.addressNotes || "",
      courierId: o.courierId || null,
      courierName: o.courierName || "Belum Ditugaskan",
      deliveryDate: o.deliveryDate,
      deliveryTimeSlot: o.deliveryTimeSlot || "Bebas",
      deliveryStatus: o.deliveryStatus || "PENDING",
      paymentStatus: o.paymentStatus || "UNPAID",
      emptyGallonsExpected: o.emptyGallonsExpected || 0,
      emptyGallonsReturned: o.emptyGallonsReturned || 0,
      subtotalOrdered: o.subtotalOrdered || 0,
      subtotalActual: o.subtotalActual || 0,
      totalPaid: o.totalPaid || 0,
      paymentMethod: o.paymentMethod || "CASH",
      driverNotes: o.driverNotes || "",
      cancellationReason: o.cancellationReason || "",
      cancelledAt: o.cancelledAt || null,
      deliveredAt: o.deliveredAt || null,
      createdAt: o.createdAt || getWitaIsoString()
    }).run();

    if (o.items && o.items.length > 0) {
      for (let idx = 0; idx < o.items.length; idx++) {
        const item = o.items[idx];
        drizzleDb.insert(schema.orderItems).values({
          id: `item-${o.id}-${idx + 1}`,
          orderId: o.id,
          productId: item.productId,
          productName: item.productName,
          unitPrice: item.unitPrice,
          qtyOrdered: item.qtyOrdered,
          qtyDelivered: item.qtyDelivered
        }).run();
      }
    }
  }

  // Seed Payments
  for (const p of seed.payments) {
    drizzleDb.insert(schema.payments).values({
      id: p.id,
      orderId: p.orderId || null,
      customerId: p.customerId || null,
      customerName: p.customerName,
      amount: p.amount,
      paymentMethod: p.paymentMethod || "CASH",
      collectedBy: p.collectedBy,
      collectedByName: p.collectedByName,
      paymentDate: p.paymentDate || getWitaIsoString(),
      notes: p.notes || ""
    }).run();
  }

  // Seed Gallon Logs
  for (const g of seed.gallonLogs) {
    drizzleDb.insert(schema.gallonLogs).values({
      id: g.id,
      orderId: g.orderId || null,
      customerId: g.customerId,
      customerName: g.customerName,
      gallonsOut: g.gallonsOut || 0,
      gallonsIn: g.gallonsIn || 0,
      balanceAfter: g.balanceAfter || 0,
      notes: g.notes || "",
      loggedAt: g.loggedAt || getWitaIsoString()
    }).run();
  }
}

// Cek jika database lokal masih kosong, lakukan auto seed
if (sqlite && drizzleDb) {
  try {
    const existingUsers = drizzleDb.select().from(schema.users).all();
    if (existingUsers.length === 0) {
      seedDatabase(false);
    }
  } catch (err) {
    console.warn("Auto-seed local skipped or failed:", err.message);
  }
}

// Wrapper DB Helper untuk kompatibilitas penuh, Drizzle ORM queries, dan in-memory fallback
export class DrizzleDatabaseHelper {
  constructor() {
    this._state = getInitialSeedData();
  }

  // getter .data untuk retro-kompatibilitas
  get data() {
    return {
      users: this.getUsers(),
      products: this.getProducts(),
      customers: this.getCustomers(),
      orders: this.getOrders(),
      payments: this.getPayments(),
      gallonLogs: this.getGallonLogs(),
      lastUpdated: new Date().toISOString()
    };
  }

  persist() {
    // Persistent
  }

  reset() {
    this._state = getInitialSeedData();
    if (drizzleDb && sqlite) {
      try { seedDatabase(false); } catch (e) {}
    }
    return this.data;
  }

  resetToZero() {
    this._state = {
      users: getInitialSeedData().users,
      products: getInitialSeedData().products,
      customers: [],
      orders: [],
      payments: [],
      gallonLogs: []
    };
    if (drizzleDb && sqlite) {
      try { seedDatabase(true); } catch (e) {}
    }
    return this.data;
  }

  // Users
  getUsers(filters = {}) {
    let list = this._state.users || [];
    if (filters.role) list = list.filter(u => u.role === filters.role);
    if (filters.active !== undefined) list = list.filter(u => u.isActive === (filters.active === "true" || filters.active === true));
    return list;
  }

  getUserById(id) {
    return (this._state.users || []).find(u => u.id === id) || null;
  }

  getUserByPhone(phone) {
    return (this._state.users || []).find(u => u.phone === phone.trim()) || null;
  }

  createUser(data) {
    const newUser = {
      id: data.id,
      name: data.name,
      phone: data.phone,
      role: data.role || "courier",
      pin: data.pin || "1234",
      vehicle: data.vehicle || null,
      isActive: data.isActive !== false,
      createdAt: getWitaIsoString()
    };
    this._state.users = (this._state.users || []).filter(u => u.id !== data.id);
    this._state.users.push(newUser);
    return newUser;
  }

  updateUser(id, data) {
    const existing = this.getUserById(id) || {};
    const updated = {
      ...existing,
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.phone !== undefined ? { phone: data.phone.trim() } : {}),
      ...(data.role !== undefined ? { role: data.role } : {}),
      ...(data.pin !== undefined ? { pin: String(data.pin) } : {}),
      ...(data.vehicle !== undefined ? { vehicle: data.vehicle.trim() || null } : {}),
      ...(data.isActive !== undefined ? { isActive: Boolean(data.isActive) } : {})
    };

    this._state.users = (this._state.users || []).map(u => u.id === id ? updated : u);
    return updated;
  }

  deleteUser(id) {
    this._state.users = (this._state.users || []).map(u => u.id === id ? { ...u, isActive: false } : u);
  }

  // Products
  getProducts(filters = {}) {
    let list = this._state.products || [];
    if (filters.active !== undefined) {
      list = list.filter(p => p.isActive === (filters.active === "true" || filters.active === true));
    }
    return list;
  }

  getProductById(id) {
    if (drizzleDb && sqlite) {
      try {
        const res = drizzleDb.select().from(schema.products).where(eq(schema.products.id, id)).get();
        if (res) return { ...res, isActive: Boolean(res.isActive) };
      } catch (e) {}
    }
    return (this._state.products || []).find(p => p.id === id) || null;
  }

  createProduct(data) {
    const newProd = {
      id: data.id,
      name: data.name,
      code: data.code,
      standardPrice: Number(data.standardPrice),
      unit: data.unit || "Galon",
      description: data.description || "",
      isActive: data.isActive !== false
    };
    this._state.products = (this._state.products || []).filter(p => p.id !== data.id);
    this._state.products.push(newProd);

    if (drizzleDb && sqlite) {
      try {
        drizzleDb.insert(schema.products).values(newProd).run();
      } catch (e) {}
    }
    return newProd;
  }

  updateProduct(id, data) {
    const existing = this.getProductById(id) || {};
    const updated = {
      ...existing,
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.code !== undefined ? { code: data.code.trim() } : {}),
      ...(data.standardPrice !== undefined ? { standardPrice: Number(data.standardPrice) } : {}),
      ...(data.unit !== undefined ? { unit: data.unit.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description.trim() } : {}),
      ...(data.isActive !== undefined ? { isActive: Boolean(data.isActive) } : {})
    };

    this._state.products = (this._state.products || []).map(p => p.id === id ? updated : p);

    if (drizzleDb && sqlite) {
      try {
        drizzleDb.update(schema.products).set(updated).where(eq(schema.products.id, id)).run();
      } catch (e) {}
    }
    return updated;
  }

  // Customers
  getCustomers(filters = {}) {
    if (drizzleDb && sqlite) {
      try {
        let rawCusts = drizzleDb.select().from(schema.customers).all();
        if (filters.q && filters.q.trim()) {
          const term = filters.q.trim().toLowerCase();
          rawCusts = rawCusts.filter(c =>
            c.name.toLowerCase().includes(term) ||
            c.phone.toLowerCase().includes(term) ||
            c.address.toLowerCase().includes(term)
          );
        }
        const allPrices = drizzleDb.select().from(schema.customerCustomPrices).all();
        return rawCusts.map(c => {
          const customPrices = {};
          allPrices.filter(p => p.customerId === c.id).forEach(p => {
            customPrices[p.productId] = p.customPrice;
          });
          return { ...c, customPrices };
        });
      } catch (e) {}
    }
    let list = this._state.customers || [];
    if (filters.q && filters.q.trim()) {
      const term = filters.q.trim().toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(term) ||
        c.phone.toLowerCase().includes(term) ||
        c.address.toLowerCase().includes(term)
      );
    }
    return list;
  }

  getCustomerById(id) {
    if (drizzleDb && sqlite) {
      try {
        const c = drizzleDb.select().from(schema.customers).where(eq(schema.customers.id, id)).get();
        if (c) {
          const prices = drizzleDb.select().from(schema.customerCustomPrices).where(eq(schema.customerCustomPrices.customerId, id)).all();
          const customPrices = {};
          prices.forEach(p => { customPrices[p.productId] = p.customPrice; });
          return { ...c, customPrices };
        }
      } catch (e) {}
    }
    return (this._state.customers || []).find(c => c.id === id) || null;
  }

  createCustomer(data) {
    const newCust = {
      id: data.id,
      name: data.name,
      phone: data.phone,
      address: data.address,
      addressNotes: data.addressNotes || "",
      currentGallonBalance: Number(data.currentGallonBalance) || 0,
      currentDebtBalance: Number(data.currentDebtBalance) || 0,
      customPrices: data.customPrices || {},
      createdAt: data.createdAt || getWitaDate()
    };
    this._state.customers = (this._state.customers || []).filter(c => c.id !== data.id);
    this._state.customers.push(newCust);

    if (drizzleDb && sqlite) {
      try {
        drizzleDb.insert(schema.customers).values({
          id: newCust.id,
          name: newCust.name,
          phone: newCust.phone,
          address: newCust.address,
          addressNotes: newCust.addressNotes,
          currentGallonBalance: newCust.currentGallonBalance,
          currentDebtBalance: newCust.currentDebtBalance,
          createdAt: newCust.createdAt
        }).run();
      } catch (e) {}
    }
    return newCust;
  }

  updateCustomer(id, data) {
    const existing = this.getCustomerById(id) || {};
    const updated = {
      ...existing,
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.phone !== undefined ? { phone: data.phone.trim() } : {}),
      ...(data.address !== undefined ? { address: data.address.trim() } : {}),
      ...(data.addressNotes !== undefined ? { addressNotes: data.addressNotes.trim() } : {}),
      ...(data.currentGallonBalance !== undefined ? { currentGallonBalance: Number(data.currentGallonBalance) } : {}),
      ...(data.currentDebtBalance !== undefined ? { currentDebtBalance: Number(data.currentDebtBalance) } : {}),
      ...(data.customPrices !== undefined ? { customPrices: data.customPrices } : {})
    };

    this._state.customers = (this._state.customers || []).map(c => c.id === id ? updated : c);

    if (drizzleDb && sqlite) {
      try {
        drizzleDb.update(schema.customers).set({
          name: updated.name,
          phone: updated.phone,
          address: updated.address,
          addressNotes: updated.addressNotes,
          currentGallonBalance: updated.currentGallonBalance,
          currentDebtBalance: updated.currentDebtBalance
        }).where(eq(schema.customers.id, id)).run();
      } catch (e) {}
    }
    return updated;
  }

  deleteCustomer(id) {
    this._state.customers = (this._state.customers || []).filter(c => c.id !== id);
    if (drizzleDb && sqlite) {
      try {
        drizzleDb.delete(schema.customerCustomPrices).where(eq(schema.customerCustomPrices.customerId, id)).run();
        drizzleDb.delete(schema.customers).where(eq(schema.customers.id, id)).run();
      } catch (e) {}
    }
  }

  setCustomPrice(customerId, productId, customPrice) {
    const priceNum = Number(customPrice);
    const cust = this.getCustomerById(customerId);
    if (cust) {
      if (!cust.customPrices) cust.customPrices = {};
      if (!isNaN(priceNum) && priceNum > 0) {
        cust.customPrices[productId] = priceNum;
      } else {
        delete cust.customPrices[productId];
      }
    }
    if (drizzleDb && sqlite) {
      try {
        drizzleDb.delete(schema.customerCustomPrices)
          .where(and(eq(schema.customerCustomPrices.customerId, customerId), eq(schema.customerCustomPrices.productId, productId)))
          .run();
        if (!isNaN(priceNum) && priceNum > 0) {
          drizzleDb.insert(schema.customerCustomPrices).values({
            id: `cp-${customerId}-${productId}`,
            customerId,
            productId,
            customPrice: priceNum
          }).run();
        }
      } catch (e) {}
    }
  }

  deleteCustomPrice(customerId, productId) {
    this.setCustomPrice(customerId, productId, 0);
  }

  getEffectivePrice(customerId, productId) {
    const cust = this.getCustomerById(customerId);
    if (cust && cust.customPrices && cust.customPrices[productId] !== undefined) {
      return cust.customPrices[productId];
    }
    const prod = this.getProductById(productId);
    return prod ? prod.standardPrice : 0;
  }

  // Orders
  getOrders(filters = {}) {
    if (drizzleDb && sqlite) {
      try {
        let rawOrders = drizzleDb.select().from(schema.orders).all();
        if (filters.date) rawOrders = rawOrders.filter(o => o.deliveryDate === filters.date);
        if (filters.courierId) rawOrders = rawOrders.filter(o => o.courierId === filters.courierId);
        if (filters.status && filters.status !== "ALL") rawOrders = rawOrders.filter(o => o.deliveryStatus === filters.status);
        if (filters.paymentStatus && filters.paymentStatus !== "ALL") rawOrders = rawOrders.filter(o => o.paymentStatus === filters.paymentStatus);
        if (filters.customerId) rawOrders = rawOrders.filter(o => o.customerId === filters.customerId);
        if (filters.q && filters.q.trim()) {
          const term = filters.q.trim().toLowerCase();
          rawOrders = rawOrders.filter(o =>
            o.id.toLowerCase().includes(term) ||
            o.customerName.toLowerCase().includes(term) ||
            o.customerPhone.includes(term) ||
            (o.courierName && o.courierName.toLowerCase().includes(term))
          );
        }
        const allItems = drizzleDb.select().from(schema.orderItems).all();
        return rawOrders.map(o => ({
          ...o,
          items: allItems.filter(it => it.orderId === o.id)
        }));
      } catch (e) {}
    }
    let list = this._state.orders || [];
    if (filters.date) list = list.filter(o => o.deliveryDate === filters.date);
    if (filters.courierId) list = list.filter(o => o.courierId === filters.courierId);
    if (filters.status && filters.status !== "ALL") list = list.filter(o => o.deliveryStatus === filters.status);
    if (filters.paymentStatus && filters.paymentStatus !== "ALL") list = list.filter(o => o.paymentStatus === filters.paymentStatus);
    if (filters.customerId) list = list.filter(o => o.customerId === filters.customerId);
    if (filters.q && filters.q.trim()) {
      const term = filters.q.trim().toLowerCase();
      list = list.filter(o =>
        o.id.toLowerCase().includes(term) ||
        o.customerName.toLowerCase().includes(term) ||
        o.customerPhone.includes(term) ||
        (o.courierName && o.courierName.toLowerCase().includes(term))
      );
    }
    return list;
  }

  getOrderById(id) {
    if (drizzleDb && sqlite) {
      try {
        const o = drizzleDb.select().from(schema.orders).where(eq(schema.orders.id, id)).get();
        if (o) {
          const items = drizzleDb.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, id)).all();
          return { ...o, items };
        }
      } catch (e) {}
    }
    return (this._state.orders || []).find(o => o.id === id) || null;
  }

  createOrder(data) {
    const newOrder = {
      ...data,
      id: data.id || `ORD-${Date.now()}`,
      items: data.items || [],
      createdAt: data.createdAt || getWitaIsoString()
    };
    this._state.orders = (this._state.orders || []).filter(o => o.id !== newOrder.id);
    this._state.orders.push(newOrder);

    if (drizzleDb && sqlite) {
      try {
        drizzleDb.insert(schema.orders).values({
          id: newOrder.id,
          customerId: newOrder.customerId,
          customerName: newOrder.customerName,
          customerPhone: newOrder.customerPhone,
          customerAddress: newOrder.customerAddress,
          addressNotes: newOrder.addressNotes || "",
          courierId: newOrder.courierId || null,
          courierName: newOrder.courierName || "Belum Ditugaskan",
          deliveryDate: newOrder.deliveryDate,
          deliveryTimeSlot: newOrder.deliveryTimeSlot || "Bebas",
          deliveryStatus: newOrder.deliveryStatus || "PENDING",
          paymentStatus: newOrder.paymentStatus || "UNPAID",
          emptyGallonsExpected: newOrder.emptyGallonsExpected || 0,
          emptyGallonsReturned: newOrder.emptyGallonsReturned || 0,
          subtotalOrdered: newOrder.subtotalOrdered || 0,
          subtotalActual: newOrder.subtotalActual || 0,
          totalPaid: newOrder.totalPaid || 0,
          paymentMethod: newOrder.paymentMethod || "CASH",
          driverNotes: newOrder.driverNotes || "",
          cancellationReason: newOrder.cancellationReason || "",
          createdAt: newOrder.createdAt
        }).run();

        if (newOrder.items && newOrder.items.length > 0) {
          newOrder.items.forEach((it, idx) => {
            drizzleDb.insert(schema.orderItems).values({
              id: `item-${newOrder.id}-${idx + 1}`,
              orderId: newOrder.id,
              productId: it.productId,
              productName: it.productName,
              unitPrice: it.unitPrice,
              qtyOrdered: it.qtyOrdered,
              qtyDelivered: it.qtyDelivered !== undefined ? it.qtyDelivered : it.qtyOrdered
            }).run();
          });
        }
      } catch (e) {}
    }
    return newOrder;
  }

  updateOrder(id, data) {
    const existing = this.getOrderById(id) || {};
    const updated = {
      ...existing,
      ...data,
      ...(data.items ? { items: data.items } : {})
    };
    this._state.orders = (this._state.orders || []).map(o => o.id === id ? updated : o);

    if (drizzleDb && sqlite) {
      try {
        const { items, ...orderRow } = updated;
        drizzleDb.update(schema.orders).set(orderRow).where(eq(schema.orders.id, id)).run();
        if (data.items) {
          drizzleDb.delete(schema.orderItems).where(eq(schema.orderItems.orderId, id)).run();
          data.items.forEach((it, idx) => {
            drizzleDb.insert(schema.orderItems).values({
              id: `item-${id}-${idx + 1}`,
              orderId: id,
              productId: it.productId,
              productName: it.productName,
              unitPrice: it.unitPrice,
              qtyOrdered: it.qtyOrdered,
              qtyDelivered: it.qtyDelivered
            }).run();
          });
        }
      } catch (e) {}
    }
    return updated;
  }

  deleteOrder(id) {
    this._state.orders = (this._state.orders || []).filter(o => o.id !== id);
    if (drizzleDb && sqlite) {
      try {
        drizzleDb.delete(schema.orderItems).where(eq(schema.orderItems.orderId, id)).run();
        drizzleDb.delete(schema.orders).where(eq(schema.orders.id, id)).run();
      } catch (e) {}
    }
  }

  // Payments
  getPayments(filters = {}) {
    if (drizzleDb && sqlite) {
      try {
        let raw = drizzleDb.select().from(schema.payments).all();
        if (filters.date) raw = raw.filter(p => getWitaDate(new Date(p.paymentDate)) === filters.date);
        if (filters.orderId) raw = raw.filter(p => p.orderId === filters.orderId);
        if (filters.customerId) raw = raw.filter(p => p.customerId === filters.customerId);
        if (filters.collectedBy) raw = raw.filter(p => p.collectedBy === filters.collectedBy);
        if (filters.method) raw = raw.filter(p => p.paymentMethod === filters.method.toUpperCase());
        return raw.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
      } catch (e) {}
    }
    let list = this._state.payments || [];
    if (filters.date) list = list.filter(p => getWitaDate(new Date(p.paymentDate)) === filters.date);
    if (filters.orderId) list = list.filter(p => p.orderId === filters.orderId);
    if (filters.customerId) list = list.filter(p => p.customerId === filters.customerId);
    if (filters.collectedBy) list = list.filter(p => p.collectedBy === filters.collectedBy);
    if (filters.method) list = list.filter(p => p.paymentMethod === filters.method.toUpperCase());
    return list.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
  }

  createPayment(data) {
    const payment = {
      id: data.id || `pay-${Date.now()}`,
      orderId: data.orderId || null,
      customerId: data.customerId || null,
      customerName: data.customerName,
      amount: data.amount,
      paymentMethod: (data.paymentMethod || "CASH").toUpperCase(),
      collectedBy: data.collectedBy,
      collectedByName: data.collectedByName,
      paymentDate: data.paymentDate || getWitaIsoString(),
      notes: data.notes || ""
    };
    this._state.payments = (this._state.payments || []).filter(p => p.id !== payment.id);
    this._state.payments.push(payment);

    if (drizzleDb && sqlite) {
      try {
        drizzleDb.insert(schema.payments).values(payment).run();
      } catch (e) {}
    }
    return payment;
  }

  getPaymentById(id) {
    return (this._state.payments || []).find(p => p.id === id) || null;
  }

  deletePayment(id) {
    this._state.payments = (this._state.payments || []).filter(p => p.id !== id);
    if (drizzleDb && sqlite) {
      try {
        drizzleDb.delete(schema.payments).where(eq(schema.payments.id, id)).run();
      } catch (e) {}
    }
  }

  // Gallon Logs
  getGallonLogs(filters = {}) {
    if (drizzleDb && sqlite) {
      try {
        let raw = drizzleDb.select().from(schema.gallonLogs).all();
        if (filters.customerId) raw = raw.filter(g => g.customerId === filters.customerId);
        if (filters.orderId) raw = raw.filter(g => g.orderId === filters.orderId);
        if (filters.date) raw = raw.filter(g => getWitaDate(new Date(g.loggedAt)) === filters.date);
        return raw.sort((a, b) => new Date(b.loggedAt) - new Date(a.loggedAt));
      } catch (e) {}
    }
    let list = this._state.gallonLogs || [];
    if (filters.customerId) list = list.filter(g => g.customerId === filters.customerId);
    if (filters.orderId) list = list.filter(g => g.orderId === filters.orderId);
    if (filters.date) list = list.filter(g => getWitaDate(new Date(g.loggedAt)) === filters.date);
    return list.sort((a, b) => new Date(b.loggedAt) - new Date(a.loggedAt));
  }

  createGallonLog(data) {
    const log = {
      id: data.id || `gln-${Date.now()}`,
      orderId: data.orderId || null,
      customerId: data.customerId,
      customerName: data.customerName,
      gallonsOut: data.gallonsOut || 0,
      gallonsIn: data.gallonsIn || 0,
      balanceAfter: data.balanceAfter || 0,
      notes: data.notes || "",
      loggedAt: data.loggedAt || getWitaIsoString()
    };
    this._state.gallonLogs = (this._state.gallonLogs || []).filter(g => g.id !== log.id);
    this._state.gallonLogs.push(log);

    if (drizzleDb && sqlite) {
      try {
        drizzleDb.insert(schema.gallonLogs).values(log).run();
      } catch (e) {}
    }
    return log;
  }

  getGallonLogById(id) {
    return (this._state.gallonLogs || []).find(g => g.id === id) || null;
  }

  deleteGallonLog(id) {
    this._state.gallonLogs = (this._state.gallonLogs || []).filter(g => g.id !== id);
    if (drizzleDb && sqlite) {
      try {
        drizzleDb.delete(schema.gallonLogs).where(eq(schema.gallonLogs.id, id)).run();
      } catch (e) {}
    }
  }
}

export const db = new DrizzleDatabaseHelper();
