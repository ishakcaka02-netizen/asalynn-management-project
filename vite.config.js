import { defineConfig } from "vite";
import { app } from "./server/app.js";

export default defineConfig({
  base: "./",
  server: {
    port: 5173
  },
  plugins: [
    {
      name: "asalynn-api-server",
      configureServer(server) {
        // Hubungkan Express API routes ke Vite dev server middlewares
        server.middlewares.use(app);
      }
    }
  ]
});

