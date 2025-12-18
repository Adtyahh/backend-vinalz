const express = require("express");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const initializeUploadDirectories = require("./utils/initUploads");
const { errorHandler, notFound } = require("./utils/errorHandler");
const { testConnection } = require("./config/supabase");

// Import routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const bapbRoutes = require("./routes/bapbRoutes");
const bappRoutes = require("./routes/bappRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const documentRoutes = require("./routes/documentRoutes");

const app = express();

initializeUploadDirectories();

// Mengamankan HTTP headers (Helmet)
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// Membatasi jumlah request dari satu IP (Rate Limiting)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 100,
  standardHeaders: true, // Menggunakan header `RateLimit-*`
  legacyHeaders: false, // Nonaktifkan header `X-RateLimit-*`
  message: {
    success: false,
    message: "Terlalu banyak permintaan dari IP ini, silakan coba lagi setelah 15 menit.",
  },
});

app.use("/api", limiter);

// Middleware Standar
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/docs", express.static(path.join(__dirname, "..", "docs")));

// Static files
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// Serve static documentation
app.use("/docs", express.static(path.join(__dirname, "..", "docs")));

// Health check
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "BA Digital API is running",
    version: "1.0.0",
    documentation: `${req.protocol}://${req.get("host")}/docs`,
    endpoints: {
      auth: "/api/auth",
      users: "/api/users",
      bapb: "/api/bapb",
      bapp: "/api/bapp",
      notifications: "/api/notifications",
      payment: "/api/payment",
      documents: "/api/documents",
    },
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/bapb", bapbRoutes);
app.use("/api/bapp", bappRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/documents", documentRoutes);

// Error handlers
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Test DB connection and start server
const startServer = async () => {
  try {
    // Test Supabase connection
    const connected = await testConnection();

    if (!connected) {
      console.error("❌ Failed to connect to Supabase");
      process.exit(1);
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`🔗 API Base URL: http://localhost:${PORT}`);
      console.log(`✅ Connected to Supabase`);
      console.log(`pV Security: Helmet & Rate Limiting Enabled`);
    });
  } catch (err) {
    console.error("❌ Unable to start server:", err);
    process.exit(1);
  }
};

startServer();

module.exports = app;
