# Dokumentasi REST API — Asalynn Management Project

Dokumentasi lengkap rute REST API untuk aplikasi manajemen depot air minum dan pengantaran galon **Asalynn Depot**, disusun berdasarkan spesifikasi di [rencana-aplikasi.md](file:///c:/Users/Admin/Documents/AI%20Vibe%20coding/asalynn%20management%20project/rencana-aplikasi.md).

---

## 📌 Ketentuan Baku Operasional
- **Base URL**: `http://localhost:3001/api` (atau langsung `http://localhost:5173/api` saat menjalankan Vite dev server).
- **Zona Waktu Sistem**: **`Asia/Makassar` (WITA, UTC+8)**.
- **Autentikasi**: Header `x-user-id: <user-id>` atau `Authorization: Bearer <user-id>`.

---

## 🚀 Cara Menjalankan Server API

### Mode 1: Terintegrasi dengan Frontend Vite (Dev Mode)
API sudah otomatis terhubung ke Vite dev server melalui middleware di [vite.config.js](file:///c:/Users/Admin/Documents/AI%20Vibe%20coding/asalynn%20management%20project/vite.config.js):
```bash
npm run dev
```
Endpoint langsung aktif di `http://localhost:5173/api`.

### Mode 2: Server Mandiri (Standalone Node Server)
```bash
npm run server
```
Server berjalan di `http://localhost:3001/api`.

### Mode 3: Jalankan Pengujian Otomatis
```bash
node test-api.js
```

---

## 🗂️ Ringkasan Katalog Endpoint

| Modul | Method | Endpoint | Deskripsi |
| :--- | :--- | :--- | :--- |
| **System** | `GET` | `/api` | Health check & daftar modul endpoint |
| **Auth** | `GET` | `/api/auth/profiles` | Daftar profil untuk Quick Selector (Landing Page) |
| **Auth** | `POST` | `/api/auth/login` | Login dengan 4 Digit PIN (`userId` / `phone` + `pin`) |
| **Auth** | `GET` | `/api/auth/me` | Cek sesi profil aktif |
| **Auth** | `POST` | `/api/auth/logout` | Keluar dari sesi |
| **Users** | `GET` | `/api/users` | Daftar seluruh akun admin & kurir |
| **Users** | `GET` | `/api/users/:id` | Detail akun pengguna |
| **Users** | `POST` | `/api/users` | Tambah kurir / admin baru |
| **Users** | `PUT` | `/api/users/:id` | Perbarui data pengguna & kendaraan |
| **Users** | `DELETE` | `/api/users/:id` | Nonaktifkan akun (soft-delete) |
| **Customers** | `GET` | `/api/customers` | Daftar pelanggan (dukungan filter `?q=`) |
| **Customers** | `GET` | `/api/customers/:id` | Detail pelanggan & saldo galon/piutang |
| **Customers** | `POST` | `/api/customers` | Tambah pelanggan baru |
| **Customers** | `PUT` | `/api/customers/:id` | Edit info pelanggan |
| **Customers** | `DELETE` | `/api/customers/:id` | Hapus pelanggan |
| **Custom Prices** | `GET` | `/api/customers/:id/custom-prices` | Ambil harga khusus pelanggan |
| **Custom Prices** | `POST` | `/api/customers/:id/custom-prices` | Pasang/ubah harga khusus produk per pelanggan |
| **Custom Prices** | `DELETE` | `/api/customers/:id/custom-prices/:productId` | Hapus harga khusus (kembali ke tarif standar) |
| **Debt Settlement**| `POST` | `/api/customers/:id/pay-debt` | Catat pelunasan sisa bon/piutang pelanggan |
| **Products** | `GET` | `/api/products` | Katalog produk & harga standar |
| **Products** | `GET` | `/api/products/:id` | Detail produk |
| **Products** | `POST` | `/api/products` | Tambah produk baru |
| **Products** | `PUT` | `/api/products/:id` | Perbarui master data produk |
| **Products** | `DELETE` | `/api/products/:id` | Nonaktifkan produk |
| **Orders** | `GET` | `/api/orders` | Filter pesanan: `?date=`, `?courierId=`, `?status=`, `?q=` |
| **Orders** | `GET` | `/api/orders/:id` | Detail lengkap pesanan |
| **Orders** | `POST` | `/api/orders` | Buat pesanan baru (Price snapshotting & ID otomatis) |
| **Orders** | `PATCH` | `/api/orders/:id/assign` | Tugaskan pesanan ke kurir (`courierId`) |
| **Orders** | `PATCH` | `/api/orders/:id/status` | Ubah status antaran (`PENDING`, `ASSIGNED`, dll) |
| **Orders** | `POST` | `/api/orders/:id/complete` | Realisasi lapangan (barang aktual, galon kosong, bayar) |
| **Orders** | `POST` | `/api/orders/:id/cancel` | Batalkan pesanan (alasan tetap tersimpan) |
| **Payments** | `GET` | `/api/payments` | Riwayat pembayaran (filter `?date=`, `?orderId=`) |
| **Payments** | `POST` | `/api/payments` | Catat penerimaan kas manual |
| **Gallons** | `GET` | `/api/gallons/logs` | Buku mutasi fisik keluar-masuk galon pelanggan |
| **Gallons** | `POST` | `/api/gallons/adjust` | Penyesuaian saldo galon manual (rusak/hilang) |
| **Reports** | `GET` | `/api/reports/daily-summary` | Rekap harian (omzet, kas di tangan kurir, piutang baru) |
| **System** | `POST` | `/api/system/reset` | Reset database ke data seed default |
| **System** | `GET` | `/api/system/export` | Unduh backup JSON database |
| **System** | `POST` | `/api/system/import` | Pulihkan database dari JSON |

---

## 📖 Rincian Payload & Implementasi Aturan Bisnis

### 1. Autentikasi (`/api/auth/login`)
- **Request Body:**
  ```json
  {
    "userId": "usr-admin-1",
    "pin": "1234"
  }
  ```
- **Kredensial Bawaan:**
  - Owner: PIN `1234`
  - Daeng Rahmat: PIN `1111`
  - Andi Pratama: PIN `2222`

### 2. Pembuatan Pesanan (`POST /api/orders`)
- **Aturan Price Snapshot:** Harga satuan item mengunci harga berlaku pada saat order dibuat (menggunakan harga khusus jika pelanggan memilikinya, atau harga standar produk).
- **Request Body:**
  ```json
  {
    "customerId": "cust-1",
    "courierId": "usr-courier-1",
    "deliveryDate": "2026-10-04",
    "deliveryTimeSlot": "Pagi (08:30 - 10:00)",
    "items": [
      { "productId": "prod-refill-19l", "qtyOrdered": 4 }
    ],
    "emptyGallonsExpected": 4,
    "driverNotes": "Pintu pagar samping"
  }
  ```

### 3. Selesaikan Pengantaran di Lapangan (`POST /api/orders/:id/complete`)
- **Aturan Decoupled Status & Kesesuaian Lapangan:**
  - `qtyDeliveredMap`: Kurir mencatat barang aktual yang diterima di lokasi. Tagihan otomatis dihitung ulang sesuai barang aktual.
  - `emptyGallonsReturned`: Mengupdate mutasi buku galon dan saldo fisik galon pelanggan.
  - `paymentStatus`: Ditentukan mandiri (`PAID`, `PARTIAL`, atau `UNPAID`). Jika kurang bayar, sisa otomatis masuk ke `currentDebtBalance` pelanggan.
- **Request Body:**
  ```json
  {
    "qtyDeliveredMap": { "prod-refill-19l": 3 },
    "emptyGallonsReturned": 3,
    "amountPaid": 18000,
    "paymentMethod": "CASH",
    "driverNotes": "Diterima oleh kasir, galon kosong kembali 3"
  }
  ```

### 4. Laporan Rekap Harian (`GET /api/reports/daily-summary?date=YYYY-MM-DD`)
- **Response Format:**
  ```json
  {
    "success": true,
    "data": {
      "date": "2026-10-04",
      "timeZone": "Asia/Makassar (WITA, UTC+8)",
      "totalOrders": 5,
      "counts": {
        "delivered": 1,
        "onDelivery": 1,
        "assigned": 2,
        "pending": 1,
        "cancelled": 0
      },
      "gallons": {
        "totalDelivered": 4,
        "totalEmptyReturned": 4,
        "netDelta": 0
      },
      "finance": {
        "totalOmzetActual": 24000,
        "totalCashReceived": 24000,
        "totalTransferReceived": 0,
        "totalRevenueCollected": 24000,
        "totalNewDebt": 0
      },
      "courierCashTally": {
        "usr-courier-1": {
          "name": "Daeng Rahmat",
          "cashInHand": 24000,
          "ordersCompleted": 1
        }
      }
    }
  }
  ```
