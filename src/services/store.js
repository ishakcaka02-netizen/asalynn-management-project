// Store & Business Logic Service - Depot Air Asalynn
// Mengimplementasikan seluruh Aturan Bisnis Tahap 1 (WITA Timezone, Price Snapshot, Decoupled Status, Gallon Accounting)

import { INITIAL_DATA } from "../data/initialData.js";

const STORAGE_KEY = "asalynn_management_store_v1";

// Helper: Format tanggal & waktu zona Asia/Makassar (WITA, UTC+8)
export function getWitaDate(dateObj = new Date()) {
  // Asia/Makassar offset UTC+8
  const witaTimeStr = dateObj.toLocaleString("en-US", { timeZone: "Asia/Makassar" });
  const witaDate = new Date(witaTimeStr);
  const yyyy = witaDate.getFullYear();
  const mm = String(witaDate.getMonth() + 1).padStart(2, "0");
  const dd = String(witaDate.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getWitaTimeString(dateObj = new Date()) {
  return dateObj.toLocaleTimeString("id-ID", {
    timeZone: "Asia/Makassar",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }) + " WITA";
}

export function formatRupiah(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(amount || 0);
}

class Store {
  constructor() {
    this.listeners = [];
    this.data = this.loadFromStorage();
  }

  loadFromStorage() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const today = getWitaDate();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        // Pastikan struktur lengkap
        if (parsed.orders && parsed.customers && parsed.products) {
          // Migrasi akun: pastikan field pin tersedia
          if (parsed.users) {
            parsed.users.forEach(u => {
              if (!u.pin) {
                if (u.id === "usr-admin-1") u.pin = "1234";
                else if (u.id === "usr-courier-1") u.pin = "1111";
                else if (u.id === "usr-courier-2") u.pin = "2222";
                else u.pin = "1234";
              }
            });
          }
          // Pastikan pengguna selalu masuk ke Landing Page Menu Login jika belum ada sesi aktif
          if (!sessionStorage.getItem("asalynn_session_active")) {
            parsed.currentUserId = null;
            parsed.currentRole = null;
          } else if (parsed.currentRole === "courier") {
            // Mode kurir dihapus — migrasi sesi lama ke admin
            parsed.currentRole = "admin";
          }
          return parsed;
        }
      } catch (e) {
        console.error("Gagal mem-parsing local storage, mereset data default:", e);
      }
    }

    // Default state jika baru pertama kali dibuka (Kosongkan data untuk mulai fresh)
    const zeroData = {
      users: INITIAL_DATA.users,
      products: INITIAL_DATA.products,
      customers: [],
      orders: [],
      payments: [],
      gallonLogs: [],
      currentRole: null, // null = landing page login
      activeCourierId: null,
      currentUserId: null, // null = landing page login
      lastUpdated: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(zeroData));
    return zeroData;
  }

  save() {
    this.data.lastUpdated = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    this.notify();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(fn => fn(this.data));
  }

  // === ROLE & USER AUTHENTICATION STATE ===
  isLoggedIn() {
    return !!this.data.currentUserId;
  }

  getCurrentUser() {
    if (!this.data.currentUserId) return null;
    return this.data.users.find(u => u.id === this.data.currentUserId) || null;
  }

  setCurrentRole(role) {
    this.data.currentRole = role;
    if (role === "admin") {
      const admin = this.data.users.find(u => u.role === "admin");
      if (admin) this.data.currentUserId = admin.id;
    } else {
      const courier = this.data.users.find(u => u.id === this.data.activeCourierId) || this.data.users.find(u => u.role === "courier");
      if (courier) {
        this.data.currentUserId = courier.id;
        this.data.activeCourierId = courier.id;
      }
    }
    sessionStorage.setItem("asalynn_session_active", "true");
    this.save();
  }

  setActiveCourier(courierId) {
    this.data.activeCourierId = courierId;
    this.data.currentUserId = courierId;
    this.data.currentRole = "courier";
    sessionStorage.setItem("asalynn_session_active", "true");
    this.save();
  }

  login(userId, pin) {
    const user = this.data.users.find(u => u.id === userId);
    if (!user) {
      return { success: false, message: "Akun pengguna tidak ditemukan." };
    }
    const correctPin = user.pin || (user.id === "usr-admin-1" ? "1234" : user.id === "usr-courier-1" ? "1111" : "2222");
    if (user.pin !== pin && correctPin !== pin) {
      return { success: false, message: "PIN yang Anda masukkan salah. Silakan coba lagi." };
    }

    this.data.currentUserId = user.id;
    // Mode Kurir dihapus — semua akun selalu masuk ke Dashboard Admin
    this.data.currentRole = "admin";
    if (user.role === "courier") {
      this.data.activeCourierId = user.id;
    }
    sessionStorage.setItem("asalynn_session_active", "true");
    this.save();
    return { success: true, user };
  }

  logout() {
    this.data.currentUserId = null;
    this.data.currentRole = null;
    sessionStorage.removeItem("asalynn_session_active");
    this.save();
  }

  // === USER PROFILE MANAGEMENT ===
  updateCurrentUserName(newName) {
    if (!this.data.currentUserId) {
      return { success: false, message: "Belum ada sesi login aktif." };
    }
    if (!newName || !newName.trim()) {
      return { success: false, message: "Nama pengguna tidak boleh kosong." };
    }
    const user = this.data.users.find(u => u.id === this.data.currentUserId);
    if (!user) {
      return { success: false, message: "Akun pengguna tidak ditemukan." };
    }
    const oldName = user.name;
    user.name = newName.trim();
    this.save();
    return { success: true, oldName, newName: user.name };
  }

  updateCurrentUserPhone(newPhone) {
    if (!this.data.currentUserId) {
      return { success: false, message: "Belum ada sesi login aktif." };
    }
    if (!newPhone || !newPhone.trim()) {
      return { success: false, message: "Nomor telepon tidak boleh kosong." };
    }
    const user = this.data.users.find(u => u.id === this.data.currentUserId);
    if (!user) {
      return { success: false, message: "Akun pengguna tidak ditemukan." };
    }
    user.phone = newPhone.trim();
    this.save();
    return { success: true, newPhone: user.phone };
  }

  updateCurrentUserPin(currentPin, newPin) {
    if (!this.data.currentUserId) {
      return { success: false, message: "Belum ada sesi login aktif." };
    }
    const user = this.data.users.find(u => u.id === this.data.currentUserId);
    if (!user) {
      return { success: false, message: "Akun pengguna tidak ditemukan." };
    }
    const correctPin = user.pin || "1234";
    if (String(currentPin) !== String(correctPin)) {
      return { success: false, message: "PIN lama yang Anda masukkan salah." };
    }
    if (!newPin || String(newPin).trim().length !== 4) {
      return { success: false, message: "PIN baru harus terdiri dari 4 digit angka." };
    }
    user.pin = String(newPin).trim();
    this.save();
    return { success: true };
  }

  // === CUSTOMER MANAGEMENT ===
  getCustomers() {
    return this.data.customers;
  }

  getCustomerById(id) {
    return this.data.customers.find(c => c.id === id);
  }

  addCustomer({ name, phone, address, addressNotes = "" }) {
    const newCustomer = {
      id: "cust-" + Date.now(),
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      addressNotes: addressNotes.trim(),
      currentGallonBalance: 0,
      currentDebtBalance: 0,
      customPrices: {},
      createdAt: getWitaDate()
    };
    this.data.customers.push(newCustomer);
    this.save();
    return newCustomer;
  }

  updateCustomer(id, fields) {
    const customer = this.getCustomerById(id);
    if (!customer) return null;
    Object.assign(customer, fields);
    this.save();
    return customer;
  }

  deleteCustomer(id) {
    const customer = this.getCustomerById(id);
    if (!customer) return { success: false, message: "Pelanggan tidak ditemukan." };

    if ((customer.currentGallonBalance || 0) > 0) {
      return {
        success: false,
        message: `Pelanggan '${customer.name}' tidak dapat dihapus karena masih terdata menyimpan ${customer.currentGallonBalance} galon depot.`
      };
    }

    const index = this.data.customers.findIndex(c => c.id === id);
    if (index !== -1) {
      this.data.customers.splice(index, 1);
      this.save();
    }
    return { success: true, message: `Data pelanggan '${customer.name}' berhasil dihapus.` };
  }

  setCustomerCustomPrice(customerId, productId, customPrice) {
    const customer = this.getCustomerById(customerId);
    if (!customer) return;
    if (!customer.customPrices) customer.customPrices = {};

    const priceNum = Number(customPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      delete customer.customPrices[productId]; // Hapus harga khusus, kembali ke standar
    } else {
      customer.customPrices[productId] = priceNum;
    }
    this.save();
  }

  // === PRODUCT MANAGEMENT ===
  getProducts() {
    return this.data.products;
  }

  getProductById(id) {
    return this.data.products.find(p => p.id === id);
  }

  getEffectivePrice(customerId, productId) {
    const product = this.getProductById(productId);
    if (!product) return 0;
    const customer = this.getCustomerById(customerId);
    if (customer && customer.customPrices && customer.customPrices[productId]) {
      return customer.customPrices[productId]; // Harga khusus pelanggan
    }
    return product.standardPrice; // Harga standar master produk
  }

  addProduct({ name, standardPrice, unit = "Galon", description = "" }) {
    const newProd = {
      id: "prod-" + Date.now(),
      name: name.trim(),
      code: "PRD-" + Math.floor(100 + Math.random() * 900),
      standardPrice: Number(standardPrice) || 0,
      unit,
      description: description.trim(),
      isActive: true
    };
    this.data.products.push(newProd);
    this.save();
    return newProd;
  }

  updateProduct(id, fields) {
    const prod = this.getProductById(id);
    if (!prod) return;
    Object.assign(prod, fields);
    this.save();
  }

  // === ORDER MANAGEMENT ===
  getOrders() {
    return this.data.orders;
  }

  getOrderById(id) {
    return this.data.orders.find(o => o.id === id);
  }

  createOrder({
    customerId,
    courierId,
    deliveryDate,
    deliveryTimeSlot = "Bebas",
    items = [],
    emptyGallonsExpected = 0,
    driverNotes = ""
  }) {
    const customer = this.getCustomerById(customerId);
    if (!customer) throw new Error("Pelanggan tidak ditemukan");

    const todayDate = deliveryDate || getWitaDate();
    const orderIndex = this.data.orders.filter(o => o.deliveryDate === todayDate).length + 1;
    const orderId = `ORD-${todayDate.replace(/-/g, "")}-${String(orderIndex).padStart(3, "0")}`;

    // Snapshot harga saat order dibuat (Price Immutability rule)
    const snapshotItems = items.map(it => {
      const prod = this.getProductById(it.productId);
      const unitPrice = this.getEffectivePrice(customerId, it.productId);
      const qty = Number(it.qtyOrdered) || 1;
      return {
        productId: it.productId,
        productName: prod ? prod.name : "Produk",
        unitPrice: unitPrice, // snapshot harga
        qtyOrdered: qty,
        qtyDelivered: qty // default sama dengan pesanan
      };
    });

    const subtotal = snapshotItems.reduce((acc, it) => acc + (it.unitPrice * it.qtyOrdered), 0);
    const courier = courierId ? this.data.users.find(u => u.id === courierId) : null;

    const newOrder = {
      id: orderId,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerAddress: customer.address,
      addressNotes: customer.addressNotes || "",
      courierId: courier ? courier.id : null,
      courierName: courier ? courier.name : "Belum Ditugaskan",
      deliveryDate: todayDate,
      deliveryTimeSlot: deliveryTimeSlot,
      deliveryStatus: courier ? "ASSIGNED" : "PENDING",
      paymentStatus: "UNPAID",
      items: snapshotItems,
      emptyGallonsExpected: Number(emptyGallonsExpected) || 0,
      emptyGallonsReturned: 0,
      subtotalOrdered: subtotal,
      subtotalActual: subtotal,
      totalPaid: 0,
      paymentMethod: "CASH",
      driverNotes: driverNotes || "",
      createdAt: new Date().toISOString()
    };

    this.data.orders.unshift(newOrder);
    this.save();
    return newOrder;
  }

  assignCourier(orderId, courierId) {
    const order = this.getOrderById(orderId);
    if (!order) return;
    const courier = this.data.users.find(u => u.id === courierId);
    if (!courier) return;

    order.courierId = courier.id;
    order.courierName = courier.name;
    if (order.deliveryStatus === "PENDING") {
      order.deliveryStatus = "ASSIGNED";
    }
    this.save();
  }

  updateDeliveryStatus(orderId, newStatus) {
    const order = this.getOrderById(orderId);
    if (!order) return;
    order.deliveryStatus = newStatus;
    this.save();
  }

  cancelOrder(orderId, cancellationReason) {
    const order = this.getOrderById(orderId);
    if (!order) return;
    order.deliveryStatus = "CANCELLED";
    order.cancellationReason = cancellationReason || "Dibatalkan oleh pelanggan";
    order.cancelledAt = new Date().toISOString();
    this.save();
  }

  // === PENYELESAIAN PENGANTARAN DI DASHBOARD ADMIN ===
  completeDelivery({
    orderId,
    qtyDeliveredMap = {}, // { [productId]: qtyActual }
    emptyGallonsReturned = 0,
    amountPaid = 0,
    paymentMethod = "CASH",
    driverNotes = ""
  }) {
    const order = this.getOrderById(orderId);
    if (!order) throw new Error("Pesanan tidak ditemukan");

    const customer = this.getCustomerById(order.customerId);
    const currentUser = this.getCurrentUser();

    // Jika pesanan sebelumnya sudah berstatus DELIVERED (mode edit/koreksi realisasi),
    // kembalikan mutasi saldo hutang & galon sebelumnya agar tidak terjadi double counting
    const wasAlreadyDelivered = order.deliveryStatus === "DELIVERED";
    if (wasAlreadyDelivered && customer) {
      const prevUnpaidDiff = Math.max(0, (order.subtotalActual || 0) - (order.totalPaid || 0));
      if (prevUnpaidDiff > 0) {
        customer.currentDebtBalance = Math.max(0, (customer.currentDebtBalance || 0) - prevUnpaidDiff);
      }
      let prevGallonsDelivered = 0;
      order.items.forEach(it => {
        if (it.productId === "prod-refill-19l" || it.productName.toLowerCase().includes("refill")) {
          prevGallonsDelivered += (it.qtyDelivered || 0);
        }
      });
      const prevGallonNetDelta = prevGallonsDelivered - (Number(order.emptyGallonsReturned) || 0);
      customer.currentGallonBalance = (customer.currentGallonBalance || 0) - prevGallonNetDelta;

      // Hapus log mutasi dan pembayaran lama dari pesanan ini
      this.data.payments = this.data.payments.filter(p => p.orderId !== order.id);
      this.data.gallonLogs = this.data.gallonLogs.filter(g => g.orderId !== order.id);
    }

    // 1. Update jumlah barang terkirim aktual & hitung subtotal aktual
    let recalculatedSubtotal = 0;
    let totalGallonsDelivered = 0;

    order.items.forEach(it => {
      if (qtyDeliveredMap[it.productId] !== undefined) {
        it.qtyDelivered = Number(qtyDeliveredMap[it.productId]);
      }
      recalculatedSubtotal += (it.unitPrice * it.qtyDelivered);

      // Hitung khusus produk galon isi ulang untuk saldo galon
      if (it.productId === "prod-refill-19l" || it.productName.toLowerCase().includes("refill")) {
        totalGallonsDelivered += it.qtyDelivered;
      }
    });

    order.subtotalActual = recalculatedSubtotal;
    const paid = Number(amountPaid) || 0;
    order.totalPaid = paid;
    order.paymentMethod = paymentMethod;
    if (driverNotes) order.driverNotes = driverNotes;

    // 2. Tentukan Payment Status secara independen (Decoupled rule)
    if (paid >= recalculatedSubtotal) {
      order.paymentStatus = "PAID";
    } else if (paid > 0 && paid < recalculatedSubtotal) {
      order.paymentStatus = "PARTIAL";
    } else {
      order.paymentStatus = "UNPAID";
    }

    // 3. Status Pengantaran jadi SELESAI
    order.deliveryStatus = "DELIVERED";
    order.emptyGallonsReturned = Number(emptyGallonsReturned) || 0;
    order.deliveredAt = new Date().toISOString();

    // 4. Update Saldo Piutang Pelanggan (Jika ada selisih kurang bayar)
    const unpaidDiff = Math.max(0, recalculatedSubtotal - paid);
    if (unpaidDiff > 0 && customer) {
      customer.currentDebtBalance = (customer.currentDebtBalance || 0) + unpaidDiff;
    }

    // 5. Update Saldo Galon Fisik Pelanggan (Empty Gallon Accounting)
    // Galon keluar = totalGallonsDelivered
    // Galon masuk = emptyGallonsReturned
    const gallonNetDelta = totalGallonsDelivered - (Number(emptyGallonsReturned) || 0);
    if (customer) {
      customer.currentGallonBalance = (customer.currentGallonBalance || 0) + gallonNetDelta;
    }

    // 6. Catat Log Mutasi Galon
    const gallonLog = {
      id: "gln-" + Date.now(),
      orderId: order.id,
      customerId: order.customerId,
      customerName: order.customerName,
      gallonsOut: totalGallonsDelivered,
      gallonsIn: Number(emptyGallonsReturned) || 0,
      balanceAfter: customer ? customer.currentGallonBalance : 0,
      loggedAt: new Date().toISOString()
    };
    this.data.gallonLogs.unshift(gallonLog);

    // 7. Catat Log Pembayaran jika ada uang masuk
    if (paid > 0) {
      const paymentLog = {
        id: "pay-" + Date.now(),
        orderId: order.id,
        customerId: order.customerId,
        customerName: order.customerName,
        amount: paid,
        paymentMethod: paymentMethod,
        collectedBy: order.courierId || (currentUser ? currentUser.id : "usr-admin-1"),
        collectedByName: order.courierName || (currentUser ? currentUser.name : "Admin Depot"),
        paymentDate: new Date().toISOString(),
        notes: `Pembayaran pesanan ${order.id}`
      };
      this.data.payments.unshift(paymentLog);
    }

    this.save();
    return order;
  }

  // Pembayaran pelunasan piutang pelanggan
  payCustomerDebt(customerId, amount, paymentMethod = "CASH", notes = "Pelunasan bon lama") {
    const customer = this.getCustomerById(customerId);
    if (!customer) return;

    const amt = Number(amount) || 0;
    customer.currentDebtBalance = Math.max(0, (customer.currentDebtBalance || 0) - amt);

    const currentUser = this.getCurrentUser();
    this.data.payments.unshift({
      id: "pay-debt-" + Date.now(),
      orderId: null,
      customerId: customer.id,
      customerName: customer.name,
      amount: amt,
      paymentMethod,
      collectedBy: currentUser.id,
      collectedByName: currentUser.name,
      paymentDate: new Date().toISOString(),
      notes
    });

    this.save();
  }

  // === REKONSILIASI & LAPORAN HARIAN (DAILY SUMMARY WITA) ===
  getDailySummary(targetDate = getWitaDate()) {
    const ordersToday = this.data.orders.filter(o => o.deliveryDate === targetDate);
    const deliveredOrders = ordersToday.filter(o => o.deliveryStatus === "DELIVERED");

    // Hitung total galon isi terkirim & galon kosong ditarik
    let totalGallonsDelivered = 0;
    let totalEmptyGallonsReturned = 0;
    let totalOmzetActual = 0;
    let totalNewDebt = 0;

    deliveredOrders.forEach(o => {
      totalOmzetActual += (o.subtotalActual || 0);
      totalEmptyGallonsReturned += (o.emptyGallonsReturned || 0);

      const gallonItems = o.items.filter(it => it.productId === "prod-refill-19l" || it.productName.toLowerCase().includes("refill"));
      gallonItems.forEach(it => {
        totalGallonsDelivered += (it.qtyDelivered || 0);
      });

      const orderDebt = Math.max(0, (o.subtotalActual || 0) - (o.totalPaid || 0));
      totalNewDebt += orderDebt;
    });

    // Uang kas tunai vs non-tunai hari ini
    const paymentsToday = this.data.payments.filter(p => {
      const pDate = getWitaDate(new Date(p.paymentDate));
      return pDate === targetDate;
    });

    let totalCashReceived = 0;
    let totalTransferReceived = 0;
    const courierCashTally = {};

    this.data.users.filter(u => u.role === "courier").forEach(c => {
      courierCashTally[c.id] = {
        name: c.name,
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

    return {
      date: targetDate,
      totalOrders: ordersToday.length,
      countDelivered: deliveredOrders.length,
      countOnDelivery: ordersToday.filter(o => o.deliveryStatus === "ON_DELIVERY").length,
      countAssigned: ordersToday.filter(o => o.deliveryStatus === "ASSIGNED").length,
      countPending: ordersToday.filter(o => o.deliveryStatus === "PENDING").length,
      countCancelled: ordersToday.filter(o => o.deliveryStatus === "CANCELLED").length,
      totalGallonsDelivered,
      totalEmptyGallonsReturned,
      totalOmzetActual,
      totalCashReceived,
      totalTransferReceived,
      totalNewDebt,
      courierCashTally
    };
  }

  // Reset database ke 0 (Kosongkan transaksi & pelanggan untuk pengoperasian baru)
  resetToZero() {
    this.data = {
      users: INITIAL_DATA.users,
      products: INITIAL_DATA.products,
      customers: [],
      orders: [],
      payments: [],
      gallonLogs: [],
      currentUserId: this.data.currentUserId || null,
      currentRole: this.data.currentRole || "admin",
      activeCourierId: null,
      lastUpdated: new Date().toISOString()
    };
    this.save();
    this.notify();
  }

  // Reset database ke sampel data default (data contoh awal)
  resetToDefault() {
    const today = getWitaDate();
    this.data = {
      users: INITIAL_DATA.users,
      products: INITIAL_DATA.products,
      customers: INITIAL_DATA.customers,
      orders: INITIAL_DATA.getInitialOrders(today),
      payments: [
        {
          id: "pay-init-01",
          orderId: "ORD-20261004-001",
          customerId: "cust-1",
          customerName: "Warung Coto Daeng Tata",
          amount: 24000,
          paymentMethod: "CASH",
          collectedBy: "usr-courier-1",
          collectedByName: "Daeng Rahmat",
          paymentDate: `${today}T09:15:00+08:00`,
          notes: "Pembayaran lunas tunai di tempat"
        }
      ],
      gallonLogs: [
        {
          id: "gln-init-01",
          orderId: "ORD-20261004-001",
          customerId: "cust-1",
          customerName: "Warung Coto Daeng Tata",
          gallonsOut: 4,
          gallonsIn: 4,
          balanceAfter: 6,
          loggedAt: `${today}T09:15:00+08:00`
        }
      ],
      currentUserId: this.data.currentUserId || null,
      currentRole: this.data.currentRole || "admin",
      activeCourierId: null,
      lastUpdated: new Date().toISOString()
    };
    this.save();
    this.notify();
  }

  // Backup & Restore
  exportJSON() {
    return JSON.stringify(this.data, null, 2);
  }

  importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.orders && parsed.customers && parsed.products) {
        this.data = parsed;
        this.save();
        return { success: true };
      }
      return { success: false, message: "Format JSON tidak valid atau struktur tidak lengkap." };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }
}

export const store = new Store();
