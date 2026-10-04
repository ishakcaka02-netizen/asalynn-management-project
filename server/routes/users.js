import { Router } from "express";
import { db } from "../db.js";

const router = Router();

// GET /api/users
router.get("/", async (req, res) => {
  try {
    const { role, active } = req.query;
    const users = await db.getUsers({ role, active });
    const safeList = users.map(u => ({ id: u.id, name: u.name, phone: u.phone, role: u.role, vehicle: u.vehicle || null, isActive: u.isActive !== false }));
    res.json({ success: true, data: safeList });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/users/:id
router.get("/:id", async (req, res) => {
  try {
    const user = await db.getUserById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "Pengguna tidak ditemukan." });
    res.json({ success: true, data: { id: user.id, name: user.name, phone: user.phone, role: user.role, vehicle: user.vehicle || null, isActive: user.isActive !== false } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/users
router.post("/", async (req, res) => {
  try {
    const { name, phone, role = "courier", pin = "1234", vehicle = "" } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: "Nama pengguna wajib diisi." });
    if (!phone?.trim()) return res.status(400).json({ success: false, message: "Nomor telepon wajib diisi." });
    const existing = await db.getUserByPhone(phone.trim());
    if (existing) return res.status(409).json({ success: false, message: "Nomor telepon sudah terdaftar pada akun lain." });
    const newUser = await db.createUser({ id: `usr-${role === "admin" ? "admin" : "courier"}-${Date.now()}`, name: name.trim(), phone: phone.trim(), role: role === "admin" ? "admin" : "courier", pin: String(pin).trim() || "1234", vehicle: vehicle.trim() || null, isActive: true });
    res.status(201).json({ success: true, message: `Pengguna '${newUser.name}' berhasil ditambahkan.`, data: { id: newUser.id, name: newUser.name, phone: newUser.phone, role: newUser.role, vehicle: newUser.vehicle || null, isActive: newUser.isActive } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /api/users/:id
router.put("/:id", async (req, res) => {
  try {
    const user = await db.getUserById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "Pengguna tidak ditemukan." });
    const updatedUser = await db.updateUser(req.params.id, req.body);
    res.json({ success: true, message: "Data pengguna berhasil diperbarui.", data: { id: updatedUser.id, name: updatedUser.name, phone: updatedUser.phone, role: updatedUser.role, vehicle: updatedUser.vehicle || null, isActive: updatedUser.isActive !== false } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE /api/users/:id
router.delete("/:id", async (req, res) => {
  try {
    const user = await db.getUserById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "Pengguna tidak ditemukan." });
    await db.deleteUser(req.params.id);
    res.json({ success: true, message: `Akun '${user.name}' berhasil dinonaktifkan.` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

export default router;
