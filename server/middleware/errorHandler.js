export function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Rute API '${req.method} ${req.originalUrl}' tidak ditemukan.`
  });
}

export function errorHandler(err, req, res, next) {
  console.error("API Error:", err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || "Terjadi kesalahan internal server.",
    error: process.env.NODE_ENV === "development" ? err.stack : undefined
  });
}
