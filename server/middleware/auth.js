import { db } from "../db.js";

// Sederhana dan cepat untuk operasional lapangan:
// Dapat membaca user dari header 'x-user-id', 'x-role', atau Authorization header
export function authMiddleware(req, res, next) {
  const userId = req.headers["x-user-id"] || req.headers["authorization"]?.replace("Bearer ", "");
  if (userId) {
    const user = db.data.users.find(u => u.id === userId && u.isActive !== false);
    if (user) {
      req.user = user;
    }
  }
  next();
}

// Middleware mewajibkan login
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Akses ditolak. Sesi autentikasi tidak ditemukan atau tidak valid."
    });
  }
  next();
}

// Middleware membatasi hanya untuk Admin/Owner
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Akses terlarang. Fitur ini hanya dapat diakses oleh Pemilik / Admin."
    });
  }
  next();
}
