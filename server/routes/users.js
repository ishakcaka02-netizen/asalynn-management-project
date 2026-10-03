import { Router } from "express";
import { db } from "../db.js";

const router = Router();

// GET /api/users - Daftar seluruh pengguna / kurir
router.get("/", (req, res) => {
  const { role, active } = req.query;
  const users = db.getUsers({ role, active });

  // Sanitasi PIN dari response publik
  const safeList = users.map(u => ({
    id: u.id,
    name: u.name,
    phone: u.phone,
    role: u.role,
    vehicle: u.vehicle || null,
    isActive: u.isActive !== false
  }));

  res.json({
    success: true,
    data: safeList
  });
});

// GET /api/users/:id - Detail pengguna
router.get("/:id", (req, res) => {
  const user = db.getUserById(req.params.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "Pengguna tidak ditemukan."
    });
  }

  res.json({
    success: true,
    data: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      vehicle: user.vehicle || null,
      isActive: user.isActive !== false
    }
  });
});

// POST /api/users - Tambah akun pengguna baru (Kurir atau Admin)
router.post("/", (req, res) => {
  const { name, phone, role = "courier", pin = "1234", vehicle = "" } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: "Nama pengguna wajib diisi." });
  }
  if (!phone || !phone.trim()) {
    return res.status(400).json({ success: false, message: "Nomor telepon wajib diisi." });
  }

  const existing = db.getUserByPhone(phone.trim());
  if (existing) {
    return res.status(409).json({ success: false, message: "Nomor telepon sudah terdaftar pada akun lain." });
  }

  const newUser = db.createUser({
    id: `usr-${role === "admin" ? "admin" : "courier"}-${Date.now()}`,
    name: name.trim(),
    phone: phone.trim(),
    role: role === "admin" ? "admin" : "courier",
    pin: String(pin).trim() || "1234",
    vehicle: vehicle.trim() || undefined,
    isActive: true
  });

  res.status(201).json({
    success: true,
    message: `Pengguna '${newUser.name}' berhasil ditambahkan.`,
    data: {
      id: newUser.id,
      name: newUser.name,
      phone: newUser.phone,
      role: newUser.role,
      vehicle: newUser.vehicle || null,
      isActive: newUser.isActive
    }
  });
});

// PUT /api/users/:id - Perbarui data pengguna
router.put("/:id", (req, res) => {
  const user = db.getUserById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: "Pengguna tidak ditemukan." });
  }

  const updatedUser = db.updateUser(req.params.id, req.body);

  res.json({
    success: true,
    message: "Data pengguna berhasil diperbarui.",
    data: {
      id: updatedUser.id,
      name: updatedUser.name,
      phone: updatedUser.phone,
      role: updatedUser.role,
      vehicle: updatedUser.vehicle || null,
      isActive: updatedUser.isActive !== false
    }
  });
});

// DELETE /api/users/:id - Nonaktifkan pengguna (soft-delete)
router.delete("/:id", (req, res) => {
  const user = db.getUserById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: "Pengguna tidak ditemukan." });
  }

  db.deleteUser(req.params.id);

  res.json({
    success: true,
    message: `Akun '${user.name}' berhasil dinonaktifkan.`
  });
});

export default router;
