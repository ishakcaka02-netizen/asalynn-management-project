import { Router } from "express";
import { db, getWitaDate } from "../db.js";

const router = Router();

// GET /api/orders - Ambil daftar pesanan (dengan filter tanggal, kurir, status)
router.get("/", (req, res) => {
  const { date, courierId, status, paymentStatus, customerId, q } = req.query;
  const orders = db.getOrders({ date, courierId, status, paymentStatus, customerId, q });

  res.json({
    success: true,
    total: orders.length,
    data: orders
  });
});

// GET /api/orders/:id - Ambil detail pesanan
router.get("/:id", (req, res) => {
  const order = db.getOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: "Pesanan tidak ditemukan." });
  }

  res.json({
    success: true,
    data: order
  });
});

// POST /api/orders - Buat pesanan baru
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

  const customer = db.getCustomerById(customerId);
  if (!customer) {
    return res.status(404).json({ success: false, message: "Data pelanggan tidak ditemukan." });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: "Minimal harus ada satu item produk yang dipesan." });
  }

  const targetDate = deliveryDate ? deliveryDate.trim() : getWitaDate();
  const existingTodayOrders = db.getOrders({ date: targetDate });
  const orderId = `ORD-${targetDate.replace(/-/g, "")}-${String(existingTodayOrders.length + 1).padStart(3, "0")}`;

  // Snapshot harga saat order dibuat (Aturan Kekekalan Harga Riwayat)
  const snapshotItems = items.map(it => {
    const prod = db.getProductById(it.productId);
    const unitPrice = db.getEffectivePrice(customerId, it.productId);
    const qty = Number(it.qtyOrdered) || 1;
    return {
      productId: it.productId,
      productName: prod ? prod.name : "Produk",
      unitPrice,
      qtyOrdered: qty,
      qtyDelivered: qty
    };
  });

  const subtotal = snapshotItems.reduce((acc, it) => acc + (it.unitPrice * it.qtyOrdered), 0);
  const courier = courierId ? db.getUserById(courierId) : null;

  const newOrder = db.createOrder({
    id: orderId,
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    customerAddress: customer.address,
    addressNotes: customer.addressNotes || "",
    courierId: (courier && courier.role === "courier") ? courier.id : null,
    courierName: (courier && courier.role === "courier") ? courier.name : "Belum Ditugaskan",
    deliveryDate: targetDate,
    deliveryTimeSlot: deliveryTimeSlot.trim() || "Bebas",
    deliveryStatus: (courier && courier.role === "courier") ? "ASSIGNED" : "PENDING",
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
  });

  res.status(201).json({
    success: true,
    message: `Pesanan ${newOrder.id} berhasil dibuat.`,
    data: newOrder
  });
});

// PUT /api/orders/:id - Perbarui data pesanan (Edit Order)
router.put("/:id", (req, res) => {
  const order = db.getOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: "Pesanan tidak ditemukan." });
  }

  const {
    deliveryDate,
    deliveryTimeSlot,
    courierId,
    items,
    emptyGallonsExpected,
    driverNotes,
    addressNotes
  } = req.body;

  let updateData = {};
  if (deliveryDate !== undefined) updateData.deliveryDate = deliveryDate.trim();
  if (deliveryTimeSlot !== undefined) updateData.deliveryTimeSlot = deliveryTimeSlot.trim();
  if (driverNotes !== undefined) updateData.driverNotes = driverNotes.trim();
  if (addressNotes !== undefined) updateData.addressNotes = addressNotes.trim();
  if (emptyGallonsExpected !== undefined) updateData.emptyGallonsExpected = Number(emptyGallonsExpected);

  if (courierId !== undefined) {
    if (!courierId) {
      updateData.courierId = null;
      updateData.courierName = "Belum Ditugaskan";
      if (order.deliveryStatus === "ASSIGNED") {
        updateData.deliveryStatus = "PENDING";
      }
    } else {
      const courier = db.getUserById(courierId);
      if (courier && courier.role === "courier") {
        updateData.courierId = courier.id;
        updateData.courierName = courier.name;
        if (order.deliveryStatus === "PENDING") {
          updateData.deliveryStatus = "ASSIGNED";
        }
      }
    }
  }

  if (Array.isArray(items) && items.length > 0) {
    const updatedItems = items.map(it => {
      const prod = db.getProductById(it.productId);
      const unitPrice = it.unitPrice !== undefined ? Number(it.unitPrice) : db.getEffectivePrice(order.customerId, it.productId);
      const qtyOrdered = Number(it.qtyOrdered) || 1;
      const qtyDelivered = it.qtyDelivered !== undefined ? Number(it.qtyDelivered) : qtyOrdered;
      return {
        productId: it.productId,
        productName: prod ? prod.name : it.productName || "Produk",
        unitPrice,
        qtyOrdered,
        qtyDelivered
      };
    });
    updateData.items = updatedItems;
    updateData.subtotalActual = updatedItems.reduce((acc, it) => acc + (it.unitPrice * it.qtyDelivered), 0);
  }

  const updatedOrder = db.updateOrder(order.id, updateData);

  res.json({
    success: true,
    message: `Pesanan ${updatedOrder.id} berhasil diperbarui.`,
    data: updatedOrder
  });
});

