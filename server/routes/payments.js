import { Router } from "express";
import { db } from "../db.js";

const router = Router();

// GET /api/payments
router.get("/", async (req, res) => {
  try {
    const { orderId, customerId } = req.query;
    const payments = await db.getPayments({ orderId, customerId });
    res.json({ success: true, total: payments.length, data: payments });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/payments/:id
router.get("/:id", async (req, res) => {
  try {
    const payment = await db.getPaymentById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: "Catatan pembayaran tidak ditemukan." });
    res.json({ success: true, data: payment });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/payments
router.post("/", async (req, res) => {
  try {
    const { orderId = null, customerId, amount, paymentMethod = "CASH", collectedBy, notes = "" } = req.body;
    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ success: false, message: "Nominal pembayaran harus berupa angka lebih dari 0." });
    let customer = null;
    if (customerId) customer = await db.getCustomerById(customerId);
    const collector = (collectedBy && await db.getUserById(collectedBy)) || req.user || { id: "usr-admin-1", name: "Hj. Asmawati (Owner)" };
    const newPayment = await db.createPayment({ id: `pay-${Date.now()}`, orderId: orderId || null, customerId: customer ? customer.id : customerId || null, customerName: customer ? customer.name : "Pelanggan", amount: amt, paymentMethod: paymentMethod.toUpperCase(), collectedBy: collector.id, collectedByName: collector.name, paymentDate: new Date().toISOString(), notes: notes.trim() });
    res.status(201).json({ success: true, message: "Pembayaran berhasil dicatat.", data: newPayment });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE /api/payments/:id
router.delete("/:id", async (req, res) => {
  try {
    const payment = await db.getPaymentById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: "Catatan pembayaran tidak ditemukan." });
    await db.deletePayment(req.params.id);
    res.json({ success: true, message: `Catatan pembayaran '${payment.id}' berhasil dihapus.` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

export default router;
