import { db } from "../db.js";

// Async auth middleware: baca user dari header x-user-id atau Authorization Bearer
export async function authMiddleware(req, res, next) {
  const userId = req.headers["x-user-id"] || req.headers["authorization"]?.replace("Bearer ", "");
  if (userId) {
    try {
      const user = await db.getUserById(userId);
      if (user && user.isActive !== false) {
        req.user = user;
      }
    } catch (e) {
      // Lanjut tanpa user jika DB error
    }
  }
  next();
}

// Middleware mewajibkan login
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Akses ditolak. Sesi autentikasi tidak ditemukan atau tidak valid." });
  }
  next();
}

// Middleware membatasi hanya untuk Admin/Owner
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Akses terlarang. Fitur ini hanya dapat diakses oleh Pemilik / Admin." });
  }
  next();
}
