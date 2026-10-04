import { Router } from "express";
import { db } from "../db.js";

const router = Router();

// GET /api/products
router.get("/", async (req, res) => {
  try {
    const { active } = req.query;
    const products = await db.getProducts({ active });
    res.json({ success: true, data: products });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/products/:id
router.get("/:id", async (req, res) => {
  try {
    const product = await db.getProductById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Produk tidak ditemukan." });
    res.json({ success: true, data: product });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/products
router.post("/", async (req, res) => {
  try {
    const { name, standardPrice, unit = "Galon", description = "", code } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: "Nama produk wajib diisi." });
    const priceNum = Number(standardPrice);
    if (isNaN(priceNum) || priceNum < 0) return res.status(400).json({ success: false, message: "Harga standar harus berupa angka positif." });
    const generatedCode = code ? code.trim() : "PRD-" + Math.floor(100 + Math.random() * 900);
    const newProduct = await db.createProduct({ id: `prod-${Date.now()}`, name: name.trim(), code: generatedCode, standardPrice: priceNum, unit: unit.trim() || "Galon", description: description.trim(), isActive: true });
    res.status(201).json({ success: true, message: `Produk '${newProduct.name}' berhasil ditambahkan.`, data: newProduct });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /api/products/:id
router.put("/:id", async (req, res) => {
  try {
    const product = await db.getProductById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Produk tidak ditemukan." });
    const updatedProduct = await db.updateProduct(req.params.id, req.body);
    res.json({ success: true, message: "Data produk berhasil diperbarui.", data: updatedProduct });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE /api/products/:id
router.delete("/:id", async (req, res) => {
  try {
    const product = await db.getProductById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Produk tidak ditemukan." });
    await db.updateProduct(req.params.id, { isActive: false });
    res.json({ success: true, message: `Produk '${product.name}' berhasil dinonaktifkan.` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

export default router;
