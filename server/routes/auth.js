import { Router } from "express";
import { db } from "../db.js";

const router = Router();

// GET /api/auth/profiles - Daftar profil untuk Quick Profile Selector di Landing Page
router.get("/profiles", (req, res) => {
  const users = db.getUsers({ active: "true" });
  const profiles = users.map(u => ({
    id: u.id,
    name: u.name,
    phone: u.phone,
    role: u.role,
    vehicle: u.vehicle || null,
    avatar: u.role === "admin" ? "👑" : "🛵",
    pinHint: u.pin ? `${u.pin.slice(0, 1)}***` : "1234"
  }));

  res.json({
    success: true,
    data: profiles
  });
});

// POST /api/auth/login - Autentikasi menggunakan PIN 4 digit
router.post("/login", (req, res) => {
  const { userId, phone, pin } = req.body;

  if (!pin) {
    return res.status(400).json({
      success: false,
      message: "PIN 4 digit wajib diisi."
    });
  }

  let user = null;
  if (userId) {
    user = db.getUserById(userId);
  } else if (phone) {
    user = db.getUserByPhone(phone);
  }

  if (!user || user.isActive === false) {
    return res.status(404).json({
      success: false,
      message: "Profil pengguna tidak ditemukan."
    });
  }

  const expectedPin = user.pin || (user.id === "usr-admin-1" ? "1234" : user.id === "usr-courier-1" ? "1111" : "2222");

  if (String(pin).trim() !== String(expectedPin).trim()) {
    return res.status(401).json({
      success: false,
      message: "PIN yang Anda masukkan salah. Silakan coba lagi."
    });
  }

  // Respon berhasil
  const safeUser = {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    vehicle: user.vehicle || null
  };

  res.json({
    success: true,
    message: `Selamat datang kembali, ${user.name}!`,
    token: user.id,
    data: safeUser
  });
});

// GET /api/auth/me - Cek data profil pengguna aktif saat ini
router.get("/me", (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Belum ada sesi login aktif."
    });
  }

  res.json({
    success: true,
    data: {
      id: req.user.id,
      name: req.user.name,
      phone: req.user.phone,
      role: req.user.role,
      vehicle: req.user.vehicle || null
    }
  });
});

// POST /api/auth/logout - Keluar dari sesi
router.post("/logout", (req, res) => {
  res.json({
    success: true,
    message: "Berhasil keluar dari aplikasi."
  });
});

export default router;
