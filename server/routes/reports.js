import { Router } from "express";
import { db, getWitaDate } from "../db.js";

const router = Router();

// GET /api/reports/daily-summary - Rekap Ringkasan Harian (Daily Closing) WITA
router.get("/daily-summary", (req, res) => {
  const targetDate = req.query.date || getWitaDate();

  const ordersToday = db.data.orders.filter(o => o.deliveryDate === targetDate);
  const deliveredOrders = ordersToday.filter(o => o.deliveryStatus === "DELIVERED");

  let totalGallonsDelivered = 0;
  let totalEmptyGallonsReturned = 0;
  let totalOmzetActual = 0;
  let totalNewDebt = 0;

  deliveredOrders.forEach(o => {
    totalOmzetActual += (o.subtotalActual || 0);
    totalEmptyGallonsReturned += (o.emptyGallonsReturned || 0);

    const gallonItems = o.items.filter(it =>
      it.productId === "prod-refill-19l" ||
      it.productName.toLowerCase().includes("refill")
    );
    gallonItems.forEach(it => {
      totalGallonsDelivered += (it.qtyDelivered || 0);
    });

    const orderDebt = Math.max(0, (o.subtotalActual || 0) - (o.totalPaid || 0));
    totalNewDebt += orderDebt;
  });

  // Pembayaran pada tanggal target (WITA)
  const paymentsToday = db.data.payments.filter(p => {
    const pDate = getWitaDate(new Date(p.paymentDate));
    return pDate === targetDate;
  });

  let totalCashReceived = 0;
  let totalTransferReceived = 0;
  const courierCashTally = {};

  db.data.users.filter(u => u.role === "courier").forEach(c => {
    courierCashTally[c.id] = {
      name: c.name,
      vehicle: c.vehicle || "-",
      cashInHand: 0,
      ordersCompleted: 0
    };
  });

  paymentsToday.forEach(p => {
    if (p.paymentMethod === "CASH") {
      totalCashReceived += p.amount;
      if (p.collectedBy && courierCashTally[p.collectedBy]) {
        courierCashTally[p.collectedBy].cashInHand += p.amount;
      }
    } else {
      totalTransferReceived += p.amount;
    }
  });

  deliveredOrders.forEach(o => {
    if (o.courierId && courierCashTally[o.courierId]) {
      courierCashTally[o.courierId].ordersCompleted += 1;
    }
  });

  // Daftar pesanan yang belum lunas
  const unpaidOrders = deliveredOrders
    .filter(o => (o.subtotalActual || 0) > (o.totalPaid || 0))
    .map(o => ({
      orderId: o.id,
      customerName: o.customerName,
      subtotalActual: o.subtotalActual,
      totalPaid: o.totalPaid,
      debtRemaining: (o.subtotalActual || 0) - (o.totalPaid || 0),
      courierName: o.courierName
    }));

  res.json({
    success: true,
    data: {
      date: targetDate,
      timeZone: "Asia/Makassar (WITA, UTC+8)",
      totalOrders: ordersToday.length,
      counts: {
        delivered: deliveredOrders.length,
        onDelivery: ordersToday.filter(o => o.deliveryStatus === "ON_DELIVERY").length,
        assigned: ordersToday.filter(o => o.deliveryStatus === "ASSIGNED").length,
        pending: ordersToday.filter(o => o.deliveryStatus === "PENDING").length,
        cancelled: ordersToday.filter(o => o.deliveryStatus === "CANCELLED").length
      },
      gallons: {
        totalDelivered: totalGallonsDelivered,
        totalEmptyReturned: totalEmptyGallonsReturned,
        netDelta: totalGallonsDelivered - totalEmptyGallonsReturned
      },
      finance: {
        totalOmzetActual,
        totalCashReceived,
        totalTransferReceived,
        totalRevenueCollected: totalCashReceived + totalTransferReceived,
        totalNewDebt
      },
      courierCashTally,
      unpaidOrders
    }
  });
});

export default router;
