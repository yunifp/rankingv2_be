import { Router } from "express";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";
import { getRankingExportData, getRankingResults, resetRanking, runRankingAndMatchmaking, setMundurPelamar } from "../controllers/ranking.controller";

const router = Router();
const pathMenu = "/rank"; 

// Hanya role yang punya akses UPDATE ke menu ranking yang bisa memicu tombol ini
router.post("/generate", verifyToken, requirePermission(pathMenu, "UPDATE"), runRankingAndMatchmaking);
router.get("/results", verifyToken, requirePermission(pathMenu, "READ"), getRankingResults);
router.post("/resign/:id", verifyToken, requirePermission(pathMenu, "UPDATE"), setMundurPelamar);
router.post("/reset", verifyToken, requirePermission(pathMenu, "DELETE"), resetRanking);
router.get("/export-all", verifyToken, requirePermission(pathMenu, "READ"), getRankingExportData);
export default router;