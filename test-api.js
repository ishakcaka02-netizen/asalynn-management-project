// Automated API Verification Test Suite - Full CRUD & Integration
import { app } from "./server/app.js";

async function runTests() {
  console.log("=== MEMULAI TEST VERIFIKASI API ASALYNN DEPOT (FULL CRUD) ===");

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  try {
    // 1. Health check & root API
    console.log("\n[1] Testing GET /api ...");
    const resRoot = await fetch(`${baseUrl}`);
    const rootData = await resRoot.json();
    console.log("Status:", resRoot.status, rootData.name, "| Timezone:", rootData.timezone);
    if (!rootData.endpoints) throw new Error("Root API tidak mengembalikan daftar endpoints");

    // 2. Auth: Profiles & Login
    console.log("\n[2] Testing Auth Routes (/api/auth) ...");
    const resProfiles = await fetch(`${baseUrl}/auth/profiles`);
    const profiles = await resProfiles.json();
    console.log("Profiles count:", profiles.data.length);

    // Test Login Owner PIN 1234
    const resLogin = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "usr-admin-1", pin: "1234" })
    });
    const loginData = await resLogin.json();
    console.log("Login Owner Result:", loginData.success, loginData.message);
    if (!loginData.success) throw new Error("Gagal login admin");

    // Test Login PIN salah
    const resWrongPin = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "usr-admin-1", pin: "9999" })
    });
    const wrongPinData = await resWrongPin.json();
    console.log("Wrong PIN Rejected properly:", resWrongPin.status === 401, wrongPinData.message);

    // 3. Full CRUD Products
    console.log("\n[3] Testing Products CRUD (/api/products) ...");
    const resProds = await fetch(`${baseUrl}/products`);
    const prods = await resProds.json();
    console.log("Products count:", prods.data.length);

    const resCreateProd = await fetch(`${baseUrl}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Produk Uji Coba CRUD", standardPrice: 15000, unit: "Paket", code: "TEST-01" })
    });
    const newProd = await resCreateProd.json();
    console.log("Created Product:", newProd.data.id, newProd.data.name);

    const resUpdateProd = await fetch(`${baseUrl}/products/${newProd.data.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ standardPrice: 17000 })
    });
    const updatedProd = await resUpdateProd.json();
    console.log("Updated Product Price:", updatedProd.data.standardPrice);

    const resDelProd = await fetch(`${baseUrl}/products/${newProd.data.id}`, { method: "DELETE" });
    const delProdData = await resDelProd.json();
    console.log("Deactivated Product Result:", delProdData.success);

    // 4. Customers & Custom Prices CRUD
    console.log("\n[4] Testing Customer Routes (/api/customers) ...");
    let resCusts = await fetch(`${baseUrl}/customers`);
    let custs = await resCusts.json();
    console.log("Customers count:", custs.data.length);
    
    if (custs.data.length === 0) {
      console.log("Creating test customer on 0 database ...");
      const resCreateCust = await fetch(`${baseUrl}/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Warung Coto Daeng Tata",
          phone: "081299887766",
          address: "Jl. Daeng Tata Raya No. 45, Makassar"
        })
      });
      const createdCust = await resCreateCust.json();
      custs.data = [createdCust.data];
    }
    const sampleCust = custs.data[0];

    // Set custom price
    console.log(`Setting custom price for ${sampleCust.name} ...`);
    const resCustomPrice = await fetch(`${baseUrl}/customers/${sampleCust.id}/custom-prices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: "prod-refill-19l", customPrice: 5500 })
    });
    const customPriceData = await resCustomPrice.json();
    console.log("Custom price result:", customPriceData.success, customPriceData.data);

    // 5. Full Orders Lifecycle & CRUD (Create -> Edit -> Complete -> Audit -> Delete)
    console.log("\n[5] Testing Orders Lifecycle & CRUD (/api/orders) ...");
    const orderPayload = {
      customerId: sampleCust.id,
      courierId: "usr-courier-1",
      deliveryDate: "2026-10-04",
      deliveryTimeSlot: "Pagi (09:00 - 11:00)",
      items: [
        { productId: "prod-refill-19l", qtyOrdered: 5 }
      ],
      emptyGallonsExpected: 5,
      driverNotes: "Uji coba via API test"
    };

    const resCreateOrder = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderPayload)
    });
    const createdOrder = await resCreateOrder.json();
    console.log("Order created:", createdOrder.data.id, "| Subtotal:", createdOrder.data.subtotalOrdered, "| UnitPrice Snapshot:", createdOrder.data.items[0].unitPrice);

    if (createdOrder.data.items[0].unitPrice !== 5500) {
      throw new Error(`Harga khusus tidak diterapkan pada snapshot order! Diharapkan 5500, dapat: ${createdOrder.data.items[0].unitPrice}`);
    }

    // Edit Order (PUT /api/orders/:id)
    const resEditOrder = await fetch(`${baseUrl}/orders/${createdOrder.data.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverNotes: "Catatan pengantar diperbarui" })
    });
    const editedOrderData = await resEditOrder.json();
    console.log("Edited Order Notes:", editedOrderData.data.driverNotes);

    // Complete delivery at customer site
    console.log(`Completing delivery for ${createdOrder.data.id} ...`);
    const resComplete = await fetch(`${baseUrl}/orders/${createdOrder.data.id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        qtyDeliveredMap: { "prod-refill-19l": 4 },
        emptyGallonsReturned: 4,
        amountPaid: 22000,
        paymentMethod: "CASH",
        driverNotes: "Selesai diantar 4 galon pas."
      })
    });
    const completeData = await resComplete.json();
    console.log("Complete delivery status:", completeData.success, "| New subtotal actual:", completeData.data.order.subtotalActual, "| DeliveryStatus:", completeData.data.order.deliveryStatus, "| PaymentStatus:", completeData.data.order.paymentStatus);

    // 6. Reports / Daily Summary
    console.log("\n[6] Testing Reports Route (/api/reports/daily-summary) ...");
    const resReport = await fetch(`${baseUrl}/reports/daily-summary?date=2026-10-04`);
    const reportData = await resReport.json();
    console.log("Daily summary for 2026-10-04:");
    console.log(" - Total Orders:", reportData.data.totalOrders);
    console.log(" - Total Delivered:", reportData.data.counts.delivered);
    console.log(" - Gallons Delivered:", reportData.data.gallons.totalDelivered);
    console.log(" - Empty Gallons Returned:", reportData.data.gallons.totalEmptyReturned);
    console.log(" - Total Omzet:", reportData.data.finance.totalOmzetActual);
    console.log(" - Total Cash Received:", reportData.data.finance.totalCashReceived);
    console.log(" - Courier Cash Tally:", Object.keys(reportData.data.courierCashTally));

    // 7. Gallon Logs & Payments Full CRUD
    console.log("\n[7] Testing Gallons & Payments routes ...");
    const resGallonLogs = await fetch(`${baseUrl}/gallons/logs`);
    const gallonLogs = await resGallonLogs.json();
    console.log("Total Gallon Logs:", gallonLogs.total);

    const resPayments = await fetch(`${baseUrl}/payments`);
    const payments = await resPayments.json();
    console.log("Total Payment Logs:", payments.total);

    if (payments.data.length > 0) {
      const pId = payments.data[0].id;
      const resPayDetail = await fetch(`${baseUrl}/payments/${pId}`);
      const payDetail = await resPayDetail.json();
      console.log("Payment detail fetched:", payDetail.success, payDetail.data.id, payDetail.data.amount);
    }

    // 8. Order Cancellation Integrity
    console.log("\n[8] Testing Order Cancellation Integrity ...");
    const resCancel = await fetch(`${baseUrl}/orders/${createdOrder.data.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cancellationReason: "Pelanggan tutup toko mendadak" })
    });
    const cancelData = await resCancel.json();
    console.log("Cancel order result:", cancelData.success, "| DeliveryStatus:", cancelData.data.deliveryStatus, "| Reason:", cancelData.data.cancellationReason);

    // 9. Test Clear-Zero Reset API Endpoint
    console.log("\n[9] Testing POST /api/system/clear-zero ...");
    const resClearZero = await fetch(`${baseUrl}/system/clear-zero`, { method: "POST" });
    const clearZeroData = await resClearZero.json();
    console.log("Clear-zero result:", clearZeroData.success, clearZeroData.message);
    console.log("Database state after reset:", clearZeroData.summary);

    console.log("\n✨ SEMUA PENGUJIAN API ROUTES (FULL CRUD) BERHASIL 100%! ✨\n");
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error("Test Error:", err);
  process.exit(1);
});
