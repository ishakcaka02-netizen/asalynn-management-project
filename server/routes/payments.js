import { Router } from "express";
import { db } from "../db.js";

const router = Router();

// GET /api/payments - Daftar pembayaran masuk
router.get("/", (req, res) => {
  const { date, orderId, customerId, collectedBy, method } = req.query;
  const payments = db.getPayments({ date, orderId, customerId, collectedBy, method });

  res.json({
    success: true,
    total: payments.length,
    data: payments
  });
});

// GET /api/payments/:id - Detail pembayaran
router.get("/:id", (req, res) => {
  const payment = db.getPaymentById(req.params.id);
  if (!payment) {
    return res.status(404).json({ success: false, message: "Catatan pembayaran tidak ditemukan." });
  }

  res.json({
    success: true,
    data: payment
  });
});

// POST /api/payments - Catat pembayaran manual
router.post("/", (req, res) => {
  const {
    orderId = null,
    customerId,
    amount,
    paymentMethod = "CASH",
    collectedBy,
    notes = ""
  } = req.body;

  const amt = Number(amount);
  if (isNaN(amt) || amt <= 0) {
    return res.status(400).json({ success: false, message: "Nominal pembayaran harus berupa angka lebih dari 0." });
  }

  let customer = null;
  if (customerId) {
    customer = db.getCustomerById(customerId);
  }

  const collector = (collectedBy && db.getUserById(collectedBy)) || req.user || {
    id: "usr-admin-1",
    name: "Hj. Asmawati (Owner)"
  };

  const newPayment = db.createPayment({
    id: `pay-${Date.now()}`,
    orderId: orderId || null,
    customerId: customer ? customer.id : customerId || null,
    customerName: customer ? customer.name : "Pelanggan",
    amount: amt,
    paymentMethod: paymentMethod.toUpperCase(),
    collectedBy: collector.id,
    collectedByName: collector.name,
    paymentDate: new Date().toISOString(),
    notes: notes.trim()
  });

  res.status(201).json({
    success: true,
    message: "Pembayaran berhasil dicatat.",
    data: newPayment
  });
});

// DELETE /api/payments/:id - Hapus/batalkan catatan pembayaran
router.delete("/:id", (req, res) => {
  const payment = db.getPaymentById(req.params.id);
  if (!payment) {
    return res.status(404).json({ success: false, message: "Catatan pembayaran tidak ditemukan." });
  }

  db.deletePayment(req.params.id);

  res.json({
    success: true,
    message: `Catatan pembayaran '${payment.id}' berhasil dihapus.`
  });
});

export default router;
