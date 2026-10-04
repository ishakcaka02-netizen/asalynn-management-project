import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  server: {
    port: 5173
  },
  plugins: [
    {
      name: "asalynn-api-server",
      async configureServer(server) {
        // Hubungkan Express API routes hanya saat mode dev lokal
        const { app } = await import("./server/app.js");
        server.middlewares.use(app);
      }
    }
  ]
});


