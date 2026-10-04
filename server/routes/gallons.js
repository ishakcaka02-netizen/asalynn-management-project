import { Router } from "express";
import { db } from "../db.js";

const router = Router();

// GET /api/gallons/logs
router.get("/logs", async (req, res) => {
  try {
    const { customerId, orderId } = req.query;
    const logs = await db.getGallonLogs({ customerId, orderId });
    res.json({ success: true, total: logs.length, data: logs });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/gallons/logs/:id
router.get("/logs/:id", async (req, res) => {
  try {
    const log = await db.getGallonLogById(req.params.id);
    if (!log) return res.status(404).json({ success: false, message: "Catatan log galon tidak ditemukan." });
    res.json({ success: true, data: log });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/gallons/adjust
router.post("/adjust", async (req, res) => {
  try {
    const { customerId, gallonsOut = 0, gallonsIn = 0, notes = "Penyesuaian manual galon" } = req.body;
    const customer = await db.getCustomerById(customerId);
    if (!customer) return res.status(404).json({ success: false, message: "Pelanggan tidak ditemukan." });
    const outCount = Number(gallonsOut) || 0;
    const inCount = Number(gallonsIn) || 0;
    const delta = outCount - inCount;
    const newBalance = Math.max(0, (customer.currentGallonBalance || 0) + delta);
    const updatedCustomer = await db.updateCustomer(customer.id, { currentGallonBalance: newBalance });
    const logEntry = await db.createGallonLog({ id: `gln-adj-${Date.now()}`, orderId: null, customerId: customer.id, customerName: customer.name, gallonsOut: outCount, gallonsIn: inCount, balanceAfter: updatedCustomer.currentGallonBalance, notes, loggedAt: new Date().toISOString() });
    res.json({ success: true, message: `Saldo galon pelanggan '${customer.name}' berhasil disesuaikan. Saldo saat ini: ${updatedCustomer.currentGallonBalance} galon.`, data: { customer: updatedCustomer, log: logEntry } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE /api/gallons/logs/:id
router.delete("/logs/:id", async (req, res) => {
  try {
    const log = await db.getGallonLogById(req.params.id);
    if (!log) return res.status(404).json({ success: false, message: "Catatan log galon tidak ditemukan." });
    await db.deleteGallonLog(req.params.id);
    res.json({ success: true, message: `Catatan log galon '${log.id}' berhasil dihapus.` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

export default router;
