const path = require("path");
require("dotenv").config({ path: "./config.env" });
const express = require("express");

const cors = require("cors");
const compression = require("compression");
const helmet = require("helmet");
const morgan = require("morgan");
const DBConnection = require("./config/dbConnection");
const GlobelError = require("./middlewares/errorMeddlieware");
const { apiLimiter } = require("./middlewares/rateLimiters");
const ApiError = require("./utils/ApiError");
const router = require("./router");
const { webhookCheckout } = require("./services/orderServices");
// Connection DB
DBConnection();
const cloudinary = require("./utils/cloudinary");
const app = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(
  helmet({
    // The frontend is hosted separately; configure CSP at its document host after inventorying its asset origins.
    contentSecurityPolicy: false,
    hsts:
      process.env.NODE_ENV === "production"
        ? { maxAge: 31536000, includeSubDomains: false, preload: false }
        : false,
  }),
);

app.use(express.static(path.join(__dirname, "uploads")));
const allowedOrigins = new Set([
  ...(process.env.CLIENT_URL ? [new URL(process.env.CLIENT_URL).origin] : []),
  ...(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => new URL(origin).origin),
  ...(process.env.NODE_ENV === "production"
    ? []
    : ["http://localhost:5173", "http://127.0.0.1:5173"]),
]);
if (process.env.NODE_ENV === "production" && allowedOrigins.size === 0) {
  throw new Error("Set CLIENT_URL or CORS_ORIGINS for production.");
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      return callback(new ApiError("هذا النطاق غير مسموح بالاتصال بالخادم", 403));
    },
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: false,
  }),
);
// app.options("*", cors());

app.use(compression());
app.use("/api/v1", apiLimiter);

// CheckOut WebHook
app.post(
  "/webhook-checkout",
  express.raw({ type: "application/json" }),
  webhookCheckout,
);
app.use(express.json());
app.use("/api/v1", router);
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
  console.log(`Mode : ${process.env.NODE_ENV}`);
} else {
  console.log(`Mode : ${process.env.NODE_ENV}`);
}

app.get("/", (req, res) => {
  res.send("Home Page");
});
app.all("*", (req, res, next) => {
  next(new ApiError(`المسار المطلوب غير موجود: ${req.originalUrl}`, 404));
});
// Get error handling middleware
app.use(GlobelError);
const Port = process.env.PORT || 5000;

const server = app.listen(Port, () => {
  console.log(`Server Running with server ${Port}`);
});

// خاصه بل ايرور خارج ال express
process.on("unhandledRejection", (err) => {
  // consloe.error(`UnhandledRejection Error : ${err.name} | ${err.message}`);
  // بتوقف السيرفر و بظهر الخطا يلي خارج ال express
  server.close(() => {
    process.exit(1);
  });
});
