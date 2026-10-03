import express from "express";
import cors from "cors";

// Middlewares
import { authMiddleware } from "./middleware/auth.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";

// Routes
import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import customersRoutes from "./routes/customers.js";
import productsRoutes from "./routes/products.js";
import ordersRoutes from "./routes/orders.js";
import paymentsRoutes from "./routes/payments.js";
import gallonsRoutes from "./routes/gallons.js";
import reportsRoutes from "./routes/reports.js";
import systemRoutes from "./routes/system.js";

export function createApp() {
  const app = express();

  // Global Middlewares
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(authMiddleware);

  // Root API Information & Health Check
  app.get("/api", (req, res) => {
    res.json({
      name: "Asalynn Management Project API",
      version: "1.0.0",
      timezone: "Asia/Makassar (WITA, UTC+8)",
      status: "healthy",
      endpoints: {
        auth: "/api/auth",
        users: "/api/users",
        customers: "/api/customers",
        products: "/api/products",
        orders: "/api/orders",
        payments: "/api/payments",
        gallons: "/api/gallons",
        reports: "/api/reports",
        system: "/api/system"
      }
    });
  });

  // Register Entity Routes
  app.use("/api/auth", authRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/customers", customersRoutes);
  app.use("/api/products", productsRoutes);
  app.use("/api/orders", ordersRoutes);
  app.use("/api/payments", paymentsRoutes);
  app.use("/api/gallons", gallonsRoutes);
  app.use("/api/reports", reportsRoutes);
  app.use("/api/system", systemRoutes);

  // 404 & Error Handlers for API
  app.use("/api", notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
