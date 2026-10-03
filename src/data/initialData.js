// Data Awal Realistis untuk Depot Air Minum Asalynn
// Zona Waktu: Asia/Makassar (WITA, UTC+8)

export const INITIAL_DATA = {
  users: [
    {
      id: "usr-admin-1",
      name: "Hj. Asmawati (Owner)",
      phone: "081234567890",
      role: "admin",
      pin: "1234",
      isActive: true
    },
    {
      id: "usr-courier-1",
      name: "Daeng Rahmat",
      phone: "082198765432",
      role: "courier",
      pin: "1111",
      isActive: true,
      vehicle: "Motor Roda Tiga (Tossa)"
    },
    {
      id: "usr-courier-2",
      name: "Andi Pratama",
      phone: "085345678901",
      role: "courier",
      pin: "2222",
      isActive: true,
      vehicle: "Sepeda Motor Obrok"
    }
  ],

  products: [
    {
      id: "prod-refill-19l",
      name: "Refill Air Galon 19L Asalynn",
      code: "RFL-19",
      standardPrice: 7000,
      description: "Air minum isi ulang higienis proses filter 8 tahap & ozonisasi",
      unit: "Galon",
      isActive: true
    },
    {
      id: "prod-new-gallon-19l",
      name: "Galon Baru + Air 19L",
      code: "GLN-NEW",
      standardPrice: 45000,
      description: "Galon PET food grade baru tebal lengkap dengan isi air Asalynn",
      unit: "Galon",
      isActive: true
    },
    {
      id: "prod-cup-dus",
      name: "Air Mineral Gelas Asalynn (Dus 48x220ml)",
      code: "CUP-48",
      standardPrice: 19000,
      description: "Dus air kemasan gelas cocok untuk acara & warung",
      unit: "Dus",
      isActive: true
    },
    {
      id: "prod-bottle-600",
      name: "Air Mineral Botol 600ml (Dus 24 botol)",
      code: "BTL-600",
      standardPrice: 35000,
      description: "Air kemasan botol praktis untuk kantor & hajatan",
      unit: "Dus",
      isActive: true
    },
    {
      id: "prod-cap-seal",
      name: "Tutup Galon & Tisu Higienis (Paket Ekstra)",
      code: "SEAL-PK",
      standardPrice: 2000,
      description: "Tutup ekstra anti-bocor dan tisu pembersih mulut galon",
      unit: "Set",
      isActive: true
    }
  ],

  customers: [
    {
      id: "cust-1",
      name: "Warung Coto Daeng Tata",
      phone: "081299887766",
      address: "Jl. Daeng Tata Raya No. 45, Parang Tambung, Makassar",
      addressNotes: "Samping Masjid Nurul Huda, masuk lorong kedua gerbang cat hijau",
      currentGallonBalance: 6, // 6 galon depot sedang berada di warung ini
      currentDebtBalance: 0,
      customPrices: {
        "prod-refill-19l": 6000 // Harga khusus langganan borongan
      },
      createdAt: "2026-09-15"
    },
    {
      id: "cust-2",
      name: "Ibu Hj. Rosdiana (BTP)",
      phone: "085244332211",
      address: "Perumahan Bumi Tamalanrea Permai (BTP) Blok M No. 12, Makassar",
      addressNotes: "Rumah pagar hitam tingkat dua, ada pohon mangga",
      currentGallonBalance: 3,
      currentDebtBalance: 14000, // Ada sisa piutang tempo minggu lalu
      customPrices: {},
      createdAt: "2026-09-20"
    },
    {
      id: "cust-3",
      name: "Kos Putri Lavender (Ibu Melati)",
      phone: "087811223344",
      address: "Jl. Sahabat No. 18, Dekat Kampus Unhas Tamalanrea, Makassar",
      addressNotes: "Pagar putih tinggi, bel pintu ada di sebelah kanan gerbang",
      currentGallonBalance: 8,
      currentDebtBalance: 0,
      customPrices: {
        "prod-refill-19l": 6500
      },
      createdAt: "2026-09-25"
    },
    {
      id: "cust-4",
      name: "Resto Seafood Paotere (Pak Basri)",
      phone: "081377665544",
      address: "Kawasan Wisata Bahari Paotere No. 7, Ujung Pandang, Makassar",
      addressNotes: "Dapur belakang resto, masuk lewat jalan samping parkiran",
      currentGallonBalance: 12,
      currentDebtBalance: 0,
      customPrices: {
        "prod-refill-19l": 6000,
        "prod-cup-dus": 18000
      },
      createdAt: "2026-09-28"
    },
    {
      id: "cust-5",
      name: "Keluarga Bpk. Irwan",
      phone: "082155667788",
      address: "Jl. AP Pettarani Komp. IDI Blok GA/8, Panakkukang, Makassar",
      addressNotes: "Rumah cat krem dekat pos security",
      currentGallonBalance: 2,
      currentDebtBalance: 0,
      customPrices: {},
      createdAt: "2026-10-01"
    }
  ],

  // Tanggal default hari ini dalam format YYYY-MM-DD WITA
  getInitialOrders: (todayDateStr) => [
    {
      id: "ORD-20261004-001",
      customerId: "cust-1",
      customerName: "Warung Coto Daeng Tata",
      customerPhone: "081299887766",
      customerAddress: "Jl. Daeng Tata Raya No. 45, Parang Tambung, Makassar",
      addressNotes: "Samping Masjid Nurul Huda, masuk lorong kedua gerbang cat hijau",
      courierId: "usr-courier-1",
      courierName: "Daeng Rahmat",
      deliveryDate: todayDateStr,
      deliveryTimeSlot: "Pagi (08:30 - 10:00)",
      deliveryStatus: "DELIVERED",
      paymentStatus: "PAID",
      items: [
        {
          productId: "prod-refill-19l",
          productName: "Refill Air Galon 19L Asalynn",
          unitPrice: 6000, // Pakai harga khusus langganan
          qtyOrdered: 4,
          qtyDelivered: 4
        }
      ],
      emptyGallonsExpected: 4,
      emptyGallonsReturned: 4,
      subtotalOrdered: 24000,
      subtotalActual: 24000,
      totalPaid: 24000,
      paymentMethod: "CASH",
      driverNotes: "Sudah diantar ke meja kasir, galon kosong diambil pas 4 buah.",
      deliveredAt: `${todayDateStr}T09:15:00+08:00`,
      createdAt: `${todayDateStr}T08:00:00+08:00`
    },
    {
      id: "ORD-20261004-002",
      customerId: "cust-3",
      customerName: "Kos Putri Lavender (Ibu Melati)",
      customerPhone: "087811223344",
      customerAddress: "Jl. Sahabat No. 18, Dekat Kampus Unhas Tamalanrea, Makassar",
      addressNotes: "Pagar putih tinggi, bel pintu ada di sebelah kanan gerbang",
      courierId: "usr-courier-1",
      courierName: "Daeng Rahmat",
      deliveryDate: todayDateStr,
      deliveryTimeSlot: "Pagi (10:00 - 11:30)",
      deliveryStatus: "ON_DELIVERY",
      paymentStatus: "UNPAID",
      items: [
        {
          productId: "prod-refill-19l",
          productName: "Refill Air Galon 19L Asalynn",
          unitPrice: 6500,
          qtyOrdered: 3,
          qtyDelivered: 3
        }
      ],
      emptyGallonsExpected: 3,
      emptyGallonsReturned: 0,
      subtotalOrdered: 19500,
      subtotalActual: 19500,
      totalPaid: 0,
      paymentMethod: "CASH",
      driverNotes: "Sedang dalam perjalanan ke kos Unhas",
      createdAt: `${todayDateStr}T09:00:00+08:00`
    },
    {
      id: "ORD-20261004-003",
      customerId: "cust-2",
      customerName: "Ibu Hj. Rosdiana (BTP)",
      customerPhone: "085244332211",
      customerAddress: "Perumahan Bumi Tamalanrea Permai (BTP) Blok M No. 12, Makassar",
      addressNotes: "Rumah pagar hitam tingkat dua, ada pohon mangga",
      courierId: "usr-courier-2",
      courierName: "Andi Pratama",
      deliveryDate: todayDateStr,
      deliveryTimeSlot: "Siang (13:00 - 14:30)",
      deliveryStatus: "ASSIGNED",
      paymentStatus: "UNPAID",
      items: [
        {
          productId: "prod-refill-19l",
          productName: "Refill Air Galon 19L Asalynn",
          unitPrice: 7000,
          qtyOrdered: 2,
          qtyDelivered: 2
        }
      ],
      emptyGallonsExpected: 2,
      emptyGallonsReturned: 0,
      subtotalOrdered: 14000,
      subtotalActual: 14000,
      totalPaid: 0,
      paymentMethod: "CASH",
      driverNotes: "Jangan lupa sekalian tagih sisa nota lama Rp 14.000 jika memungkinkan",
      createdAt: `${todayDateStr}T09:30:00+08:00`
    },
    {
      id: "ORD-20261004-004",
      customerId: "cust-4",
      customerName: "Resto Seafood Paotere (Pak Basri)",
      customerPhone: "081377665544",
      customerAddress: "Kawasan Wisata Bahari Paotere No. 7, Ujung Pandang, Makassar",
      addressNotes: "Dapur belakang resto, masuk lewat jalan samping parkiran",
      courierId: "usr-courier-2",
      courierName: "Andi Pratama",
      deliveryDate: todayDateStr,
      deliveryTimeSlot: "Siang (14:30 - 16:00)",
      deliveryStatus: "ASSIGNED",
      paymentStatus: "UNPAID",
      items: [
        {
          productId: "prod-refill-19l",
          productName: "Refill Air Galon 19L Asalynn",
          unitPrice: 6000,
          qtyOrdered: 5,
          qtyDelivered: 5
        },
        {
          productId: "prod-cup-dus",
          productName: "Air Mineral Gelas Asalynn (Dus 48x220ml)",
          unitPrice: 18000,
          qtyOrdered: 2,
          qtyDelivered: 2
        }
      ],
      emptyGallonsExpected: 5,
      emptyGallonsReturned: 0,
      subtotalOrdered: 66000,
      subtotalActual: 66000,
      totalPaid: 0,
      paymentMethod: "TRANSFER",
      driverNotes: "Nota diserahkan ke bagian kasir dapur",
      createdAt: `${todayDateStr}T10:15:00+08:00`
    },
    {
      id: "ORD-20261004-005",
      customerId: "cust-5",
      customerName: "Keluarga Bpk. Irwan",
      customerPhone: "082155667788",
      customerAddress: "Jl. AP Pettarani Komp. IDI Blok GA/8, Panakkukang, Makassar",
      addressNotes: "Rumah cat krem dekat pos security",
      courierId: null,
      courierName: "Belum Ditugaskan",
      deliveryDate: todayDateStr,
      deliveryTimeSlot: "Sore (16:00 - 17:30)",
      deliveryStatus: "PENDING",
      paymentStatus: "UNPAID",
      items: [
        {
          productId: "prod-refill-19l",
          productName: "Refill Air Galon 19L Asalynn",
          unitPrice: 7000,
          qtyOrdered: 2,
          qtyDelivered: 2
        },
        {
          productId: "prod-new-gallon-19l",
          productName: "Galon Baru + Air 19L",
          unitPrice: 45000,
          qtyOrdered: 1,
          qtyDelivered: 1
        }
      ],
      emptyGallonsExpected: 2, // Karena 1 galon baru tanpa tukar galon kosong
      emptyGallonsReturned: 0,
      subtotalOrdered: 59000,
      subtotalActual: 59000,
      totalPaid: 0,
      paymentMethod: "CASH",
      driverNotes: "",
      createdAt: `${todayDateStr}T10:45:00+08:00`
    }
  ]
};
