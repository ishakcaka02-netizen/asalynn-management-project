import { Router } from "express";
import { db, getWitaDate } from "../db.js";

const router = Router();

// GET /api/customers
router.get("/", async (req, res) => {
  try {
    const { q } = req.query;
    const customers = await db.getCustomers({ q });
    res.json({ success: true, total: customers.length, data: customers });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/customers/:id
router.get("/:id", async (req, res) => {
  try {
    const customer = await db.getCustomerById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: "Pelanggan tidak ditemukan." });
    const customPricesDetails = [];
    for (const [prodId, price] of Object.entries(customer.customPrices || {})) {
      const prod = await db.getProductById(prodId);
      customPricesDetails.push({ productId: prodId, productName: prod ? prod.name : prodId, standardPrice: prod ? prod.standardPrice : 0, customPrice: price });
    }
    res.json({ success: true, data: { ...customer, customPricesDetails } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/customers
router.post("/", async (req, res) => {
  try {
    const { name, phone, address, addressNotes = "" } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: "Nama pelanggan wajib diisi." });
    if (!phone?.trim()) return res.status(400).json({ success: false, message: "Nomor telepon/WA wajib diisi." });
    if (!address?.trim()) return res.status(400).json({ success: false, message: "Alamat pengantaran wajib diisi." });
    const newCustomer = await db.createCustomer({ id: `cust-${Date.now()}`, name: name.trim(), phone: phone.trim(), address: address.trim(), addressNotes: addressNotes.trim(), currentGallonBalance: 0, currentDebtBalance: 0, createdAt: getWitaDate() });
    res.status(201).json({ success: true, message: `Pelanggan '${newCustomer.name}' berhasil didaftarkan.`, data: newCustomer });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /api/customers/:id
router.put("/:id", async (req, res) => {
  try {
    const customer = await db.getCustomerById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: "Pelanggan tidak ditemukan." });
    const updatedCustomer = await db.updateCustomer(req.params.id, req.body);
    res.json({ success: true, message: "Data pelanggan berhasil diperbarui.", data: updatedCustomer });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE /api/customers/:id
router.delete("/:id", async (req, res) => {
  try {
    const customer = await db.getCustomerById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: "Pelanggan tidak ditemukan." });
    if ((customer.currentGallonBalance || 0) > 0) return res.status(400).json({ success: false, message: `Pelanggan '${customer.name}' tidak dapat dihapus karena masih terdata menyimpan ${customer.currentGallonBalance} galon depot.` });
    await db.deleteCustomer(req.params.id);
    res.json({ success: true, message: `Pelanggan '${customer.name}' berhasil dihapus.` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/customers/:id/custom-prices
router.get("/:id/custom-prices", async (req, res) => {
  try {
    const customer = await db.getCustomerById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: "Pelanggan tidak ditemukan." });
    res.json({ success: true, data: customer.customPrices || {} });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/customers/:id/custom-prices
router.post("/:id/custom-prices", async (req, res) => {
  try {
    const customer = await db.getCustomerById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: "Pelanggan tidak ditemukan." });
    const { productId, customPrice } = req.body;
    if (!productId) return res.status(400).json({ success: false, message: "productId wajib diisi." });
    const product = await db.getProductById(productId);
    if (!product) return res.status(404).json({ success: false, message: "Produk tidak ditemukan." });
    await db.setCustomPrice(customer.id, productId, customPrice);
    const updatedCustomer = await db.getCustomerById(customer.id);
    res.json({ success: true, message: `Harga khusus untuk produk '${product.name}' berhasil disimpan.`, data: updatedCustomer.customPrices || {} });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE /api/customers/:id/custom-prices/:productId
router.delete("/:id/custom-prices/:productId", async (req, res) => {
  try {
    const customer = await db.getCustomerById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: "Pelanggan tidak ditemukan." });
    await db.deleteCustomPrice(customer.id, req.params.productId);
    const updatedCustomer = await db.getCustomerById(customer.id);
    res.json({ success: true, message: "Harga khusus dihapus, dikembalikan ke tarif standar produk.", data: updatedCustomer.customPrices || {} });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/customers/:id/pay-debt
router.post("/:id/pay-debt", async (req, res) => {
  try {
    const customer = await db.getCustomerById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: "Pelanggan tidak ditemukan." });
    const { amount, paymentMethod = "CASH", notes = "Pelunasan sisa piutang", collectedBy } = req.body;
    const payAmt = Number(amount);
    if (isNaN(payAmt) || payAmt <= 0) return res.status(400).json({ success: false, message: "Jumlah nominal pembayaran tidak valid." });
    const newDebt = Math.max(0, (customer.currentDebtBalance || 0) - payAmt);
    const updatedCustomer = await db.updateCustomer(customer.id, { currentDebtBalance: newDebt });
    const collectorUser = (collectedBy && await db.getUserById(collectedBy)) || req.user || { id: "usr-admin-1", name: "Hj. Asmawati (Owner)" };
    const paymentRecord = await db.createPayment({ id: `pay-debt-${Date.now()}`, orderId: null, customerId: customer.id, customerName: customer.name, amount: payAmt, paymentMethod, collectedBy: collectorUser.id, collectedByName: collectorUser.name, paymentDate: new Date().toISOString(), notes });
    res.json({ success: true, message: `Pelunasan piutang Rp ${payAmt.toLocaleString("id-ID")} berhasil dicatat. Sisa piutang: Rp ${updatedCustomer.currentDebtBalance.toLocaleString("id-ID")}`, data: { customer: updatedCustomer, payment: paymentRecord } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

export default router;
