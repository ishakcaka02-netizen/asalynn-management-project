import { Router } from "express";
import { db } from "../db.js";

const router = Router();

// GET /api/products - Ambil katalog produk
router.get("/", (req, res) => {
  const { active } = req.query;
  const products = db.getProducts({ active });

  res.json({
    success: true,
    data: products
  });
});

// GET /api/products/:id - Ambil detail produk
router.get("/:id", (req, res) => {
  const product = db.getProductById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: "Produk tidak ditemukan." });
  }

  res.json({
    success: true,
    data: product
  });
});

// POST /api/products - Tambah produk baru
router.post("/", (req, res) => {
  const { name, standardPrice, unit = "Galon", description = "", code } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: "Nama produk wajib diisi." });
  }

  const priceNum = Number(standardPrice);
  if (isNaN(priceNum) || priceNum < 0) {
    return res.status(400).json({ success: false, message: "Harga standar harus berupa angka positif." });
  }

  const generatedCode = code ? code.trim() : "PRD-" + Math.floor(100 + Math.random() * 900);

  const newProduct = db.createProduct({
    id: `prod-${Date.now()}`,
    name: name.trim(),
    code: generatedCode,
    standardPrice: priceNum,
    unit: unit.trim() || "Galon",
    description: description.trim(),
    isActive: true
  });

  res.status(201).json({
    success: true,
    message: `Produk '${newProduct.name}' berhasil ditambahkan.`,
    data: newProduct
  });
});

// PUT /api/products/:id - Perbarui produk
router.put("/:id", (req, res) => {
  const product = db.getProductById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: "Produk tidak ditemukan." });
  }

  const updatedProduct = db.updateProduct(req.params.id, req.body);

  res.json({
    success: true,
    message: "Data produk berhasil diperbarui.",
    data: updatedProduct
  });
});

// DELETE /api/products/:id - Nonaktifkan produk
router.delete("/:id", (req, res) => {
  const product = db.getProductById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: "Produk tidak ditemukan." });
  }

  db.updateProduct(req.params.id, { isActive: false });

  res.json({
    success: true,
    message: `Produk '${product.name}' berhasil dinonaktifkan.`
  });
});

export default router;
