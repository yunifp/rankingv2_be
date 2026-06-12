import { Router } from "express";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";
import { getDashboardStats } from "../controllers/dashboard.controller";

const router = Router();
const pathMenu = "/dashboard"; // Pastikan path ini terdaftar di database menu kamu

router.get("/stats", verifyToken, requirePermission(pathMenu, "READ"), getDashboardStats);

export default router;