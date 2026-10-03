import { Router } from "express";
import { db, getWitaDate } from "../db.js";

const router = Router();

// GET /api/customers - Daftar pelanggan (dukungan pencarian ?q=)
router.get("/", (req, res) => {
  const { q } = req.query;
  const customers = db.getCustomers({ q });

  res.json({
    success: true,
    total: customers.length,
    data: customers
  });
});

// GET /api/customers/:id - Detail pelanggan
router.get("/:id", (req, res) => {
  const customer = db.getCustomerById(req.params.id);
  if (!customer) {
    return res.status(404).json({ success: false, message: "Pelanggan tidak ditemukan." });
  }

  const customPricesDetails = Object.entries(customer.customPrices || {}).map(([prodId, price]) => {
    const prod = db.getProductById(prodId);
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

  const newCustomer = db.createCustomer({
    id: `cust-${Date.now()}`,
    name: name.trim(),
    phone: phone.trim(),
    address: address.trim(),
    addressNotes: addressNotes.trim(),
    currentGallonBalance: 0,
    currentDebtBalance: 0,
    createdAt: getWitaDate()
  });

  res.status(201).json({
    success: true,
    message: `Pelanggan '${newCustomer.name}' berhasil didaftarkan.`,
    data: newCustomer
  });
});

// PUT /api/customers/:id - Perbarui data pelanggan
router.put("/:id", (req, res) => {
  const customer = db.getCustomerById(req.params.id);
  if (!customer) {
    return res.status(404).json({ success: false, message: "Pelanggan tidak ditemukan." });
  }

  const updatedCustomer = db.updateCustomer(req.params.id, req.body);

  res.json({
    success: true,
    message: "Data pelanggan berhasil diperbarui.",
    data: updatedCustomer
  });
});

// DELETE /api/customers/:id - Hapus pelanggan (kecuali jika masih menyimpan galon)
router.delete("/:id", (req, res) => {
  const customer = db.getCustomerById(req.params.id);
  if (!customer) {
    return res.status(404).json({ success: false, message: "Pelanggan tidak ditemukan." });
  }

  if ((customer.currentGallonBalance || 0) > 0) {
    return res.status(400).json({
      success: false,
      message: `Pelanggan '${customer.name}' tidak dapat dihapus karena masih terdata menyimpan ${customer.currentGallonBalance} galon depot.`
    });
  }

  db.deleteCustomer(req.params.id);

  res.json({
    success: true,
    message: `Pelanggan '${customer.name}' berhasil dihapus.`
  });
});

// GET /api/customers/:id/custom-prices - Ambil daftar harga khusus pelanggan
router.get("/:id/custom-prices", (req, res) => {
  const customer = db.getCustomerById(req.params.id);
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
  const customer = db.getCustomerById(req.params.id);
  if (!customer) {
    return res.status(404).json({ success: false, message: "Pelanggan tidak ditemukan." });
  }

  const { productId, customPrice } = req.body;
  if (!productId) {
    return res.status(400).json({ success: false, message: "productId wajib diisi." });
  }

  const product = db.getProductById(productId);
  if (!product) {
    return res.status(404).json({ success: false, message: "Produk tidak ditemukan." });
  }

  db.setCustomPrice(customer.id, productId, customPrice);
  const updatedCustomer = db.getCustomerById(customer.id);

  res.json({
    success: true,
    message: `Harga khusus untuk produk '${product.name}' berhasil disimpan.`,
    data: updatedCustomer.customPrices || {}
  });
});

// DELETE /api/customers/:id/custom-prices/:productId - Hapus harga khusus pelanggan (kembali ke harga standar)
router.delete("/:id/custom-prices/:productId", (req, res) => {
  const customer = db.getCustomerById(req.params.id);
  if (!customer) {
    return res.status(404).json({ success: false, message: "Pelanggan tidak ditemukan." });
  }

  db.deleteCustomPrice(customer.id, req.params.productId);
  const updatedCustomer = db.getCustomerById(customer.id);

  res.json({
    success: true,
    message: "Harga khusus dihapus, dikembalikan ke tarif standar produk.",
    data: updatedCustomer.customPrices || {}
  });
});

// POST /api/customers/:id/pay-debt - Pelunasan piutang pelanggan
router.post("/:id/pay-debt", (req, res) => {
  const customer = db.getCustomerById(req.params.id);
  if (!customer) {
    return res.status(404).json({ success: false, message: "Pelanggan tidak ditemukan." });
  }

  const { amount, paymentMethod = "CASH", notes = "Pelunasan sisa piutang", collectedBy } = req.body;
  const payAmt = Number(amount);

  if (isNaN(payAmt) || payAmt <= 0) {
    return res.status(400).json({ success: false, message: "Jumlah nominal pembayaran tidak valid." });
  }

  const previousDebt = customer.currentDebtBalance || 0;
  const newDebt = Math.max(0, previousDebt - payAmt);
  const updatedCustomer = db.updateCustomer(customer.id, { currentDebtBalance: newDebt });

  const collectorUser = (collectedBy && db.getUserById(collectedBy)) || req.user || { id: "usr-admin-1", name: "Hj. Asmawati (Owner)" };

  const paymentRecord = db.createPayment({
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
  });

  res.json({
    success: true,
    message: `Pelunasan piutang Rp ${payAmt.toLocaleString("id-ID")} berhasil dicatat. Sisa piutang: Rp ${updatedCustomer.currentDebtBalance.toLocaleString("id-ID")}`,
    data: {
      customer: updatedCustomer,
      payment: paymentRecord
    }
  });
});

export default router;
