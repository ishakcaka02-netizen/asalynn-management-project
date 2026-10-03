import { Router } from "express";
import { db } from "../db.js";

const router = Router();

// GET /api/products - Ambil katalog produk
router.get("/", (req, res) => {
  const { active } = req.query;
  let products = db.data.products;

  if (active !== undefined) {
    const isActive = active === "true";
    products = products.filter(p => !!p.isActive === isActive);
  }

  res.json({
    success: true,
    data: products
  });
});

// GET /api/products/:id - Ambil detail produk
router.get("/:id", (req, res) => {
  const product = db.data.products.find(p => p.id === req.params.id);
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

  const newProduct = {
    id: `prod-${Date.now()}`,
    name: name.trim(),
    code: generatedCode,
    standardPrice: priceNum,
    unit: unit.trim() || "Galon",
    description: description.trim(),
    isActive: true
  };

  db.data.products.push(newProduct);
  db.persist();

  res.status(201).json({
    success: true,
    message: `Produk '${newProduct.name}' berhasil ditambahkan.`,
    data: newProduct
  });
});

// PUT /api/products/:id - Perbarui produk
router.put("/:id", (req, res) => {
  const product = db.data.products.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: "Produk tidak ditemukan." });
  }

  const { name, standardPrice, unit, description, code, isActive } = req.body;
  if (name !== undefined) product.name = name.trim();
  if (code !== undefined) product.code = code.trim();
  if (standardPrice !== undefined) product.standardPrice = Number(standardPrice) || 0;
  if (unit !== undefined) product.unit = unit.trim();
  if (description !== undefined) product.description = description.trim();
  if (isActive !== undefined) product.isActive = Boolean(isActive);

  db.persist();

  res.json({
    success: true,
    message: "Data produk berhasil diperbarui.",
    data: product
  });
});

// DELETE /api/products/:id - Nonaktifkan produk
router.delete("/:id", (req, res) => {
  const product = db.data.products.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: "Produk tidak ditemukan." });
  }

  product.isActive = false;
  db.persist();

  res.json({
    success: true,
    message: `Produk '${product.name}' berhasil dinonaktifkan.`
  });
});

export default router;
