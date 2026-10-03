import { Router } from "express";
import { db, getWitaDate } from "../db.js";

const router = Router();

// GET /api/gallons/logs - Ambil buku mutasi keluar-masuk galon
router.get("/logs", (req, res) => {
  const { customerId, orderId, date } = req.query;
  let logs = db.data.gallonLogs;

  if (customerId) {
    logs = logs.filter(l => l.customerId === customerId);
  }
  if (orderId) {
    logs = logs.filter(l => l.orderId === orderId);
  }
  if (date) {
    logs = logs.filter(l => {
      const logDate = getWitaDate(new Date(l.loggedAt));
      return logDate === date;
    });
  }

  res.json({
    success: true,
    total: logs.length,
    data: logs
  });
});

// POST /api/gallons/adjust - Penyesuaian saldo galon manual pelanggan (misal ada galon rusak/hilang/titip)
router.post("/adjust", (req, res) => {
  const { customerId, gallonsOut = 0, gallonsIn = 0, notes = "Penyesuaian manual galon" } = req.body;

  const customer = db.data.customers.find(c => c.id === customerId);
  if (!customer) {
    return res.status(404).json({ success: false, message: "Pelanggan tidak ditemukan." });
  }

  const outCount = Number(gallonsOut) || 0;
  const inCount = Number(gallonsIn) || 0;
  const delta = outCount - inCount;

  customer.currentGallonBalance = Math.max(0, (customer.currentGallonBalance || 0) + delta);

  const logEntry = {
    id: `gln-adj-${Date.now()}`,
    orderId: null,
    customerId: customer.id,
    customerName: customer.name,
    gallonsOut: outCount,
    gallonsIn: inCount,
    balanceAfter: customer.currentGallonBalance,
    notes,
    loggedAt: new Date().toISOString()
  };

  db.data.gallonLogs.unshift(logEntry);
  db.persist();

  res.json({
    success: true,
    message: `Saldo galon pelanggan '${customer.name}' berhasil disesuaikan. Saldo saat ini: ${customer.currentGallonBalance} galon.`,
    data: {
      customer,
      log: logEntry
    }
  });
});

export default router;
