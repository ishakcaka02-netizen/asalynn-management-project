import { Router } from "express";
import { db, getWitaDate } from "../db.js";

const router = Router();

// GET /api/payments - Daftar pembayaran masuk
router.get("/", (req, res) => {
  const { date, orderId, customerId, collectedBy, method } = req.query;
  let payments = db.data.payments;

  if (date) {
    payments = payments.filter(p => {
      const pDate = getWitaDate(new Date(p.paymentDate));
      return pDate === date;
    });
  }
  if (orderId) {
    payments = payments.filter(p => p.orderId === orderId);
  }
  if (customerId) {
    payments = payments.filter(p => p.customerId === customerId);
  }
  if (collectedBy) {
    payments = payments.filter(p => p.collectedBy === collectedBy);
  }
  if (method) {
    payments = payments.filter(p => p.paymentMethod === method.toUpperCase());
  }

  res.json({
    success: true,
    total: payments.length,
    data: payments
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
    customer = db.data.customers.find(c => c.id === customerId);
  }

  const collector = (collectedBy && db.data.users.find(u => u.id === collectedBy)) || req.user || {
    id: "usr-admin-1",
    name: "Hj. Asmawati (Owner)"
  };

  const newPayment = {
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
  };

  db.data.payments.unshift(newPayment);
  db.persist();

  res.status(201).json({
    success: true,
    message: "Pembayaran berhasil dicatat.",
    data: newPayment
  });
});

export default router;
