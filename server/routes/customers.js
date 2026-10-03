import { Router } from "express";
import { db, getWitaDate } from "../db.js";

const router = Router();

// GET /api/customers - Daftar pelanggan (dukungan pencarian ?q=)
router.get("/", (req, res) => {
  const { q } = req.query;
  let customers = db.data.customers;

  if (q && q.trim()) {
    const term = q.trim().toLowerCase();
    customers = customers.filter(c =>
      c.name.toLowerCase().includes(term) ||
      c.phone.includes(term) ||
      c.address.toLowerCase().includes(term)
    );
  }

  res.json({
    success: true,
    total: customers.length,
    data: customers
  });
});

// GET /api/customers/:id - Detail pelanggan
router.get("/:id", (req, res) => {
  const customer = db.data.customers.find(c => c.id === req.params.id);
  if (!customer) {
    return res.status(404).json({ success: false, message: "Pelanggan tidak ditemukan." });
  }

  // Tampilkan juga harga efektif dengan nama produk
  const customPricesDetails = Object.entries(customer.customPrices || {}).map(([prodId, price]) => {
    const prod = db.data.products.find(p => p.id === prodId);
    return {
      productId: prodId,
      productName: prod ? prod.name : prodId,
      standardPrice: prod ? prod.standardPrice : 0,
      customPrice: price
    };
  });

  res.json({
    success: true,
    data: {
      ...customer,
      customPricesDetails
    }
  });
});

// POST /api/customers - Tambah pelanggan baru
router.post("/", (req, res) => {
  const { name, phone, address, addressNotes = "" } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: "Nama pelanggan wajib diisi." });
  }
  if (!phone || !phone.trim()) {
    return res.status(400).json({ success: false, message: "Nomor telepon/WA wajib diisi." });
  }
  if (!address || !address.trim()) {
    return res.status(400).json({ success: false, message: "Alamat pengantaran wajib diisi." });
  }

  const newCustomer = {
    id: `cust-${Date.now()}`,
    name: name.trim(),
    phone: phone.trim(),
    address: address.trim(),
    addressNotes: addressNotes.trim(),
    currentGallonBalance: 0,
    currentDebtBalance: 0,
    customPrices: {},
    createdAt: getWitaDate()
  };

  db.data.customers.push(newCustomer);
  db.persist();

  res.status(201).json({
    success: true,
    message: `Pelanggan '${newCustomer.name}' berhasil didaftarkan.`,
    data: newCustomer
  });
});

// PUT /api/customers/:id - Perbarui data pelanggan
router.put("/:id", (req, res) => {
  const customer = db.data.customers.find(c => c.id === req.params.id);
  if (!customer) {
    return res.status(404).json({ success: false, message: "Pelanggan tidak ditemukan." });
  }

  const { name, phone, address, addressNotes, currentGallonBalance, currentDebtBalance } = req.body;
  if (name !== undefined) customer.name = name.trim();
  if (phone !== undefined) customer.phone = phone.trim();
  if (address !== undefined) customer.address = address.trim();
  if (addressNotes !== undefined) customer.addressNotes = addressNotes.trim();
  if (currentGallonBalance !== undefined) customer.currentGallonBalance = Number(currentGallonBalance);
  if (currentDebtBalance !== undefined) customer.currentDebtBalance = Number(currentDebtBalance);

  db.persist();

  res.json({
    success: true,
    message: "Data pelanggan berhasil diperbarui.",
    data: customer
  });
});

// DELETE /api/customers/:id - Hapus pelanggan (kecuali jika masih menyimpan galon)
router.delete("/:id", (req, res) => {
  const customer = db.data.customers.find(c => c.id === req.params.id);
  if (!customer) {
    return res.status(404).json({ success: false, message: "Pelanggan tidak ditemukan." });
  }

  // Cek apakah pelanggan masih menyimpan/meminjam galon depot
  if ((customer.currentGallonBalance || 0) > 0) {
    return res.status(400).json({
      success: false,
      message: `Pelanggan '${customer.name}' tidak dapat dihapus karena masih terdata menyimpan ${customer.currentGallonBalance} galon depot.`
    });
  }

  const index = db.data.customers.findIndex(c => c.id === req.params.id);
  const deleted = db.data.customers.splice(index, 1)[0];
  db.persist();

  res.json({
    success: true,
    message: `Pelanggan '${deleted.name}' berhasil dihapus.`
  });
});

