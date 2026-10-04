import { Router } from "express";
import { db, seedDatabase } from "../db.js";

const router = Router();

// POST /api/system/reset
router.post("/reset", async (req, res) => {
  try {
    const isZero = req.query.zero === "true" || req.body?.zero === true;
    const freshData = isZero ? await db.resetToZero() : await db.reset();
    res.json({ success: true, message: isZero ? "Database berhasil direset ke 0. Siap untuk digunakan dari awal." : "Database berhasil direset ke data awal operasional.", summary: { users: freshData.users.length, customers: freshData.customers.length, products: freshData.products.length, orders: freshData.orders.length } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/system/clear-zero
router.post("/clear-zero", async (req, res) => {
  try {
    const zeroData = await db.resetToZero();
    res.json({ success: true, message: "Database berhasil direset ke 0. Seluruh transaksi & pelanggan telah dikosongkan.", summary: { users: zeroData.users.length, products: zeroData.products.length, customers: zeroData.customers.length, orders: zeroData.orders.length } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/system/export
router.get("/export", async (req, res) => {
  try {
    const data = await db.getData();
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(data, null, 2));
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/system/import
router.post("/import", async (req, res) => {
  try {
    const incoming = req.body;
    if (!incoming || !incoming.users || !incoming.customers || !incoming.products || !incoming.orders) {
      return res.status(400).json({ success: false, message: "Format backup JSON tidak valid atau struktur data tidak lengkap." });
    }

    // Reset ke 0 dulu
    await seedDatabase(true);

    // Import users
    if (Array.isArray(incoming.users)) {
      for (const u of incoming.users) await db.createUser(u);
    }
    // Import products
    if (Array.isArray(incoming.products)) {
      for (const p of incoming.products) await db.createProduct(p);
    }
    // Import customers & custom prices
    if (Array.isArray(incoming.customers)) {
      for (const c of incoming.customers) {
        await db.createCustomer(c);
        if (c.customPrices) {
          for (const [pId, price] of Object.entries(c.customPrices)) {
            await db.setCustomPrice(c.id, pId, price);
          }
        }
      }
    }
    // Import orders
    if (Array.isArray(incoming.orders)) {
      for (const o of incoming.orders) await db.createOrder(o);
    }
    // Import payments
    if (Array.isArray(incoming.payments)) {
      for (const p of incoming.payments) await db.createPayment(p);
    }
    // Import gallon logs
    if (Array.isArray(incoming.gallonLogs)) {
      for (const g of incoming.gallonLogs) await db.createGallonLog(g);
    }

    const summary = await db.getData();
    res.json({ success: true, message: "Database berhasil diimpor dan diperbarui.", summary: { users: summary.users.length, customers: summary.customers.length, products: summary.products.length, orders: summary.orders.length } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

export default router;
