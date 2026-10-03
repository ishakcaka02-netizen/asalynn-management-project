import { Router } from "express";
import { db } from "../db.js";

const router = Router();

// POST /api/system/reset - Reset database (default seed atau 0)
router.post("/reset", (req, res) => {
  const isZero = req.query.zero === "true" || req.body?.zero === true;
  const freshData = isZero ? db.resetToZero() : db.reset();
  res.json({
    success: true,
    message: isZero
      ? "Database berhasil direset ke 0. Siap untuk digunakan dari awal."
      : "Database berhasil direset ke data awal operasional.",
    summary: {
      users: freshData.users.length,
      customers: freshData.customers.length,
      products: freshData.products.length,
      orders: freshData.orders.length
    }
  });
});

// POST /api/system/clear-zero - Kosongkan seluruh transaksi & pelanggan (Reset ke 0)
router.post("/clear-zero", (req, res) => {
  const zeroData = db.resetToZero();
  res.json({
    success: true,
    message: "Database berhasil direset ke 0. Seluruh transaksi & pelanggan telah dikosongkan.",
    summary: {
      users: zeroData.users.length,
      products: zeroData.products.length,
      customers: zeroData.customers.length,
      orders: zeroData.orders.length
    }
  });
});

// GET /api/system/export - Ekspor seluruh database dalam bentuk JSON
router.get("/export", (req, res) => {
  res.setHeader("Content-Disposition", `attachment; filename=asalynn-backup-${Date.now()}.json`);
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(db.data, null, 2));
});

// POST /api/system/import - Impor database dari JSON
router.post("/import", (req, res) => {
  const incoming = req.body;
  if (!incoming || !incoming.users || !incoming.customers || !incoming.products || !incoming.orders) {
    return res.status(400).json({
      success: false,
      message: "Format backup JSON tidak valid atau struktur data tidak lengkap."
    });
  }

  db.data = incoming;
  db.persist();

  res.json({
    success: true,
    message: "Database berhasil diimpor dan diperbarui.",
    summary: {
      users: db.data.users.length,
      customers: db.data.customers.length,
      products: db.data.products.length,
      orders: db.data.orders.length
    }
  });
});

export default router;