// GET /api/customers/:id/custom-prices - Ambil daftar harga khusus pelanggan
router.get("/:id/custom-prices", (req, res) => {
  const customer = db.data.customers.find(c => c.id === req.params.id);
  if (!customer) {
    return res.status(404).json({ success: false, message: "Pelanggan tidak ditemukan." });
  }

  res.json({
    success: true,
    data: customer.customPrices || {}
  });
});

// POST /api/customers/:id/custom-prices - Pasang / ubah harga khusus pelanggan
router.post("/:id/custom-prices", (req, res) => {
  const customer = db.data.customers.find(c => c.id === req.params.id);
  if (!customer) {
    return res.status(404).json({ success: false, message: "Pelanggan tidak ditemukan." });
  }

  const { productId, customPrice } = req.body;
  if (!productId) {
    return res.status(400).json({ success: false, message: "productId wajib diisi." });
  }

  const product = db.data.products.find(p => p.id === productId);
  if (!product) {
    return res.status(404).json({ success: false, message: "Produk tidak ditemukan." });
  }

  if (!customer.customPrices) customer.customPrices = {};

  const priceNum = Number(customPrice);
  if (isNaN(priceNum) || priceNum <= 0) {
    delete customer.customPrices[productId];
  } else {
    customer.customPrices[productId] = priceNum;
  }

  db.persist();

  res.json({
    success: true,
    message: `Harga khusus untuk produk '${product.name}' berhasil disimpan.`,
    data: customer.customPrices
  });
});

// DELETE /api/customers/:id/custom-prices/:productId - Hapus harga khusus pelanggan (kembali ke harga standar)
router.delete("/:id/custom-prices/:productId", (req, res) => {
  const customer = db.data.customers.find(c => c.id === req.params.id);
  if (!customer) {
    return res.status(404).json({ success: false, message: "Pelanggan tidak ditemukan." });
  }

  if (customer.customPrices && customer.customPrices[req.params.productId]) {
    delete customer.customPrices[req.params.productId];
    db.persist();
  }

  res.json({
    success: true,
    message: "Harga khusus dihapus, dikembalikan ke tarif standar produk.",
    data: customer.customPrices || {}
  });
});

// POST /api/customers/:id/pay-debt - Pelunasan piutang pelanggan
router.post("/:id/pay-debt", (req, res) => {
  const customer = db.data.customers.find(c => c.id === req.params.id);
  if (!customer) {
    return res.status(404).json({ success: false, message: "Pelanggan tidak ditemukan." });
  }

  const { amount, paymentMethod = "CASH", notes = "Pelunasan sisa piutang", collectedBy } = req.body;
  const payAmt = Number(amount);

  if (isNaN(payAmt) || payAmt <= 0) {
    return res.status(400).json({ success: false, message: "Jumlah nominal pembayaran tidak valid." });
  }

  const previousDebt = customer.currentDebtBalance || 0;
  customer.currentDebtBalance = Math.max(0, previousDebt - payAmt);

  const collectorUser = (collectedBy && db.data.users.find(u => u.id === collectedBy)) || req.user || { id: "usr-admin-1", name: "Hj. Asmawati (Owner)" };

  const paymentRecord = {
    id: `pay-debt-${Date.now()}`,
    orderId: null,
    customerId: customer.id,
    customerName: customer.name,
    amount: payAmt,
    paymentMethod,
    collectedBy: collectorUser.id,
    collectedByName: collectorUser.name,
    paymentDate: new Date().toISOString(),
    notes
  };

  db.data.payments.unshift(paymentRecord);
  db.persist();

  res.json({
    success: true,
    message: `Pelunasan piutang Rp ${payAmt.toLocaleString("id-ID")} berhasil dicatat. Sisa piutang: Rp ${customer.currentDebtBalance.toLocaleString("id-ID")}`,
    data: {
      customer,
      payment: paymentRecord
    }
  });
});

export default router;
