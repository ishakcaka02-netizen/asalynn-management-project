// API Client Service - Asalynn Management Project
// Menghubungkan antarmuka frontend ke backend REST API (/api/*)

const API_BASE = "/api";

class ApiClient {
  constructor() {
    this.token = localStorage.getItem("asalynn_api_token") || null;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem("asalynn_api_token", token);
    } else {
      localStorage.removeItem("asalynn_api_token");
    }
  }

  async request(endpoint, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(this.token ? { "x-user-id": this.token, Authorization: `Bearer ${this.token}` } : {}),
      ...(options.headers || {})
    };

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, config);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }
      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  }

  // === AUTHENTICATION ===
  auth = {
    getProfiles: () => this.request("/auth/profiles"),
    login: (userId, pin) => this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ userId, pin })
    }).then(res => {
      if (res.token) this.setToken(res.token);
      return res;
    }),
    getMe: () => this.request("/auth/me"),
    logout: () => {
      this.setToken(null);
      return this.request("/auth/logout", { method: "POST" });
    }
  };

  // === USERS & COURIERS ===
  users = {
    getAll: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return this.request(`/users${query ? `?${query}` : ""}`);
    },
    getById: (id) => this.request(`/users/${id}`),
    create: (userData) => this.request("/users", {
      method: "POST",
      body: JSON.stringify(userData)
    }),
    update: (id, userData) => this.request(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(userData)
    }),
    delete: (id) => this.request(`/users/${id}`, { method: "DELETE" })
  };

  // === PRODUCTS ===
  products = {
    getAll: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return this.request(`/products${query ? `?${query}` : ""}`);
    },
    getById: (id) => this.request(`/products/${id}`),
    create: (data) => this.request("/products", {
      method: "POST",
      body: JSON.stringify(data)
    }),
    update: (id, data) => this.request(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    }),
    delete: (id) => this.request(`/products/${id}`, { method: "DELETE" })
  };

  // === CUSTOMERS ===
  customers = {
    getAll: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return this.request(`/customers${query ? `?${query}` : ""}`);
    },
    getById: (id) => this.request(`/customers/${id}`),
    create: (data) => this.request("/customers", {
      method: "POST",
      body: JSON.stringify(data)
    }),
    update: (id, data) => this.request(`/customers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    }),
    delete: (id) => this.request(`/customers/${id}`, { method: "DELETE" }),
    getCustomPrices: (customerId) => this.request(`/customers/${customerId}/custom-prices`),
    setCustomPrice: (customerId, productId, customPrice) => this.request(`/customers/${customerId}/custom-prices`, {
      method: "POST",
      body: JSON.stringify({ productId, customPrice })
    }),
    deleteCustomPrice: (customerId, productId) => this.request(`/customers/${customerId}/custom-prices/${productId}`, {
      method: "DELETE"
    }),
    payDebt: (customerId, { amount, paymentMethod, notes, collectedBy }) => this.request(`/customers/${customerId}/pay-debt`, {
      method: "POST",
      body: JSON.stringify({ amount, paymentMethod, notes, collectedBy })
    })
  };

  // === ORDERS ===
  orders = {
    getAll: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return this.request(`/orders${query ? `?${query}` : ""}`);
    },
    getById: (id) => this.request(`/orders/${id}`),
    create: (orderData) => this.request("/orders", {
      method: "POST",
      body: JSON.stringify(orderData)
    }),
    assignCourier: (orderId, courierId) => this.request(`/orders/${orderId}/assign`, {
      method: "PATCH",
      body: JSON.stringify({ courierId })
    }),
    updateStatus: (orderId, deliveryStatus) => this.request(`/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ deliveryStatus })
    }),
    completeDelivery: (orderId, completionData) => this.request(`/orders/${orderId}/complete`, {
      method: "POST",
      body: JSON.stringify(completionData)
    }),
    cancelOrder: (orderId, cancellationReason) => this.request(`/orders/${orderId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ cancellationReason })
    })
  };

  // === PAYMENTS ===
  payments = {
    getAll: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return this.request(`/payments${query ? `?${query}` : ""}`);
    },
    create: (paymentData) => this.request("/payments", {
      method: "POST",
      body: JSON.stringify(paymentData)
    })
  };

  // === GALLON LOGS ===
  gallons = {
    getLogs: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return this.request(`/gallons/logs${query ? `?${query}` : ""}`);
    },
    adjust: (adjustmentData) => this.request("/gallons/adjust", {
      method: "POST",
      body: JSON.stringify(adjustmentData)
    })
  };

  // === REPORTS ===
  reports = {
    getDailySummary: (date) => this.request(`/reports/daily-summary${date ? `?date=${encodeURIComponent(date)}` : ""}`)
  };

  // === SYSTEM ===
  system = {
    reset: () => this.request("/system/reset", { method: "POST" }),
    export: () => fetch(`${API_BASE}/system/export`).then(r => r.json()),
    import: (data) => this.request("/system/import", {
      method: "POST",
      body: JSON.stringify(data)
    })
  };
}

export const api = new ApiClient();
