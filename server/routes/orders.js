import { Router } from "express";
import { db, getWitaDate } from "../db.js";

const router = Router();

// GET /api/orders - Ambil daftar pesanan (dengan filter tanggal, kurir, status)
router.get("/", (req, res) => {
  const { date, courierId, status, paymentStatus, customerId, q } = req.query;
  let orders = db.data.orders;

  if (date) {
    orders = orders.filter(o => o.deliveryDate === date);
  }
  if (courierId) {
    orders = orders.filter(o => o.courierId === courierId);
  }
  if (status && status !== "ALL") {
    orders = orders.filter(o => o.deliveryStatus === status);
  }
  if (paymentStatus && paymentStatus !== "ALL") {
    orders = orders.filter(o => o.paymentStatus === paymentStatus);
  }
  if (customerId) {
    orders = orders.filter(o => o.customerId === customerId);
  }
  if (q && q.trim()) {
    const term = q.trim().toLowerCase();
    orders = orders.filter(o =>
      o.id.toLowerCase().includes(term) ||
      o.customerName.toLowerCase().includes(term) ||
      o.customerPhone.includes(term) ||
      (o.courierName && o.courierName.toLowerCase().includes(term))
    );
  }

  res.json({
    success: true,
    total: orders.length,
    data: orders
  });
});

// GET /api/orders/:id - Ambil detail pesanan
router.get("/:id", (req, res) => {
  const order = db.data.orders.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: "Pesanan tidak ditemukan." });
  }

  res.json({
    success: true,
    data: order
  });
});

// POST /api/orders - Buat pesanan baru
// Aturan Bisnis: Price Snapshot, Automatic ID (ORD-YYYYMMDD-XXX), Decoupled status
router.post("/", (req, res) => {
  const {
    customerId,
    courierId,
    deliveryDate,
    deliveryTimeSlot = "Bebas",
    items = [],
    emptyGallonsExpected = 0,
    driverNotes = ""
  } = req.body;

  if (!customerId) {
    return res.status(400).json({ success: false, message: "Pelanggan (customerId) wajib dipilih." });
  }

  const customer = db.data.customers.find(c => c.id === customerId);
  if (!customer) {
    return res.status(404).json({ success: false, message: "Data pelanggan tidak ditemukan." });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: "Minimal harus ada satu item produk yang dipesan." });
  }

  const targetDate = deliveryDate ? deliveryDate.trim() : getWitaDate();
  const dateOrdersCount = db.data.orders.filter(o => o.deliveryDate === targetDate).length + 1;
  const orderId = `ORD-${targetDate.replace(/-/g, "")}-${String(dateOrdersCount).padStart(3, "0")}`;

  // Snapshot harga saat order dibuat (Aturan Kekekalan Harga Riwayat)
  const snapshotItems = items.map(it => {
    const prod = db.data.products.find(p => p.id === it.productId);
    const unitPrice = db.getEffectivePrice(customerId, it.productId);
    const qty = Number(it.qtyOrdered) || 1;
    return {
      productId: it.productId,
      productName: prod ? prod.name : "Produk",
      unitPrice,
      qtyOrdered: qty,
      qtyDelivered: qty // Default awal sama dengan yang dipesan
    };
  });

  const subtotal = snapshotItems.reduce((acc, it) => acc + (it.unitPrice * it.qtyOrdered), 0);
  const courier = courierId ? db.data.users.find(u => u.id === courierId && u.role === "courier") : null;

  const newOrder = {
    id: orderId,
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    customerAddress: customer.address,
    addressNotes: customer.addressNotes || "",
    courierId: courier ? courier.id : null,
    courierName: courier ? courier.name : "Belum Ditugaskan",
    deliveryDate: targetDate,
    deliveryTimeSlot: deliveryTimeSlot.trim() || "Bebas",
    deliveryStatus: courier ? "ASSIGNED" : "PENDING",
    paymentStatus: "UNPAID",
    items: snapshotItems,
    emptyGallonsExpected: Number(emptyGallonsExpected) || 0,
    emptyGallonsReturned: 0,
    subtotalOrdered: subtotal,
    subtotalActual: subtotal,
    totalPaid: 0,
    paymentMethod: "CASH",
    driverNotes: driverNotes.trim(),
    createdAt: new Date().toISOString()
  };

  db.data.orders.unshift(newOrder);
  db.persist();

  res.status(201).json({
    success: true,
    message: `Pesanan ${newOrder.id} berhasil dibuat.`,
    data: newOrder
  });
});

// PATCH /api/orders/:id/assign - Tugaskan pesanan ke kurir
router.patch("/:id/assign", (req, res) => {
  const order = db.data.orders.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: "Pesanan tidak ditemukan." });
  }

  const { courierId } = req.body;
  if (!courierId) {
    // Unassign
    order.courierId = null;
    order.courierName = "Belum Ditugaskan";
    if (order.deliveryStatus === "ASSIGNED") {
      order.deliveryStatus = "PENDING";
    }
  } else {
    const courier = db.data.users.find(u => u.id === courierId && u.role === "courier");
    if (!courier) {
      return res.status(404).json({ success: false, message: "Kurir tidak ditemukan." });
    }
    order.courierId = courier.id;
    order.courierName = courier.name;
    if (order.deliveryStatus === "PENDING") {
      order.deliveryStatus = "ASSIGNED";
    }
  }

  db.persist();

  res.json({
    success: true,
    message: `Pesanan ${order.id} berhasil ditugaskan ke ${order.courierName}.`,
    data: order
  });
});

