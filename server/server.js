import { app } from "./app.js";

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Asalynn Depot API Server is running on http://localhost:${PORT}`);
  console.log(`📡 API Base: http://localhost:${PORT}/api`);
  console.log(`⏰ Timezone: Asia/Makassar (WITA, UTC+8)`);
});
