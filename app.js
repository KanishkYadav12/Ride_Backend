const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const cors = require("cors");
const app = express();
const cookieParser = require("cookie-parser");
const userRoutes = require("./routes/user.routes");
const captainRoutes = require("./routes/captain.routes");
const mapsRoutes = require("./routes/maps.routes");
const rideRoutes = require("./routes/ride.routes");

// CORS Configuration
const allowedOrigins = [
  "http://localhost:5173",
  "https://ride-handling.vercel.app",
  "https://ride-frontend-self.vercel.app",
  "https://ride-frontend-kanishk-yadavs-projects.vercel.app",
];

const normalizeOrigin = (origin) => origin?.replace(/\/+$/, "").toLowerCase();

const isVercelPreview = (origin) => {
  if (!origin) return false;

  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
};

const corsOptions = {
  origin: function (origin, callback) {
    const normalizedOrigin = normalizeOrigin(origin);
    const isAllowedOrigin =
      !normalizedOrigin ||
      allowedOrigins.some(
        (allowed) => normalizeOrigin(allowed) === normalizedOrigin,
      ) ||
      isVercelPreview(normalizedOrigin);

    // allow requests with no origin (like Postman, curl)
    if (isAllowedOrigin) {
      callback(null, true);
    } else {
      console.warn(`Blocked by CORS: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.use("/users", userRoutes);
app.use("/captains", captainRoutes);
app.use("/maps", mapsRoutes);
app.use("/rides", rideRoutes);

module.exports = app;