// PATCH /api/orders/:id/status - Ubah status pengantaran langsung
router.patch("/:id/status", (req, res) => {
  const order = db.data.orders.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: "Pesanan tidak ditemukan." });
  }

  const { deliveryStatus } = req.body;
  const validStatuses = ["PENDING", "ASSIGNED", "ON_DELIVERY", "DELIVERED", "CANCELLED"];
  if (!validStatuses.includes(deliveryStatus)) {
    return res.status(400).json({
      success: false,
      message: `Status tidak valid. Gunakan salah satu dari: ${validStatuses.join(", ")}`
    });
  }

  order.deliveryStatus = deliveryStatus;
  db.persist();

  res.json({
    success: true,
    message: `Status pesanan ${order.id} diubah menjadi ${deliveryStatus}.`,
    data: order
  });
});

// POST /api/orders/:id/complete - Selesaikan pengantaran di lapangan
// Aturan Bisnis:
// 1. Kesesuaian realisasi kirim aktual (qtyDeliveredMap)
// 2. Kalkulasi ulang subtotal aktual
// 3. Status bayar independen (LUNAS / PARTIAL / UNPAID)
// 4. Update saldo piutang jika ada selisih
// 5. Pencatatan galon kosong & update saldo galon fisik pelanggan
// 6. Pencatatan mutasi galon & pembayaran otomatis
router.post("/:id/complete", (req, res) => {
  const order = db.data.orders.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: "Pesanan tidak ditemukan." });
  }

  const {
    qtyDeliveredMap = {},
    emptyGallonsReturned = 0,
    amountPaid = 0,
    paymentMethod = "CASH",
    driverNotes = ""
  } = req.body;

  const customer = db.data.customers.find(c => c.id === order.customerId);

  // 1. Hitung ulang barang terkirim aktual dan galon isi
  let recalculatedSubtotal = 0;
  let totalGallonsDelivered = 0;

  order.items.forEach(it => {
    if (qtyDeliveredMap[it.productId] !== undefined) {
      it.qtyDelivered = Number(qtyDeliveredMap[it.productId]) || 0;
    }
    recalculatedSubtotal += (it.unitPrice * it.qtyDelivered);

    if (it.productId === "prod-refill-19l" || it.productName.toLowerCase().includes("refill")) {
      totalGallonsDelivered += it.qtyDelivered;
    }
  });

  order.subtotalActual = recalculatedSubtotal;
  const paid = Number(amountPaid) || 0;
  order.totalPaid = paid;
  order.paymentMethod = paymentMethod;
  if (driverNotes) order.driverNotes = driverNotes;

  // 2. Status pembayaran independen
  if (paid >= recalculatedSubtotal) {
    order.paymentStatus = "PAID";
  } else if (paid > 0 && paid < recalculatedSubtotal) {
    order.paymentStatus = "PARTIAL";
  } else {
    order.paymentStatus = "UNPAID";
  }

  // 3. Status pengantaran
  order.deliveryStatus = "DELIVERED";
  order.emptyGallonsReturned = Number(emptyGallonsReturned) || 0;
  order.deliveredAt = new Date().toISOString();

  // 4. Update saldo piutang pelanggan jika kurang bayar
  const unpaidDiff = Math.max(0, recalculatedSubtotal - paid);
  if (unpaidDiff > 0 && customer) {
    customer.currentDebtBalance = (customer.currentDebtBalance || 0) + unpaidDiff;
  }

  // 5. Update saldo galon fisik pelanggan
  const gallonNetDelta = totalGallonsDelivered - (Number(emptyGallonsReturned) || 0);
  if (customer) {
    customer.currentGallonBalance = (customer.currentGallonBalance || 0) + gallonNetDelta;
  }

  // 6. Catat Log Mutasi Galon
  const gallonLog = {
    id: `gln-${Date.now()}`,
    orderId: order.id,
    customerId: order.customerId,
    customerName: order.customerName,
    gallonsOut: totalGallonsDelivered,
    gallonsIn: Number(emptyGallonsReturned) || 0,
    balanceAfter: customer ? customer.currentGallonBalance : 0,
    loggedAt: new Date().toISOString()
  };
  db.data.gallonLogs.unshift(gallonLog);

  // 7. Catat Log Pembayaran jika ada uang masuk
  let paymentLog = null;
  if (paid > 0) {
    paymentLog = {
      id: `pay-${Date.now()}`,
      orderId: order.id,
      customerId: order.customerId,
      customerName: order.customerName,
      amount: paid,
      paymentMethod,
      collectedBy: order.courierId || "usr-courier-1",
      collectedByName: order.courierName || "Kurir",
      paymentDate: new Date().toISOString(),
      notes: `Pembayaran pesanan ${order.id}`
    };
    db.data.payments.unshift(paymentLog);
  }

  db.persist();

  res.json({
    success: true,
    message: `Pengantaran pesanan ${order.id} berhasil diselesaikan.`,
    data: {
      order,
      gallonLog,
      paymentLog,
      customerUpdated: customer
    }
  });
});

// POST /api/orders/:id/cancel - Pembatalan pesanan (Integritas Pembatalan: tidak dihapus permanen)
router.post("/:id/cancel", (req, res) => {
  const order = db.data.orders.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: "Pesanan tidak ditemukan." });
  }

  const { cancellationReason = "Dibatalkan (Ya/Oke)" } = req.body || {};
  order.deliveryStatus = "CANCELLED";
  order.cancellationReason = (cancellationReason || "").trim() || "Dibatalkan (Ya/Oke)";
  order.cancelledAt = new Date().toISOString();

  db.persist();

  res.json({
    success: true,
    message: `Pesanan ${order.id} berhasil dibatalkan (Oke).`,
    data: order
  });
});

export default router;
