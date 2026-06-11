import { Router } from "express";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";
import { runRankingAndMatchmaking } from "../controllers/ranking.controller";

const router = Router();
const pathMenu = "/rank"; 

// Hanya role yang punya akses UPDATE ke menu ranking yang bisa memicu tombol ini
router.post("/generate", verifyToken, requirePermission(pathMenu, "UPDATE"), runRankingAndMatchmaking);

export default router;