// PATCH /api/orders/:id/assign - Tugaskan pesanan ke kurir
router.patch("/:id/assign", (req, res) => {
  const order = db.getOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: "Pesanan tidak ditemukan." });
  }

  const { courierId } = req.body;
  let updateData = {};

  if (!courierId) {
    updateData.courierId = null;
    updateData.courierName = "Belum Ditugaskan";
    if (order.deliveryStatus === "ASSIGNED") {
      updateData.deliveryStatus = "PENDING";
    }
  } else {
    const courier = db.getUserById(courierId);
    if (!courier || courier.role !== "courier") {
      return res.status(404).json({ success: false, message: "Kurir tidak ditemukan." });
    }
    updateData.courierId = courier.id;
    updateData.courierName = courier.name;
    if (order.deliveryStatus === "PENDING") {
      updateData.deliveryStatus = "ASSIGNED";
    }
  }

  const updatedOrder = db.updateOrder(order.id, updateData);

  res.json({
    success: true,
    message: `Pesanan ${updatedOrder.id} berhasil ditugaskan ke ${updatedOrder.courierName}.`,
    data: updatedOrder
  });
});

// PATCH /api/orders/:id/status - Ubah status pengantaran langsung
router.patch("/:id/status", (req, res) => {
  const order = db.getOrderById(req.params.id);
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

  const updatedOrder = db.updateOrder(order.id, { deliveryStatus });

  res.json({
    success: true,
    message: `Status pesanan ${updatedOrder.id} diubah menjadi ${deliveryStatus}.`,
    data: updatedOrder
  });
});

// POST /api/orders/:id/complete - Selesaikan pengantaran di lapangan
router.post("/:id/complete", (req, res) => {
  const order = db.getOrderById(req.params.id);
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

  const customer = db.getCustomerById(order.customerId);

  let recalculatedSubtotal = 0;
  let totalGallonsDelivered = 0;

  const updatedItems = order.items.map(it => {
    let deliveredQty = it.qtyDelivered;
    if (qtyDeliveredMap[it.productId] !== undefined) {
      deliveredQty = Number(qtyDeliveredMap[it.productId]) || 0;
    }
    recalculatedSubtotal += (it.unitPrice * deliveredQty);

    if (it.productId === "prod-refill-19l" || it.productName.toLowerCase().includes("refill")) {
      totalGallonsDelivered += deliveredQty;
    }

    return {
      ...it,
      qtyDelivered: deliveredQty
    };
  });

  const paid = Number(amountPaid) || 0;
  let paymentStatus = "UNPAID";
  if (paid >= recalculatedSubtotal) {
    paymentStatus = "PAID";
  } else if (paid > 0 && paid < recalculatedSubtotal) {
    paymentStatus = "PARTIAL";
  }

  const nowIso = new Date().toISOString();

  const updatedOrder = db.updateOrder(order.id, {
    items: updatedItems,
    subtotalActual: recalculatedSubtotal,
    totalPaid: paid,
    paymentMethod,
    driverNotes: driverNotes || order.driverNotes,
    paymentStatus,
    deliveryStatus: "DELIVERED",
    emptyGallonsReturned: Number(emptyGallonsReturned) || 0,
    deliveredAt: nowIso
  });

  const unpaidDiff = Math.max(0, recalculatedSubtotal - paid);
  const gallonNetDelta = totalGallonsDelivered - (Number(emptyGallonsReturned) || 0);

  let updatedCustomer = customer;
  if (customer) {
    const newDebt = (customer.currentDebtBalance || 0) + unpaidDiff;
    const newGallonBal = (customer.currentGallonBalance || 0) + gallonNetDelta;
    updatedCustomer = db.updateCustomer(customer.id, {
      currentDebtBalance: newDebt,
      currentGallonBalance: newGallonBal
    });
  }

  const gallonLog = db.createGallonLog({
    id: `gln-${Date.now()}`,
    orderId: order.id,
    customerId: order.customerId,
    customerName: order.customerName,
    gallonsOut: totalGallonsDelivered,
    gallonsIn: Number(emptyGallonsReturned) || 0,
    balanceAfter: updatedCustomer ? updatedCustomer.currentGallonBalance : 0,
    loggedAt: nowIso
  });

  let paymentLog = null;
  if (paid > 0) {
    paymentLog = db.createPayment({
      id: `pay-${Date.now()}`,
      orderId: order.id,
      customerId: order.customerId,
      customerName: order.customerName,
      amount: paid,
      paymentMethod,
      collectedBy: order.courierId || "usr-courier-1",
      collectedByName: order.courierName || "Kurir",
      paymentDate: nowIso,
      notes: `Pembayaran pesanan ${order.id}`
    });
  }

  res.json({
    success: true,
    message: `Pengantaran pesanan ${order.id} berhasil diselesaikan.`,
    data: {
      order: updatedOrder,
      gallonLog,
      paymentLog,
      customerUpdated: updatedCustomer
    }
  });
});

// POST /api/orders/:id/cancel - Pembatalan pesanan (Integritas Pembatalan)
router.post("/:id/cancel", (req, res) => {
  const order = db.getOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: "Pesanan tidak ditemukan." });
  }

  const { cancellationReason = "Dibatalkan (Ya/Oke)" } = req.body || {};
  const updatedOrder = db.updateOrder(order.id, {
    deliveryStatus: "CANCELLED",
    cancellationReason: (cancellationReason || "").trim() || "Dibatalkan (Ya/Oke)",
    cancelledAt: new Date().toISOString()
  });

  res.json({
    success: true,
    message: `Pesanan ${updatedOrder.id} berhasil dibatalkan (Oke).`,
    data: updatedOrder
  });
});

// DELETE /api/orders/:id - Hapus pesanan
router.delete("/:id", (req, res) => {
  const order = db.getOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: "Pesanan tidak ditemukan." });
  }

  db.deleteOrder(req.params.id);

  res.json({
    success: true,
    message: `Pesanan '${order.id}' berhasil dihapus.`
  });
});

export default router;
