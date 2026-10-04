import { Router } from "express";
import { db, getWitaDate } from "../db.js";

const router = Router();

// GET /api/reports/daily-summary
router.get("/daily-summary", async (req, res) => {
  try {
    const targetDate = req.query.date || getWitaDate();
    const ordersToday = await db.getOrders({ date: targetDate });
    const deliveredOrders = ordersToday.filter(o => o.deliveryStatus === "DELIVERED");

    let totalGallonsDelivered = 0, totalEmptyGallonsReturned = 0, totalOmzetActual = 0, totalNewDebt = 0;
    deliveredOrders.forEach(o => {
      totalOmzetActual += (o.subtotalActual || 0);
      totalEmptyGallonsReturned += (o.emptyGallonsReturned || 0);
      o.items.filter(it => it.productId === "prod-refill-19l" || it.productName.toLowerCase().includes("refill"))
        .forEach(it => { totalGallonsDelivered += (it.qtyDelivered || 0); });
      totalNewDebt += Math.max(0, (o.subtotalActual || 0) - (o.totalPaid || 0));
    });

    const paymentsToday = await db.getPayments();
    const couriers = await db.getUsers({ role: "courier" });
    const courierCashTally = {};
    couriers.forEach(c => { courierCashTally[c.id] = { name: c.name, vehicle: c.vehicle || "-", cashInHand: 0, ordersCompleted: 0 }; });

    let totalCashReceived = 0, totalTransferReceived = 0;
    // Filter payments by date (WITA)
    const todayPayments = paymentsToday.filter(p => {
      try { return p.paymentDate && p.paymentDate.startsWith(targetDate); } catch { return false; }
    });
    todayPayments.forEach(p => {
      if (p.paymentMethod === "CASH") {
        totalCashReceived += p.amount;
        if (p.collectedBy && courierCashTally[p.collectedBy]) courierCashTally[p.collectedBy].cashInHand += p.amount;
      } else { totalTransferReceived += p.amount; }
    });
    deliveredOrders.forEach(o => { if (o.courierId && courierCashTally[o.courierId]) courierCashTally[o.courierId].ordersCompleted += 1; });

    const unpaidOrders = deliveredOrders
      .filter(o => (o.subtotalActual || 0) > (o.totalPaid || 0))
      .map(o => ({ orderId: o.id, customerName: o.customerName, subtotalActual: o.subtotalActual, totalPaid: o.totalPaid, debtRemaining: (o.subtotalActual || 0) - (o.totalPaid || 0), courierName: o.courierName }));

    res.json({
      success: true,
      data: {
        date: targetDate, timeZone: "Asia/Makassar (WITA, UTC+8)", totalOrders: ordersToday.length,
        counts: { delivered: deliveredOrders.length, onDelivery: ordersToday.filter(o => o.deliveryStatus === "ON_DELIVERY").length, assigned: ordersToday.filter(o => o.deliveryStatus === "ASSIGNED").length, pending: ordersToday.filter(o => o.deliveryStatus === "PENDING").length, cancelled: ordersToday.filter(o => o.deliveryStatus === "CANCELLED").length },
        gallons: { totalDelivered: totalGallonsDelivered, totalEmptyReturned: totalEmptyGallonsReturned, netDelta: totalGallonsDelivered - totalEmptyGallonsReturned },
        finance: { totalOmzetActual, totalCashReceived, totalTransferReceived, totalRevenueCollected: totalCashReceived + totalTransferReceived, totalNewDebt },
        courierCashTally, unpaidOrders
      }
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

export default router;
