import { Router } from "express";
import { db } from "../db.js";

const router = Router();

// GET /api/gallons/logs - Ambil buku mutasi keluar-masuk galon
router.get("/logs", (req, res) => {
  const { customerId, orderId, date } = req.query;
  const logs = db.getGallonLogs({ customerId, orderId, date });

  res.json({
    success: true,
    total: logs.length,
    data: logs
  });
});

// GET /api/gallons/logs/:id - Detail log mutasi galon
router.get("/logs/:id", (req, res) => {
  const log = db.getGallonLogById(req.params.id);
  if (!log) {
    return res.status(404).json({ success: false, message: "Catatan log galon tidak ditemukan." });
  }

  res.json({
    success: true,
    data: log
  });
});

// POST /api/gallons/adjust - Penyesuaian saldo galon manual pelanggan
router.post("/adjust", (req, res) => {
  const { customerId, gallonsOut = 0, gallonsIn = 0, notes = "Penyesuaian manual galon" } = req.body;

  const customer = db.getCustomerById(customerId);
  if (!customer) {
    return res.status(404).json({ success: false, message: "Pelanggan tidak ditemukan." });
  }

  const outCount = Number(gallonsOut) || 0;
  const inCount = Number(gallonsIn) || 0;
  const delta = outCount - inCount;

  const newBalance = Math.max(0, (customer.currentGallonBalance || 0) + delta);
  const updatedCustomer = db.updateCustomer(customer.id, { currentGallonBalance: newBalance });

  const logEntry = db.createGallonLog({
    id: `gln-adj-${Date.now()}`,
    orderId: null,
    customerId: customer.id,
    customerName: customer.name,
    gallonsOut: outCount,
    gallonsIn: inCount,
    balanceAfter: updatedCustomer.currentGallonBalance,
    notes,
    loggedAt: new Date().toISOString()
  });

  res.json({
    success: true,
    message: `Saldo galon pelanggan '${customer.name}' berhasil disesuaikan. Saldo saat ini: ${updatedCustomer.currentGallonBalance} galon.`,
    data: {
      customer: updatedCustomer,
      log: logEntry
    }
  });
});

// DELETE /api/gallons/logs/:id - Hapus catatan log galon
router.delete("/logs/:id", (req, res) => {
  const log = db.getGallonLogById(req.params.id);
  if (!log) {
    return res.status(404).json({ success: false, message: "Catatan log galon tidak ditemukan." });
  }

  db.deleteGallonLog(req.params.id);

  res.json({
    success: true,
    message: `Catatan log galon '${log.id}' berhasil dihapus.`
  });
});

export default router;
