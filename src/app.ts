import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import path from "path";

import routes from "./routes";
// 1. IMPORT KONEKSI MONGO
import { connectMongo } from "./config/mongo"; 

dotenv.config();

const app: Application = express();

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(
  cors({
    origin: "*", 
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);

// Morgan untuk HTTP request logger (memunculkan log di terminal setiap ada request masuk)
app.use(morgan("dev"));

// Body parser untuk membaca data JSON dan URL-encoded dari request body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// 2. ROUTES
// ==========================================
// Rute untuk mengecek apakah server menyala (Health Check)
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    message: "Welcome to SISU API",
    status: "Running",
    version: "1.0.0",
  });
});

// Daftarkan semua rute API di bawah prefix '/api'
app.use("/api", routes);
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ==========================================
// 3. GLOBAL ERROR HANDLER
// ==========================================
// Menangkap request ke endpoint yang tidak terdaftar (404 Not Found)
app.use((req: Request, res: Response) => {
  res.status(404).json({ message: "Endpoint tidak ditemukan (404)" });
});

// Menangkap error internal server (500)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("[Error]:", err.stack);
  res.status(500).json({
    message: "Terjadi kesalahan pada server (500)",
    error: process.env.NODE_ENV === "development" ? err.message : {},
  });
});

// ==========================================
// 4. START SERVER & DATABASE
// ==========================================
const PORT = process.env.PORT || 8000;

  connectMongo();

app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`🚀 Server berjalan di: http://localhost:${PORT}`);
  console.log(`=================================`);
});

export default app;